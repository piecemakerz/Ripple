import { useEffect, useRef, useState } from 'react';
import type { DependencyRecord, EvidenceDetail, Item, Workspace } from '../shared/types.js';
import { evidenceMatches } from '../shared/evidence-selection.js';
import { api } from './api.js';

export function Relationships({
  workspace,
  onWorkspace,
  onEvidence,
}: {
  workspace: Workspace;
  onWorkspace: (value: Workspace) => void;
  onEvidence: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<{ edge: DependencyRecord; items: Item[] }>();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [quote, setQuote] = useState('');
  const [occurrence, setOccurrence] = useState(-1);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
    `${id} · ${workspace.items.find((i) => i.id === id)?.title ?? 'Unknown item'}`;
  const history = workspace.dependencies.filter((d) => d.status === 'superseded');

  async function open(edge: DependencyRecord) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const original = await api<EvidenceDetail>(`/api/evidence/${edge.evidenceId}`);
      setEditing({ edge, items: workspace.items });
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
    <section className="document-card relationships" aria-label="Confirmed relationships">
      <h3>Confirmed relationships</h3>
      <p>
        Edit the evidence or replace either endpoint. The old relationship stays in history; the
        replacement is confirmed immediately.
      </p>
      <div ref={feedback} tabIndex={-1}>
        {error && (
          <div className="banner error" role="alert">
            {error} Your draft is preserved.
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
              Refresh relationships
            </button>
          </div>
        )}
        {notice && (
          <p className="banner success" role="status">
            {notice}
          </p>
        )}
      </div>
      <fieldset disabled={busy} className="document-controls">
        <legend className="sr-only">Relationship editor and history</legend>
        {workspace.dependencies
          .filter((d) => d.status === 'confirmed')
          .map((d) => (
            <div className="candidate-row" key={d.id}>
              <div>
                <strong>
                  {name(d.from)} → {name(d.to)}
                </strong>
                <p>
                  Confirmed · revision {d.revision}
                  {d.supersedes ? ' · replacement' : ''}
                </p>
              </div>
              <button
                onClick={() =>
                  void onEvidence(d.evidenceId).catch((e: Error) => setError(e.message))
                }
              >
                View original evidence
              </button>
              <button onClick={() => void open(d)}>
                Edit or replace {d.from} → {d.to}
              </button>
            </div>
          ))}
        {editing && (
          <div
            ref={editor}
            tabIndex={-1}
            className="relationship-editor"
            aria-label="Edit confirmed relationship"
          >
            <h4>
              Edit {editing.edge.from} → {editing.edge.to}
            </h4>
            <p>
              Original: {name(editing.edge.from)} depends on {name(editing.edge.to)}. Choose new
              evidence below, or keep the original quote when replacing endpoints.
            </p>
            <div className="document-grid">
              <div>
                <label>
                  Replacement dependent
                  <select value={from} onChange={(e) => setFrom(e.target.value)}>
                    {editing.items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {name(i.id)}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="direction-label">↓ depends on</p>
                <label>
                  Replacement prerequisite
                  <select value={to} onChange={(e) => setTo(e.target.value)}>
                    {editing.items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {name(i.id)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reason for replacement
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
                  Replacement source version
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
                        {s.title} · v{s.version}
                      </option>
                    ))}
                  </select>
                </label>
                {source && (
                  <pre
                    className="preserved-source"
                    tabIndex={0}
                    aria-label="Replacement original text"
                  >
                    {source.text}
                  </pre>
                )}
                <label>
                  Replacement evidence quote
                  <textarea
                    rows={3}
                    value={quote}
                    maxLength={10000}
                    onChange={(e) => {
                      setQuote(e.target.value);
                      setOccurrence(-1);
                    }}
                  />
                </label>
                {matches.length > 1 && (
                  <label>
                    Replacement quote occurrence
                    <select
                      value={occurrence}
                      onChange={(e) => setOccurrence(Number(e.target.value))}
                    >
                      <option value={-1}>Choose the intended occurrence</option>
                      {matches.slice(0, 100).map((m, i) => (
                        <option key={m.start} value={m.start}>
                          Occurrence {i + 1} · characters {m.start}–{m.end}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="helper" role="status">
                  {match
                    ? `Exact match · characters ${match.start}–${match.end}`
                    : 'Select an exact quote and its occurrence.'}
                  {matches.length > 100
                    ? ' First 100 occurrences shown; use a longer quote to narrow the match.'
                    : ''}
                </p>
              </div>
            </div>
            <p>
              After saving:{' '}
              <b>
                {from} depends on {to}
              </b>
              . Check the direction and evidence before confirming.
            </p>
            <div className="relationship-actions">
              <button
                className="primary"
                disabled={!match || !quote.trim() || !reason.trim() || from === to}
                onClick={() => void save()}
              >
                Confirm replacement
              </button>
              <button onClick={() => setEditing(undefined)}>Cancel edit</button>
            </div>
          </div>
        )}
        <details className="relationship-history">
          <summary>Relationship history ({history.length})</summary>
          {!history.length && <p>No replacements yet.</p>}
          {history.map((d) => {
            const next = workspace.dependencies.find((r) => r.id === d.supersededBy);
            return (
              <article className="candidate-row" key={d.id}>
                <div>
                  <strong>
                    {name(d.from)} → {name(d.to)}
                  </strong>
                  <p>Superseded · {d.id}</p>
                  {next && (
                    <>
                      <p>
                        Replaced by {name(next.from)} → {name(next.to)} · {next.id}
                      </p>
                      <p>
                        {next.createdAt && new Date(next.createdAt).toLocaleString('en-US')} ·{' '}
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
                  View prior evidence
                </button>
                {next && (
                  <button
                    onClick={() =>
                      void onEvidence(next.evidenceId).catch((e: Error) => setError(e.message))
                    }
                  >
                    View replacement evidence
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
