import { SampleBody } from './SampleContent.js';
import { itemTitle } from './sample-content.js';
import { useI18n } from './i18n.js';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  FileText,
  History as HistoryIcon,
  RotateCcw,
  Search,
  GitBranch,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import type { EvidenceDetail, HistoryEntry, HistoryPage, Item } from '../shared/types.js';
import { api } from './api.js';
import { resolveHistoryTitle, translatedTitleMatches } from './history-search.js';

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
  onPage,
}: {
  items: Item[];
  active: boolean;
  refreshToken: unknown;
  initialItem?: string;
  onOpenChange: (changeId: string, itemId?: string) => void;
  onEvidence: (evidence: EvidenceDetail, invoker?: Element | null) => void;
  onPage?: (page: HistoryPage | undefined) => void;
}) {
  const { t, locale, language } = useI18n();
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
  const appliedFilterCount = Object.values(filters).filter(Boolean).length;
  const titleSuggestions = translatedTitleMatches(items, draft.q, language).slice(0, 6);
  useEffect(() => {
    if (!active) return;
    const abort = new AbortController();
    setLoading(true);
    setError('');
    setResult(undefined);
    onPage?.(undefined);
    api<HistoryPage>(`/api/history?${query}`, { signal: abort.signal })
      .then((page) => {
        if (!abort.signal.aborted) {
          setResult({ query, page });
          onPage?.(page);
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [active, query, refreshToken, retry, onPage]);

  function apply(next: Filters) {
    setFilters(next);
    setDraft(next);
    setCursors([null]);
    setRetry((v) => v + 1);
    setEvidenceError('');
  }
  async function openEvidence(id: string) {
    if (openingEvidence) return;
    const invoker = document.activeElement;
    setOpeningEvidence(true);
    setEvidenceError('');
    try {
      onEvidence(await api<EvidenceDetail>(`/api/evidence/${encodeURIComponent(id)}`), invoker);
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
  const itemName = (id: string) =>
    itemTitle(
      items.find((i) => i.id === id),
      language,
    ) || id;
  const evidenceButton = (id: string, label: string) => (
    <button
      className="history-action"
      // Keep the trigger focused while loading so the native dialog can restore it on close.
      aria-disabled={openingEvidence}
      aria-busy={openingEvidence}
      onClick={() => void openEvidence(id)}
    >
      <FileText size={15} aria-hidden="true" /> {label}
    </button>
  );
  function eventContent(entry: HistoryEntry) {
    switch (entry.kind) {
      case 'change':
        return (
          <>
            <h3>{itemTitle({ id: entry.itemId, title: entry.title }, language)}</h3>
            <p>
              {t('Revision {0} → {1} · {2} impacted items', [
                entry.beforeRevision,
                entry.afterRevision,
                entry.itemIds.length - 1,
              ])}
            </p>
            <details className="history-diff">
              <summary>{t('Compare before and after')}</summary>
              <div className="history-diff-grid">
                <div>
                  <span className="history-diff-label">{t('Before')}</span>
                  <SampleBody item={{ id: entry.itemId, title: entry.title }} body={entry.before} />
                </div>
                <div>
                  <span className="history-diff-label">{t('After')}</span>
                  <SampleBody item={{ id: entry.itemId, title: entry.title }} body={entry.after} />
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
                {t('View saved change')}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
              {evidenceButton(entry.evidenceId, t('View change evidence'))}
            </div>
          </>
        );
      case 'review':
        return (
          <>
            <h3>{itemTitle({ id: entry.itemId, title: entry.title }, language)}</h3>
            <p className="history-context">
              {t('For a change to {0} · {1}', [entry.changedItemId, itemName(entry.changedItemId)])}
            </p>
            <div className="history-decision">
              <span className={`studio-status ${entry.status}`}>{t(decisions[entry.status])}</span>
              <p className="history-reason">{entry.reason}</p>
            </div>
            <button
              className="history-action"
              onClick={() => onOpenChange(entry.changeId, entry.itemId)}
            >
              {t('Open review & saved paths')}
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </>
        );
      case 'relationship':
        return (
          <>
            <h3>
              {itemName(entry.replacement.from)} → {itemName(entry.replacement.to)}
            </h3>
            <p className="history-reason">{entry.reason}</p>
            <div className="history-diff-grid">
              <div>
                <span className="history-diff-label">{t('Previous relationship')}</span>
                <p>
                  {itemName(entry.previous.from)} → {itemName(entry.previous.to)}
                </p>
                {evidenceButton(entry.previous.evidenceId, t('Previous evidence'))}
              </div>
              <div>
                <span className="history-diff-label">{t('Replacement')}</span>
                <p>
                  {itemName(entry.replacement.from)} → {itemName(entry.replacement.to)}
                </p>
                {evidenceButton(entry.replacement.evidenceId, t('Replacement evidence'))}
              </div>
            </div>
          </>
        );
    }
  }
  return (
    <section className="history-view" aria-labelledby="history-title">
      <div className="workspace-heading history-heading">
        <div>
          <span className="workspace-caption">
            <HistoryIcon size={15} aria-hidden="true" />
            {t('Preserved decisions')}
          </span>
          <h1 id="history-title">{t('Workspace history')}</h1>
          <p>
            {t(
              'Explore applied changes, every saved review decision, and relationship replacements.',
            )}
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
          <RotateCcw size={15} aria-hidden="true" />
          {t('Refresh history')}
        </button>
      </div>
      <div className="history-layout">
        <details className="history-filter-panel" open>
          <summary>
            <SlidersHorizontal size={18} aria-hidden="true" />
            <span>
              {t('Filter history')}
              <small>
                {appliedFilterCount
                  ? t('{0} {1} applied', [
                      appliedFilterCount,
                      appliedFilterCount === 1 ? t('filter') : t('filters'),
                    ])
                  : t('All workspace events')}
              </small>
            </span>
            <ChevronDown size={17} aria-hidden="true" />
          </summary>
          <form
            className="history-filters"
            onSubmit={(e) => {
              e.preventDefault();
              apply(resolveHistoryTitle(draft, items, language));
            }}
          >
            <label>
              {t('Item')}
              <select
                value={draft.itemId}
                onChange={(e) => setDraft({ ...draft, itemId: e.target.value })}
              >
                <option value="">{t('All items')}</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.id} · {itemTitle(i, language)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('Event type')}
              <select
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value, status: '' })}
              >
                <option value="">{t('All events')}</option>
                <option value="change">{t('Changes')}</option>
                <option value="review">{t('Reviews')}</option>
                <option value="relationship">{t('Relationship replacements')}</option>
              </select>
            </label>
            <label>
              {t('Review decision')}
              <select
                value={draft.status}
                disabled={!!draft.kind && draft.kind !== 'review'}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              >
                <option value="">{t('All decisions')}</option>
                <option value="keep">{t('Keep')}</option>
                <option value="revise">{t('Revise')}</option>
                <option value="defer">{t('Defer')}</option>
              </select>
            </label>
            <label className="history-search">
              {t('Search history')}
              <input
                type="search"
                maxLength={200}
                name="history-search"
                autoComplete="off"
                aria-describedby="history-search-help"
                placeholder={t('Item, reason or record ID…')}
                value={draft.q}
                onChange={(e) => setDraft({ ...draft, q: e.target.value })}
              />
            </label>
            {titleSuggestions.length > 0 && (
              <div
                className="history-title-suggestions"
                aria-label={t('Matching displayed titles')}
                role="group"
              >
                <p>{t('Find records for this item:')}</p>
                {titleSuggestions.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => apply({ ...draft, itemId: item.id, q: '' })}
                  >
                    {itemTitle(item, language)}
                  </button>
                ))}
              </div>
            )}
            <label>
              {t('From date')}
              <input
                type="date"
                max={draft.until || '9999-12-30'}
                value={draft.from}
                onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              />
            </label>
            <label>
              {t('Through date')}
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
                <Search size={15} aria-hidden="true" />
                {t('Apply filters')}
              </button>
              <button className="history-action" type="button" onClick={() => apply(emptyFilters)}>
                {t('Clear filters')}
              </button>
            </div>
            <p className="history-filter-help" id="history-search-help">
              {t(
                'Item matches include changed or impacted items, reviewed items and their changed item, and both endpoints before and after replacement. Dates use your local timezone. Search covers IDs, item titles, changed text and reasons.',
              )}{' '}
              {t(
                'An exact translated sample title selects that item. Partial titles offer matching items; other text searches the original records.',
              )}
            </p>
          </form>
        </details>
        <div
          id="sample-history"
          className="history-results"
          ref={resultsRef}
          tabIndex={-1}
          aria-busy={loading}
        >
          <h2 className="history-results-title">{t('Event record')}</h2>
          <p className="history-results-label" role="status">
            {loading
              ? t('Loading history…')
              : error
                ? t('History unavailable')
                : t('Page {0} · {1} {2} · Newest first', [
                    cursors.length,
                    page?.entries.length ?? 0,
                    page?.entries.length === 1 ? t('event') : t('events'),
                  ])}
          </p>
          <p className="helper">
            {t(
              'Review events record decisions, not completed work. Previous decisions remain visible even after a later decision. Opening a review shows its latest decision and original paths.',
            )}
          </p>
          {error && (
            <div className="banner error" role="alert">
              {t(error)}
              <button onClick={() => setRetry((v) => v + 1)}>{t('Retry history')}</button>
            </div>
          )}
          {evidenceError && (
            <div className="banner error" role="alert">
              {t('{0} Select the evidence again to retry.', [t(evidenceError)])}
            </div>
          )}
          {!loading && !error && page?.entries.length === 0 && (
            <div className="history-empty">
              <HistoryIcon size={28} aria-hidden="true" />
              <h3>{t('No matching history')}</h3>
              <p>
                {t(
                  'Try a different item or clear the filters. Events appear after applying a change, saving a review, or replacing a relationship.',
                )}
              </p>
              <button className="history-action" onClick={() => apply(emptyFilters)}>
                {t('Show all history')}
              </button>
            </div>
          )}
          {!loading && !error && (
            <ol className="history-list">
              {page?.entries.map((entry) => (
                <li key={entry.id}>
                  <article className={`history-card history-${entry.kind}`}>
                    <div className="history-meta">
                      <span className="history-kind">
                        {entry.kind === 'review' ? (
                          <CheckCircle2 size={16} aria-hidden="true" />
                        ) : entry.kind === 'relationship' ? (
                          <GitBranch size={16} aria-hidden="true" />
                        ) : (
                          <FileText size={16} aria-hidden="true" />
                        )}
                        {t(kinds[entry.kind])}
                      </span>
                      <time dateTime={entry.createdAt}>
                        {new Date(entry.createdAt).toLocaleString(locale)}
                      </time>
                    </div>
                    {eventContent(entry)}
                    <div className="history-items" aria-label={t('Related items')}>
                      {entry.itemIds.map((id) => (
                        <button
                          key={id}
                          title={itemName(id)}
                          aria-label={t('Filter history for {0}: {1}', [id, itemName(id)])}
                          onClick={() => apply({ ...filters, itemId: id })}
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                    <details className="history-record">
                      <summary>{t('Record ID')}</summary>
                      <code>{entry.id}</code>
                      {'changeId' in entry && <p>{t('Change: {0}', [entry.changeId])}</p>}
                      {entry.kind === 'relationship' && (
                        <p>
                          {t('Previous: {0}', [entry.previous.id])}
                          <br />
                          {t('Replacement: {0}', [entry.replacement.id])}
                        </p>
                      )}
                    </details>
                  </article>
                </li>
              ))}
            </ol>
          )}
          <nav className="history-pagination" aria-label={t('History pages')}>
            <button
              className="history-action"
              disabled={loading || cursors.length === 1}
              onClick={() => turnPage(cursors.slice(0, -1))}
            >
              {t('Previous page')}
            </button>
            <span>{t('Up to {0} events per page', [page?.pageSize ?? 25])}</span>
            <button
              className="history-action"
              disabled={loading || !page?.nextCursor || !!error}
              onClick={() => turnPage([...cursors, page!.nextCursor])}
            >
              {t('Next page')}
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </section>
  );
}
