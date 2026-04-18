import type { DatasetRow, EqualsEvalConfig, EvalResult } from '../types.js';
import { resolveActual, resolveExpected } from './path.js';

export function runEquals(cfg: EqualsEvalConfig, actual: unknown, row: DatasetRow): EvalResult {
  const a = resolveActual(cfg, actual);
  const e = resolveExpected(cfg, row);
  const pass = deepEqual(a, e);
  const base: EvalResult = { name: cfg.name, pass, score: pass ? 1 : 0 };
  if (!pass) base.detail = `expected ${repr(e)}, got ${repr(a)}`;
  return base;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === 'object') {
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b)) return false;
      if (a.length !== b.length) return false;
      return a.every((v, i) => deepEqual(v, b[i]));
    }
    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}

function repr(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
