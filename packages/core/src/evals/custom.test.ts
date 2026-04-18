import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { DatasetRow, LLMContext, Logger } from '../types';
import { runCustom } from './custom';

const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

const dummyLLM: LLMContext = {
  model: {} as LLMContext['model'],
  generateText: async () => ({
    text: '',
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    messages: [],
  }),
};

describe('runCustom', () => {
  test('loads and invokes a user-supplied eval file', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'petr-custom-'));
    const file = path.join(dir, 'my-eval.ts');
    await fs.writeFile(
      file,
      `export default async (args) => ({
         pass: args.actual === 'expected',
         score: args.actual === 'expected' ? 1 : 0,
         detail: 'custom ran',
       });`,
    );
    const row: DatasetRow = { id: 'r', input: {} };
    const result = await runCustom(
      { name: 'c', type: 'custom', file: 'my-eval.ts' },
      dir,
      'expected',
      row,
      { llm: dummyLLM, logger: silentLogger },
    );
    expect(result.pass).toBe(true);
    expect(result.name).toBe('c');
    expect(result.detail).toBe('custom ran');
  });

  test('throws when the file has no default export', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'petr-custom-'));
    const file = path.join(dir, 'broken.ts');
    await fs.writeFile(file, `export const nope = 1;`);
    const row: DatasetRow = { id: 'r', input: {} };
    await expect(
      runCustom({ name: 'c', type: 'custom', file: 'broken.ts' }, dir, null, row, {
        llm: dummyLLM,
        logger: silentLogger,
      }),
    ).rejects.toThrow(/default export/);
  });
});
