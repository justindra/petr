import { Args, Command, Flags } from '@oclif/core';
import { startReviewServer } from '@petr/core';
import path from 'node:path';

export default class Review extends Command {
  static override description = 'Start an HTTP server that serves the review UI for a run';

  static override args = {
    runDir: Args.string({
      description: 'Path to a run folder (e.g. runs/<timestamp>)',
      required: true,
    }),
  };

  static override flags = {
    port: Flags.integer({ char: 'p', description: 'Port to bind', default: 4317 }),
    host: Flags.string({ description: 'Hostname', default: '127.0.0.1' }),
  };

  override async run(): Promise<void> {
    const { args, flags } = await this.parse(Review);
    const runDir = path.resolve(args.runDir);
    const handle = await startReviewServer({ runDir, port: flags.port, host: flags.host });
    this.log(`review server ready → ${handle.url}`);
    this.log('(ctrl+c to stop)');
    // Keep the process alive until signal.
    await new Promise<void>((resolve) => {
      const stop = async (): Promise<void> => {
        await handle.stop();
        resolve();
      };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
  }
}
