import fs from 'node:fs';
import path from 'node:path';

export interface LoadEnvResult {
  loaded: string[];
  skipped: string[];
}

// Loads environment variables from .env files in the given directory,
// walking up to the repo root if needed. Existing process.env values win.
export function loadEnvFromDir(dir: string): LoadEnvResult {
  const candidates = [path.join(dir, '.env.local'), path.join(dir, '.env')];
  const result: LoadEnvResult = { loaded: [], skipped: [] };
  for (const file of candidates) {
    if (!fs.existsSync(file)) {
      result.skipped.push(file);
      continue;
    }
    const parsed = parseEnvFile(fs.readFileSync(file, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
    result.loaded.push(file);
  }
  return result;
}

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
    // Strip surrounding quotes if present.
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
