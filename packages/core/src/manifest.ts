import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import type { SuiteConfig } from './types.js';

export function generateRunId(name: string, now: Date = new Date()): string {
  const iso = now.toISOString().slice(0, 19).replace(/[:.]/g, '-');
  const rand = randomBytes(3).toString('hex');
  const safeName = name.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'run';
  return `${iso}_${safeName}_${rand}`;
}

export function hashConfig(config: SuiteConfig): string {
  return createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0, 12);
}

export function tryGitSha(cwd?: string): string | null {
  try {
    const out = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}
