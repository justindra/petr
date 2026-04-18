import type { DatasetRow } from '../types.js';

export function getPath(obj: unknown, path: string | undefined): unknown {
  if (!path) return obj;
  if (obj == null) return undefined;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function resolveActual(cfg: { field?: string | undefined }, actual: unknown): unknown {
  return getPath(actual, cfg.field);
}

export function resolveExpected(
  cfg: { field?: string | undefined; expected?: string | undefined },
  row: DatasetRow,
): unknown {
  const spec = cfg.expected;
  if (spec === undefined) {
    return getPath(row.expected, cfg.field);
  }
  if (spec.startsWith('row.')) {
    return getPath(row, spec.slice('row.'.length));
  }
  if (spec.startsWith('input.')) {
    return getPath(row.input, spec.slice('input.'.length));
  }
  return spec;
}
