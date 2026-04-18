import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { defineConfig, loadConfig, resolveVariant, validateConfig } from './config';
import type { SuiteConfig } from './types';

const baseConfig: SuiteConfig = {
  name: 'test',
  dataset: './data.jsonl',
  prompt: './prompt.ts',
  evals: [{ name: 'e', type: 'equals' }],
  variants: [{ name: 'main', model: { provider: 'anthropic', id: 'claude-3' } }],
};

describe('defineConfig', () => {
  test('returns the config it was given', () => {
    expect(defineConfig(baseConfig)).toEqual(baseConfig);
  });
});

describe('validateConfig', () => {
  test('passes a valid single-variant config', () => {
    expect(() => validateConfig(baseConfig)).not.toThrow();
  });

  test('passes a valid multi-variant config', () => {
    expect(() =>
      validateConfig({
        ...baseConfig,
        variants: [
          { name: 'a', model: { provider: 'anthropic', id: 'x' } },
          { name: 'b', model: { provider: 'openai', id: 'y' }, prompt: './other.ts' },
        ],
      }),
    ).not.toThrow();
  });

  test('rejects missing name', () => {
    expect(() => validateConfig({ ...baseConfig, name: '' })).toThrow(/name is required/);
  });

  test('rejects empty variants array', () => {
    expect(() => validateConfig({ ...baseConfig, variants: [] })).toThrow(
      /variants must be a non-empty array/,
    );
  });

  test('rejects variant missing name', () => {
    expect(() =>
      validateConfig({
        ...baseConfig,
        variants: [{ name: '', model: { provider: 'anthropic', id: 'x' } }],
      }),
    ).toThrow(/variants\[0\].name is required/);
  });

  test('rejects variant missing model.id', () => {
    expect(() =>
      validateConfig({
        ...baseConfig,
        variants: [{ name: 'a', model: { provider: 'anthropic', id: '' } }],
      }),
    ).toThrow(/variants\[0\].model.id is required/);
  });

  test('rejects duplicate variant names', () => {
    expect(() =>
      validateConfig({
        ...baseConfig,
        variants: [
          { name: 'x', model: { provider: 'anthropic', id: 'a' } },
          { name: 'x', model: { provider: 'openai', id: 'b' } },
        ],
      }),
    ).toThrow(/duplicate variant name: "x"/);
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

describe('resolveVariant', () => {
  test('materializes a variant with the suite prompt by default', () => {
    const resolved = resolveVariant(baseConfig, 'main');
    expect(resolved.variantName).toBe('main');
    expect(resolved.model.id).toBe('claude-3');
    expect(resolved.prompt).toBe('./prompt.ts');
    expect('variants' in resolved).toBe(false);
  });

  test('applies a per-variant prompt override', () => {
    const resolved = resolveVariant(
      {
        ...baseConfig,
        variants: [
          {
            name: 'main',
            model: { provider: 'anthropic', id: 'x' },
            prompt: './override.ts',
          },
        ],
      },
      'main',
    );
    expect(resolved.prompt).toBe('./override.ts');
  });

  test('throws on an unknown variant name', () => {
    expect(() => resolveVariant(baseConfig, 'nope')).toThrow(
      /unknown variant "nope" \(available: main\)/,
    );
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
