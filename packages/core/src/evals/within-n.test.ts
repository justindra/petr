import { describe, expect, test } from 'bun:test';
import type { DatasetRow } from '../types.js';
import { runWithinN } from './within-n.js';

const row: DatasetRow = { id: 'r', input: {}, expected: { score: 5 } };

describe('runWithinN', () => {
  test('passes when within threshold', () => {
    expect(
      runWithinN({ name: 'w', type: 'withinN', field: 'score', n: 1 }, { score: 6 }, row).pass,
    ).toBe(true);
  });

  test('fails when outside threshold', () => {
    expect(
      runWithinN({ name: 'w', type: 'withinN', field: 'score', n: 1 }, { score: 8 }, row).pass,
    ).toBe(false);
  });

  test('coerces numeric strings', () => {
    expect(
      runWithinN({ name: 'w', type: 'withinN', field: 'score', n: 0 }, { score: '5' }, row).pass,
    ).toBe(true);
  });

  test('fails on non-numeric values', () => {
    expect(
      runWithinN({ name: 'w', type: 'withinN', field: 'score', n: 1 }, { score: 'NaN-ish' }, row)
        .pass,
    ).toBe(false);
  });
});
