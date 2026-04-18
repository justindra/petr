import fs from 'node:fs/promises';
import type { RowResult, RunManifest } from '../types';

/** Shape of `results.json` inside a run folder. */
export interface RunJsonPayload {
  manifest: RunManifest;
  results: RowResult[];
}

/** Pretty-prints a value to disk as UTF-8 JSON with a trailing newline. */
export async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

/** Writes the full `results.json` payload (manifest + row results). */
export async function writeRunJson(filePath: string, payload: RunJsonPayload): Promise<void> {
  await writeJson(filePath, payload);
}

/**
 * Writes a manifest object — the per-variant {@link RunManifest} or the
 * suite-level {@link import('../types').SuiteRunManifest}, whichever one
 * matches the folder level.
 */
export async function writeManifest(filePath: string, manifest: object): Promise<void> {
  await writeJson(filePath, manifest);
}
