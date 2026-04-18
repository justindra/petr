import fs from 'node:fs/promises';
import path from 'node:path';
import type { RowResult, RunManifest, SuiteConfig } from '../types';
import { rowResultsToCsv, writeCsv } from './csv';
import { writeHtmlReport } from './html';
import { writeManifest, writeRunJson } from './json';

/** Arguments to {@link writeRunArtifacts}. */
export interface WriteRunOptions {
  config: SuiteConfig;
  manifest: RunManifest;
  results: RowResult[];
  /** Parent directory — a `<runId>/` subfolder is created inside. */
  outDir: string;
}

/** Absolute paths of each artifact that was written. */
export interface WriteRunResult {
  runDir: string;
  csvPath: string;
  jsonPath: string;
  manifestPath: string;
  htmlPath: string;
}

/**
 * Writes a complete run folder: `results.csv`, `results.json`, `manifest.json`,
 * and a self-contained `report.html`. The folder is named after `manifest.runId`.
 */
export async function writeRunArtifacts(opts: WriteRunOptions): Promise<WriteRunResult> {
  const runDir = path.join(opts.outDir, opts.manifest.runId);
  await fs.mkdir(runDir, { recursive: true });

  const csvPath = path.join(runDir, 'results.csv');
  const jsonPath = path.join(runDir, 'results.json');
  const manifestPath = path.join(runDir, 'manifest.json');
  const htmlPath = path.join(runDir, 'report.html');

  await writeCsv(csvPath, rowResultsToCsv(opts.config, opts.results));
  await writeRunJson(jsonPath, { manifest: opts.manifest, results: opts.results });
  await writeManifest(manifestPath, opts.manifest);
  await writeHtmlReport(htmlPath, {
    mode: 'run',
    manifest: opts.manifest,
    results: opts.results,
  });

  return { runDir, csvPath, jsonPath, manifestPath, htmlPath };
}
