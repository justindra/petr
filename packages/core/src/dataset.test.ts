import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { notesPathFor, readDataset, readNotes, writeNote } from './dataset';

async function tmpdir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'petr-ds-'));
}

describe('readDataset', () => {
  test('reads one row per non-empty line', async () => {
    const dir = await tmpdir();
    const file = path.join(dir, 'ds.jsonl');
    await fs.writeFile(
      file,
      [
        JSON.stringify({ id: 'a', input: { q: 1 }, expected: { a: 2 } }),
        '',
        JSON.stringify({ id: 'b', input: { q: 3 } }),
      ].join('\n'),
    );
    const rows = await readDataset(file);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe('a');
    expect(rows[1]?.id).toBe('b');
  });

  test('assigns a deterministic id when one is missing', async () => {
    const dir = await tmpdir();
    const file = path.join(dir, 'ds.jsonl');
    const payload = { input: { q: 'abc' }, expected: 'z' };
    await fs.writeFile(file, JSON.stringify(payload) + '\n');
    const first = (await readDataset(file))[0];
    const second = (await readDataset(file))[0];
    expect(first?.id).toBe(second?.id);
    expect(first?.id).toMatch(/^[a-f0-9]{12}$/);
  });

  test('rejects duplicate ids', async () => {
    const dir = await tmpdir();
    const file = path.join(dir, 'ds.jsonl');
    await fs.writeFile(
      file,
      [JSON.stringify({ id: 'x', input: 1 }), JSON.stringify({ id: 'x', input: 2 })].join('\n'),
    );
    await expect(readDataset(file)).rejects.toThrow(/Duplicate row id "x"/);
  });

  test('rejects rows missing input', async () => {
    const dir = await tmpdir();
    const file = path.join(dir, 'ds.jsonl');
    await fs.writeFile(file, JSON.stringify({ id: 'a' }));
    await expect(readDataset(file)).rejects.toThrow(/missing required "input"/);
  });

  test('reports JSON parse errors with line numbers', async () => {
    const dir = await tmpdir();
    const file = path.join(dir, 'ds.jsonl');
    await fs.writeFile(file, '{"input":1}\nnot json');
    await expect(readDataset(file)).rejects.toThrow(/ds\.jsonl:2 invalid JSON/);
  });
});

describe('notesPathFor', () => {
  test('replaces .jsonl with .notes.jsonl', () => {
    expect(notesPathFor('/a/b/dataset.jsonl')).toBe('/a/b/dataset.notes.jsonl');
  });

  test('handles no extension', () => {
    expect(notesPathFor('/a/b/dataset')).toBe('/a/b/dataset.notes.jsonl');
  });
});

describe('notes read/write', () => {
  test('writes atomically and survives re-read', async () => {
    const dir = await tmpdir();
    const dataset = path.join(dir, 'ds.jsonl');
    await fs.writeFile(dataset, JSON.stringify({ id: 'a', input: 1 }));

    await writeNote(dataset, {
      rowId: 'a',
      text: 'needs review',
      tags: ['dataset-issue'],
      updatedAt: '2026-04-17T00:00:00.000Z',
    });

    const notes = await readNotes(dataset);
    expect(notes.get('a')?.text).toBe('needs review');
  });

  test('updates an existing note instead of duplicating', async () => {
    const dir = await tmpdir();
    const dataset = path.join(dir, 'ds.jsonl');
    await fs.writeFile(dataset, JSON.stringify({ id: 'a', input: 1 }));

    await writeNote(dataset, { rowId: 'a', text: 'first', updatedAt: '2026-04-17T00:00:00Z' });
    await writeNote(dataset, { rowId: 'a', text: 'second', updatedAt: '2026-04-17T00:00:01Z' });

    const notes = await readNotes(dataset);
    expect(notes.size).toBe(1);
    expect(notes.get('a')?.text).toBe('second');
  });

  test('readNotes returns empty map when file does not exist', async () => {
    const dir = await tmpdir();
    const notes = await readNotes(path.join(dir, 'nope.jsonl'));
    expect(notes.size).toBe(0);
  });
});
