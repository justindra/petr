import fs from 'node:fs/promises';
import type { RowResult, RunManifest } from '../types';
import { loadUiBundle } from './ui-bundle';

/** Payload embedded in the self-contained HTML report. */
export interface ReportData {
  mode: 'run' | 'compare';
  manifest: RunManifest | null;
  /** Present in run-mode reports only. */
  results?: RowResult[];
  /** Present in compare-mode reports only; matches the `CompareData` shape. */
  compare?: unknown;
}

/**
 * Builds a single self-contained HTML string — the Vite-built review UI with
 * its JS and CSS inlined, plus the run data on `window.__PETR_DATA__` so the
 * UI can render without a server. When the UI bundle hasn't been built, falls
 * back to a no-dep static table so the report is at least readable.
 */
export function renderReportHtml(data: ReportData): string {
  const bundle = loadUiBundle();
  if (!bundle) {
    return renderFallbackHtml(data);
  }
  let html = bundle.indexHtml;
  for (const [rel, src] of bundle.scripts) {
    html = html.replace(
      new RegExp(`<script([^>]*?)src="${escapeRegex(rel)}"([^>]*)></script>`),
      `<script$1$2>${escapeScriptContent(src)}</script>`,
    );
  }
  for (const [rel, css] of bundle.styles) {
    html = html.replace(
      new RegExp(`<link([^>]*?)href="${escapeRegex(rel)}"([^>]*?)/?>`),
      `<style$1$2>${css}</style>`,
    );
  }
  const payload = JSON.stringify(data).replace(/</g, '\\u003c');
  html = html.replace('</head>', `<script>window.__PETR_DATA__ = ${payload};</script></head>`);
  return html;
}

/** Renders {@link renderReportHtml} and writes it to disk. */
export async function writeHtmlReport(filePath: string, data: ReportData): Promise<void> {
  await fs.writeFile(filePath, renderReportHtml(data), 'utf8');
}

function renderFallbackHtml(data: ReportData): string {
  const rows = data.results ?? [];
  const passCount = data.manifest?.passCount ?? 0;
  const rowCount = data.manifest?.rowCount ?? rows.length;
  const tbody = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.id)}</td><td>${r.pass ? '✓' : '✗'}</td><td>${escapeHtml(r.error ?? '')}</td></tr>`,
    )
    .join('');
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>petr ${escapeHtml(data.manifest?.name ?? '')}</title>
<style>body{font-family:system-ui;padding:24px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 10px}</style>
</head><body>
<h1>${escapeHtml(data.manifest?.name ?? 'petr run')}</h1>
<p>${passCount}/${rowCount} passed — UI bundle not found, showing fallback.</p>
<table><thead><tr><th>id</th><th>pass</th><th>error</th></tr></thead><tbody>${tbody}</tbody></table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeScriptContent(s: string): string {
  return s.replace(/<\/script>/gi, '<\\/script>');
}
