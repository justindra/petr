import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import type { SuiteConfig } from './types';

/**
 * Generates a run id of the form `YYYY-MM-DDTHH-MM-SS_<safe-name>_<rand>`.
 *
 * The timestamp is truncated to seconds and the random suffix keeps concurrent
 * runs from colliding. `name` is sanitized so it's safe to use as a directory
 * name on every OS. `now` is a seam for tests.
 */
export function generateRunId(name: string, now: Date = new Date()): string {
  const iso = now.toISOString().slice(0, 19).replace(/[:.]/g, '-');
  const rand = randomBytes(3).toString('hex');
  const safeName = name.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'run';
  return `${iso}_${safeName}_${rand}`;
}

/**
 * Returns a 12-character SHA-256 prefix of the serialized config — stable for
 * identical configs, changes with any field. Used in manifests to spot when
 * a run's configuration has drifted.
 */
export function hashConfig(config: SuiteConfig): string {
  return createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0, 12);
}

/**
 * Returns the current commit sha when `cwd` (or the process cwd) is inside a
 * git repo, otherwise `null`. Never throws — shelling out to git is best-effort.
 */
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
