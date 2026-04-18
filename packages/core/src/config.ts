import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SuiteConfig } from './types.js';

export function defineConfig(config: SuiteConfig): SuiteConfig {
  return config;
}

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

export function resolveRelativeToConfig(baseDir: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) return relativePath;
  return path.resolve(baseDir, relativePath);
}
