import fs from 'node:fs/promises';
import path from 'node:path';
import type { EvalConfig, RowResult, RunManifest, SuiteRunManifest } from '../types';
// writeManifest now accepts any object so we can use it for both per-variant
// RunManifests and suite-level SuiteRunManifests.
import { rowResultsToCsv, writeCsv } from './csv';
import { writeHtmlReport } from './html';
import { writeManifest, writeRunJson } from './json';

/**
 * Result of writing a single variant's artifacts. Used by the suite-run
 * orchestrator to keep track of where each variant landed.
 */
export interface WriteVariantResult {
  variantName: string;
  variantDir: string;
  csvPath: string;
  jsonPath: string;
  manifestPath: string;
  htmlPath: string;
}

/** Arguments to {@link writeVariantArtifacts}. */
export interface WriteVariantOptions {
  /** Only `evals` is consumed — a ResolvedSuiteConfig or SuiteConfig both work. */
  config: { evals: EvalConfig[] };
  manifest: RunManifest;
  results: RowResult[];
  /**
   * Directory for this variant's files. Usually
   * `<suiteRunDir>/<variantName>/`; created if it doesn't exist.
   */
  variantDir: string;
}

/**
 * Writes one variant's artifacts into the given directory: `results.csv`,
 * `results.json`, `manifest.json`, and a self-contained `report.html`.
 */
export async function writeVariantArtifacts(
  opts: WriteVariantOptions,
): Promise<WriteVariantResult> {
  await fs.mkdir(opts.variantDir, { recursive: true });

  const csvPath = path.join(opts.variantDir, 'results.csv');
  const jsonPath = path.join(opts.variantDir, 'results.json');
  const manifestPath = path.join(opts.variantDir, 'manifest.json');
  const htmlPath = path.join(opts.variantDir, 'report.html');

  await writeCsv(csvPath, rowResultsToCsv(opts.config, opts.results));
  await writeRunJson(jsonPath, { manifest: opts.manifest, results: opts.results });
  await writeManifest(manifestPath, opts.manifest);
  await writeHtmlReport(htmlPath, {
    mode: 'run',
    manifest: opts.manifest,
    results: opts.results,
  });

  return {
    variantName: opts.manifest.variantName,
    variantDir: opts.variantDir,
    csvPath,
    jsonPath,
    manifestPath,
    htmlPath,
  };
}

/** Arguments to {@link writeSuiteRunManifest}. */
export interface WriteSuiteRunManifestOptions {
  suiteRunDir: string;
  manifest: SuiteRunManifest;
}

/**
 * Writes the top-level `manifest.json` for a suite run — the file a tool
 * reads first to discover the variants and walk into them.
 */
export async function writeSuiteRunManifest(opts: WriteSuiteRunManifestOptions): Promise<string> {
  await fs.mkdir(opts.suiteRunDir, { recursive: true });
  const manifestPath = path.join(opts.suiteRunDir, 'manifest.json');
  await writeManifest(manifestPath, opts.manifest);
  return manifestPath;
}
