import { Args, Command, Flags } from '@oclif/core';
import {
  buildCompareData,
  formatCompareSummary,
  generateRunId,
  writeCompareArtifacts,
  type EvalConfig,
  type RowResult,
  type RunManifest,
} from '@petr/core';
import fs from 'node:fs/promises';
import path from 'node:path';

export default class Compare extends Command {
  static override description =
    'Report on two existing run folders — emit side-by-side artifacts and print a pass-rate summary. Does not run anything.';

  static override args = {
    a: Args.string({ description: 'First run folder (baseline)', required: true }),
    b: Args.string({ description: 'Second run folder (candidate)', required: true }),
  };

  static override flags = {
    out: Flags.string({
      char: 'o',
      description: 'Output directory for compare artifacts (default: ./compare)',
      default: './compare',
    }),
  };

  override async run(): Promise<void> {
    const { args, flags } = await this.parse(Compare);
    const a = await loadRun(args.a);
    const b = await loadRun(args.b);

    const data = buildCompareData(a, b);
    const outDir = path.resolve(flags.out);
    const compareId = generateRunId(
      `${a.config.name}_${a.manifest.variantName}-vs-${b.manifest.variantName}`,
    );
    const artifacts = await writeCompareArtifacts({ a, b, outDir, compareId });

    this.log(formatCompareSummary(data));
    this.log(`→ ${artifacts.compareDir}`);
  }
}

interface LoadedRun {
  config: { name: string; evals: EvalConfig[] };
  manifest: RunManifest;
  results: RowResult[];
}

async function loadRun(runDir: string): Promise<LoadedRun> {
  const absDir = path.resolve(runDir);
  const resultsPath = path.join(absDir, 'results.json');
  let raw: string;
  try {
    raw = await fs.readFile(resultsPath, 'utf8');
  } catch (err) {
    throw new Error(`Could not read ${resultsPath} — is "${runDir}" a petr run folder?`, {
      cause: err,
    });
  }
  const parsed = JSON.parse(raw) as { manifest: RunManifest; results: RowResult[] };
  // Synthesize the minimal config shape buildCompareData needs from the results.
  // Each row carries its own eval names, so we don't need the original eval
  // config — type is set to `equals` as a placeholder; only `name` is read.
  const evalNames = [...new Set(parsed.results.flatMap((r) => r.evals.map((e) => e.name)))];
  const evals: EvalConfig[] = evalNames.map((name) => ({ name, type: 'equals' }));
  const label = `${parsed.manifest.name}/${parsed.manifest.variantName}`;
  return {
    config: { name: label, evals },
    manifest: parsed.manifest,
    results: parsed.results,
  };
}
