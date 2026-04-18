import type { RowResult } from '../api';
import { Badge } from './badge';
import { Divider } from './divider';
import { Heading, Subheading } from './heading';

export interface RowDetailProps {
  row: RowResult;
}

export function RowDetail({ row }: RowDetailProps) {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center gap-3">
        <Heading>{row.id}</Heading>
        <Badge color={row.error ? 'amber' : row.pass ? 'lime' : 'red'}>
          {row.error ? 'error' : row.pass ? 'pass' : 'fail'}
        </Badge>
        <span className="ml-auto text-sm text-zinc-500">
          {row.latencyMs}ms · {row.tokensIn}→{row.tokensOut} tokens
        </span>
      </div>

      {row.error && (
        <div className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {row.error}
        </div>
      )}

      <Section title="Input">
        <pre className="overflow-auto rounded bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
          {pretty(row.input)}
        </pre>
      </Section>

      {row.expected !== null && row.expected !== undefined && (
        <Section title="Expected">
          <pre className="overflow-auto rounded bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
            {pretty(row.expected)}
          </pre>
        </Section>
      )}

      <Section title="Output">
        <pre className="overflow-auto rounded bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
          {pretty(row.output)}
        </pre>
      </Section>

      {row.evals.length > 0 && (
        <Section title="Evals">
          <ul className="space-y-2 text-sm">
            {row.evals.map((e) => (
              <li key={e.name} className="flex items-start gap-3">
                <Badge color={e.pass ? 'lime' : 'red'}>{e.pass ? 'pass' : 'fail'}</Badge>
                <div>
                  <div className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {e.name}
                    {e.score !== undefined ? ` · ${e.score}` : ''}
                  </div>
                  {e.detail && <div className="text-xs text-zinc-500">{e.detail}</div>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {row.transcript.length > 0 && (
        <Section title="Transcript">
          <div className="space-y-2 text-sm">
            {row.transcript.map((t, i) => (
              <div key={i} className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="mb-1 text-xs font-medium text-zinc-500 uppercase">{t.role}</div>
                <pre className="text-xs whitespace-pre-wrap">{pretty(t.content)}</pre>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <Subheading className="mb-2">{title}</Subheading>
      <Divider className="mb-3" />
      {children}
    </div>
  );
}

function pretty(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
