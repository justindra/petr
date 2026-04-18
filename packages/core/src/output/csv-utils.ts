/**
 * Encodes a row of cells as a CSV line, quoting and escaping cells that
 * contain commas, quotes, or newlines per RFC 4180.
 */
export function encodeRow(cells: string[]): string {
  return cells.map(escapeCell).join(',');
}

function escapeCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/**
 * Serializes an arbitrary value for a CSV cell. Strings pass through as-is
 * (so multi-line text still works), everything else becomes compact JSON.
 * Returns an empty string for null/undefined.
 */
export function stringifyJson(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
