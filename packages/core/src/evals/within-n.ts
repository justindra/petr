import type { DatasetRow, EvalResult, WithinNEvalConfig } from '../types.js';
import { resolveActual, resolveExpected } from './path.js';

export function runWithinN(cfg: WithinNEvalConfig, actual: unknown, row: DatasetRow): EvalResult {
  const a = toNumber(resolveActual(cfg, actual));
  const e = toNumber(resolveExpected(cfg, row));
  if (a === null || e === null) {
    return {
      name: cfg.name,
      pass: false,
      score: 0,
      detail: `non-numeric value (actual=${String(resolveActual(cfg, actual))}, expected=${String(resolveExpected(cfg, row))})`,
    };
  }
  const diff = Math.abs(a - e);
  const pass = diff <= cfg.n;
  return {
    name: cfg.name,
    pass,
    score: pass ? 1 : 0,
    detail: `|${a} - ${e}| = ${diff} (threshold ${cfg.n})`,
  };
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
