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

async function writeRunFolder(
  parent: string,
  suiteName: string,
  variantName: string,
  evals: Array<{ name: string; pass: boolean }>,
): Promise<string> {
  const runId = `2026-04-18T00-00-00_${suiteName}_${variantName}_aaaaaa`;
  const runDir = path.join(parent, 'runs', runId);
  await fs.mkdir(runDir, { recursive: true });
  const manifest = {
    name: suiteName,
    variantName,
    runId,
    startedAt: '2026-04-18T00:00:00.000Z',
    endedAt: '2026-04-18T00:00:01.000Z',
    configHash: 'xxx',
    gitSha: null,
    model: { provider: 'anthropic', id: 'm' },
    datasetPath: 'ds.jsonl',
    promptPath: 'p.ts',
    rowCount: 1,
    passCount: evals.every((e) => e.pass) ? 1 : 0,
    totalTokensIn: 0,
    totalTokensOut: 0,
    estimatedCostUsd: null,
  };
  const results = [
    {
      id: 'r1',
      input: { q: 'hi' },
      expected: null,
      output: 'x',
      error: null,
      evals: evals.map((e) => ({ name: e.name, pass: e.pass, score: e.pass ? 1 : 0 })),
      pass: evals.every((e) => e.pass),
      latencyMs: 0,
      tokensIn: 0,
      tokensOut: 0,
      transcript: [],
    },
  ];
  await fs.writeFile(path.join(runDir, 'results.json'), JSON.stringify({ manifest, results }));
  await fs.writeFile(path.join(runDir, 'manifest.json'), JSON.stringify(manifest));
  return runDir;
}

describe('petr compare e2e', () => {
  test('reports on two existing run folders and writes compare artifacts', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'petr-cmp-e2e-'));
    const runA = await writeRunFolder(dir, 'demo', 'alpha', [{ name: 'label-match', pass: true }]);
    const runB = await writeRunFolder(dir, 'demo', 'beta', [{ name: 'label-match', pass: false }]);

    const { code, stdout, stderr } = await runCli(
      ['compare', runA, runB, '--out', './compare'],
      dir,
    );
    expect(stderr).toBe('');
    expect(code).toBe(0);
    expect(stdout).toContain('Compare: demo/alpha vs demo/beta');
    expect(stdout).toContain('label-match');
    expect(stdout).toMatch(/-100\.0pp|\+100\.0pp/); // 100% → 0% is a -100pp delta

    const compares = await fs.readdir(path.join(dir, 'compare'));
    expect(compares).toHaveLength(1);
    const files = await fs.readdir(path.join(dir, 'compare', compares[0]!));
    expect(files).toEqual(
      expect.arrayContaining(['results.csv', 'summary.csv', 'results.json', 'report.html']),
    );
  }, 30_000);
});
