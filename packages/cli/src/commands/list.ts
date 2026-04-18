import { Command, Flags } from '@oclif/core';
import type { RunManifest } from '@petr/core';
import fs from 'node:fs/promises';
import path from 'node:path';

export default class List extends Command {
  static override description = 'List past runs in a directory (default: ./runs)';

  static override flags = {
    dir: Flags.string({ char: 'd', default: './runs' }),
  };

  override async run(): Promise<void> {
    const { flags } = await this.parse(List);
    const runsDir = path.resolve(flags.dir);
    let entries: string[];
    try {
      entries = await fs.readdir(runsDir);
    } catch {
      this.log(`no runs found in ${runsDir}`);
      return;
    }

    const rows: Array<{ id: string; manifest: RunManifest }> = [];
    for (const entry of entries) {
      const manifestPath = path.join(runsDir, entry, 'manifest.json');
      try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        rows.push({ id: entry, manifest: JSON.parse(raw) as RunManifest });
      } catch {
        // skip directories that aren't run folders
      }
    }

    if (rows.length === 0) {
      this.log(`no runs found in ${runsDir}`);
      return;
    }

    rows.sort((a, b) => b.manifest.startedAt.localeCompare(a.manifest.startedAt));
    for (const { id, manifest } of rows) {
      const pct = manifest.rowCount > 0 ? (manifest.passCount / manifest.rowCount) * 100 : 0;
      this.log(
        `${id}  ${manifest.name.padEnd(20)}  ${manifest.passCount}/${manifest.rowCount} (${pct.toFixed(1)}%)  ${manifest.model.provider}:${manifest.model.id}`,
      );
    }
  }
}
