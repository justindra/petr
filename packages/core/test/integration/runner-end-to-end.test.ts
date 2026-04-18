import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  loadConfig,
  resolveVariant,
  runSuite,
  silentLogger,
  writeVariantArtifacts,
  type LLMSession,
  type SuiteConfig,
} from '../../src/index.js';

function fakeSession(scripted: Record<string, string>): () => LLMSession {
  return () => {
    const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
    const llm = {
      model: 'fake' as unknown as never,
      async generateText(args: { prompt?: string }) {
        const key = args.prompt ?? '';
        return {
          text: scripted[key] ?? '',
          usage,
          messages: [],
        };
      },
    };
    return {
      llm,
      getUsage: () => usage,
      getTranscript: () => [],
    };
  };
}

async function writeFixture(
  rows: Array<{ id: string; input: unknown; expected: unknown }>,
  promptSrc: string,
): Promise<{ configPath: string; baseDir: string; config: SuiteConfig }> {
  const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'petr-int-'));
  await fs.writeFile(
    path.join(baseDir, 'dataset.jsonl'),
    rows.map((r) => JSON.stringify(r)).join('\n') + '\n',
  );
  await fs.writeFile(path.join(baseDir, 'prompt.ts'), promptSrc);

  const configSrc = `import { defineConfig } from '${path.resolve(import.meta.dir, '../../src/config.ts').replace(/\\/g, '/')}';
export default defineConfig({
  name: 'integration',
  dataset: './dataset.jsonl',
  prompt: './prompt.ts',
  evals: [
    { name: 'label-match', type: 'equals', field: 'label' },
    { name: 'score-within-1', type: 'withinN', field: 'score', n: 1 },
  ],
  variants: [{ name: 'main', model: { provider: 'anthropic', id: 'claude-haiku-4-5' } }],
  concurrency: 2,
});`;
  const configPath = path.join(baseDir, 'petr.config.ts');
  await fs.writeFile(configPath, configSrc);
  const { config } = await loadConfig(configPath);
  return { configPath, baseDir, config };
}

describe('runner integration', () => {
  test('runs a 3-row dataset, writes CSV + JSON + manifest + HTML', async () => {
    const { baseDir, config } = await writeFixture(
      [
        { id: 'a', input: { msg: 'thanks' }, expected: { label: 'positive', score: 8 } },
        { id: 'b', input: { msg: 'bad' }, expected: { label: 'negative', score: 8 } },
        { id: 'c', input: { msg: 'when' }, expected: { label: 'neutral', score: 99 } },
      ],
      `export default async (input, ctx) => {
         const { text } = await ctx.llm.generateText({ prompt: input.msg });
         return { label: text, score: text.length };
       };`,
    );

    const resolved = resolveVariant(config, 'main');
    const result = await runSuite({
      config: resolved,
      baseDir,
      logger: silentLogger,
      buildSession: fakeSession({ thanks: 'positive', bad: 'negative', when: 'neutral' }),
    });

    expect(result.manifest.rowCount).toBe(3);
    // a + b pass (label matches, score matches), c fails score (|7-99|)
    expect(result.manifest.passCount).toBe(2);

    const variantDir = path.join(baseDir, 'runs', 'suite', resolved.variantName);
    const artifacts = await writeVariantArtifacts({
      config: resolved,
      manifest: result.manifest,
      results: result.results,
      variantDir,
    });

    const [csv, json, manifest, html] = await Promise.all([
      fs.readFile(artifacts.csvPath, 'utf8'),
      fs.readFile(artifacts.jsonPath, 'utf8'),
      fs.readFile(artifacts.manifestPath, 'utf8'),
      fs.readFile(artifacts.htmlPath, 'utf8'),
    ]);

    expect(csv).toContain('eval.label-match.pass');
    expect(csv).toContain('a,');
    const parsed = JSON.parse(json) as { manifest: { rowCount: number }; results: unknown[] };
    expect(parsed.manifest.rowCount).toBe(3);
    expect(parsed.results).toHaveLength(3);
    expect(manifest).toContain('"runId"');
    expect(html.length).toBeGreaterThan(100);
  });
});
