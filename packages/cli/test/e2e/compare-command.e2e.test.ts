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

async function writeSuiteRun(
  parent: string,
  suiteName: string,
  variants: Array<{
    name: string;
    rows: Array<{ id: string; pass: boolean; evalNames: string[] }>;
  }>,
): Promise<string> {
  const suiteRunId = `2026-04-18T00-00-00_${suiteName}_aaaaaa`;
  const suiteRunDir = path.join(parent, 'runs', suiteRunId);
  await fs.mkdir(suiteRunDir, { recursive: true });

  const variantSummaries: Array<{
    name: string;
    dir: string;
    passCount: number;
    rowCount: number;
  }> = [];
  for (const v of variants) {
    const variantDir = path.join(suiteRunDir, v.name);
    await fs.mkdir(variantDir, { recursive: true });
    const runId = `${suiteRunId}_${v.name}`;
    const manifest = {
      name: suiteName,
      variantName: v.name,
      runId,
      baseDir: parent,
      startedAt: '2026-04-18T00:00:00.000Z',
      endedAt: '2026-04-18T00:00:01.000Z',
      configHash: 'xxx',
      gitSha: null,
      model: { provider: 'anthropic', id: 'm' },
      datasetPath: 'ds.jsonl',
      promptPath: 'p.ts',
      rowCount: v.rows.length,
      passCount: v.rows.filter((r) => r.pass).length,
      totalTokensIn: 0,
      totalTokensOut: 0,
      estimatedCostUsd: null,
    };
    const results = v.rows.map((r) => ({
      id: r.id,
      input: { q: r.id },
      expected: null,
      output: 'x',
      error: null,
      evals: r.evalNames.map((n) => ({ name: n, pass: r.pass, score: r.pass ? 1 : 0 })),
      pass: r.pass,
      latencyMs: 0,
      tokensIn: 0,
      tokensOut: 0,
      transcript: [],
    }));
    await fs.writeFile(
      path.join(variantDir, 'results.json'),
      JSON.stringify({ manifest, results }),
    );
    await fs.writeFile(path.join(variantDir, 'manifest.json'), JSON.stringify(manifest));
    variantSummaries.push({
      name: v.name,
      dir: v.name,
      passCount: manifest.passCount,
      rowCount: manifest.rowCount,
    });
  }

  const suiteManifest = {
    suiteName,
    suiteRunId,
    startedAt: '2026-04-18T00:00:00.000Z',
    endedAt: '2026-04-18T00:00:02.000Z',
    gitSha: null,
    baseDir: parent,
    variants: variantSummaries,
  };
  await fs.writeFile(path.join(suiteRunDir, 'manifest.json'), JSON.stringify(suiteManifest));
  return suiteRunDir;
}

describe('petr compare e2e', () => {
  test('re-emits compare artifacts from a suite run folder (2 variants)', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'petr-cmp-e2e-'));
    const suiteRun = await writeSuiteRun(dir, 'demo', [
      { name: 'alpha', rows: [{ id: 'r1', pass: true, evalNames: ['label-match'] }] },
      { name: 'beta', rows: [{ id: 'r1', pass: false, evalNames: ['label-match'] }] },
    ]);

    const { code, stdout, stderr } = await runCli(['compare', suiteRun], dir);
    expect(stderr).toBe('');
    expect(code).toBe(0);
    expect(stdout).toContain('Compare: 2 variants');
    expect(stdout).toContain('alpha → beta');
    expect(stdout).toContain('label-match');
    expect(stdout).toMatch(/-100\.0pp|\+100\.0pp/);

    const files = await fs.readdir(path.join(suiteRun, 'compare'));
    expect(files).toEqual(
      expect.arrayContaining(['results.csv', 'summary.csv', 'results.json', 'report.html']),
    );
  }, 30_000);

  test('handles 3+ variants (N-way compare)', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'petr-cmp-e2e-'));
    const suiteRun = await writeSuiteRun(dir, 'demo', [
      { name: 'a', rows: [{ id: 'r1', pass: true, evalNames: ['label-match'] }] },
      { name: 'b', rows: [{ id: 'r1', pass: true, evalNames: ['label-match'] }] },
      { name: 'c', rows: [{ id: 'r1', pass: false, evalNames: ['label-match'] }] },
    ]);

    const { code, stdout } = await runCli(['compare', suiteRun], dir);
    expect(code).toBe(0);
    expect(stdout).toContain('Compare: 3 variants');
    expect(stdout).toContain('label-match');
    expect(stdout).toContain('a');
    expect(stdout).toContain('b');
    expect(stdout).toContain('c');
    expect(stdout).not.toContain('pp)'); // N-way layout doesn't print deltas
  }, 30_000);

  test('errors out on a folder without ≥2 variants', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'petr-cmp-e2e-'));
    const suiteRun = await writeSuiteRun(dir, 'demo', [
      { name: 'only', rows: [{ id: 'r1', pass: true, evalNames: ['label-match'] }] },
    ]);
    const { code, stderr } = await runCli(['compare', suiteRun], dir);
    expect(code).not.toBe(0);
    expect(stderr).toMatch(/at least 2 variants/);
  }, 30_000);
});
