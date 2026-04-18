import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchRun, isServerMode, type NotesEntry, type RowResult, type RunPayload } from '../api';
import { Badge } from '../components/badge';
import { Heading, Subheading } from '../components/heading';
import { NotesPanel } from '../components/notes-panel';
import { RowDetail } from '../components/row-detail';
import { RowList } from '../components/row-list';

export function RunView() {
  const { rowId } = useParams<{ rowId?: string }>();
  const [payload, setPayload] = useState<RunPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(rowId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, NotesEntry>>({});
  const canEditNotes = isServerMode();

  useEffect(() => {
    fetchRun()
      .then((p) => {
        setPayload(p);
        setNotes(p.notes ?? {});
        setSelectedId((cur) => cur ?? p.results[0]?.id ?? null);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (rowId) setSelectedId(rowId);
  }, [rowId]);

  const selectedRow: RowResult | null = useMemo(() => {
    if (!payload || !selectedId) return null;
    return payload.results.find((r) => r.id === selectedId) ?? null;
  }, [payload, selectedId]);

  if (error) return <ErrorState message={error} />;
  if (!payload) return <LoadingState />;

  const { manifest, results } = payload;
  const passPct = manifest.rowCount > 0 ? (manifest.passCount / manifest.rowCount) * 100 : 0;

  return (
    <div className="flex h-screen w-screen flex-col">
      <header className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="flex items-baseline gap-4">
          <Heading>{manifest.name}</Heading>
          <span className="font-mono text-xs text-zinc-500">{manifest.runId}</span>
          <span className="ml-auto flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <Badge color={passPct >= 80 ? 'lime' : passPct >= 50 ? 'amber' : 'red'}>
              {manifest.passCount}/{manifest.rowCount} ({passPct.toFixed(0)}%)
            </Badge>
            <span>
              {manifest.model.provider}:{manifest.model.id}
            </span>
            <span>
              {manifest.totalTokensIn}→{manifest.totalTokensOut} tokens
              {manifest.estimatedCostUsd !== null && ` · ~$${manifest.estimatedCostUsd.toFixed(4)}`}
            </span>
          </span>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 flex-shrink-0">
          <RowList rows={results} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="flex flex-1 flex-col">
          {selectedRow ? (
            <>
              <RowDetail row={selectedRow} />
              <NotesPanel
                key={selectedRow.id}
                rowId={selectedRow.id}
                initial={notes[selectedRow.id] ?? null}
                readOnly={!canEditNotes}
                onSaved={(entry) => setNotes((cur) => ({ ...cur, [selectedRow.id]: entry }))}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-zinc-500">
              Select a row to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return <div className="flex h-screen items-center justify-center text-zinc-500">Loading…</div>;
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="max-w-md rounded border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
        <Subheading className="text-red-700 dark:text-red-300">Failed to load</Subheading>
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>
      </div>
    </div>
  );
}
