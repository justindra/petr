import type { DatasetRow, EvalResult, RegexEvalConfig } from '../types.js';
import { resolveActual } from './path.js';

export function runRegex(cfg: RegexEvalConfig, actual: unknown, _row: DatasetRow): EvalResult {
  const target = toStr(resolveActual(cfg, actual));
  let re: RegExp;
  try {
    re = new RegExp(cfg.pattern, cfg.flags);
  } catch (err) {
    return {
      name: cfg.name,
      pass: false,
      score: 0,
      detail: `invalid regex: ${(err as Error).message}`,
    };
  }
  const pass = re.test(target);
  const base: EvalResult = { name: cfg.name, pass, score: pass ? 1 : 0 };
  if (!pass) base.detail = `output did not match /${cfg.pattern}/${cfg.flags ?? ''}`;
  return base;
}

function toStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}
