import { Args, Command, Flags } from '@oclif/core';
import { loadConfig, runSuite, writeRunArtifacts } from '@petr/core';
import path from 'node:path';

export default class Run extends Command {
  static override description =
    'Run a suite: execute a prompt against a dataset and score with evals';

  static override args = {
    config: Args.string({
      description: 'Path to petr.config.ts',
      required: true,
    }),
  };

  static override flags = {
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
  };

  override async run(): Promise<void> {
    const { args, flags } = await this.parse(Run);
    const { config, baseDir } = await loadConfig(args.config);

    const opts = {
      config,
      baseDir,
      ...(flags.concurrency !== undefined ? { concurrency: flags.concurrency } : {}),
      ...(flags['max-retries'] !== undefined ? { maxRetries: flags['max-retries'] } : {}),
      ...(flags.limit !== undefined ? { limit: flags.limit } : {}),
    };

    this.log(`▸ running ${config.name} — ${config.model.provider}:${config.model.id}`);
    const result = await runSuite(opts);

    const outDir = path.resolve(flags.out);
    const artifacts = await writeRunArtifacts({
      config,
      manifest: result.manifest,
      results: result.results,
      outDir,
    });

    const { manifest } = result;
    this.log(
      `✓ ${manifest.passCount}/${manifest.rowCount} passed · tokens ${manifest.totalTokensIn}→${manifest.totalTokensOut}${manifest.estimatedCostUsd !== null ? ` · ~$${manifest.estimatedCostUsd.toFixed(4)}` : ''}`,
    );
    this.log(`→ ${artifacts.runDir}`);
  }
}
