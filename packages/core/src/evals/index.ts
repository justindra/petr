import type { DatasetRow, EvalConfig, EvalResult, LLMContext, Logger } from '../types.js';
import { runBoolean } from './boolean.js';
import { runContains } from './contains.js';
import { runCustom } from './custom.js';
import { runEquals } from './equals.js';
import { runRegex } from './regex.js';
import { runWithinN } from './within-n.js';

export interface RunEvalsDeps {
  llm: LLMContext;
  logger: Logger;
  baseDir: string;
}

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

export { runBoolean, runContains, runCustom, runEquals, runRegex, runWithinN };
