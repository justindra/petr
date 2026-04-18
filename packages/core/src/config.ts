import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SuiteConfig } from './types';

/**
 * Identity helper that gives a suite config full type inference and a single
 * entry point users can recognize in `petr.config.ts` files.
 *
 * @example
 * ```ts
 * import { defineConfig } from '@petr/core';
 *
 * export default defineConfig({
 *   name: 'classification',
 *   dataset: './data.jsonl',
 *   prompt: './prompt.ts',
 *   model: { provider: 'anthropic', id: 'claude-sonnet-4.6' },
 *   evals: [{ name: 'label-match', type: 'equals', field: 'label' }],
 * });
 * ```
 */
export function defineConfig(config: SuiteConfig): SuiteConfig {
  return config;
}

/**
 * Dynamically imports a TypeScript config file and validates its shape.
 *
 * The file must export its `SuiteConfig` as the default export (or as a named
 * `config` export). Relative paths inside the config are later resolved against
 * the returned `baseDir`.
 *
 * @param configPath - Path to the config file, absolute or relative to the cwd.
 * @returns The parsed config, the absolute path it was loaded from, and the
 *   directory to treat as the base for resolving relative paths in the config.
 * @throws When the file has no valid default export, or when the config fails
 *   the shape validation in {@link validateConfig}.
 */
export async function loadConfig(configPath: string): Promise<{
  config: SuiteConfig;
  absPath: string;
  baseDir: string;
}> {
  const absPath = path.resolve(configPath);
  const url = pathToFileURL(absPath).href;
  const mod = (await import(url)) as { default?: SuiteConfig; config?: SuiteConfig };
  const config = mod.default ?? mod.config;
  if (!config) {
    throw new Error(
      `Config file ${configPath} must export a config via \`export default defineConfig(...)\``,
    );
  }
  validateConfig(config);
  return { config, absPath, baseDir: path.dirname(absPath) };
}

/**
 * Throws if the config is missing any of the fields the runner depends on.
 * Use this in tests or when constructing configs programmatically; `loadConfig`
 * already calls it.
 */
export function validateConfig(config: SuiteConfig): void {
  if (!config.name) throw new Error('config.name is required');
  if (!config.dataset) throw new Error('config.dataset is required');
  if (!config.prompt) throw new Error('config.prompt is required');
  if (!config.model?.provider) throw new Error('config.model.provider is required');
  if (!config.model?.id) throw new Error('config.model.id is required');
  if (!Array.isArray(config.evals)) throw new Error('config.evals must be an array');
  for (const [i, ev] of config.evals.entries()) {
    if (!ev.name) throw new Error(`config.evals[${i}].name is required`);
    if (!ev.type) throw new Error(`config.evals[${i}].type is required`);
  }
}

/**
 * Resolves a config-relative path against the config file's directory.
 * Absolute paths pass through unchanged.
 */
export function resolveRelativeToConfig(baseDir: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) return relativePath;
  return path.resolve(baseDir, relativePath);
}
