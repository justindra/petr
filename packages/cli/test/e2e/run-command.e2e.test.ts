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
  await fs.writeFile(
    path.join(dir, 'alternate.jsonl'),
    JSON.stringify({ id: 'c', input: { x: 10 }, expected: { y: 11 } }) + '\n',
  );
  // Prompt ignores ctx.llm and computes output directly so no API key is needed.
  await fs.writeFile(
    path.join(dir, 'prompt.ts'),
    `export default async (input) => ({ y: input.x + 1 });`,
  );
  const corePath = path.resolve(import.meta.dir, '../../../core/dist/index.js').replace(/\\/g, '/');
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
  test('single-variant config produces a suite run folder with one variant inside', async () => {
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

    const suiteRuns = await fs.readdir(path.join(dir, 'runs'));
    expect(suiteRuns).toHaveLength(1);
    const suiteRunDir = path.join(dir, 'runs', suiteRuns[0]!);

    const suiteContents = await fs.readdir(suiteRunDir);
    expect(suiteContents).toContain('main');
    expect(suiteContents).toContain('manifest.json');
    expect(suiteContents).not.toContain('compare'); // only one variant

    const variantFiles = await fs.readdir(path.join(suiteRunDir, 'main'));
    expect(variantFiles).toEqual(
      expect.arrayContaining(['results.csv', 'results.json', 'manifest.json', 'report.html']),
    );
  }, 30_000);

  test('two-variant config nests both variants plus a compare folder', async () => {
    const dir = await writeFixture(
      `[
        { name: 'alpha', model: { provider: 'anthropic', id: 'a' } },
        { name: 'beta',  model: { provider: 'openai',    id: 'b' } },
      ]`,
    );
    const { code, stdout, stderr } = await runCli(
      ['run', 'petr.config.ts', '--out', './runs'],
      dir,
    );
    expect(stderr).toBe('');
    expect(code).toBe(0);
    expect(stdout).toContain('Compare: 2 variants');
    expect(stdout).toContain('alpha → beta');
    expect(stdout).toContain('y-match');

    const suiteRuns = await fs.readdir(path.join(dir, 'runs'));
    expect(suiteRuns).toHaveLength(1);
    const suiteRunDir = path.join(dir, 'runs', suiteRuns[0]!);
    const suiteContents = await fs.readdir(suiteRunDir);
    expect(suiteContents).toEqual(
      expect.arrayContaining(['alpha', 'beta', 'compare', 'manifest.json']),
    );

    const compareFiles = await fs.readdir(path.join(suiteRunDir, 'compare'));
    expect(compareFiles).toEqual(
      expect.arrayContaining(['results.csv', 'summary.csv', 'results.json', 'report.html']),
    );
  }, 30_000);

  test('three-variant config auto-compares with N-way layout', async () => {
    const dir = await writeFixture(
      `[
        { name: 'a', model: { provider: 'anthropic', id: 'a' } },
        { name: 'b', model: { provider: 'openai',    id: 'b' } },
        { name: 'c', model: { provider: 'google',    id: 'c' } },
      ]`,
    );
    const { code, stdout } = await runCli(['run', 'petr.config.ts', '--out', './runs'], dir);
    expect(code).toBe(0);
    expect(stdout).toContain('Compare: 3 variants');
    expect(stdout).not.toContain('pp)'); // N-way layout has no delta column

    const suiteRuns = await fs.readdir(path.join(dir, 'runs'));
    const suiteRunDir = path.join(dir, 'runs', suiteRuns[0]!);
    const suiteContents = await fs.readdir(suiteRunDir);
    expect(suiteContents).toEqual(expect.arrayContaining(['a', 'b', 'c', 'compare']));
  }, 45_000);

  test('--variant flag filters to one variant (still writes a suite folder)', async () => {
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

    const suiteRuns = await fs.readdir(path.join(dir, 'runs'));
    expect(suiteRuns).toHaveLength(1);
    const suiteRunDir = path.join(dir, 'runs', suiteRuns[0]!);
    const suiteContents = await fs.readdir(suiteRunDir);
    expect(suiteContents).toContain('alpha');
    expect(suiteContents).not.toContain('beta');
    expect(suiteContents).not.toContain('compare');
  }, 30_000);

  test('--dataset overrides the config dataset relative to the command cwd', async () => {
    const dir = await writeFixture(
      `[{ name: 'main', model: { provider: 'anthropic', id: 'claude-haiku-4-5' } }]`,
    );
    const { code, stdout, stderr } = await runCli(
      ['run', 'petr.config.ts', '--dataset', 'alternate.jsonl', '--out', './runs'],
      dir,
    );
    expect(stderr).toBe('');
    expect(code).toBe(0);
    expect(stdout).toContain('1/1 passed');

    const suiteRuns = await fs.readdir(path.join(dir, 'runs'));
    expect(suiteRuns).toHaveLength(1);
    const manifestPath = path.join(dir, 'runs', suiteRuns[0]!, 'main', 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
      datasetPath: string;
      rowCount: number;
    };
    expect(manifest.datasetPath).toBe('alternate.jsonl');
    expect(manifest.rowCount).toBe(1);
  }, 30_000);
});
