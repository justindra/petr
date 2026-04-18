import type { BooleanEvalConfig, DatasetRow, EvalResult } from '../types.js';
import { resolveActual, resolveExpected } from './path.js';

export function runBoolean(cfg: BooleanEvalConfig, actual: unknown, row: DatasetRow): EvalResult {
  const a = coerceBool(resolveActual(cfg, actual));
  const e = coerceBool(resolveExpected(cfg, row));
  if (a === null) {
    return {
      name: cfg.name,
      pass: false,
      score: 0,
      detail: `actual is not a boolean-ish value (got ${String(resolveActual(cfg, actual))})`,
    };
  }
  if (e === null) {
    return {
      name: cfg.name,
      pass: false,
      score: 0,
      detail: `expected is not a boolean-ish value (got ${String(resolveExpected(cfg, row))})`,
    };
  }
  const pass = a === e;
  const base: EvalResult = { name: cfg.name, pass, score: pass ? 1 : 0 };
  if (!pass) base.detail = `expected ${e}, got ${a}`;
  return base;
}

function coerceBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(s)) return true;
    if (['false', 'no', 'n', '0'].includes(s)) return false;
  }
  return null;
}
