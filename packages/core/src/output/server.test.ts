import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readNotes } from '../dataset';
import type { ReviewServerHandle } from './server';
import { startReviewServer } from './server';

let handle: ReviewServerHandle;
let runDir: string;
let datasetPath: string;

beforeAll(async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'petr-srv-'));
  datasetPath = path.join(tmp, 'ds.jsonl');
  await fs.writeFile(datasetPath, JSON.stringify({ id: 'r1', input: { q: 'hi' } }));

  runDir = path.join(tmp, 'runs', 'testrun');
  await fs.mkdir(runDir, { recursive: true });
  const manifest = {
    name: 't',
    runId: 'testrun',
    startedAt: '',
    endedAt: '',
    configHash: 'x',
    gitSha: null,
    model: { provider: 'anthropic', id: 'm' },
    datasetPath: 'ds.jsonl',
    promptPath: 'p.ts',
    rowCount: 1,
    passCount: 1,
    totalTokensIn: 0,
    totalTokensOut: 0,
    estimatedCostUsd: null,
  };
  // The server resolves the dataset path relative to ../../<manifest.datasetPath> from runDir.
  // runDir = tmp/runs/testrun → ../.. = tmp → tmp/ds.jsonl ✓
  await fs.writeFile(
    path.join(runDir, 'results.json'),
    JSON.stringify({
      manifest,
      results: [
        {
          id: 'r1',
          input: { q: 'hi' },
          expected: null,
          output: 'hello',
          error: null,
          evals: [],
          pass: true,
          latencyMs: 5,
          tokensIn: 1,
          tokensOut: 1,
          transcript: [],
        },
      ],
    }),
  );

  handle = await startReviewServer({ runDir, port: 0 });
});

afterAll(async () => {
  await handle.stop();
});

describe('review server', () => {
  test('GET /api/run returns manifest + results', async () => {
    const res = await fetch(`${handle.url}/api/run`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { manifest: { runId: string }; results: unknown[] };
    expect(body.manifest.runId).toBe('testrun');
    expect(body.results).toHaveLength(1);
  });

  test('POST /api/notes/:id persists a note to the sidecar', async () => {
    const res = await fetch(`${handle.url}/api/notes/r1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'needs review', tags: ['prompt-issue'] }),
    });
    expect(res.status).toBe(200);
    const notes = await readNotes(datasetPath);
    expect(notes.get('r1')?.text).toBe('needs review');
    expect(notes.get('r1')?.tags).toEqual(['prompt-issue']);
  });
});
