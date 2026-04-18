import { useEffect, useState } from 'react';
import { saveNote, type NotesEntry } from '../api';
import { Button } from './button';
import { Subheading } from './heading';
import { Textarea } from './textarea';

export interface NotesPanelProps {
  rowId: string;
  initial: NotesEntry | null;
  readOnly: boolean;
  onSaved(entry: NotesEntry): void;
}

const TAGS = ['prompt-issue', 'dataset-issue', 'needs-review', 'accepted'] as const;

export function NotesPanel({ rowId, initial, readOnly, onSaved }: NotesPanelProps) {
  const [text, setText] = useState(initial?.text ?? '');
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(initial?.text ?? '');
    setTags(initial?.tags ?? []);
    setError(null);
  }, [rowId, initial]);

  const toggleTag = (tag: string): void => {
    setTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));
  };

  const onSave = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const entry = await saveNote(rowId, text, tags);
      onSaved(entry);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
      <Subheading className="mb-2">Notes</Subheading>
      {readOnly ? (
        <div className="text-xs text-zinc-500">
          Notes are read-only in static reports. Run <code>petr review &lt;dir&gt;</code> to edit.
        </div>
      ) : (
        <>
          <Textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Leave a note for this row…"
          />
          <div className="mt-2 flex flex-wrap gap-1 text-xs">
            {TAGS.map((t) => {
              const active = tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={`rounded px-2 py-1 ${
                    active
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'bg-zinc-100 dark:bg-zinc-800'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            {error && <span className="text-xs text-red-600">{error}</span>}
            {initial?.updatedAt && (
              <span className="text-xs text-zinc-500">
                last updated {new Date(initial.updatedAt).toLocaleString()}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
