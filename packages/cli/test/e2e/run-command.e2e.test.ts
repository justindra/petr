import { describe, expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const BIN = path.resolve(import.meta.dir, '../../bin/run.js');

async function runCli(
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(BIN, args, { cwd, env: process.env });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function writeFixture(variants: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'petr-e2e-'));
  await fs.writeFile(
    path.join(dir, 'dataset.jsonl'),
    [
      JSON.stringify({ id: 'a', input: { x: 1 }, expected: { y: 2 } }),
      JSON.stringify({ id: 'b', input: { x: 3 }, expected: { y: 4 } }),
    ].join('\n') + '\n',
  );
  // Prompt ignores ctx.llm and computes output directly so no API key is needed.
  await fs.writeFile(
    path.join(dir, 'prompt.ts'),
    `export default async (input) => ({ y: input.x + 1 });`,
  );
  const corePath = path.resolve(import.meta.dir, '../../../core/src/config.ts').replace(/\\/g, '/');
  await fs.writeFile(
    path.join(dir, 'petr.config.ts'),
    `import { defineConfig } from '${corePath}';
export default defineConfig({
  name: 'e2e',
  dataset: './dataset.jsonl',
  prompt: './prompt.ts',
  evals: [{ name: 'y-match', type: 'equals', field: 'y' }],
  variants: ${variants},
});`,
  );
  return dir;
}

describe('petr run e2e', () => {
  test('single-variant config produces one run folder', async () => {
    const dir = await writeFixture(
      `[{ name: 'main', model: { provider: 'anthropic', id: 'claude-haiku-4-5' } }]`,
    );
    const { code, stdout, stderr } = await runCli(
      ['run', 'petr.config.ts', '--out', './runs'],
      dir,
    );
    expect(stderr).toBe('');
    expect(code).toBe(0);
    expect(stdout).toContain('2/2 passed');

    const entries = await fs.readdir(path.join(dir, 'runs'));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toContain('main');
    const files = await fs.readdir(path.join(dir, 'runs', entries[0]!));
    expect(files).toEqual(
      expect.arrayContaining(['results.csv', 'results.json', 'manifest.json', 'report.html']),
    );
  }, 30_000);

  test('two-variant config produces two run folders plus a compare folder', async () => {
    const dir = await writeFixture(
      `[
        { name: 'alpha', model: { provider: 'anthropic', id: 'a' } },
        { name: 'beta',  model: { provider: 'openai',    id: 'b' } },
      ]`,
    );
    const { code, stdout, stderr } = await runCli(
      ['run', 'petr.config.ts', '--out', './runs', '--compare-out', './compare'],
      dir,
    );
    expect(stderr).toBe('');
    expect(code).toBe(0);
    expect(stdout).toContain('Compare: e2e/alpha vs e2e/beta');
    expect(stdout).toContain('y-match');

    const runs = await fs.readdir(path.join(dir, 'runs'));
    expect(runs).toHaveLength(2);
    expect(runs.some((r) => r.includes('alpha'))).toBe(true);
    expect(runs.some((r) => r.includes('beta'))).toBe(true);

    const compares = await fs.readdir(path.join(dir, 'compare'));
    expect(compares).toHaveLength(1);
    const compareFiles = await fs.readdir(path.join(dir, 'compare', compares[0]!));
    expect(compareFiles).toEqual(
      expect.arrayContaining(['results.csv', 'summary.csv', 'results.json', 'report.html']),
    );
  }, 30_000);

  test('--variant flag filters to one variant', async () => {
    const dir = await writeFixture(
      `[
        { name: 'alpha', model: { provider: 'anthropic', id: 'a' } },
        { name: 'beta',  model: { provider: 'openai',    id: 'b' } },
      ]`,
    );
    const { code } = await runCli(
      ['run', 'petr.config.ts', '--variant', 'alpha', '--out', './runs'],
      dir,
    );
    expect(code).toBe(0);
    const runs = await fs.readdir(path.join(dir, 'runs'));
    expect(runs).toHaveLength(1);
    expect(runs[0]).toContain('alpha');
  }, 30_000);
});
