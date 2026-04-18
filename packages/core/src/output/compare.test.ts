import { describe, expect, test } from 'bun:test';
import type { RunManifest } from '../types';
import { formatCompareSummary, type CompareData } from './compare';

const manifest: RunManifest = {
  name: 'demo',
  variantName: 'main',
  runId: 'r',
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

function makeCompareData(
  summary: CompareData['summary'],
  rowCount: number = summary.length,
): CompareData {
  return {
    aLabel: 'demo/alpha',
    bLabel: 'demo/beta',
    manifestA: manifest,
    manifestB: manifest,
    rows: Array.from({ length: rowCount }, (_, i) => ({
      id: `r${i}`,
      input: {},
      expected: null,
      outputA: null,
      outputB: null,
      passA: false,
      passB: false,
      errorA: null,
      errorB: null,
      evalsA: [],
      evalsB: [],
    })),
    summary,
  };
}

describe('formatCompareSummary', () => {
  test('shows pass-rate delta for each eval', () => {
    const text = formatCompareSummary(
      makeCompareData([
        { eval: 'label-match', passRateA: 1, passRateB: 1, delta: 0 },
        { eval: 'within-1', passRateA: 0.8, passRateB: 0.9, delta: 0.1 },
      ]),
    );
    expect(text).toContain('Compare: demo/alpha vs demo/beta  (2 rows)');
    expect(text).toContain('label-match');
    expect(text).toMatch(/100\.0% → +100\.0%/);
    expect(text).toContain('(+0.0pp)');
    expect(text).toContain('within-1');
    expect(text).toMatch(/80\.0% → +90\.0%/);
    expect(text).toContain('(+10.0pp)');
  });

  test('uses a minus sign for regressions', () => {
    const text = formatCompareSummary(
      makeCompareData([{ eval: 'label-match', passRateA: 1, passRateB: 0, delta: -1 }]),
    );
    expect(text).toContain('(-100.0pp)');
  });

  test('degrades gracefully when no evals ran on both sides', () => {
    const text = formatCompareSummary(makeCompareData([], 5));
    expect(text).toContain('Compare: demo/alpha vs demo/beta  (5 rows)');
    expect(text).toContain('no evals were run on both sides');
  });
});
