import fs from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { readNotes, writeNote } from '../dataset.js';
import type { NotesEntry, RowResult, RunManifest } from '../types.js';
import { loadUiBundle } from './ui-bundle.js';

export interface StartReviewServerOptions {
  runDir: string;
  port?: number;
  host?: string;
}

export interface ReviewServerHandle {
  url: string;
  port: number;
  stop(): Promise<void>;
}

interface RunPayload {
  manifest: RunManifest;
  results: RowResult[];
}

export async function startReviewServer(
  opts: StartReviewServerOptions,
): Promise<ReviewServerHandle> {
  const payload = await loadRunPayload(opts.runDir);
  const bundle = loadUiBundle();
  const datasetPath = path.resolve(opts.runDir, '..', '..', payload.manifest.datasetPath);

  const host = opts.host ?? '127.0.0.1';
  const port = opts.port ?? 0;

  const server = createServer(async (req, res) => {
    try {
      await handle(req, res, { payload, bundle, datasetPath });
    } catch (err) {
      respondJson(res, 500, { error: (err as Error).message });
    }
  });

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  const address = server.address();
  const realPort = typeof address === 'object' && address ? address.port : port;

  return {
    url: `http://${host}:${realPort}`,
    port: realPort,
    async stop() {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    },
  };
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: {
    payload: RunPayload;
    bundle: ReturnType<typeof loadUiBundle>;
    datasetPath: string;
  },
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/api/run') {
    const notes = await readNotes(ctx.datasetPath);
    respondJson(res, 200, { ...ctx.payload, notes: Object.fromEntries(notes) });
    return;
  }

  if (url.pathname.startsWith('/api/notes/') && req.method === 'POST') {
    const rowId = decodeURIComponent(url.pathname.slice('/api/notes/'.length));
    const body = await readJsonBody<Partial<NotesEntry>>(req);
    const entry: NotesEntry = {
      rowId,
      text: String(body.text ?? ''),
      ...(body.tags ? { tags: body.tags } : {}),
      updatedAt: new Date().toISOString(),
    };
    await writeNote(ctx.datasetPath, entry);
    respondJson(res, 200, entry);
    return;
  }

  if (ctx.bundle && url.pathname.startsWith('/assets/')) {
    const js = ctx.bundle.scripts.get(url.pathname);
    if (js) {
      res.writeHead(200, { 'content-type': 'application/javascript' });
      res.end(js);
      return;
    }
    const css = ctx.bundle.styles.get(url.pathname);
    if (css) {
      res.writeHead(200, { 'content-type': 'text/css' });
      res.end(css);
      return;
    }
  }

  if (ctx.bundle) {
    const html = ctx.bundle.indexHtml.replace(
      '</head>',
      `<script>window.__PETR_MODE__='server';</script></head>`,
    );
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(html);
    return;
  }

  res.writeHead(500, { 'content-type': 'text/plain' });
  res.end('UI bundle not found — run `bun run build` first');
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw) as T;
}

function respondJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function loadRunPayload(runDir: string): Promise<RunPayload> {
  const jsonPath = path.join(runDir, 'results.json');
  const raw = await fs.readFile(jsonPath, 'utf8');
  return JSON.parse(raw) as RunPayload;
}
