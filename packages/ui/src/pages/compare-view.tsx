import { useEffect, useState } from 'react';
import { fetchCompare, type CompareData } from '../api';
import { Badge } from '../components/badge';
import { Heading, Subheading } from '../components/heading';

export function CompareView() {
  const [data, setData] = useState<CompareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchCompare()
      .then((d) => {
        setData(d);
        if (d.rows[0]) setSelectedId(d.rows[0].id);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error)
    return (
      <div className="flex h-screen items-center justify-center text-sm text-red-500">{error}</div>
    );
  if (!data) return <div className="flex h-screen items-center justify-center">Loading…</div>;

  const selected = data.rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex h-screen w-screen flex-col">
      <header className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <Heading>
          Compare: {data.aLabel} vs {data.bLabel}
        </Heading>
        <div className="mt-2 text-sm">
          {data.summary.map((s) => (
            <span key={s.eval} className="mr-4">
              <span className="font-mono text-xs">{s.eval}</span> {(s.passRateA * 100).toFixed(0)}%
              → {(s.passRateB * 100).toFixed(0)}%{' '}
              <Badge color={s.delta > 0 ? 'lime' : s.delta < 0 ? 'red' : 'zinc'}>
                {s.delta >= 0 ? '+' : ''}
                {(s.delta * 100).toFixed(1)}pp
              </Badge>
            </span>
          ))}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 overflow-auto border-r border-zinc-200 dark:border-zinc-800">
          {data.rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className={`flex w-full items-center gap-2 px-4 py-2 text-left text-xs ${
                r.id === selectedId ? 'bg-zinc-100 dark:bg-zinc-800' : ''
              }`}
            >
              <Badge color={r.passA ? 'lime' : 'red'}>A</Badge>
              <Badge color={r.passB ? 'lime' : 'red'}>B</Badge>
              <span className="font-mono">{r.id}</span>
            </button>
          ))}
        </div>
        {selected ? (
          <div className="grid flex-1 grid-cols-2 gap-4 overflow-auto p-6">
            <div>
              <Subheading>{data.aLabel}</Subheading>
              <pre className="mt-2 overflow-auto rounded bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
                {pretty(selected.outputA)}
              </pre>
              {selected.errorA && (
                <div className="mt-2 text-xs text-red-600">error: {selected.errorA}</div>
              )}
            </div>
            <div>
              <Subheading>{data.bLabel}</Subheading>
              <pre className="mt-2 overflow-auto rounded bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
                {pretty(selected.outputB)}
              </pre>
              {selected.errorB && (
                <div className="mt-2 text-xs text-red-600">error: {selected.errorB}</div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-zinc-500">Select a row</div>
        )}
      </div>
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
