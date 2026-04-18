import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DatasetRow, NotesEntry } from './types.js';

export async function readDataset(datasetPath: string): Promise<DatasetRow[]> {
  let text: string;
  try {
    text = await fs.readFile(datasetPath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read dataset ${datasetPath}: ${(err as Error).message}`, {
      cause: err,
    });
  }
  const rows: DatasetRow[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    let parsed: Partial<DatasetRow>;
    try {
      parsed = JSON.parse(line) as Partial<DatasetRow>;
    } catch (err) {
      throw new Error(`${datasetPath}:${i + 1} invalid JSON — ${(err as Error).message}`, {
        cause: err,
      });
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(`${datasetPath}:${i + 1} each row must be a JSON object`);
    }
    if (!('input' in parsed)) {
      throw new Error(`${datasetPath}:${i + 1} row is missing required "input" field`);
    }
    const row: DatasetRow = {
      id: typeof parsed.id === 'string' && parsed.id.length > 0 ? parsed.id : hashRow(parsed),
      input: parsed.input,
      ...(parsed.expected !== undefined ? { expected: parsed.expected } : {}),
      ...(parsed.tags !== undefined ? { tags: parsed.tags } : {}),
    };
    rows.push(row);
  }
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) {
      throw new Error(`Duplicate row id "${row.id}" in ${datasetPath}`);
    }
    seen.add(row.id);
  }
  return rows;
}

function hashRow(row: Partial<DatasetRow>): string {
  const payload = JSON.stringify({ input: row.input, expected: row.expected });
  return createHash('sha256').update(payload).digest('hex').slice(0, 12);
}

export function notesPathFor(datasetPath: string): string {
  const ext = path.extname(datasetPath);
  const base = ext.length > 0 ? datasetPath.slice(0, -ext.length) : datasetPath;
  return `${base}.notes.jsonl`;
}

export async function readNotes(datasetPath: string): Promise<Map<string, NotesEntry>> {
  const p = notesPathFor(datasetPath);
  const map = new Map<string, NotesEntry>();
  let text: string;
  try {
    text = await fs.readFile(p, 'utf8');
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') return map;
    throw err;
  }
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line) as NotesEntry;
    if (!entry.rowId) continue;
    map.set(entry.rowId, entry);
  }
  return map;
}

export async function writeNote(datasetPath: string, entry: NotesEntry): Promise<void> {
  const all = await readNotes(datasetPath);
  all.set(entry.rowId, entry);
  const p = notesPathFor(datasetPath);
  const tmp = `${p}.${Date.now()}.tmp`;
  const lines = [...all.values()].map((e) => JSON.stringify(e));
  await fs.writeFile(tmp, lines.join('\n') + '\n', 'utf8');
  await fs.rename(tmp, p);
}
