import type { ContainsEvalConfig, DatasetRow, EvalResult } from '../types';
import { resolveActual, resolveExpected } from './path';

export function runContains(cfg: ContainsEvalConfig, actual: unknown, row: DatasetRow): EvalResult {
  const haystack = toStr(resolveActual(cfg, actual));
  const needle = toStr(resolveExpected(cfg, row));
  const ci = cfg.caseInsensitive === true;
  const pass = ci
    ? haystack.toLowerCase().includes(needle.toLowerCase())
    : haystack.includes(needle);
  const base: EvalResult = { name: cfg.name, pass, score: pass ? 1 : 0 };
  if (!pass) base.detail = `"${needle}" not found in output`;
  return base;
}

function toStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}
