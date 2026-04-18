import fs from 'node:fs';
import path from 'node:path';

/** Report of which .env files were loaded and which candidates were missing. */
export interface LoadEnvResult {
  loaded: string[];
  skipped: string[];
}

/**
 * Reads `.env` and `.env.local` from the given directory into `process.env`.
 *
 * Precedence: `process.env` (the shell) > `.env.local` > `.env`. Shell values
 * are never overwritten, matching the convention popularized by Next.js and
 * Vite.
 */
export function loadEnvFromDir(dir: string): LoadEnvResult {
  const candidates = [path.join(dir, '.env'), path.join(dir, '.env.local')];
  const result: LoadEnvResult = { loaded: [], skipped: [] };
  const merged: Record<string, string> = {};
  for (const file of candidates) {
    if (!fs.existsSync(file)) {
      result.skipped.push(file);
      continue;
    }
    // Later files override earlier ones; .env.local wins over .env.
    Object.assign(merged, parseEnvFile(fs.readFileSync(file, 'utf8')));
    result.loaded.push(file);
  }
  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return result;
}

/**
 * Minimal `.env` parser. Supports `KEY=value`, comments (`#`), blank lines,
 * and surrounding single/double quotes. Does not expand `${VAR}` references.
 * Keys that aren't valid identifiers are silently dropped.
 */
export function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}
