import path from 'node:path';
import { resolveRelativeToConfig } from './config';
import { buildLLMContext, type LLMSession } from './context';
import { readDataset } from './dataset';
import { runEvals } from './evals';
import { importUserModule } from './import-user-module';
import { consoleLogger } from './logger';
import { generateRunId, hashConfig, tryGitSha } from './manifest';
import { estimateCostUsd } from './providers/pricing';
import type {
  DatasetRow,
  EvalResult,
  Logger,
  ModelConfig,
  PromptFn,
  ResolvedSuiteConfig,
  RowResult,
  RunContext,
  RunManifest,
} from './types';

/** Arguments to {@link runSuite}. */
export interface RunSuiteOptions {
  /**
   * A variant-resolved suite config — pass the output of `resolveVariant(suite, name)`.
   * Using `ResolvedSuiteConfig` at this boundary makes it a type error to try
   * running an unresolved multi-variant suite against a single-shot runner.
   */
  config: ResolvedSuiteConfig;
  /** Directory to resolve `config.dataset` and `config.prompt` against. */
  baseDir: string;
  /** Overrides `config.concurrency`. Default: 4. */
  concurrency?: number;
  /** Overrides `config.maxRetries`. Default: 3. */
  maxRetries?: number;
  /** If set, runs only the first N rows of the dataset. Handy for iteration. */
  limit?: number;
  /** Custom logger; defaults to a console logger tagged with the run id. */
  logger?: Logger;
  /** Called after each row finishes — even failed ones. */
  onRow?: (row: RowResult, totalRows: number) => void;
  /**
   * Seam for tests: replaces {@link buildLLMContext} so no real provider calls
   * happen. Each row gets its own session via this factory.
   */
  buildSession?: (cfg: ModelConfig) => LLMSession;
  /** Seam for tests: replaces the default dynamic import of the prompt file. */
  loadPrompt?: (path: string) => Promise<PromptFn>;
}

/** Return value of {@link runSuite}. */
export interface RunSuiteResult {
  manifest: RunManifest;
  /** Ordered to match the dataset order, regardless of completion order. */
  results: RowResult[];
}

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Runs a suite against its dataset. Each row is executed in parallel up to
 * `concurrency`; transient failures retry with exponential backoff up to
 * `maxRetries`. A row that exhausts its retries is captured as an error row
 * and doesn't stop the rest of the run.
 *
 * This is the core entry point for programmatic use — the `petr run` CLI is
 * a thin wrapper over it + {@link writeRunArtifacts}.
 */
export async function runSuite(opts: RunSuiteOptions): Promise<RunSuiteResult> {
  const {
    config,
    baseDir,
    concurrency = config.concurrency ?? DEFAULT_CONCURRENCY,
    maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES,
    limit,
    buildSession = buildLLMContext,
    loadPrompt = defaultLoadPrompt,
  } = opts;

  const datasetPath = resolveRelativeToConfig(baseDir, config.dataset);
  const promptPath = resolveRelativeToConfig(baseDir, config.prompt);

  const allRows = await readDataset(datasetPath);
  const rows = typeof limit === 'number' ? allRows.slice(0, limit) : allRows;
  const promptFn = await loadPrompt(promptPath);

  const runId = generateRunId(`${config.name}_${config.variantName}`);
  const startedAt = new Date();
  const logger = opts.logger ?? consoleLogger(runId);

  logger.info('starting run', {
    runId,
    variant: config.variantName,
    rows: rows.length,
    concurrency,
    model: `${config.model.provider}:${config.model.id}`,
  });

  const indexById = new Map(rows.map((r, i) => [r.id, i]));
  const results: RowResult[] = new Array(rows.length) as RowResult[];

  await runWithConcurrency(rows, concurrency, async (row) => {
    const rowLogger = childLogger(logger, `row:${row.id}`);
    const result = await runRow({
      row,
      promptFn,
      config,
      baseDir,
      maxRetries,
      buildSession,
      logger: rowLogger,
    });
    const idx = indexById.get(row.id) ?? 0;
    results[idx] = result;
    opts.onRow?.(result, rows.length);
    rowLogger.info('row done', {
      pass: result.pass,
      latencyMs: result.latencyMs,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    });
  });

  const endedAt = new Date();
  const totalTokensIn = results.reduce((a, r) => a + r.tokensIn, 0);
  const totalTokensOut = results.reduce((a, r) => a + r.tokensOut, 0);
  const manifest: RunManifest = {
    name: config.name,
    variantName: config.variantName,
    runId,
    baseDir,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    configHash: hashConfig(config),
    gitSha: tryGitSha(baseDir),
    model: config.model,
    datasetPath: path.relative(baseDir, datasetPath) || datasetPath,
    promptPath: path.relative(baseDir, promptPath) || promptPath,
    rowCount: results.length,
    passCount: results.filter((r) => r.pass).length,
    totalTokensIn,
    totalTokensOut,
    estimatedCostUsd: estimateCostUsd(config.model, totalTokensIn, totalTokensOut),
  };

  logger.info('run complete', {
    runId,
    passed: manifest.passCount,
    total: manifest.rowCount,
    tokensIn: manifest.totalTokensIn,
    tokensOut: manifest.totalTokensOut,
  });

  return { manifest, results };
}

interface RunRowArgs {
  row: DatasetRow;
  promptFn: PromptFn;
  config: ResolvedSuiteConfig;
  baseDir: string;
  maxRetries: number;
  buildSession: (cfg: ModelConfig) => LLMSession;
  logger: Logger;
}

async function runRow(args: RunRowArgs): Promise<RowResult> {
  const { row, promptFn, config, baseDir, maxRetries, buildSession, logger } = args;
  const session = buildSession(config.model);
  const ctx: RunContext = { llm: session.llm, row, logger };

  const startedAt = Date.now();
  let output: unknown = null;
  let error: string | null = null;
  try {
    output = await retry(() => promptFn(row.input, ctx), maxRetries, logger);
  } catch (err) {
    error = (err as Error).message ?? String(err);
    logger.error('prompt failed', { error });
  }

  const latencyMs = Date.now() - startedAt;
  const usage = session.getUsage();
  const transcript = session.getTranscript();

  let evalResults: EvalResult[] = [];
  if (error === null) {
    try {
      evalResults = await runEvals(config.evals, output, row, {
        llm: session.llm,
        logger,
        baseDir,
      });
    } catch (err) {
      error = `eval error: ${(err as Error).message}`;
      logger.error('eval failed', { error });
    }
  }

  return {
    id: row.id,
    input: row.input,
    expected: row.expected ?? null,
    output,
    error,
    evals: evalResults,
    pass: error === null && evalResults.length > 0 && evalResults.every((e) => e.pass),
    latencyMs,
    tokensIn: usage.inputTokens,
    tokensOut: usage.outputTokens,
    transcript,
  };
}

async function retry<T>(fn: () => Promise<T>, maxRetries: number, logger: Logger): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= maxRetries) break;
      const delay = Math.min(30_000, 250 * Math.pow(2, attempt));
      logger.warn('retrying', {
        attempt: attempt + 1,
        delayMs: delay,
        error: (err as Error).message,
      });
      await sleep(delay);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const concurrency = Math.max(1, limit);
  let cursor = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      const item = items[idx];
      if (item === undefined) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function defaultLoadPrompt(promptPath: string): Promise<PromptFn> {
  const mod = await importUserModule<{ default?: PromptFn }>(promptPath);
  if (typeof mod.default !== 'function') {
    throw new Error(`Prompt file at ${promptPath} must have a default export`);
  }
  return mod.default;
}

function childLogger(parent: Logger, tag: string): Logger {
  const prefix = `[${tag}] `;
  return {
    info: (msg, meta) => parent.info(`${prefix}${msg}`, meta),
    warn: (msg, meta) => parent.warn(`${prefix}${msg}`, meta),
    error: (msg, meta) => parent.error(`${prefix}${msg}`, meta),
    debug: (msg, meta) => parent.debug(`${prefix}${msg}`, meta),
  };
}
