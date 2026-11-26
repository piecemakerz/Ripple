import { itemTitle, proposalTitle } from './sample-content.js';
import { localeFor, translate, type Language } from './i18n-core.js';
import { useI18n } from './i18n.js';
import { useEffect, useState } from 'react';
import type { ChangePage, ChangeSummary, Item, Proposal } from '../shared/types.js';
import { api } from './api.js';

const label = (change: ChangeSummary, items: Item[], language: Language) =>
  translate('{0} — revision {1}, {2}', language, [
    itemTitle(
      items.find((item) => item.id === change.itemId),
      language,
    ) || change.itemId,
    change.afterRevision,
    new Date(change.createdAt).toLocaleString(localeFor(language)),
  ]);

export function ChangePicker({
  initialPage,
  proposals,
  items,
  selection,
  selectedChange,
  disabled,
  onSelect,
}: {
  initialPage: ChangePage;
  proposals: Proposal[];
  items: Item[];
  selection: string;
  selectedChange: ChangeSummary | undefined;
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  const { t, language } = useI18n();
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ cursor: string | null; page: ChangePage }>({
    cursor: null,
    page: initialPage,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPaging, setShowPaging] = useState(false);
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
          {t('Change to explore')}
        </label>
        <select
          id="change-select"
          name="change"
          value={selection}
          disabled={disabled}
          onChange={(e) => onSelect(e.target.value)}
        >
          <optgroup label={t('Proposed updates')}>
            {proposals.map((p) => (
              <option key={p.id} value={`proposal:${p.id}`}>
                {t('{0} · proposed update', [proposalTitle(p, language)])}
              </option>
            ))}
          </optgroup>
          {outsidePage && (
            <option value={selection}>
              {t('{0} · selected', [
                selectedChange ? label(selectedChange, items, language) : t('Saved change'),
              ])}
            </option>
          )}
          <optgroup label={t('Saved changes · page {0}', [cursors.length])}>
            {entries.map((c) => (
              <option key={c.id} value={c.id}>
                {label(c, items, language)}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <div className={`change-picker-navigation ${showPaging ? 'expanded' : ''}`}>
        <button
          className="change-picker-toggle"
          aria-expanded={showPaging}
          aria-controls="change-pages"
          onClick={() => setShowPaging((value) => !value)}
        >
          {t('Saved change pages')}
          <span>{showPaging ? t('Hide') : t('Show')}</span>
        </button>
        <div id="change-pages" className="change-picker-paging">
          <p className="helper" role="status">
            {loading
              ? t('Loading saved changes…')
              : page
                ? t('{0} saved {1} on page {2}.', [
                    entries.length,
                    entries.length === 1 ? t('change') : t('changes'),
                    cursors.length,
                  ])
                : t('Change list unavailable.')}
          </p>
          <div className="change-picker-actions" aria-label={t('Saved change pages')}>
            <button
              disabled={disabled || loading || cursors.length === 1}
              onClick={() => {
                setCursors((v) => v.slice(0, -1));
                setRetry((v) => v + 1);
              }}
            >
              {t('Newer changes')}
            </button>
            <button
              disabled={disabled || loading || !!error || !page?.nextCursor}
              onClick={() => {
                setCursors((v) => [...v, page!.nextCursor]);
                setRetry((v) => v + 1);
              }}
            >
              {t('Older changes')}
            </button>
            <button
              disabled={disabled || loading}
              onClick={() => {
                setCursors([null]);
                setRetry((v) => v + 1);
              }}
            >
              {t('Refresh changes')}
            </button>
          </div>
        </div>
      </div>
      {error && (
        <div className="banner error" role="alert">
          <span>{t('Could not load saved changes. {0}', [t(error)])}</span>
          <button disabled={disabled || loading} onClick={() => setRetry((v) => v + 1)}>
            {t('Retry change list')}
          </button>
        </div>
      )}
    </div>
  );
}
