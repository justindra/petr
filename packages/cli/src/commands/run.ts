import { Args, Command, Flags } from '@oclif/core';
import {
  buildCompareData,
  formatCompareSummary,
  generateRunId,
  loadConfig,
  loadEnvFromDir,
  resolveVariant,
  runSuite,
  tryGitSha,
  writeCompareArtifacts,
  writeSuiteRunManifest,
  writeVariantArtifacts,
  type CompareSide,
  type RowResult,
  type RunManifest,
  type SuiteConfig,
  type SuiteRunManifest,
} from '@petr/core';
import path from 'node:path';

export default class Run extends Command {
  static override description =
    'Run a suite: execute every variant against the dataset and score with evals. Auto-compares when 2+ variants run.';

  static override args = {
    config: Args.string({
      description: 'Path to petr.config.ts',
      required: true,
    }),
  };

  static override flags = {
    variant: Flags.string({
      char: 'V',
      description: 'Only run a single variant by name (default: run every variant)',
    }),
    concurrency: Flags.integer({
      char: 'c',
      description: 'Parallel rows in flight',
    }),
    'max-retries': Flags.integer({
      description: 'Max retry attempts per row on transient errors',
    }),
    limit: Flags.integer({
      char: 'l',
      description: 'Only run the first N rows',
    }),
    out: Flags.string({
      char: 'o',
      description: 'Parent directory for run folders (default: ./runs)',
      default: './runs',
    }),
  };

  override async run(): Promise<void> {
    const { args, flags } = await this.parse(Run);
    const { config, baseDir } = await loadConfig(args.config);
    const env = loadEnvFromDir(baseDir);
    for (const f of env.loaded) this.log(`• loaded env from ${path.relative(baseDir, f) || f}`);

    const targets = pickVariants(config, flags.variant);
    const outDir = path.resolve(flags.out);
    const suiteRunId = generateRunId(config.name);
    const suiteRunDir = path.join(outDir, suiteRunId);
    const startedAt = new Date();

    this.log(`▸ ${config.name}  →  ${path.relative(process.cwd(), suiteRunDir) || suiteRunDir}`);

    const completed: Array<{ manifest: RunManifest; results: RowResult[] }> = [];
    const variantSummaries: SuiteRunManifest['variants'] = [];

    for (const variantName of targets) {
      const resolved = resolveVariant(config, variantName);
      this.log(`  · ${variantName} — ${resolved.model.provider}:${resolved.model.id}`);

      const result = await runSuite({
        config: resolved,
        baseDir,
        ...(flags.concurrency !== undefined ? { concurrency: flags.concurrency } : {}),
        ...(flags['max-retries'] !== undefined ? { maxRetries: flags['max-retries'] } : {}),
        ...(flags.limit !== undefined ? { limit: flags.limit } : {}),
      });

      const variantDir = path.join(suiteRunDir, variantName);
      await writeVariantArtifacts({
        config: resolved,
        manifest: result.manifest,
        results: result.results,
        variantDir,
      });

      const { manifest } = result;
      const costBit =
        manifest.estimatedCostUsd !== null ? ` · ~$${manifest.estimatedCostUsd.toFixed(4)}` : '';
      this.log(
        `    ${manifest.passCount}/${manifest.rowCount} passed · tokens ${manifest.totalTokensIn}→${manifest.totalTokensOut}${costBit}`,
      );

      completed.push({ manifest, results: result.results });
      variantSummaries.push({
        name: variantName,
        dir: variantName,
        passCount: manifest.passCount,
        rowCount: manifest.rowCount,
      });
    }

    const endedAt = new Date();
    const suiteManifest: SuiteRunManifest = {
      suiteName: config.name,
      suiteRunId,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      gitSha: tryGitSha(baseDir),
      baseDir,
      variants: variantSummaries,
    };
    await writeSuiteRunManifest({ suiteRunDir, manifest: suiteManifest });

    if (completed.length >= 2) {
      const sides: CompareSide[] = completed.map((c) => ({
        label: c.manifest.variantName,
        evals: config.evals,
        manifest: c.manifest,
        results: c.results,
      }));
      const compareDir = path.join(suiteRunDir, 'compare');
      const { compareDir: writtenTo } = await writeCompareArtifacts({ sides, compareDir });
      const data = buildCompareData(sides);
      this.log('');
      this.log(formatCompareSummary(data));
      this.log(`→ ${writtenTo}`);
    } else {
      this.log(`→ ${suiteRunDir}`);
    }
  }
}

function pickVariants(config: SuiteConfig, only: string | undefined): string[] {
  if (only !== undefined) {
    const match = config.variants.find((v) => v.name === only);
    if (!match) {
      const available = config.variants.map((v) => v.name).join(', ');
      throw new Error(`unknown variant "${only}" (available: ${available})`);
    }
    return [only];
  }
  return config.variants.map((v) => v.name);
}
