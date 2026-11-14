import { useRef, useState } from 'react';
import type { Evidence, ItemKind, Proposal, SourceVersion, Workspace } from '../shared/types.js';
import { api } from './api.js';
import { evidenceMatches } from '../shared/evidence-selection.js';
import { Relationships } from './Relationships.js';

export function Documents({
  workspace,
  onWorkspace,
  onPreview,
  onEvidence,
}: {
  workspace: Workspace;
  onWorkspace: (value: Workspace) => void;
  onPreview: (proposal: Proposal) => void;
  onEvidence: (id: string) => Promise<void>;
}) {
  const [documentId, setDocumentId] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [quote, setQuote] = useState('');
  const [occurrence, setOccurrence] = useState(-1);
  const [kind, setKind] = useState<ItemKind>('Task');
  const [itemTitle, setItemTitle] = useState('');
  const [body, setBody] = useState('');
  const [owner, setOwner] = useState('Me');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [target, setTarget] = useState('');
  const [after, setAfter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Reuse the key after a lost response; changed input gets a different request.
  const requests = useRef(new Map<string, string>());
  const source = workspace.sources.find((s) => s.id === sourceId);
  const documents = [
    ...new Map(
      workspace.sources.filter((s) => /^\d+$/.test(s.version)).map((s) => [s.documentId, s]),
    ).values(),
  ];
  const latestVersion = Math.max(
    0,
    ...workspace.sources.filter((s) => s.documentId === documentId).map((s) => Number(s.version)),
  );
  const matches = source ? evidenceMatches(source.text, quote) : [];
  const match = matches.length === 1 ? matches[0] : matches.find((m) => m.start === occurrence);
  const evidence: Omit<Evidence, 'id'> | undefined =
    source && match && quote.trim() ? { sourceId: source.id, ...match } : undefined;
  const options = workspace.items.map((i) => (
    <option key={i.id} value={i.id}>
      {i.title} ({i.id}) · v{i.revision}
    </option>
  ));

  async function run<T>(
    path: string,
    payload: object,
    done?: (result: T) => void,
    method = 'POST',
  ) {
    setBusy(true);
    setError('');
    setNotice('');
    const key = JSON.stringify({ path, payload });
    if (!requests.current.has(key)) requests.current.set(key, crypto.randomUUID());
    try {
      const result = await api<T>(path, {
        method,
        body: JSON.stringify({ ...payload, requestId: requests.current.get(key) }),
      });
      const latest = await api<Workspace>('/api/workspace');
      onWorkspace(latest);
      done?.(result);
      setNotice('Saved in your local workspace.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    setBusy(true);
    try {
      onWorkspace(await api<Workspace>('/api/workspace'));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="documents" aria-label="Documents and relationships">
      <div className="documents-intro">
        <h2>Build context from your documents</h2>
        <p>
          Save a source, identify items, then check the evidence and direction of each dependency.
          Only confirmed relationships affect impact analysis.
        </p>
      </div>
      <Relationships workspace={workspace} onWorkspace={onWorkspace} onEvidence={onEvidence} />
      {error && (
        <div className="banner error" role="alert">
          {error} Your input is preserved.{' '}
          <button onClick={() => void reload()} disabled={busy}>
            Reload workspace
          </button>
        </div>
      )}
      {notice && (
        <div className="banner success" role="status">
          {notice}
        </div>
      )}
      <fieldset disabled={busy} className="document-controls">
        <legend className="sr-only">Document workflow</legend>
        <div className="document-grid">
          <section className="document-card">
            <h3>1. Preserve a document</h3>
            <label>
              Save to document
              <select value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
                <option value="">New document</option>
                {documents.map((s) => (
                  <option key={s.documentId} value={s.documentId}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Document title
              <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Upload Markdown or text
              <input
                type="file"
                accept=".md,.markdown,.txt,text/plain,text/markdown"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  if (!/\.(md|markdown|txt)$/i.test(file.name) || file.size > 80000) {
                    setError('Choose a UTF-8 .md or .txt file up to 80 KB.');
                    return;
                  }
                  setBusy(true);
                  try {
                    const value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
                      await file.arrayBuffer(),
                    );
                    if (value.length > 20000)
                      throw new Error('Documents can contain at most 20,000 characters.');
                    setText(value);
                    setTitle(file.name);
                    setError('');
                  } catch {
                    setError('Unable to read this file. Use UTF-8 text, up to 20,000 characters.');
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
            <label>
              Document text
              <textarea
                rows={7}
                value={text}
                maxLength={20000}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <p className="helper">
              {text.length.toLocaleString()} / 20,000 characters. Saving adds version{' '}
              {latestVersion + 1}; earlier versions stay intact.
            </p>
            <button
              className="primary"
              disabled={!text.trim() || !title.trim()}
              onClick={() =>
                void run<SourceVersion>(
                  '/api/sources',
                  {
                    ...(documentId ? { documentId } : {}),
                    expectedVersion: latestVersion,
                    title,
                    text,
                  },
                  (s) => {
                    setSourceId(s.id);
                    setDocumentId(s.documentId);
                    setQuote('');
                    setOccurrence(-1);
                  },
                )
              }
            >
              Save source version
            </button>
          </section>
          <section className="document-card">
            <h3>2. Select original evidence</h3>
            <label>
              Saved source version
              <select
                value={sourceId}
                onChange={(e) => {
                  setSourceId(e.target.value);
                  setQuote('');
                  setOccurrence(-1);
                }}
              >
                <option value="">Choose a source</option>
                {workspace.sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} · v{s.version}
                  </option>
                ))}
              </select>
            </label>
            {source ? (
              <>
                <pre className="preserved-source" tabIndex={0} aria-label="Preserved original text">
                  {source.text}
                </pre>
                <p className="helper">
                  Preserved version {source.version}. Copy the exact passage that supports your
                  item, dependency or update.
                </p>
                <label>
                  Exact evidence quote
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
                    Quote occurrence
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
                <p role="status" className="helper">
                  {matches.length > 100 &&
                    'Showing the first 100 occurrences. Use a longer quote to narrow the match. '}
                  {evidence
                    ? `Exact match · characters ${evidence.start}–${evidence.end}`
                    : quote
                      ? 'Select a matching passage and, if repeated, its occurrence.'
                      : 'An exact quote is required for the actions below.'}
                </p>
              </>
            ) : (
              <p>Save or select a source version to continue.</p>
            )}
          </section>
          <section className="document-card">
            <h3>3. Add an item</h3>
            <p>Create an assumption, decision or task supported by the selected quote.</p>
            <label>
              Item kind
              <select value={kind} onChange={(e) => setKind(e.target.value as ItemKind)}>
                {['Assumption', 'Decision', 'Task'].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label>
              Item title
              <input
                value={itemTitle}
                maxLength={150}
                onChange={(e) => setItemTitle(e.target.value)}
              />
            </label>
            <label>
              Item description
              <textarea
                rows={3}
                value={body}
                maxLength={10000}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            <label>
              Owner
              <input value={owner} maxLength={100} onChange={(e) => setOwner(e.target.value)} />
            </label>
            <button
              className="primary"
              disabled={!evidence || !itemTitle.trim() || !body.trim() || !owner.trim()}
              onClick={() =>
                void run('/api/items', { kind, title: itemTitle, body, owner, evidence }, () => {
                  setItemTitle('');
                  setBody('');
                })
              }
            >
              Add evidenced item
            </button>
          </section>
          <section className="document-card">
            <h3>4. Propose a dependency</h3>
            <p>
              The dependent needs the prerequisite. The selected quote must explain that connection.
            </p>
            <label>
              Dependent item
              <select value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="">Choose dependent</option>
                {options}
              </select>
            </label>
            <p className="direction-label">↓ depends on</p>
            <label>
              Prerequisite item
              <select value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">Choose prerequisite</option>
                {options}
              </select>
            </label>
            <button
              className="primary"
              disabled={!evidence || !from || !to || from === to}
              onClick={() =>
                void run('/api/candidates', {
                  from,
                  to,
                  fromRevision: workspace.items.find((i) => i.id === from)!.revision,
                  toRevision: workspace.items.find((i) => i.id === to)!.revision,
                  evidence,
                })
              }
            >
              Save relationship candidate
            </button>
            <p className="helper">
              Candidates are excluded from impact analysis until you confirm them below.
            </p>
          </section>
        </div>
        <section className="document-card candidates">
          <h3>Check relationship candidates</h3>
          <p>
            Open the original evidence and check the direction before confirming. Decisions are
            retained.
          </p>
          {!workspace.candidates.some(
            (c) => c.status === 'proposed' || c.status === 'rejected',
          ) && <p>No pending or rejected candidates. Confirmed relationships are listed above.</p>}
          {workspace.candidates
            .filter((c) => c.status === 'proposed' || c.status === 'rejected')
            .map((c) => (
              <div className="candidate-row" key={c.id}>
                <div>
                  <strong>
                    {workspace.items.find((i) => i.id === c.from)?.title} →{' '}
                    {workspace.items.find((i) => i.id === c.to)?.title}
                  </strong>
                  <p>
                    {c.from} depends on {c.to} · <b>{c.status}</b>
                  </p>
                </div>
                <button
                  onClick={() =>
                    void onEvidence(c.evidenceId).catch((e: Error) => setError(e.message))
                  }
                >
                  View original evidence
                </button>
                {c.status === 'proposed' && (
                  <>
                    <button
                      onClick={() =>
                        void run(
                          `/api/candidates/${c.id}`,
                          { expectedRevision: c.revision, status: 'confirmed' },
                          undefined,
                          'PUT',
                        )
                      }
                    >
                      Confirm dependency
                    </button>
                    <button
                      onClick={() =>
                        void run(
                          `/api/candidates/${c.id}`,
                          { expectedRevision: c.revision, status: 'rejected' },
                          undefined,
                          'PUT',
                        )
                      }
                    >
                      Reject candidate
                    </button>
                  </>
                )}
              </div>
            ))}
        </section>
        <section className="document-card proposal-editor">
          <h3>5. Preview a change</h3>
          <p>
            Select evidence for the update in step 2, then open the existing impact and review
            workbench.
          </p>
          <label>
            Item to change
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Choose an item</option>
              {options}
            </select>
          </label>
          {target && <p>Current: {workspace.items.find((i) => i.id === target)?.body}</p>}
          <label>
            Updated description
            <textarea
              rows={3}
              value={after}
              maxLength={10000}
              onChange={(e) => setAfter(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={!target || !after.trim() || !evidence}
            onClick={() =>
              void run<Proposal>(
                '/api/proposals',
                {
                  itemId: target,
                  expectedRevision: workspace.items.find((i) => i.id === target)!.revision,
                  after,
                  evidence,
                },
                onPreview,
              )
            }
          >
            Preview impact
          </button>
        </section>
      </fieldset>
      <p className="helper">
        Local workspace limits: 50 source versions, 100 items, 200 dependencies, 100 change
        proposals. No AI extraction. Markdown is displayed as plain text.
      </p>
    </section>
  );
}
