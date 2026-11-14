import { useEffect, useRef, useState } from 'react';
import { ArrowRight, FileText, History as HistoryIcon, RotateCcw, Search } from 'lucide-react';
import type { EvidenceDetail, HistoryEntry, HistoryPage, Item } from '../shared/types.js';
import { api } from './api.js';

const kinds = {
  change: 'Change applied',
  review: 'Review decision',
  relationship: 'Relationship replaced',
};
const decisions = { keep: 'Keep', revise: 'Revise', defer: 'Defer' };
const emptyFilters = { itemId: '', kind: '', status: '', q: '', from: '', until: '' };
type Filters = typeof emptyFilters;

function queryFor(filters: Filters, cursor: string | null) {
  const query = new URLSearchParams();
  for (const name of ['itemId', 'kind', 'status', 'q'] as const)
    if (filters[name]) query.set(name, filters[name]);
  // Calendar days follow the browser's local timezone; the API uses [from, until).
  if (filters.from) query.set('from', new Date(`${filters.from}T00:00:00`).toISOString());
  if (filters.until) {
    const until = new Date(`${filters.until}T00:00:00`);
    until.setDate(until.getDate() + 1);
    query.set('until', until.toISOString());
  }
  if (cursor) query.set('cursor', cursor);
  return query.toString();
}

export function History({
  items,
  active,
  refreshToken,
  initialItem = '',
  onOpenChange,
  onEvidence,
}: {
  items: Item[];
  active: boolean;
  refreshToken: unknown;
  initialItem?: string;
  onOpenChange: (changeId: string, itemId?: string) => void;
  onEvidence: (evidence: EvidenceDetail) => void;
}) {
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters, itemId: initialItem });
  const [draft, setDraft] = useState(filters);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [result, setResult] = useState<{ query: string; page: HistoryPage }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [evidenceError, setEvidenceError] = useState('');
  const [retry, setRetry] = useState(0);
  const [openingEvidence, setOpeningEvidence] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const query = queryFor(filters, cursors.at(-1)!);
  const page = result?.query === query ? result.page : undefined;
  useEffect(() => {
    if (!active) return;
    const abort = new AbortController();
    setLoading(true);
    setError('');
    setResult(undefined);
    api<HistoryPage>(`/api/history?${query}`, { signal: abort.signal })
      .then((page) => {
        if (!abort.signal.aborted) setResult({ query, page });
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [active, query, refreshToken, retry]);

  function apply(next: Filters) {
    setFilters(next);
    setDraft(next);
    setCursors([null]);
    setRetry((v) => v + 1);
    setEvidenceError('');
  }
  async function openEvidence(id: string) {
    setOpeningEvidence(true);
    setEvidenceError('');
    try {
      onEvidence(await api<EvidenceDetail>(`/api/evidence/${encodeURIComponent(id)}`));
    } catch (e) {
      setEvidenceError((e as Error).message);
    } finally {
      setOpeningEvidence(false);
    }
  }
  function turnPage(next: (string | null)[]) {
    setCursors(next);
    resultsRef.current?.scrollIntoView({ block: 'start' });
    resultsRef.current?.focus({ preventScroll: true });
  }
  const itemName = (id: string) => items.find((i) => i.id === id)?.title ?? id;
  const evidenceButton = (id: string, label: string) => (
    <button
      className="history-action"
      disabled={openingEvidence}
      onClick={() => void openEvidence(id)}
    >
      <FileText size={15} /> {label}
    </button>
  );
  function eventContent(entry: HistoryEntry) {
    switch (entry.kind) {
      case 'change':
        return (
          <>
            <h3>
              {entry.itemId} · {entry.title}
            </h3>
            <p>
              Revision {entry.beforeRevision} → {entry.afterRevision} · {entry.itemIds.length - 1}{' '}
              impacted items
            </p>
            <details className="history-diff">
              <summary>Compare before and after</summary>
              <div className="history-diff-grid">
                <div>
                  <span className="eyebrow">BEFORE</span>
                  <p>{entry.before}</p>
                </div>
                <div>
                  <span className="eyebrow">AFTER</span>
                  <p>{entry.after}</p>
                </div>
              </div>
            </details>
            <div className="history-actions">
              <button
                className="history-action"
                onClick={() =>
                  onOpenChange(
                    entry.changeId,
                    filters.itemId && filters.itemId !== entry.itemId ? filters.itemId : undefined,
                  )
                }
              >
                View saved change <ArrowRight size={15} />
              </button>
              {evidenceButton(entry.evidenceId, 'Change evidence')}
            </div>
          </>
        );
      case 'review':
        return (
          <>
            <h3>
              {entry.itemId} · {entry.title}
            </h3>
            <p className="history-context">
              For a change to {entry.changedItemId} · {itemName(entry.changedItemId)}
            </p>
            <p className="history-reason">
              <b>{decisions[entry.status]}</b> — {entry.reason}
            </p>
            <button
              className="history-action"
              onClick={() => onOpenChange(entry.changeId, entry.itemId)}
            >
              Open review & saved paths <ArrowRight size={15} />
            </button>
          </>
        );
      case 'relationship':
        return (
          <>
            <h3>
              {entry.previous.from} → {entry.previous.to}{' '}
              <span className="history-replaced">replaced by</span> {entry.replacement.from} →{' '}
              {entry.replacement.to}
            </h3>
            <p className="history-reason">{entry.reason}</p>
            <div className="history-diff-grid">
              <div>
                <span className="eyebrow">PREVIOUS RELATIONSHIP</span>
                <p>
                  {itemName(entry.previous.from)} → {itemName(entry.previous.to)}
                </p>
                {evidenceButton(entry.previous.evidenceId, 'Previous evidence')}
              </div>
              <div>
                <span className="eyebrow">REPLACEMENT</span>
                <p>
                  {itemName(entry.replacement.from)} → {itemName(entry.replacement.to)}
                </p>
                {evidenceButton(entry.replacement.evidenceId, 'Replacement evidence')}
              </div>
            </div>
          </>
        );
    }
  }
  return (
    <section className="history-view" aria-labelledby="history-title">
      <div className="history-heading">
        <div>
          <span className="eyebrow">THE RECORD BEHIND THE RIPPLE</span>
          <h2 id="history-title">
            <HistoryIcon size={24} /> Workspace history
          </h2>
          <p>
            Explore applied changes, every saved review decision, and relationship replacements.
          </p>
        </div>
        <button
          className="history-action"
          onClick={() => {
            setCursors([null]);
            setRetry((v) => v + 1);
          }}
          disabled={loading}
        >
          <RotateCcw size={15} /> Refresh history
        </button>
      </div>
      <form
        className="history-filters"
        onSubmit={(e) => {
          e.preventDefault();
          apply(draft);
        }}
      >
        <label>
          Item
          <select
            value={draft.itemId}
            onChange={(e) => setDraft({ ...draft, itemId: e.target.value })}
          >
            <option value="">All items</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.id} · {i.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Event type
          <select
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value, status: '' })}
          >
            <option value="">All events</option>
            <option value="change">Changes</option>
            <option value="review">Reviews</option>
            <option value="relationship">Relationship replacements</option>
          </select>
        </label>
        <label>
          Review decision
          <select
            value={draft.status}
            disabled={!!draft.kind && draft.kind !== 'review'}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          >
            <option value="">All decisions</option>
            <option value="keep">Keep</option>
            <option value="revise">Revise</option>
            <option value="defer">Defer</option>
          </select>
        </label>
        <label className="history-search">
          Search history
          <input
            type="search"
            maxLength={200}
            placeholder="Item, text, reason or record ID"
            value={draft.q}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          />
        </label>
        <label>
          From date
          <input
            type="date"
            max={draft.until || '9999-12-30'}
            value={draft.from}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
          />
        </label>
        <label>
          Through date
          <input
            type="date"
            min={draft.from}
            max="9999-12-30"
            value={draft.until}
            onChange={(e) => setDraft({ ...draft, until: e.target.value })}
          />
        </label>
        <div className="history-filter-actions">
          <button className="primary" type="submit">
            <Search size={15} /> Apply filters
          </button>
          <button className="history-action" type="button" onClick={() => apply(emptyFilters)}>
            Clear filters
          </button>
        </div>
        <p className="history-filter-help">
          Item matches include changed or impacted items, reviewed items and their changed item, and
          both endpoints before and after replacement. Dates use your local timezone. Search covers
          IDs, item titles, changed text and reasons.
        </p>
      </form>
      <div className="history-results" ref={resultsRef} tabIndex={-1} aria-busy={loading}>
        <p className="history-results-label" role="status">
          {loading
            ? 'Loading history…'
            : error
              ? 'History unavailable'
              : `Page ${cursors.length} · ${page?.entries.length ?? 0} ${page?.entries.length === 1 ? 'event' : 'events'} · Newest first`}
        </p>
        <p className="helper">
          Review events record decisions, not completed work. Previous decisions remain visible even
          after a later decision. Opening a review shows its latest decision and original paths.
        </p>
        {error && (
          <div className="banner error" role="alert">
            {error}
            <button onClick={() => setRetry((v) => v + 1)}>Retry history</button>
          </div>
        )}
        {evidenceError && (
          <div className="banner error" role="alert">
            {evidenceError} Select the evidence again to retry.
          </div>
        )}
        {!loading && !error && page?.entries.length === 0 && (
          <div className="history-empty">
            <HistoryIcon size={28} />
            <h3>No matching history</h3>
            <p>
              Try a different item or clear the filters. Events appear after applying a change,
              saving a review, or replacing a relationship.
            </p>
            <button className="history-action" onClick={() => apply(emptyFilters)}>
              Show all history
            </button>
          </div>
        )}
        {!loading && !error && (
          <ol className="history-list">
            {page?.entries.map((entry) => (
              <li key={entry.id}>
                <article className={`history-card history-${entry.kind}`}>
                  <div className="history-meta">
                    <span className="history-kind">{kinds[entry.kind]}</span>
                    <time dateTime={entry.createdAt}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </time>
                  </div>
                  {eventContent(entry)}
                  <div className="history-items" aria-label="Related items">
                    {entry.itemIds.map((id) => (
                      <button
                        key={id}
                        title={itemName(id)}
                        aria-label={`Filter history for ${id}: ${itemName(id)}`}
                        onClick={() => apply({ ...filters, itemId: id })}
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                  <details className="history-record">
                    <summary>Record ID</summary>
                    <code>{entry.id}</code>
                    {'changeId' in entry && <p>Change: {entry.changeId}</p>}
                    {entry.kind === 'relationship' && (
                      <p>
                        Previous: {entry.previous.id}
                        <br />
                        Replacement: {entry.replacement.id}
                      </p>
                    )}
                  </details>
                </article>
              </li>
            ))}
          </ol>
        )}
        <nav className="history-pagination" aria-label="History pages">
          <button
            className="history-action"
            disabled={loading || cursors.length === 1}
            onClick={() => turnPage(cursors.slice(0, -1))}
          >
            Previous page
          </button>
          <span>Up to {page?.pageSize ?? 25} events per page</span>
          <button
            className="history-action"
            disabled={loading || !page?.nextCursor || !!error}
            onClick={() => turnPage([...cursors, page!.nextCursor])}
          >
            Next page <ArrowRight size={15} />
          </button>
        </nav>
      </div>
    </section>
  );
}
