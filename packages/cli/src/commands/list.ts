import { Command, Flags } from '@oclif/core';
import type { SuiteRunManifest } from '@petr/core';
import fs from 'node:fs/promises';
import path from 'node:path';

export default class List extends Command {
  static override description = 'List past suite runs in a directory (default: ./runs)';

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

    const rows: Array<{ id: string; manifest: SuiteRunManifest }> = [];
    for (const entry of entries) {
      const manifestPath = path.join(runsDir, entry, 'manifest.json');
      try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(raw) as SuiteRunManifest;
        if (Array.isArray(manifest.variants)) rows.push({ id: entry, manifest });
      } catch {
        // skip directories that aren't suite run folders
      }
    }

    if (rows.length === 0) {
      this.log(`no runs found in ${runsDir}`);
      return;
    }

    rows.sort((a, b) => b.manifest.startedAt.localeCompare(a.manifest.startedAt));
    for (const { id, manifest } of rows) {
      const totalRows = manifest.variants.reduce((a, v) => a + v.rowCount, 0);
      const totalPasses = manifest.variants.reduce((a, v) => a + v.passCount, 0);
      const pct = totalRows > 0 ? (totalPasses / totalRows) * 100 : 0;
      const variantList = manifest.variants.map((v) => v.name).join(', ');
      this.log(
        `${id}  ${manifest.suiteName.padEnd(20)}  ${totalPasses}/${totalRows} (${pct.toFixed(1)}%)  [${variantList}]`,
      );
    }
  }
}
