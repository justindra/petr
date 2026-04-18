import type { DatasetRow, EvalConfig, EvalResult, LLMContext, Logger } from '../types';
import { runBoolean } from './boolean';
import { runContains } from './contains';
import { runCustom } from './custom';
import { runEquals } from './equals';
import { runRegex } from './regex';
import { runWithinN } from './within-n';

/** Shared context for eval dispatch — the runner builds one per row. */
export interface RunEvalsDeps {
  llm: LLMContext;
  logger: Logger;
  /** Base directory for resolving `custom` eval file paths. */
  baseDir: string;
}

/**
 * Runs every eval in `configs` against a single prompt output and returns the
 * results in order. Evals execute sequentially so order-dependent custom evals
 * can rely on earlier results being available in logs.
 */
export async function runEvals(
  configs: EvalConfig[],
  actual: unknown,
  row: DatasetRow,
  deps: RunEvalsDeps,
): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  for (const cfg of configs) {
    results.push(await runSingleEval(cfg, actual, row, deps));
  }
  return results;
}

async function runSingleEval(
  cfg: EvalConfig,
  actual: unknown,
  row: DatasetRow,
  deps: RunEvalsDeps,
): Promise<EvalResult> {
  switch (cfg.type) {
    case 'equals':
      return runEquals(cfg, actual, row);
    case 'contains':
      return runContains(cfg, actual, row);
    case 'regex':
      return runRegex(cfg, actual, row);
    case 'withinN':
      return runWithinN(cfg, actual, row);
    case 'boolean':
      return runBoolean(cfg, actual, row);
    case 'custom':
      return runCustom(cfg, deps.baseDir, actual, row, {
        llm: deps.llm,
        logger: deps.logger,
      });
  }
}
