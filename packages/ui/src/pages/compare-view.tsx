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
        <Heading>Compare: {data.variants.join(' vs ')}</Heading>
        <div className="mt-2 space-y-1 text-sm">
          {data.summary.map((s) => (
            <div key={s.eval} className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-xs">{s.eval}</span>
              {data.variants.map((v) => {
                const pct = (s.passRates[v] ?? 0) * 100;
                return (
                  <span key={v} className="flex items-baseline gap-1 text-xs">
                    <span className="text-zinc-500">{v}:</span>
                    <Badge color={pct >= 80 ? 'lime' : pct >= 50 ? 'amber' : 'red'}>
                      {pct.toFixed(1)}%
                    </Badge>
                  </span>
                );
              })}
            </div>
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
              className={`flex w-full flex-wrap items-center gap-1 px-4 py-2 text-left text-xs ${
                r.id === selectedId ? 'bg-zinc-100 dark:bg-zinc-800' : ''
              }`}
            >
              {data.variants.map((v) => (
                <Badge key={v} color={r.passes[v] ? 'lime' : 'red'}>
                  {v[0]?.toUpperCase() ?? v}
                </Badge>
              ))}
              <span className="ml-1 font-mono">{r.id}</span>
            </button>
          ))}
        </div>
        {selected ? (
          <div
            className="grid flex-1 gap-4 overflow-auto p-6"
            style={{ gridTemplateColumns: `repeat(${data.variants.length}, minmax(0, 1fr))` }}
          >
            {data.variants.map((v) => (
              <div key={v}>
                <Subheading>{v}</Subheading>
                <pre className="mt-2 overflow-auto rounded bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
                  {pretty(selected.outputs[v])}
                </pre>
                {selected.errors[v] && (
                  <div className="mt-2 text-xs text-red-600">error: {selected.errors[v]}</div>
                )}
              </div>
            ))}
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
