import fs from 'node:fs/promises';
import path from 'node:path';
import type { RowResult, RunManifest, SuiteConfig } from '../types.js';
import { rowResultsToCsv, writeCsv } from './csv.js';
import { writeHtmlReport } from './html.js';
import { writeManifest, writeRunJson } from './json.js';

export interface WriteRunOptions {
  config: SuiteConfig;
  manifest: RunManifest;
  results: RowResult[];
  outDir: string;
}

export interface WriteRunResult {
  runDir: string;
  csvPath: string;
  jsonPath: string;
  manifestPath: string;
  htmlPath: string;
}

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
