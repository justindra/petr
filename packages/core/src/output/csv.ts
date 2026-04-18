import fs from 'node:fs/promises';
import type { EvalResult, RowResult, SuiteConfig } from '../types';
import { encodeRow, stringifyJson } from './csv-utils';

/**
 * Renders run results as a CSV string. Each eval in the suite becomes three
 * columns (`eval.<name>.pass`, `.score`, `.detail`) so spreadsheet tools can
 * filter failures without parsing JSON.
 */
export function rowResultsToCsv(config: SuiteConfig, results: RowResult[]): string {
  const evalNames = [...new Set(config.evals.map((e) => e.name))];
  const headers = [
    'id',
    'pass',
    'error',
    'latency_ms',
    'tokens_in',
    'tokens_out',
    'input',
    'expected',
    'output',
    ...evalNames.flatMap((n) => [`eval.${n}.pass`, `eval.${n}.score`, `eval.${n}.detail`]),
  ];
  const lines: string[] = [encodeRow(headers)];
  for (const r of results) {
    const byName = new Map<string, EvalResult>(r.evals.map((e) => [e.name, e]));
    const evalCells = evalNames.flatMap((name) => {
      const res = byName.get(name);
      if (!res) return ['', '', ''];
      return [String(res.pass), res.score !== undefined ? String(res.score) : '', res.detail ?? ''];
    });
    lines.push(
      encodeRow([
        r.id,
        String(r.pass),
        r.error ?? '',
        String(r.latencyMs),
        String(r.tokensIn),
        String(r.tokensOut),
        stringifyJson(r.input),
        stringifyJson(r.expected),
        stringifyJson(r.output),
        ...evalCells,
      ]),
    );
  }
  return lines.join('\n') + '\n';
}

/** Writes a prebuilt CSV string to disk (utf-8). */
export async function writeCsv(filePath: string, csv: string): Promise<void> {
  await fs.writeFile(filePath, csv, 'utf8');
}
