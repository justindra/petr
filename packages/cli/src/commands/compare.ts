import { Args, Command } from '@oclif/core';
import {
  buildCompareData,
  formatCompareSummary,
  writeCompareArtifacts,
  type CompareSide,
  type EvalConfig,
  type RowResult,
  type RunManifest,
  type SuiteRunManifest,
} from '@petr-ai/core';
import fs from 'node:fs/promises';
import path from 'node:path';

export default class Compare extends Command {
  static override description =
    'Re-emit the compare report for a suite run folder (the one `petr run` produced). Reads each variant under it, rebuilds compare artifacts, and prints a summary.';

  static override args = {
    suiteRun: Args.string({
      description: 'Path to a suite run folder, e.g. runs/2026-04-18T...',
      required: true,
    }),
  };

  override async run(): Promise<void> {
    const { args } = await this.parse(Compare);
    const suiteRunDir = path.resolve(args.suiteRun);

    const sides = await loadSuiteSides(suiteRunDir);
    if (sides.length < 2) {
      this.error(`Need at least 2 variants to compare; ${sides.length} found in ${suiteRunDir}.`);
    }

    const compareDir = path.join(suiteRunDir, 'compare');
    await writeCompareArtifacts({ sides, compareDir });
    const data = buildCompareData(sides);
    this.log(formatCompareSummary(data));
    this.log(`→ ${compareDir}`);
  }
}

async function loadSuiteSides(suiteRunDir: string): Promise<CompareSide[]> {
  let suiteManifest: SuiteRunManifest | null = null;
  try {
    const raw = await fs.readFile(path.join(suiteRunDir, 'manifest.json'), 'utf8');
    suiteManifest = JSON.parse(raw) as SuiteRunManifest;
  } catch {
    // Fall back to scanning the folder if the suite manifest is missing.
  }

  const variantDirs = suiteManifest
    ? suiteManifest.variants.map((v) => ({ name: v.name, dir: path.join(suiteRunDir, v.dir) }))
    : await discoverVariantDirs(suiteRunDir);

  const sides: CompareSide[] = [];
  for (const { name, dir } of variantDirs) {
    const resultsPath = path.join(dir, 'results.json');
    let raw: string;
    try {
      raw = await fs.readFile(resultsPath, 'utf8');
    } catch (err) {
      throw new Error(`Could not read ${resultsPath} — is "${dir}" a petr variant run folder?`, {
        cause: err,
      });
    }
    const parsed = JSON.parse(raw) as { manifest: RunManifest; results: RowResult[] };
    const evalNames = [...new Set(parsed.results.flatMap((r) => r.evals.map((e) => e.name)))];
    const evals: EvalConfig[] = evalNames.map((n) => ({ name: n, type: 'equals' }));
    sides.push({
      label: name,
      evals,
      manifest: parsed.manifest,
      results: parsed.results,
    });
  }

  return sides;
}

async function discoverVariantDirs(
  suiteRunDir: string,
): Promise<Array<{ name: string; dir: string }>> {
  const entries = await fs.readdir(suiteRunDir, { withFileTypes: true });
  const dirs: Array<{ name: string; dir: string }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'compare') continue;
    const candidate = path.join(suiteRunDir, entry.name, 'results.json');
    try {
      await fs.access(candidate);
      dirs.push({ name: entry.name, dir: path.join(suiteRunDir, entry.name) });
    } catch {
      // Not a variant folder; skip.
    }
  }
  return dirs;
}
