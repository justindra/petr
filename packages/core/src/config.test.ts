import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { defineConfig, loadConfig, validateConfig } from './config.js';
import type { SuiteConfig } from './types.js';

const baseConfig: SuiteConfig = {
  name: 'test',
  dataset: './data.jsonl',
  prompt: './prompt.ts',
  model: { provider: 'anthropic', id: 'claude-3' },
  evals: [{ name: 'e', type: 'equals' }],
};

describe('defineConfig', () => {
  test('returns the config it was given', () => {
    expect(defineConfig(baseConfig)).toEqual(baseConfig);
  });
});

describe('validateConfig', () => {
  test('passes a valid config', () => {
    expect(() => validateConfig(baseConfig)).not.toThrow();
  });

  test('rejects missing name', () => {
    expect(() => validateConfig({ ...baseConfig, name: '' })).toThrow(/name is required/);
  });

  test('rejects missing model.id', () => {
    expect(() =>
      validateConfig({ ...baseConfig, model: { provider: 'anthropic', id: '' } }),
    ).toThrow(/model.id is required/);
  });

  test('rejects non-array evals', () => {
    expect(() =>
      validateConfig({ ...baseConfig, evals: 'bad' as unknown as SuiteConfig['evals'] }),
    ).toThrow(/evals must be an array/);
  });

  test('rejects eval missing name', () => {
    expect(() =>
      validateConfig({
        ...baseConfig,
        evals: [{ name: '', type: 'equals' }],
      }),
    ).toThrow(/evals\[0\].name is required/);
  });
});

describe('loadConfig', () => {
  test('dynamically imports a TS config with a default export', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'petr-cfg-'));
    const cfgPath = path.join(dir, 'petr.config.ts');
    await fs.writeFile(
      cfgPath,
      `import { defineConfig } from '${path.resolve(import.meta.dir, './config.ts').replace(/\\/g, '/')}';
       export default defineConfig(${JSON.stringify(baseConfig)});`,
    );
    const { config, baseDir } = await loadConfig(cfgPath);
    expect(config.name).toBe('test');
    expect(baseDir).toBe(dir);
  });

  test('throws when no default export', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'petr-cfg-'));
    const cfgPath = path.join(dir, 'petr.config.ts');
    await fs.writeFile(cfgPath, `export const unrelated = 1;`);
    await expect(loadConfig(cfgPath)).rejects.toThrow(/must export a config/);
  });
});
