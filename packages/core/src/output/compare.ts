import fs from 'node:fs/promises';
import path from 'node:path';
import type { RowResult, RunManifest, SuiteConfig } from '../types';
import { writeCsv } from './csv';
import { encodeRow, stringifyJson } from './csv-utils';
import { writeHtmlReport } from './html';
import { writeJson } from './json';

/** One side of a comparison — either baseline (A) or candidate (B). */
export interface CompareSideData {
  config: SuiteConfig;
  manifest: RunManifest;
  results: RowResult[];
}

/** One row in a comparison, with outputs and errors from each side joined by id. */
export interface CompareRow {
  id: string;
  input: unknown;
  expected: unknown;
  outputA: unknown;
  outputB: unknown;
  passA: boolean;
  passB: boolean;
  errorA: string | null;
  errorB: string | null;
  evalsA: RowResult['evals'];
  evalsB: RowResult['evals'];
}

/** Per-eval pass rates across the two runs. `delta` is B minus A. */
export interface CompareSummaryRow {
  eval: string;
  passRateA: number;
  passRateB: number;
  delta: number;
}

/** Full comparison payload — what a compare report renders and what's written to `results.json`. */
export interface CompareData {
  aLabel: string;
  bLabel: string;
  manifestA: RunManifest;
  manifestB: RunManifest;
  rows: CompareRow[];
  summary: CompareSummaryRow[];
}

/**
 * Joins two runs by row id and computes per-eval pass-rate deltas.
 *
 * Rows unique to side A carry through; rows unique to B are dropped (rare —
 * happens if the two configs point at different datasets). Dataset symmetry
 * is the caller's responsibility.
 */
export function buildCompareData(a: CompareSideData, b: CompareSideData): CompareData {
  const byIdB = new Map(b.results.map((r) => [r.id, r]));
  const rows: CompareRow[] = a.results.map((rA) => {
    const rB = byIdB.get(rA.id);
    return {
      id: rA.id,
      input: rA.input,
      expected: rA.expected,
      outputA: rA.output,
      outputB: rB?.output ?? null,
      passA: rA.pass,
      passB: rB?.pass ?? false,
      errorA: rA.error,
      errorB: rB?.error ?? null,
      evalsA: rA.evals,
      evalsB: rB?.evals ?? [],
    };
  });

  const evalNames = [
    ...new Set([...a.config.evals.map((e) => e.name), ...b.config.evals.map((e) => e.name)]),
  ];
  const summary: CompareSummaryRow[] = evalNames.map((name) => {
    const rateA = passRate(a.results, name);
    const rateB = passRate(b.results, name);
    return { eval: name, passRateA: rateA, passRateB: rateB, delta: rateB - rateA };
  });

  return {
    aLabel: a.config.name,
    bLabel: b.config.name,
    manifestA: a.manifest,
    manifestB: b.manifest,
    rows,
    summary,
  };
}

function passRate(results: RowResult[], evalName: string): number {
  const relevant = results.map((r) => r.evals.find((e) => e.name === evalName)).filter(Boolean);
  if (relevant.length === 0) return 0;
  const passes = relevant.filter((e) => e!.pass).length;
  return passes / relevant.length;
}

/** Renders side-by-side row outputs as CSV (`output_A`, `output_B`, etc.). */
export function compareRowsToCsv(data: CompareData): string {
  const headers = [
    'id',
    'pass_A',
    'pass_B',
    'error_A',
    'error_B',
    'input',
    'expected',
    'output_A',
    'output_B',
  ];
  const lines = [encodeRow(headers)];
  for (const r of data.rows) {
    lines.push(
      encodeRow([
        r.id,
        String(r.passA),
        String(r.passB),
        r.errorA ?? '',
        r.errorB ?? '',
        stringifyJson(r.input),
        stringifyJson(r.expected),
        stringifyJson(r.outputA),
        stringifyJson(r.outputB),
      ]),
    );
  }
  return lines.join('\n') + '\n';
}

/** Renders the per-eval pass-rate summary as a small CSV suitable for dashboards. */
export function compareSummaryToCsv(data: CompareData): string {
  const headers = ['eval', 'pass_rate_A', 'pass_rate_B', 'delta'];
  const lines = [encodeRow(headers)];
  for (const s of data.summary) {
    lines.push(
      encodeRow([s.eval, s.passRateA.toFixed(4), s.passRateB.toFixed(4), s.delta.toFixed(4)]),
    );
  }
  return lines.join('\n') + '\n';
}

/** Arguments to {@link writeCompareArtifacts}. */
export interface WriteCompareOptions {
  a: CompareSideData;
  b: CompareSideData;
  /** Parent directory — a `<compareId>/` subfolder is created inside. */
  outDir: string;
  /** Folder name to use; generate a fresh one with {@link generateRunId}. */
  compareId: string;
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
 * Writes a comparison folder: `results.csv` (per-row outputs), `summary.csv`
 * (eval pass rates + deltas), `results.json`, and a self-contained `report.html`.
 */
export async function writeCompareArtifacts(
  opts: WriteCompareOptions,
): Promise<WriteCompareResult> {
  const compareDir = path.join(opts.outDir, opts.compareId);
  await fs.mkdir(compareDir, { recursive: true });

  const data = buildCompareData(opts.a, opts.b);

  const csvPath = path.join(compareDir, 'results.csv');
  const summaryPath = path.join(compareDir, 'summary.csv');
  const jsonPath = path.join(compareDir, 'results.json');
  const htmlPath = path.join(compareDir, 'report.html');

  await writeCsv(csvPath, compareRowsToCsv(data));
  await writeCsv(summaryPath, compareSummaryToCsv(data));
  await writeJson(jsonPath, data);
  await writeHtmlReport(htmlPath, {
    mode: 'compare',
    manifest: null,
    compare: data,
  });

  return { compareDir, csvPath, summaryPath, jsonPath, htmlPath };
}
