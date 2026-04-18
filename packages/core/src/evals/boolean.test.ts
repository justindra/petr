import { describe, expect, test } from 'bun:test';
import type { DatasetRow } from '../types.js';
import { runBoolean } from './boolean.js';

const row: DatasetRow = { id: 'r', input: {}, expected: { answer: true } };

describe('runBoolean', () => {
  test('true booleans match', () => {
    expect(
      runBoolean({ name: 'b', type: 'boolean', field: 'answer' }, { answer: true }, row).pass,
    ).toBe(true);
  });

  test('"yes" and true are equal', () => {
    expect(
      runBoolean({ name: 'b', type: 'boolean', field: 'answer' }, { answer: 'yes' }, row).pass,
    ).toBe(true);
  });

  test('mismatch fails with a detail', () => {
    const r = runBoolean({ name: 'b', type: 'boolean', field: 'answer' }, { answer: 'no' }, row);
    expect(r.pass).toBe(false);
    expect(r.detail).toContain('expected true');
  });

  test('non-boolean-ish actuals fail cleanly', () => {
    const r = runBoolean({ name: 'b', type: 'boolean', field: 'answer' }, { answer: 'maybe' }, row);
    expect(r.pass).toBe(false);
    expect(r.detail).toContain('not a boolean-ish');
  });
});
