export interface NotesEntry {
  rowId: string;
  text: string;
  tags?: string[];
  updatedAt: string;
}

export interface RunPayload {
  manifest: RunManifest;
  results: RowResult[];
  notes?: Record<string, NotesEntry>;
}

export interface RunManifest {
  name: string;
  runId: string;
  startedAt: string;
  endedAt: string;
  configHash: string;
  gitSha: string | null;
  model: { provider: string; id: string };
  datasetPath: string;
  promptPath: string;
  rowCount: number;
  passCount: number;
  totalTokensIn: number;
  totalTokensOut: number;
  estimatedCostUsd: number | null;
}

export interface EvalResult {
  name: string;
  pass: boolean;
  score?: number;
  detail?: string;
}

export interface TranscriptEntry {
  role: string;
  content: unknown;
}

export interface RowResult {
  id: string;
  input: unknown;
  expected: unknown;
  output: unknown;
  error: string | null;
  evals: EvalResult[];
  pass: boolean;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  transcript: TranscriptEntry[];
}

declare global {
  interface Window {
    __PETR_DATA__?: {
      mode: 'run' | 'compare';
      manifest: RunManifest | null;
      results?: RowResult[];
      compare?: unknown;
    };
    __PETR_MODE__?: 'server';
  }
}

export function isServerMode(): boolean {
  return typeof window !== 'undefined' && window.__PETR_MODE__ === 'server';
}

export function isStaticMode(): boolean {
  return typeof window !== 'undefined' && !!window.__PETR_DATA__;
}

export async function fetchRun(): Promise<RunPayload> {
  if (isStaticMode()) {
    const data = window.__PETR_DATA__!;
    if (data.mode !== 'run') throw new Error('Static report is in compare mode, not run mode');
    return {
      manifest: data.manifest!,
      results: data.results ?? [],
    };
  }
  const res = await fetch('/api/run');
  if (!res.ok) throw new Error(`GET /api/run → ${res.status}`);
  return (await res.json()) as RunPayload;
}

export async function saveNote(rowId: string, text: string, tags: string[]): Promise<NotesEntry> {
  const res = await fetch(`/api/notes/${encodeURIComponent(rowId)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, tags }),
  });
  if (!res.ok) throw new Error(`POST /api/notes/${rowId} → ${res.status}`);
  return (await res.json()) as NotesEntry;
}

export interface CompareData {
  /** Variant labels in display order — also the keys into every row's per-variant map. */
  variants: string[];
  manifests: Record<string, RunManifest>;
  rows: Array<{
    id: string;
    input: unknown;
    expected: unknown;
    outputs: Record<string, unknown>;
    passes: Record<string, boolean>;
    errors: Record<string, string | null>;
    evalResults: Record<string, EvalResult[]>;
  }>;
  summary: Array<{ eval: string; passRates: Record<string, number> }>;
}

export async function fetchCompare(): Promise<CompareData> {
  if (isStaticMode()) {
    const data = window.__PETR_DATA__!;
    if (data.mode !== 'compare') throw new Error('Static report is in run mode, not compare mode');
    return data.compare as CompareData;
  }
  const res = await fetch('/api/compare');
  if (!res.ok) throw new Error(`GET /api/compare → ${res.status}`);
  return (await res.json()) as CompareData;
}
