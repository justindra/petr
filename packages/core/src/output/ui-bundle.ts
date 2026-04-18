import fs from 'node:fs';
import path from 'node:path';

interface UiBundle {
  indexHtml: string;
  scripts: Map<string, string>;
  styles: Map<string, string>;
  rootDir: string;
}

const CANDIDATE_PATHS = [
  // published layout: packages/core/ui-dist/
  path.resolve(import.meta.dirname, '../../ui-dist'),
  // monorepo dev layout: packages/ui/dist/
  path.resolve(import.meta.dirname, '../../../ui/dist'),
];

function findUiBundleDir(): string | null {
  for (const candidate of CANDIDATE_PATHS) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) return candidate;
  }
  return null;
}

export function loadUiBundle(): UiBundle | null {
  const rootDir = findUiBundleDir();
  if (!rootDir) return null;
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const scripts = new Map<string, string>();
  const styles = new Map<string, string>();
  for (const match of indexHtml.matchAll(/src="(\/assets\/[^"]+\.js)"/g)) {
    const rel = match[1];
    if (!rel) continue;
    const file = path.join(rootDir, rel);
    if (fs.existsSync(file)) scripts.set(rel, fs.readFileSync(file, 'utf8'));
  }
  for (const match of indexHtml.matchAll(/href="(\/assets\/[^"]+\.css)"/g)) {
    const rel = match[1];
    if (!rel) continue;
    const file = path.join(rootDir, rel);
    if (fs.existsSync(file)) styles.set(rel, fs.readFileSync(file, 'utf8'));
  }
  return { indexHtml, scripts, styles, rootDir };
}
