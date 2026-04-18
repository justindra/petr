import fs from 'node:fs/promises';
import path from 'node:path';
import type { EvalConfig, EvalResult, RowResult, RunManifest } from '../types';
import { writeCsv } from './csv';
import { encodeRow, stringifyJson } from './csv-utils';
import { writeHtmlReport } from './html';
import { writeJson } from './json';

/** One variant's materialized run output feeding into a compare. */
export interface CompareSide {
  /** Display label — usually `<suite>/<variantName>`. */
  label: string;
  /** Only the eval names are read (to derive the summary table headers). */
  evals: EvalConfig[];
  manifest: RunManifest;
  results: RowResult[];
}

/** A single row in the compare, with every variant's output for that input joined by row id. */
export interface CompareRow {
  id: string;
  input: unknown;
  expected: unknown;
  /** Keyed by variant label. `null` when a variant didn't produce this row. */
  outputs: Record<string, unknown>;
  passes: Record<string, boolean>;
  errors: Record<string, string | null>;
  evalResults: Record<string, EvalResult[]>;
}

/**
 * One eval's pass rate across every variant. Not a delta — with N variants
 * the "baseline" becomes ambiguous, so consumers eyeball the row themselves.
 */
export interface CompareSummaryRow {
  eval: string;
  /** Keyed by variant label. */
  passRates: Record<string, number>;
}

/** Full comparison payload. Supports any number of variants. */
export interface CompareData {
  /** Variant labels in display order — use these as column keys everywhere. */
  variants: string[];
  manifests: Record<string, RunManifest>;
  rows: CompareRow[];
  summary: CompareSummaryRow[];
}

/**
 * Joins N runs by row id and computes per-eval pass rates per variant.
 *
 * Row order follows the first side — any row id not present in side 0 is
 * dropped. Variants missing a given row produce `null` outputs and `false`
 * passes in that column. Dataset symmetry is still the caller's responsibility.
 */
export function buildCompareData(sides: CompareSide[]): CompareData {
  if (sides.length < 2) {
    throw new Error(`buildCompareData needs at least 2 sides, got ${sides.length}`);
  }
  const variants = sides.map((s) => s.label);
  const resultsByVariant = new Map(
    sides.map((s) => [s.label, new Map(s.results.map((r) => [r.id, r]))]),
  );

  const firstSide = sides[0]!;
  const rows: CompareRow[] = firstSide.results.map((firstRow) => {
    const outputs: Record<string, unknown> = {};
    const passes: Record<string, boolean> = {};
    const errors: Record<string, string | null> = {};
    const evalResults: Record<string, EvalResult[]> = {};
    for (const label of variants) {
      const r = resultsByVariant.get(label)!.get(firstRow.id);
      outputs[label] = r?.output ?? null;
      passes[label] = r?.pass ?? false;
      errors[label] = r?.error ?? null;
      evalResults[label] = r?.evals ?? [];
    }
    return {
      id: firstRow.id,
      input: firstRow.input,
      expected: firstRow.expected,
      outputs,
      passes,
      errors,
      evalResults,
    };
  });

  const evalNames = [...new Set(sides.flatMap((s) => s.evals.map((e) => e.name)))];
  const summary: CompareSummaryRow[] = evalNames.map((evalName) => {
    const passRates: Record<string, number> = {};
    for (const side of sides) passRates[side.label] = passRate(side.results, evalName);
    return { eval: evalName, passRates };
  });

  const manifests: Record<string, RunManifest> = {};
  for (const side of sides) manifests[side.label] = side.manifest;

  return { variants, manifests, rows, summary };
}

function passRate(results: RowResult[], evalName: string): number {
  const relevant = results.map((r) => r.evals.find((e) => e.name === evalName)).filter(Boolean);
  if (relevant.length === 0) return 0;
  const passes = relevant.filter((e) => e!.pass).length;
  return passes / relevant.length;
}

/**
 * Renders per-row outputs as CSV. Headers: `id, input, expected, pass_<v>…,
 * output_<v>…, error_<v>…` for every variant `v`.
 */
export function compareRowsToCsv(data: CompareData): string {
  const headers = [
    'id',
    'input',
    'expected',
    ...data.variants.map((v) => `pass_${v}`),
    ...data.variants.map((v) => `output_${v}`),
    ...data.variants.map((v) => `error_${v}`),
  ];
  const lines = [encodeRow(headers)];
  for (const r of data.rows) {
    lines.push(
      encodeRow([
        r.id,
        stringifyJson(r.input),
        stringifyJson(r.expected),
        ...data.variants.map((v) => String(r.passes[v] ?? false)),
        ...data.variants.map((v) => stringifyJson(r.outputs[v])),
        ...data.variants.map((v) => r.errors[v] ?? ''),
      ]),
    );
  }
  return lines.join('\n') + '\n';
}

/** Renders the per-eval pass-rate matrix: columns are variants, rows are evals. */
export function compareSummaryToCsv(data: CompareData): string {
  const headers = ['eval', ...data.variants.map((v) => `pass_rate_${v}`)];
  const lines = [encodeRow(headers)];
  for (const s of data.summary) {
    lines.push(encodeRow([s.eval, ...data.variants.map((v) => (s.passRates[v] ?? 0).toFixed(4))]));
  }
  return lines.join('\n') + '\n';
}

/**
 * Formats a compare summary as a terminal-friendly block. For 2 variants the
 * layout stays compact (one line per eval); for 3+, each eval gets a small
 * column so the output stays readable at any width.
 *
 * @example (3 variants)
 * ```
 * Compare: demo  (8 rows, 3 variants)
 *   label-match
 *     copilot   100.0%
 *     bedrock   100.0%
 *     openai     87.5%
 * ```
 */
export function formatCompareSummary(data: CompareData): string {
  const header = `Compare: ${data.variants.length} variants  (${data.rows.length} rows)`;
  if (data.summary.length === 0) return `${header}\n  (no evals were run on any variant)`;

  if (data.variants.length === 2) {
    const [a, b] = data.variants as [string, string];
    const nameWidth = Math.max(...data.summary.map((s) => s.eval.length));
    const labelBlock = `${a} → ${b}`;
    const lines = [
      header,
      `  ${' '.repeat(nameWidth)}  ${labelBlock}`,
      ...data.summary.map((s) => {
        const aPct = (s.passRates[a] ?? 0) * 100;
        const bPct = (s.passRates[b] ?? 0) * 100;
        const delta = bPct - aPct;
        const sign = delta >= 0 ? '+' : '';
        return `  ${s.eval.padEnd(nameWidth)}  ${aPct.toFixed(1).padStart(6)}% → ${bPct
          .toFixed(1)
          .padStart(6)}%  (${sign}${delta.toFixed(1)}pp)`;
      }),
    ];
    return lines.join('\n');
  }

  const variantWidth = Math.max(...data.variants.map((v) => v.length));
  const lines = [header];
  for (const s of data.summary) {
    lines.push(`  ${s.eval}`);
    for (const v of data.variants) {
      const pct = (s.passRates[v] ?? 0) * 100;
      lines.push(`    ${v.padEnd(variantWidth)}  ${pct.toFixed(1).padStart(6)}%`);
    }
  }
  return lines.join('\n');
}

/** Arguments to {@link writeCompareArtifacts}. */
export interface WriteCompareOptions {
  sides: CompareSide[];
  /** Directory to write compare artifacts into (usually `<suiteRunDir>/compare/`). */
  compareDir: string;
}

/** Absolute paths of each compare artifact that was written. */
export interface WriteCompareResult {
  compareDir: string;
  csvPath: string;
  summaryPath: string;
  jsonPath: string;
  htmlPath: string;
}

/**
 * Writes a comparison folder: `results.csv` (per-row outputs, N variant
 * columns), `summary.csv` (eval × variant pass rate matrix), `results.json`,
 * and a self-contained `report.html`.
 */
export async function writeCompareArtifacts(
  opts: WriteCompareOptions,
): Promise<WriteCompareResult> {
  await fs.mkdir(opts.compareDir, { recursive: true });
  const data = buildCompareData(opts.sides);

  const csvPath = path.join(opts.compareDir, 'results.csv');
  const summaryPath = path.join(opts.compareDir, 'summary.csv');
  const jsonPath = path.join(opts.compareDir, 'results.json');
  const htmlPath = path.join(opts.compareDir, 'report.html');

  await writeCsv(csvPath, compareRowsToCsv(data));
  await writeCsv(summaryPath, compareSummaryToCsv(data));
  await writeJson(jsonPath, data);
  await writeHtmlReport(htmlPath, { mode: 'compare', manifest: null, compare: data });

  return { compareDir: opts.compareDir, csvPath, summaryPath, jsonPath, htmlPath };
}
