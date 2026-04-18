import { describe, expect, test } from 'bun:test';
import { generateRunId, hashConfig, tryGitSha } from './manifest';
import type { SuiteConfig } from './types';

const cfg: SuiteConfig = {
  name: 'demo',
  dataset: 'd.jsonl',
  prompt: 'p.ts',
  model: { provider: 'anthropic', id: 'm' },
  evals: [],
};

describe('generateRunId', () => {
  test('starts with an ISO-like timestamp and includes the name', () => {
    const id = generateRunId('my-run', new Date('2026-04-17T12:34:56Z'));
    expect(id).toMatch(/^2026-04-17T12-34-56_my-run_[a-f0-9]{6}$/);
  });

  test('sanitizes non-safe characters from the name', () => {
    const id = generateRunId('my/run?with spaces!');
    expect(id).toMatch(/my-run-with-spaces-/);
  });

  test('produces a different id on each call', () => {
    const a = generateRunId('x');
    const b = generateRunId('x');
    expect(a).not.toBe(b);
  });
});

describe('hashConfig', () => {
  test('is stable for the same input', () => {
    expect(hashConfig(cfg)).toBe(hashConfig(cfg));
  });

  test('changes when the config changes', () => {
    expect(hashConfig(cfg)).not.toBe(hashConfig({ ...cfg, name: 'other' }));
  });
});

describe('tryGitSha', () => {
  test('returns null in a non-git directory', () => {
    expect(tryGitSha('/tmp')).toBe(null);
  });
});
