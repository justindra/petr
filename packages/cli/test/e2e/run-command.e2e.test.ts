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

describe('petr run e2e', () => {
  test('init + run produces a runs/<id>/ folder with expected files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'petr-e2e-'));

    // Scaffold a deterministic fixture that doesn't call any LLM.
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
    const corePath = path
      .resolve(import.meta.dir, '../../../core/src/config.ts')
      .replace(/\\/g, '/');
    await fs.writeFile(
      path.join(dir, 'petr.config.ts'),
      `import { defineConfig } from '${corePath}';
export default defineConfig({
  name: 'e2e',
  dataset: './dataset.jsonl',
  prompt: './prompt.ts',
  model: { provider: 'anthropic', id: 'claude-haiku-4-5' },
  evals: [{ name: 'y-match', type: 'equals', field: 'y' }],
});`,
    );

    const { code, stdout, stderr } = await runCli(
      ['run', 'petr.config.ts', '--out', './runs'],
      dir,
    );
    expect(stderr).toBe('');
    expect(code).toBe(0);
    expect(stdout).toContain('2/2 passed');

    const runsDir = path.join(dir, 'runs');
    const entries = await fs.readdir(runsDir);
    expect(entries).toHaveLength(1);
    const runDir = path.join(runsDir, entries[0]!);
    const files = await fs.readdir(runDir);
    expect(files).toEqual(
      expect.arrayContaining(['results.csv', 'results.json', 'manifest.json', 'report.html']),
    );

    const csv = await fs.readFile(path.join(runDir, 'results.csv'), 'utf8');
    expect(csv).toContain('eval.y-match.pass');
    expect(csv.split('\n').filter((l) => l.trim()).length).toBe(3); // header + 2 rows
  }, 30_000);
});
