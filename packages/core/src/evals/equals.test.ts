import { describe, expect, test } from 'bun:test';
import type { DatasetRow } from '../types.js';
import { runEquals } from './equals.js';

const row: DatasetRow = {
  id: 'r1',
  input: {},
  expected: { label: 'greeting' },
};

describe('runEquals', () => {
  test('passes when primitive actual matches expected field', () => {
    const r = runEquals({ name: 'e', type: 'equals', field: 'label' }, { label: 'greeting' }, row);
    expect(r.pass).toBe(true);
    expect(r.score).toBe(1);
  });

  test('fails and reports a detail when values differ', () => {
    const r = runEquals({ name: 'e', type: 'equals', field: 'label' }, { label: 'other' }, row);
    expect(r.pass).toBe(false);
    expect(r.detail).toContain('greeting');
    expect(r.detail).toContain('other');
  });

  test('deep-equals nested objects and arrays', () => {
    const custom: DatasetRow = {
      id: 'r2',
      input: {},
      expected: { items: [{ a: 1 }, { a: 2 }] },
    };
    const r = runEquals({ name: 'e', type: 'equals' }, { items: [{ a: 1 }, { a: 2 }] }, custom);
    expect(r.pass).toBe(true);
  });
});
