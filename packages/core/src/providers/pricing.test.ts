import { describe, expect, test } from 'bun:test';
import { estimateCostUsd } from './pricing';

describe('estimateCostUsd', () => {
  test('computes cost for known models', () => {
    const cost = estimateCostUsd({ provider: 'openai', id: 'gpt-4o-mini' }, 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.75, 3);
  });

  test('returns null for unknown models', () => {
    expect(estimateCostUsd({ provider: 'anthropic', id: 'made-up' }, 100, 100)).toBe(null);
  });
});
