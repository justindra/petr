import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadEnvFromDir, parseEnvFile } from './env';

describe('parseEnvFile', () => {
  test('parses KEY=value lines', () => {
    expect(parseEnvFile('FOO=bar\nBAZ=qux')).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  test('ignores comments and blank lines', () => {
    expect(parseEnvFile('# a comment\n\nFOO=1\n# trailing\n')).toEqual({ FOO: '1' });
  });

  test('strips surrounding quotes', () => {
    expect(parseEnvFile(`A="hello"\nB='world'`)).toEqual({ A: 'hello', B: 'world' });
  });

  test('preserves = signs inside the value', () => {
    expect(parseEnvFile('URL=https://x.com/path?q=1')).toEqual({
      URL: 'https://x.com/path?q=1',
    });
  });

  test('rejects malformed keys silently', () => {
    expect(parseEnvFile('1BAD=x\nGOOD=y')).toEqual({ GOOD: 'y' });
  });
});

describe('loadEnvFromDir', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('loads .env when present, without overwriting existing env vars', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'petr-env-'));
    await fs.writeFile(
      path.join(dir, '.env'),
      'PETR_TEST_NEW=from_file\nPETR_TEST_EXISTING=from_file',
    );
    process.env['PETR_TEST_EXISTING'] = 'from_shell';

    const result = loadEnvFromDir(dir);

    expect(result.loaded).toHaveLength(1);
    expect(process.env['PETR_TEST_NEW']).toBe('from_file');
    expect(process.env['PETR_TEST_EXISTING']).toBe('from_shell');
  });

  test('.env.local wins over .env when both set the same key', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'petr-env-'));
    await fs.writeFile(path.join(dir, '.env'), 'PETR_TEST_PRIORITY=from_env');
    await fs.writeFile(path.join(dir, '.env.local'), 'PETR_TEST_PRIORITY=from_local');

    loadEnvFromDir(dir);

    expect(process.env['PETR_TEST_PRIORITY']).toBe('from_local');
  });

  test('returns empty loaded list when no .env files exist', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'petr-env-'));
    const result = loadEnvFromDir(dir);
    expect(result.loaded).toHaveLength(0);
    expect(result.skipped.length).toBeGreaterThan(0);
  });
});
