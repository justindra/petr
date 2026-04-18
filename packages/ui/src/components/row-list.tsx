import { useMemo, useState } from 'react';
import type { RowResult } from '../api';
import { Badge } from './badge';
import { Input } from './input';

interface RowListProps {
  rows: RowResult[];
  selectedId: string | null;
  onSelect(id: string): void;
}

type Filter = 'all' | 'pass' | 'fail' | 'error';

export function RowList({ rows, selectedId, onSelect }: RowListProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === 'pass' && !r.pass) return false;
      if (filter === 'fail' && (r.pass || r.error !== null)) return false;
      if (filter === 'error' && r.error === null) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const text = JSON.stringify({ id: r.id, input: r.input, output: r.output }).toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, filter]);

  return (
    <div className="flex h-full flex-col border-r border-zinc-200 dark:border-zinc-800">
      <div className="flex flex-col gap-2 p-4">
        <Input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex gap-1 text-xs">
          {(['all', 'pass', 'fail', 'error'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded px-2 py-1 ${filter === f ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800'}`}
            >
              {f}
            </button>
          ))}
          <span className="ml-auto text-zinc-500">
            {filtered.length} / {rows.length}
          </span>
        </div>
      </div>
      <ul className="flex-1 overflow-auto">
        {filtered.map((r) => {
          const selected = r.id === selectedId;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r.id)}
                className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                  selected
                    ? 'bg-zinc-100 dark:bg-zinc-800'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Badge color={r.error ? 'amber' : r.pass ? 'lime' : 'red'}>
                    {r.error ? 'err' : r.pass ? 'pass' : 'fail'}
                  </Badge>
                  <span className="truncate font-mono text-xs text-zinc-500">{r.id}</span>
                </div>
                <div className="mt-1 truncate text-xs text-zinc-500">
                  {truncate(JSON.stringify(r.input), 80)}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
