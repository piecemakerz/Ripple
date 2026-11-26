import { SampleSource } from './SampleContent.js';
import { itemTitle, sourceTitle } from './sample-content.js';
import { useI18n } from './i18n.js';
import { useEffect, useRef, useState } from 'react';
import type { DependencyRecord, EvidenceDetail, Item, Workspace } from '../shared/types.js';
import { evidenceMatches } from '../shared/evidence-selection.js';
import { api } from './api.js';

export function Relationships({
  workspace,
  onWorkspace,
  onEvidence,
  onDirtyChange,
  readingOnly = false,
}: {
  workspace: Workspace;
  onWorkspace: (value: Workspace) => void;
  onEvidence: (id: string) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
  readingOnly?: boolean;
}) {
  const { t, locale, language } = useI18n();
  const [editing, setEditing] = useState<{
    edge: DependencyRecord;
    items: Item[];
    evidence: EvidenceDetail;
  }>();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [quote, setQuote] = useState('');
  const [occurrence, setOccurrence] = useState(-1);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty =
    !!editing &&
    (from !== editing.edge.from ||
      to !== editing.edge.to ||
      sourceId !== editing.evidence.sourceId ||
      quote !== editing.evidence.quote ||
      occurrence !== editing.evidence.start ||
      !!reason);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  const requests = useRef(new Map<string, string>());
  const editor = useRef<HTMLDivElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error || notice) {
      feedback.current?.scrollIntoView({ block: 'center' });
      feedback.current?.focus();
    }
  }, [error, notice]);
  const source = workspace.sources.find((s) => s.id === sourceId);
  const matches = source ? evidenceMatches(source.text, quote) : [];
  const match = matches.length === 1 ? matches[0] : matches.find((m) => m.start === occurrence);
  const name = (id: string) =>
    itemTitle(
      workspace.items.find((i) => i.id === id),
      language,
    ) || id;
  const history = workspace.dependencies.filter((d) => d.status === 'superseded');

  async function open(edge: DependencyRecord) {
    if (dirty && !window.confirm(t('Discard the unsaved relationship edit?'))) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const original = await api<EvidenceDetail>(`/api/evidence/${edge.evidenceId}`);
      setEditing({ edge, items: workspace.items, evidence: original });
      setFrom(edge.from);
      setTo(edge.to);
      setSourceId(original.sourceId);
      setQuote(original.quote);
      setOccurrence(original.start);
      setReason('');
      requestAnimationFrame(() => {
        editor.current?.scrollIntoView({ block: 'center' });
        editor.current?.focus();
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!editing || !source || !match) return;
    const payload = {
      expectedRevision: editing.edge.revision,
      from,
      to,
      fromRevision: editing.items.find((i) => i.id === from)!.revision,
      toRevision: editing.items.find((i) => i.id === to)!.revision,
      evidence: { sourceId, ...match },
      reason,
    };
    const path = `/api/dependencies/${editing.edge.id}/replacements`;
    const key = JSON.stringify({ path, payload });
    if (!requests.current.has(key)) requests.current.set(key, crypto.randomUUID());
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(path, {
        method: 'POST',
        body: JSON.stringify({ ...payload, requestId: requests.current.get(key) }),
      });
      onWorkspace(await api<Workspace>('/api/workspace'));
      setEditing(undefined);
      setNotice(
        'Replacement confirmed. Future impact uses the new relationship. Saved changes and reviews retain their original paths.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="document-card relationships" aria-label={t('Confirmed relationships')}>
      <h2>{t('Confirmed relationships')}</h2>
      <p hidden={readingOnly}>
        {t(
          'Edit the evidence or replace either endpoint. The old relationship stays in history; the replacement is confirmed immediately.',
        )}
      </p>
      <div ref={feedback} tabIndex={-1}>
        {error && (
          <div className="banner error" role="alert">
            {t('{0} Your draft is preserved.', [t(error)])}
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  onWorkspace(await api<Workspace>('/api/workspace'));
                  setError('Workspace refreshed. Reopen the editor to use current revisions.');
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('Refresh relationships')}
            </button>
          </div>
        )}
        {notice && (
          <p className="banner success" role="status">
            {t(notice)}
          </p>
        )}
      </div>
      <fieldset disabled={busy} className="document-controls">
        <legend className="sr-only">{t('Relationship editor and history')}</legend>
        {workspace.dependencies
          .filter((d) => d.status === 'confirmed')
          .map((d) => (
            <div
              className="candidate-row"
              key={d.id}
              id={d.from === 'D1' && d.to === 'A1' ? 'sample-relationship' : undefined}
              tabIndex={-1}
            >
              <div>
                <strong>
                  {name(d.from)} → {name(d.to)}
                </strong>
                <p>
                  {t('Confirmed · revision {0} {1}', [
                    d.revision,
                    d.supersedes ? t(' · replacement') : '',
                  ])}
                </p>
              </div>
              <button
                onClick={() =>
                  void onEvidence(d.evidenceId).catch((e: Error) => setError(e.message))
                }
              >
                {t('View original evidence')}
              </button>
              <button hidden={readingOnly} onClick={() => void open(d)}>
                {t('Edit or replace {0} → {1}', [d.from, d.to])}
              </button>
            </div>
          ))}
        {editing && (
          <div
            hidden={readingOnly}
            ref={editor}
            tabIndex={-1}
            className="relationship-editor document-action-panel"
            aria-label={t('Edit confirmed relationship')}
          >
            <h3>{t('Edit {0} → {1}', [editing.edge.from, editing.edge.to])}</h3>
            <p>
              {t(
                'Original: {0} depends on {1}. Choose new evidence below, or keep the original quote when replacing endpoints.',
                [name(editing.edge.from), name(editing.edge.to)],
              )}
            </p>
            <div className="document-grid">
              <div>
                <label>
                  {t('Replacement dependent')}
                  <select value={from} onChange={(e) => setFrom(e.target.value)}>
                    {editing.items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {name(i.id)}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="direction-label">{t('↓ depends on')}</p>
                <label>
                  {t('Replacement prerequisite')}
                  <select value={to} onChange={(e) => setTo(e.target.value)}>
                    {editing.items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {name(i.id)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('Reason for replacement')}
                  <textarea
                    rows={3}
                    value={reason}
                    maxLength={4000}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              </div>
              <div>
                <label>
                  {t('Replacement source version')}
                  <select
                    value={sourceId}
                    onChange={(e) => {
                      setSourceId(e.target.value);
                      setQuote('');
                      setOccurrence(-1);
                    }}
                  >
                    {workspace.sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {t('{0} · v{1}', [sourceTitle(s, language), s.version])}
                      </option>
                    ))}
                  </select>
                </label>
                {source && <SampleSource key={source.id} source={source} />}
                <label>
                  {t('Replacement evidence quote')}
                  <textarea
                    rows={3}
                    value={quote}
                    maxLength={10000}
                    aria-invalid={!!quote && matches.length === 0}
                    aria-describedby="replacement-match-status"
                    onChange={(e) => {
                      setQuote(e.target.value);
                      setOccurrence(-1);
                    }}
                  />
                </label>
                {matches.length > 1 && (
                  <label>
                    {t('Replacement quote occurrence')}
                    <select
                      value={occurrence}
                      onChange={(e) => setOccurrence(Number(e.target.value))}
                    >
                      <option value={-1}>{t('Choose the intended occurrence')}</option>
                      {matches.slice(0, 100).map((m, i) => (
                        <option key={m.start} value={m.start}>
                          {t('Occurrence {0} · characters {1}–{2}', [i + 1, m.start, m.end])}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="helper" role="status" id="replacement-match-status">
                  {match
                    ? t('Exact match · characters {0}–{1}', [match.start, match.end])
                    : quote && matches.length === 0
                      ? t(
                          'This text is not in the saved original. Copy an exact passage, including punctuation and spaces; a translation or paraphrase will not match.',
                        )
                      : matches.length > 1
                        ? t(
                            'This passage appears more than once. Choose the intended occurrence above.',
                          )
                        : t('Select an exact quote and its occurrence.')}
                  {matches.length > 100
                    ? t(' First 100 occurrences shown; use a longer quote to narrow the match.')
                    : ''}
                </p>
              </div>
            </div>
            <p>
              {t('After saving:')}
              <b>{t('{0} depends on {1}', [from, to])}</b>
              {t('. Check the direction and evidence before confirming.')}
            </p>
            <div className="relationship-actions">
              <button
                className="primary"
                disabled={!match || !quote.trim() || !reason.trim() || from === to}
                onClick={() => void save()}
              >
                {t('Confirm replacement')}
              </button>
              <button onClick={() => setEditing(undefined)}>{t('Cancel edit')}</button>
            </div>
          </div>
        )}
        <details className="relationship-history">
          <summary>{t('Relationship history ({0})', [history.length])}</summary>
          {!history.length && <p>{t('No replacements yet.')}</p>}
          {history.map((d) => {
            const next = workspace.dependencies.find((r) => r.id === d.supersededBy);
            return (
              <article className="candidate-row" key={d.id}>
                <div>
                  <strong>
                    {name(d.from)} → {name(d.to)}
                  </strong>
                  <p>{t('Superseded · {0}', [d.id])}</p>
                  {next && (
                    <>
                      <p>
                        {t('Replaced by')}
                        {name(next.from)} → {name(next.to)} · {next.id}
                      </p>
                      <p>
                        {next.createdAt && new Date(next.createdAt).toLocaleString(locale)} ·{' '}
                        {next.reason}
                      </p>
                    </>
                  )}
                </div>
                <button
                  onClick={() =>
                    void onEvidence(d.evidenceId).catch((e: Error) => setError(e.message))
                  }
                >
                  {t('View prior evidence')}
                </button>
                {next && (
                  <button
                    onClick={() =>
                      void onEvidence(next.evidenceId).catch((e: Error) => setError(e.message))
                    }
                  >
                    {t('View replacement evidence')}
                  </button>
                )}
              </article>
            );
          })}
        </details>
      </fieldset>
    </section>
  );
}
