import fs from 'node:fs/promises';
import type { RowResult, RunManifest } from '../types.js';

export interface RunJsonPayload {
  manifest: RunManifest;
  results: RowResult[];
}

export async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

export async function writeRunJson(filePath: string, payload: RunJsonPayload): Promise<void> {
  await writeJson(filePath, payload);
}

export async function writeManifest(filePath: string, manifest: RunManifest): Promise<void> {
  await writeJson(filePath, manifest);
}
