import { describe, expect, test } from 'bun:test';
import { generateRunId, hashConfig, tryGitSha } from './manifest';
import type { SuiteConfig } from './types';

const cfg: SuiteConfig = {
  name: 'demo',
  dataset: 'd.jsonl',
  prompt: 'p.ts',
  evals: [],
  variants: [{ name: 'main', model: { provider: 'anthropic', id: 'm' } }],
};

describe('generateRunId', () => {
  test('joins name and timestamp with a hyphen', () => {
    const id = generateRunId('my-run', new Date('2026-04-17T12:34:56Z'));
    expect(id).toBe('my-run-2026-04-17T12-34-56');
  });

  test('sanitizes non-safe characters from the name', () => {
    const id = generateRunId('my/run?with spaces!', new Date('2026-04-17T12:34:56Z'));
    expect(id).toBe('my-run-with-spaces-2026-04-17T12-34-56');
  });

  test('falls back to "run" when the name sanitizes to empty', () => {
    const id = generateRunId('!!!', new Date('2026-04-17T12:34:56Z'));
    expect(id).toBe('run-2026-04-17T12-34-56');
  });

  test('distinct timestamps produce distinct ids', () => {
    const a = generateRunId('x', new Date('2026-04-17T12:34:56Z'));
    const b = generateRunId('x', new Date('2026-04-17T12:34:57Z'));
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
