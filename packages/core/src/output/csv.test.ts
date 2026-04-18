import { describe, expect, test } from 'bun:test';
import type { RowResult, SuiteConfig } from '../types.js';
import { rowResultsToCsv } from './csv.js';

const config: SuiteConfig = {
  name: 't',
  dataset: 'd',
  prompt: 'p',
  model: { provider: 'anthropic', id: 'm' },
  evals: [
    { name: 'match', type: 'equals' },
    { name: 'within-1', type: 'withinN', n: 1 },
  ],
};

const results: RowResult[] = [
  {
    id: 'r1',
    input: { q: 'hi' },
    expected: { label: 'greeting' },
    output: { label: 'greeting' },
    error: null,
    evals: [
      { name: 'match', pass: true, score: 1 },
      { name: 'within-1', pass: false, score: 0, detail: '|5 - 3| = 2' },
    ],
    pass: false,
    latencyMs: 120,
    tokensIn: 12,
    tokensOut: 3,
    transcript: [],
  },
];

describe('rowResultsToCsv', () => {
  test('emits headers and one row per result with eval columns expanded', () => {
    const csv = rowResultsToCsv(config, results);
    const [header, row] = csv.trim().split('\n');
    expect(header).toContain('eval.match.pass');
    expect(header).toContain('eval.within-1.detail');
    expect(row).toContain('r1');
    expect(row).toContain('|5 - 3| = 2');
  });

  test('escapes commas and quotes in cells', () => {
    const rowsWithComma: RowResult[] = [
      {
        ...results[0]!,
        id: 'r2',
        output: 'he said "hello, world"',
      },
    ];
    const csv = rowResultsToCsv(config, rowsWithComma);
    expect(csv).toContain('"he said ""hello, world"""');
  });
});
