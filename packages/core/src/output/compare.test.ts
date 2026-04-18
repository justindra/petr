import { describe, expect, test } from 'bun:test';
import type { RunManifest } from '../types';
import { formatCompareSummary, type CompareData } from './compare';

const manifest: RunManifest = {
  name: 'demo',
  variantName: 'main',
  runId: 'r',
  baseDir: '/tmp',
  startedAt: '',
  endedAt: '',
  configHash: '',
  gitSha: null,
  model: { provider: 'anthropic', id: 'm' },
  datasetPath: 'ds.jsonl',
  promptPath: 'p.ts',
  rowCount: 0,
  passCount: 0,
  totalTokensIn: 0,
  totalTokensOut: 0,
  estimatedCostUsd: null,
};

function makeCompareData(opts: {
  variants: string[];
  summary: CompareData['summary'];
  rowCount?: number;
}): CompareData {
  const manifests: Record<string, RunManifest> = {};
  for (const v of opts.variants) manifests[v] = manifest;
  return {
    variants: opts.variants,
    manifests,
    rows: Array.from({ length: opts.rowCount ?? opts.summary.length }, (_, i) => {
      const outputs: Record<string, unknown> = {};
      const passes: Record<string, boolean> = {};
      const errors: Record<string, string | null> = {};
      const evalResults: Record<string, never[]> = {};
      for (const v of opts.variants) {
        outputs[v] = null;
        passes[v] = false;
        errors[v] = null;
        evalResults[v] = [];
      }
      return { id: `r${i}`, input: {}, expected: null, outputs, passes, errors, evalResults };
    }),
    summary: opts.summary,
  };
}

describe('formatCompareSummary', () => {
  test('2-variant layout shows delta pp on one line per eval', () => {
    const text = formatCompareSummary(
      makeCompareData({
        variants: ['alpha', 'beta'],
        summary: [
          { eval: 'label-match', passRates: { alpha: 1, beta: 1 } },
          { eval: 'within-1', passRates: { alpha: 0.8, beta: 0.9 } },
        ],
      }),
    );
    expect(text).toContain('Compare: 2 variants  (2 rows)');
    expect(text).toContain('alpha → beta');
    expect(text).toMatch(/100\.0% → +100\.0%/);
    expect(text).toMatch(/\(\+0\.0pp\)/);
    expect(text).toMatch(/80\.0% → +90\.0%/);
    expect(text).toMatch(/\(\+10\.0pp\)/);
  });

  test('2-variant layout uses a minus sign for regressions', () => {
    const text = formatCompareSummary(
      makeCompareData({
        variants: ['alpha', 'beta'],
        summary: [{ eval: 'label-match', passRates: { alpha: 1, beta: 0 } }],
      }),
    );
    expect(text).toMatch(/\(-100\.0pp\)/);
  });

  test('3+ variant layout lists each variant under the eval name', () => {
    const text = formatCompareSummary(
      makeCompareData({
        variants: ['copilot', 'bedrock', 'openai'],
        summary: [{ eval: 'label-match', passRates: { copilot: 1, bedrock: 1, openai: 0.875 } }],
      }),
    );
    expect(text).toContain('Compare: 3 variants  (1 rows)');
    expect(text).toContain('label-match');
    expect(text).toContain('copilot');
    expect(text).toContain('bedrock');
    expect(text).toContain('openai');
    expect(text).toContain('100.0%');
    expect(text).toContain(' 87.5%');
  });

  test('degrades gracefully when no evals ran', () => {
    const text = formatCompareSummary(
      makeCompareData({ variants: ['alpha', 'beta'], summary: [], rowCount: 5 }),
    );
    expect(text).toContain('Compare: 2 variants  (5 rows)');
    expect(text).toContain('no evals were run on any variant');
  });
});
