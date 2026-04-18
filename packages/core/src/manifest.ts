import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

/**
 * Generates a run id of the form `<safe-name>-YYYY-MM-DDTHH-MM-SS`.
 *
 * The timestamp is truncated to seconds. `name` is sanitized so the id is
 * safe to use as a directory name on every OS. `now` is a seam for tests.
 */
export function generateRunId(name: string, now: Date = new Date()): string {
  const iso = now.toISOString().slice(0, 19).replace(/[:.]/g, '-');
  const safeName =
    name
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .slice(0, 40)
      .replace(/^-+|-+$/g, '') || 'run';
  return `${safeName}-${iso}`;
}

/**
 * Returns a 12-character SHA-256 prefix of a serialized object — stable for
 * identical inputs, changes with any field. Used in manifests to spot when a
 * run's resolved config has drifted.
 */
export function hashConfig(config: object): string {
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
