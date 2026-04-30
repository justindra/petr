import path from 'node:path';
import { importUserModule } from './import-user-module';
import type { ResolvedSuiteConfig, SuiteConfig } from './types';

/**
 * Identity helper that gives a suite config full type inference and a single
 * entry point users can recognize in `petr.config.ts` files.
 *
 * @example
 * ```ts
 * import { defineConfig } from '@petr-ai/core';
 *
 * export default defineConfig({
 *   name: 'classification',
 *   dataset: './data.jsonl',
 *   prompt: './prompt.ts',
 *   evals: [{ name: 'label-match', type: 'equals', field: 'label' }],
 *   variants: [
 *     { name: 'copilot', model: { provider: 'copilot', id: 'claude-sonnet-4.6' } },
 *     { name: 'bedrock', model: { provider: 'bedrock', id: 'us.anthropic...' } },
 *   ],
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
 * @throws When the file has no valid default export, or when the config fails
 *   the shape validation in {@link validateConfig}.
 */
export async function loadConfig(configPath: string): Promise<{
  config: SuiteConfig;
  absPath: string;
  baseDir: string;
}> {
  const absPath = path.resolve(configPath);
  const mod = await importUserModule<{ default?: SuiteConfig; config?: SuiteConfig }>(absPath);
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
 * Throws if the config is missing any of the fields the runner depends on, or
 * declares variants that won't round-trip (duplicates, missing model, etc.).
 * Use this when constructing configs programmatically; `loadConfig` already
 * calls it.
 */
export function validateConfig(config: SuiteConfig): void {
  if (!config.name) throw new Error('config.name is required');
  if (!config.dataset) throw new Error('config.dataset is required');
  if (!config.prompt) throw new Error('config.prompt is required');
  if (!Array.isArray(config.evals)) throw new Error('config.evals must be an array');
  for (const [i, ev] of config.evals.entries()) {
    if (!ev.name) throw new Error(`config.evals[${i}].name is required`);
    if (!ev.type) throw new Error(`config.evals[${i}].type is required`);
  }
  if (!Array.isArray(config.variants) || config.variants.length === 0) {
    throw new Error('config.variants must be a non-empty array');
  }
  const seenNames = new Set<string>();
  for (const [i, v] of config.variants.entries()) {
    if (!v.name) throw new Error(`config.variants[${i}].name is required`);
    if (seenNames.has(v.name)) throw new Error(`duplicate variant name: "${v.name}"`);
    seenNames.add(v.name);
    if (!v.model?.provider) throw new Error(`config.variants[${i}].model.provider is required`);
    if (!v.model?.id) throw new Error(`config.variants[${i}].model.id is required`);
  }
}

/**
 * Materializes a variant into a flat {@link ResolvedSuiteConfig} — variant
 * overrides (model, prompt) applied on top of suite defaults. The runner
 * operates on this shape, so it doesn't need to know about variants.
 *
 * @throws When `variantName` doesn't match any variant in the suite.
 */
export function resolveVariant(config: SuiteConfig, variantName: string): ResolvedSuiteConfig {
  const variant = config.variants.find((v) => v.name === variantName);
  if (!variant) {
    const available = config.variants.map((v) => v.name).join(', ');
    throw new Error(`unknown variant "${variantName}" (available: ${available})`);
  }
  const resolved: ResolvedSuiteConfig = {
    name: config.name,
    dataset: config.dataset,
    prompt: variant.prompt ?? config.prompt,
    evals: config.evals,
    model: variant.model,
    variantName: variant.name,
  };
  if (config.concurrency !== undefined) resolved.concurrency = config.concurrency;
  if (config.maxRetries !== undefined) resolved.maxRetries = config.maxRetries;
  if (config.out !== undefined) resolved.out = config.out;
  return resolved;
}

/**
 * Resolves a config-relative path against the config file's directory.
 * Absolute paths pass through unchanged.
 */
export function resolveRelativeToConfig(baseDir: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) return relativePath;
  return path.resolve(baseDir, relativePath);
}
