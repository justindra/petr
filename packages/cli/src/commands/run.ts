import { Args, Command, Flags } from '@oclif/core';
import {
  buildCompareData,
  formatCompareSummary,
  generateRunId,
  loadConfig,
  loadEnvFromDir,
  resolveVariant,
  runSuite,
  writeCompareArtifacts,
  writeRunArtifacts,
  type RowResult,
  type RunManifest,
  type SuiteConfig,
} from '@petr/core';
import path from 'node:path';

export default class Run extends Command {
  static override description =
    'Run a suite: execute every variant against the dataset and score with evals. Auto-compares on 2 variants.';

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
      description: 'Output directory (default: ./runs)',
      default: './runs',
    }),
    'compare-out': Flags.string({
      description: 'Output directory for compare artifacts (default: ./compare)',
      default: './compare',
    }),
  };

  override async run(): Promise<void> {
    const { args, flags } = await this.parse(Run);
    const { config, baseDir } = await loadConfig(args.config);
    const env = loadEnvFromDir(baseDir);
    for (const f of env.loaded) this.log(`• loaded env from ${path.relative(baseDir, f) || f}`);

    const targets = pickVariants(config, flags.variant);
    const outDir = path.resolve(flags.out);

    const completed: Array<{ config: SuiteConfig; manifest: RunManifest; results: RowResult[] }> =
      [];

    for (const variantName of targets) {
      const resolved = resolveVariant(config, variantName);
      this.log(
        `▸ ${config.name} · ${variantName} — ${resolved.model.provider}:${resolved.model.id}`,
      );

      const result = await runSuite({
        config: resolved,
        baseDir,
        ...(flags.concurrency !== undefined ? { concurrency: flags.concurrency } : {}),
        ...(flags['max-retries'] !== undefined ? { maxRetries: flags['max-retries'] } : {}),
        ...(flags.limit !== undefined ? { limit: flags.limit } : {}),
      });

      const artifacts = await writeRunArtifacts({
        config: resolved,
        manifest: result.manifest,
        results: result.results,
        outDir,
      });

      const { manifest } = result;
      const costBit =
        manifest.estimatedCostUsd !== null ? ` · ~$${manifest.estimatedCostUsd.toFixed(4)}` : '';
      this.log(
        `✓ ${manifest.passCount}/${manifest.rowCount} passed · tokens ${manifest.totalTokensIn}→${manifest.totalTokensOut}${costBit}`,
      );
      this.log(`→ ${artifacts.runDir}`);

      completed.push({ config, manifest: result.manifest, results: result.results });
    }

    if (completed.length === 2) {
      const [a, b] = completed as [(typeof completed)[number], (typeof completed)[number]];
      const compareOutDir = path.resolve(flags['compare-out']);
      const compareId = generateRunId(
        `${config.name}_${a.manifest.variantName}-vs-${b.manifest.variantName}`,
      );
      // Label each side with `<suite>/<variant>` so the summary distinguishes
      // the two columns — `config.name` alone is the shared suite name.
      const sideA = {
        config: { name: `${config.name}/${a.manifest.variantName}`, evals: config.evals },
        manifest: a.manifest,
        results: a.results,
      };
      const sideB = {
        config: { name: `${config.name}/${b.manifest.variantName}`, evals: config.evals },
        manifest: b.manifest,
        results: b.results,
      };
      const artifacts = await writeCompareArtifacts({
        a: sideA,
        b: sideB,
        outDir: compareOutDir,
        compareId,
      });
      const data = buildCompareData(sideA, sideB);
      this.log('');
      this.log(formatCompareSummary(data));
      this.log(`→ ${artifacts.compareDir}`);
    } else if (completed.length > 2) {
      this.log('');
      this.log(
        `(${completed.length} variants ran; auto-compare is pairwise — use \`petr compare <runA> <runB>\` on any pair)`,
      );
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
