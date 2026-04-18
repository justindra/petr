import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { LLMSession } from './context.js';
import { runSuite } from './runner.js';
import type {
  GenerateTextArgs,
  GenerateTextResult,
  LLMContext,
  PromptFn,
  SuiteConfig,
} from './types.js';

function fakeSession(reply: string): LLMSession {
  const llm: LLMContext = {
    model: 'fake' as unknown as LLMContext['model'],
    async generateText(_args: GenerateTextArgs): Promise<GenerateTextResult> {
      return {
        text: reply,
        usage: { inputTokens: 5, outputTokens: 7, totalTokens: 12 },
        messages: [],
      };
    },
  };
  return {
    llm,
    getUsage: () => ({ inputTokens: 5, outputTokens: 7, totalTokens: 12 }),
    getTranscript: () => [{ role: 'assistant', content: reply }],
  };
}

async function scaffoldSuite(
  rows: string[],
  promptSource: string,
): Promise<{
  config: SuiteConfig;
  baseDir: string;
  promptFn: PromptFn;
}> {
  const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'petr-run-'));
  const dsPath = path.join(baseDir, 'ds.jsonl');
  await fs.writeFile(dsPath, rows.join('\n') + '\n');
  const promptPath = path.join(baseDir, 'prompt.ts');
  await fs.writeFile(promptPath, promptSource);
  const config: SuiteConfig = {
    name: 'fixture',
    dataset: 'ds.jsonl',
    prompt: 'prompt.ts',
    model: { provider: 'anthropic', id: 'claude-haiku-4-5' },
    evals: [{ name: 'label-match', type: 'equals', field: 'label' }],
  };
  const mod = (await import(path.toNamespacedPath(promptPath))) as { default: PromptFn };
  return { config, baseDir, promptFn: mod.default };
}

describe('runSuite', () => {
  test('runs a dataset against a prompt and scores with evals', async () => {
    const { config, baseDir } = await scaffoldSuite(
      [
        JSON.stringify({ id: 'r1', input: { q: 'hi' }, expected: { label: 'greeting' } }),
        JSON.stringify({ id: 'r2', input: { q: 'bye' }, expected: { label: 'farewell' } }),
      ],
      `export default async (input, ctx) => {
         const { text } = await ctx.llm.generateText({ prompt: input.q });
         return { label: text };
       };`,
    );

    const out = await runSuite({
      config,
      baseDir,
      buildSession: () => fakeSession('greeting'),
      concurrency: 1,
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    });

    expect(out.manifest.rowCount).toBe(2);
    expect(out.manifest.passCount).toBe(1); // first row matches, second doesn't
    expect(out.results[0]?.pass).toBe(true);
    expect(out.results[1]?.pass).toBe(false);
    expect(out.manifest.totalTokensIn).toBe(10);
    expect(out.manifest.totalTokensOut).toBe(14);
  });

  test('captures thrown errors as row errors rather than crashing', async () => {
    const { config, baseDir } = await scaffoldSuite(
      [JSON.stringify({ id: 'r1', input: { q: 'hi' }, expected: { label: 'x' } })],
      `export default async () => { throw new Error('boom'); };`,
    );

    const out = await runSuite({
      config,
      baseDir,
      buildSession: () => fakeSession('x'),
      maxRetries: 0,
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    });

    expect(out.results[0]?.error).toBe('boom');
    expect(out.results[0]?.pass).toBe(false);
  });

  test('retries on transient failures until max retries exhausted', async () => {
    const { config, baseDir } = await scaffoldSuite(
      [JSON.stringify({ id: 'r1', input: { q: 'hi' }, expected: { label: 'x' } })],
      `let calls = 0;
       export default async () => {
         calls++;
         if (calls < 3) throw new Error('retry me');
         return { label: 'x' };
       };`,
    );

    const out = await runSuite({
      config,
      baseDir,
      buildSession: () => fakeSession('x'),
      maxRetries: 5,
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    });

    expect(out.results[0]?.pass).toBe(true);
    expect(out.results[0]?.error).toBe(null);
  });

  test('honors --limit', async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({ id: `r${i}`, input: { q: i }, expected: { label: 'x' } }),
    );
    const { config, baseDir } = await scaffoldSuite(
      rows,
      `export default async () => ({ label: 'x' });`,
    );

    const out = await runSuite({
      config,
      baseDir,
      buildSession: () => fakeSession('x'),
      limit: 3,
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    });

    expect(out.results.length).toBe(3);
  });
});
