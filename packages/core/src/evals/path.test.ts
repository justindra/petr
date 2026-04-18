import { describe, expect, test } from 'bun:test';
import type { DatasetRow } from '../types';
import { getPath, resolveActual, resolveExpected } from './path';

describe('getPath', () => {
  test('returns the whole object when path is empty/undefined', () => {
    expect(getPath({ a: 1 }, undefined)).toEqual({ a: 1 });
  });

  test('walks nested dot-paths', () => {
    expect(getPath({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
  });

  test('returns undefined for missing keys', () => {
    expect(getPath({ a: 1 }, 'a.b')).toBeUndefined();
    expect(getPath(null, 'a')).toBeUndefined();
  });
});

describe('resolveExpected', () => {
  const row: DatasetRow = {
    id: 'r1',
    input: { question: 'hi' },
    expected: { label: 'greeting', score: 5 },
  };

  test('uses row.expected[field] when no expected is set', () => {
    expect(resolveExpected({ field: 'label' }, row)).toBe('greeting');
  });

  test('resolves row.* paths', () => {
    expect(resolveExpected({ expected: 'row.expected.score' }, row)).toBe(5);
  });

  test('resolves input.* paths', () => {
    expect(resolveExpected({ expected: 'input.question' }, row)).toBe('hi');
  });

  test('treats other strings as literals', () => {
    expect(resolveExpected({ expected: 'greeting' }, row)).toBe('greeting');
  });
});

describe('resolveActual', () => {
  test('returns the whole output when no field is set', () => {
    expect(resolveActual({}, { label: 'x' })).toEqual({ label: 'x' });
  });

  test('resolves dot-paths', () => {
    expect(resolveActual({ field: 'label' }, { label: 'x' })).toBe('x');
  });
});
