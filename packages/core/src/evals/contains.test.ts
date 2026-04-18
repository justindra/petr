import { describe, expect, test } from 'bun:test';
import type { DatasetRow } from '../types.js';
import { runContains } from './contains.js';

const row: DatasetRow = {
  id: 'r',
  input: {},
  expected: { keyword: 'error' },
};

describe('runContains', () => {
  test('passes when actual includes the expected substring', () => {
    expect(
      runContains(
        { name: 'c', type: 'contains', field: 'msg', expected: 'error' },
        { msg: 'fatal error occurred' },
        row,
      ).pass,
    ).toBe(true);
  });

  test('case-sensitive by default', () => {
    expect(runContains({ name: 'c', type: 'contains', expected: 'Error' }, 'error', row).pass).toBe(
      false,
    );
  });

  test('case-insensitive flag', () => {
    expect(
      runContains(
        { name: 'c', type: 'contains', expected: 'Error', caseInsensitive: true },
        'fatal error',
        row,
      ).pass,
    ).toBe(true);
  });

  test('serializes non-string actuals to JSON for matching', () => {
    expect(
      runContains({ name: 'c', type: 'contains', expected: '"a"' }, { k: 'a' }, row).pass,
    ).toBe(true);
  });
});
