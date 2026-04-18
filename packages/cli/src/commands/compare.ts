import { Args, Command, Flags } from '@oclif/core';
import {
  generateRunId,
  loadConfig,
  runSuite,
  writeCompareArtifacts,
  type RunSuiteOptions,
} from '@petr/core';
import path from 'node:path';

export default class Compare extends Command {
  static override description =
    'Run two suites against the same dataset and emit a side-by-side comparison';

  static override args = {
    a: Args.string({ description: 'First config (baseline)', required: true }),
    b: Args.string({ description: 'Second config (candidate)', required: true }),
  };

  static override flags = {
    concurrency: Flags.integer({ char: 'c' }),
    'max-retries': Flags.integer(),
    limit: Flags.integer({ char: 'l' }),
    out: Flags.string({ char: 'o', default: './compare' }),
  };

  override async run(): Promise<void> {
    const { args, flags } = await this.parse(Compare);

    const [loaded1, loaded2] = await Promise.all([loadConfig(args.a), loadConfig(args.b)]);

    const build = (cfg: typeof loaded1): RunSuiteOptions => ({
      config: cfg.config,
      baseDir: cfg.baseDir,
      ...(flags.concurrency !== undefined ? { concurrency: flags.concurrency } : {}),
      ...(flags['max-retries'] !== undefined ? { maxRetries: flags['max-retries'] } : {}),
      ...(flags.limit !== undefined ? { limit: flags.limit } : {}),
    });

    this.log(
      `▸ A: ${loaded1.config.name} — ${loaded1.config.model.provider}:${loaded1.config.model.id}`,
    );
    this.log(
      `▸ B: ${loaded2.config.name} — ${loaded2.config.model.provider}:${loaded2.config.model.id}`,
    );

    const [a, b] = await Promise.all([runSuite(build(loaded1)), runSuite(build(loaded2))]);

    const outDir = path.resolve(flags.out);
    const artifacts = await writeCompareArtifacts({
      a: { config: loaded1.config, manifest: a.manifest, results: a.results },
      b: { config: loaded2.config, manifest: b.manifest, results: b.results },
      outDir,
      compareId: generateRunId(`${loaded1.config.name}-vs-${loaded2.config.name}`),
    });

    this.log(
      `A: ${a.manifest.passCount}/${a.manifest.rowCount} passed  ·  B: ${b.manifest.passCount}/${b.manifest.rowCount} passed`,
    );
    this.log(`→ ${artifacts.compareDir}`);
  }
}
