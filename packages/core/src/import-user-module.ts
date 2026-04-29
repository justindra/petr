import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tsImport } from 'tsx/esm/api';

const TYPESCRIPT_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);

export async function importUserModule<T>(filePath: string): Promise<T> {
  const url = pathToFileURL(filePath).href;
  if (typeof Bun !== 'undefined') {
    return (await import(url)) as T;
  }
  if (TYPESCRIPT_EXTENSIONS.has(path.extname(filePath))) {
    const mod = await tsImport(url, { parentURL: import.meta.url });
    return unwrapInteropModule(mod) as T;
  }
  return (await import(url)) as T;
}

function unwrapInteropModule(mod: unknown): unknown {
  if (!mod || typeof mod !== 'object' || !('default' in mod)) return mod;
  const defaultExport = (mod as { default?: unknown }).default;
  if (!defaultExport || typeof defaultExport !== 'object') return mod;
  if ((defaultExport as { __esModule?: unknown }).__esModule === true) return defaultExport;
  return mod;
}
