import { describe, expect, test } from 'bun:test';
import type { DatasetRow } from '../types';
import { runRegex } from './regex';

const row: DatasetRow = { id: 'r', input: {} };

describe('runRegex', () => {
  test('passes when the pattern matches', () => {
    expect(runRegex({ name: 'r', type: 'regex', pattern: '^hello' }, 'hello world', row).pass).toBe(
      true,
    );
  });

  test('fails when the pattern does not match', () => {
    expect(runRegex({ name: 'r', type: 'regex', pattern: '^hi' }, 'hello', row).pass).toBe(false);
  });

  test('honors flags', () => {
    expect(
      runRegex({ name: 'r', type: 'regex', pattern: 'ERROR', flags: 'i' }, 'some error here', row)
        .pass,
    ).toBe(true);
  });

  test('invalid regex produces a non-passing result with a detail', () => {
    const r = runRegex({ name: 'r', type: 'regex', pattern: '([' }, 'x', row);
    expect(r.pass).toBe(false);
    expect(r.detail).toContain('invalid regex');
  });
});
