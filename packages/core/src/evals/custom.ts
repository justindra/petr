import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  CustomEvalConfig,
  DatasetRow,
  EvalFn,
  EvalFnArgs,
  EvalResult,
  LLMContext,
  Logger,
} from '../types';

const moduleCache = new Map<string, EvalFn>();

async function loadCustomEval(cfg: CustomEvalConfig, baseDir: string): Promise<EvalFn> {
  const absPath = path.isAbsolute(cfg.file) ? cfg.file : path.resolve(baseDir, cfg.file);
  const cached = moduleCache.get(absPath);
  if (cached) return cached;
  const url = pathToFileURL(absPath).href;
  const mod = (await import(url)) as { default?: EvalFn };
  if (typeof mod.default !== 'function') {
    throw new Error(`Custom eval at ${cfg.file} must have a default export (async function)`);
  }
  moduleCache.set(absPath, mod.default);
  return mod.default;
}

export async function runCustom(
  cfg: CustomEvalConfig,
  baseDir: string,
  actual: unknown,
  row: DatasetRow,
  deps: { llm: LLMContext; logger: Logger },
): Promise<EvalResult> {
  const fn = await loadCustomEval(cfg, baseDir);
  const args: EvalFnArgs = {
    actual,
    expected: row.expected,
    row,
    ctx: deps,
  };
  const result = await fn(args);
  const out: EvalResult = { name: cfg.name, pass: !!result.pass };
  if (result.score !== undefined) out.score = result.score;
  if (result.detail !== undefined) out.detail = result.detail;
  return out;
}
