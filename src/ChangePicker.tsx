import { useEffect, useState } from 'react';
import type { ChangePage, ChangeSummary, Proposal } from '../shared/types.js';
import { api } from './api.js';

const label = (change: ChangeSummary) =>
  `${change.itemId} · revision ${change.afterRevision} · ${new Date(change.createdAt).toLocaleString()}`;

export function ChangePicker({
  initialPage,
  proposals,
  selection,
  selectedChange,
  disabled,
  onSelect,
}: {
  initialPage: ChangePage;
  proposals: Proposal[];
  selection: string;
  selectedChange: ChangeSummary | undefined;
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ cursor: string | null; page: ChangePage }>({
    cursor: null,
    page: initialPage,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const cursor = cursors.at(-1)!;
  const page = result.cursor === cursor ? result.page : undefined;
  useEffect(() => {
    if (cursor === null && retry === 0) {
      setResult({ cursor: null, page: initialPage });
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    setError('');
    const query = new URLSearchParams(cursor ? { cursor } : {});
    api<ChangePage>(`/api/changes?${query}`, { signal: abort.signal })
      .then((page) => {
        if (!abort.signal.aborted) setResult({ cursor, page });
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [cursor, retry, initialPage]);
  const entries = page?.entries ?? [];
  const outsidePage =
    !selection.startsWith('proposal:') && !entries.some((c) => c.id === selection);
  return (
    <div className="change-picker">
      <div className="change-picker-field">
        <label className="field-label" htmlFor="change-select">
          CHANGE TO EXPLORE
        </label>
        <select
          id="change-select"
          value={selection}
          disabled={disabled}
          onChange={(e) => onSelect(e.target.value)}
        >
          <optgroup label="Proposed updates">
            {proposals.map((p) => (
              <option key={p.id} value={`proposal:${p.id}`}>
                {p.title} · proposed update
              </option>
            ))}
          </optgroup>
          {outsidePage && (
            <option value={selection}>
              {selectedChange ? label(selectedChange) : 'Saved change'} · selected
            </option>
          )}
          <optgroup label={`Saved changes · page ${cursors.length}`}>
            {entries.map((c) => (
              <option key={c.id} value={c.id}>
                {label(c)}
              </option>
            ))}
          </optgroup>
        </select>
        <p className="helper" role="status">
          {loading
            ? 'Loading saved changes…'
            : page
              ? `${entries.length} saved changes on page ${cursors.length}.`
              : 'Change list unavailable.'}{' '}
          Browse pages without changing your selection. Use History to search.
        </p>
      </div>
      <div className="change-picker-actions" aria-label="Saved change pages">
        <button
          disabled={disabled || loading || cursors.length === 1}
          onClick={() => {
            setCursors((v) => v.slice(0, -1));
            setRetry((v) => v + 1);
          }}
        >
          Newer changes
        </button>
        <button
          disabled={disabled || loading || !!error || !page?.nextCursor}
          onClick={() => {
            setCursors((v) => [...v, page!.nextCursor]);
            setRetry((v) => v + 1);
          }}
        >
          Older changes
        </button>
        <button
          disabled={disabled || loading}
          onClick={() => {
            setCursors([null]);
            setRetry((v) => v + 1);
          }}
        >
          Refresh changes
        </button>
      </div>
      {error && (
        <div className="banner error" role="alert">
          <span>Could not load saved changes. {error}</span>
          <button disabled={disabled || loading} onClick={() => setRetry((v) => v + 1)}>
            Retry change list
          </button>
        </div>
      )}
    </div>
  );
}
