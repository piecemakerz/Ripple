import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  FileText,
  GitBranch,
  Layers3,
  LoaderCircle,
  Radio,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import type {
  ChangeDetail,
  EvidenceDetail,
  Impact,
  ImpactResult,
  Item,
  ReviewStatus,
  Workspace,
} from '../shared/types.js';
import { api } from './api.js';

const labels: Record<ReviewStatus, string> = {
  pending: 'Needs review',
  keep: 'Keep',
  revise: 'Revise',
  defer: 'Defer',
};
const initials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('');

function EvidenceDialog({
  evidence,
  onClose,
}: {
  evidence: EvidenceDetail | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (evidence) ref.current?.showModal();
    else ref.current?.close();
  }, [evidence]);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="source-dialog"
    >
      {evidence && (
        <>
          <div className="dialog-header">
            <div>
              <span className="eyebrow">ORIGINAL SOURCE · V{evidence.source.version}</span>
              <h2>{evidence.source.title}</h2>
            </div>
            <button className="icon-button" onClick={onClose} aria-label="Close source">
              <X size={20} />
            </button>
          </div>
          <p className="source-caption">
            <ShieldCheck size={15} /> Exact quote from a preserved document version
          </p>
          <div className="source-text">
            {evidence.source.text.slice(0, evidence.start)}
            <mark>{evidence.quote}</mark>
            {evidence.source.text.slice(evidence.end)}
          </div>
          <div className="source-foot">
            {evidence.source.id} · Highlighted characters {evidence.start}–{evidence.end}
          </div>
        </>
      )}
    </dialog>
  );
}

function Graph({
  result,
  selected,
  onSelect,
  onEvidence,
}: {
  result: ImpactResult;
  selected: Impact | undefined;
  onSelect: (id: string) => void;
  onEvidence: (e: EvidenceDetail) => void;
}) {
  const allNodes: Item[] = [result.target, ...result.impacts.map((i) => i.item)];
  const depth = new Map([
    [result.target.id, 0],
    ...result.impacts.map((i) => [i.item.id, i.depth] as [string, number]),
  ]);
  const maxDepth = Math.max(1, ...depth.values());
  const positions = new Map(
    allNodes.map((node) => {
      const level = depth.get(node.id)!;
      const peers = allNodes.filter((n) => depth.get(n.id) === level);
      return [
        node.id,
        {
          x: ((peers.indexOf(node) + 1) * 560) / (peers.length + 1),
          y: 52 + (level * 240) / maxDepth,
        },
      ];
    }),
  );
  const edges = [
    ...new Map(
      result.impacts.flatMap((i) => i.paths.flatMap((p) => p.edges)).map((e) => [e.id, e]),
    ).values(),
  ];
  const active = new Set(selected?.paths[0].nodes.map((n) => n.id));
  return (
    <div
      className="graph"
      aria-label="Dependency graph. Arrows point from dependent to prerequisite."
    >
      <div className="graph-top">
        <span>
          <span className="small-dot" /> Confirmed dependencies
        </span>
        <span>{allNodes.length} connected items</span>
      </div>
      <div className="graph-canvas">
        <svg
          viewBox="0 0 560 350"
          preserveAspectRatio="none"
          role="img"
          aria-label="Dependency arrows point toward A1"
        >
          <defs>
            <marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6" fill="none" stroke="#9baaa0" strokeWidth="1.4" />
            </marker>
            <marker
              id="arrow-active"
              markerWidth="7"
              markerHeight="7"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6" fill="none" stroke="#39705f" strokeWidth="1.4" />
            </marker>
          </defs>
          {edges.map((e) => {
            const from = positions.get(e.from)!,
              to = positions.get(e.to)!;
            const isActive = active.has(e.from) && active.has(e.to);
            return (
              <path
                key={e.id}
                d={`M ${from.x} ${from.y - 29} C ${from.x} ${from.y - 65}, ${to.x} ${to.y + 65}, ${to.x} ${to.y + 33}`}
                fill="none"
                stroke={isActive ? '#39705f' : '#ccd4cc'}
                strokeWidth={isActive ? 2 : 1.5}
                markerEnd={`url(#${isActive ? 'arrow-active' : 'arrow'})`}
              />
            );
          })}
        </svg>
        {allNodes.map((node) => {
          const p = positions.get(node.id)!;
          return (
            <button
              key={node.id}
              style={{ left: `${p.x / 5.6}%`, top: `${p.y / 3.5}%` }}
              className={`graph-node ${node.kind.toLowerCase()} ${node.id === selected?.item.id ? 'selected' : ''} ${active.has(node.id) ? 'on-path' : ''}`}
              onClick={() => {
                if (node.id !== result.target.id) onSelect(node.id);
              }}
              aria-label={`${node.id} ${node.title}`}
              aria-pressed={node.id === selected?.item.id}
              disabled={node.id === result.target.id}
            >
              <span className="node-type">
                {node.id === result.target.id ? (
                  <CircleDot size={12} />
                ) : node.kind === 'Decision' ? (
                  <GitBranch size={12} />
                ) : (
                  <CheckCircle2 size={12} />
                )}
                {node.id} · {node.kind}
              </span>
              <strong>{node.title}</strong>
            </button>
          );
        })}
      </div>
      <div className="graph-bottom">
        <span>
          <i className="legend assumption" /> Assumption
        </span>
        <span>
          <i className="legend decision" /> Decision
        </span>
        <span>
          <i className="legend task" /> Task
        </span>
      </div>
      {selected && (
        <div className="trace">
          <span className="eyebrow">SELECTED DEPENDENCY PATH</span>
          <div className="trace-ids">
            {selected.paths[0].nodes.map((n, i) => (
              <span key={n.id}>
                {i > 0 && <ArrowRight size={14} />}
                <b>{n.id}</b>
              </span>
            ))}
          </div>
          <p>Each item depends on the next. Select a connection to read why.</p>
          {selected.paths.map((p, index) => (
            <div key={index} className="trace-path">
              {selected.paths.length > 1 && <small>Path {index + 1}</small>}
              {p.edges.map((e) => (
                <button
                  key={e.id}
                  className="evidence-link"
                  onClick={() => e.evidence && onEvidence(e.evidence)}
                  disabled={!e.evidence}
                >
                  <FileText size={14} />
                  <span>
                    {e.from} → {e.to}
                  </span>
                  <span>{e.evidence ? 'View evidence' : 'Evidence unavailable'}</span>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function App() {
  const [workspace, setWorkspace] = useState<Workspace>();
  const [result, setResult] = useState<ImpactResult>();
  const [detail, setDetail] = useState<ChangeDetail>();
  const [selection, setSelection] = useState('proposal');
  const [selectedId, setSelectedId] = useState('T1');
  const [evidence, setEvidence] = useState<EvidenceDetail | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [panel, setPanel] = useState('change');
  const [drafts, setDrafts] = useState<
    Record<string, { status: 'keep' | 'revise' | 'defer'; reason: string }>
  >({});
  const requestId = useRef(crypto.randomUUID());

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    api<Workspace>('/api/workspace', { signal: abort.signal })
      .then((data) => {
        setWorkspace(data);
        setSelection(data.changes[0]?.id ?? 'proposal');
        setError('');
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [retry]);
  useEffect(() => {
    if (!workspace) return;
    const abort = new AbortController();
    setLoading(true);
    setError('');
    setResult(undefined);
    setDetail(undefined);
    const load = async () => {
      if (selection === 'proposal') {
        const next = await api<ImpactResult>(`/api/items/${workspace.proposals[0].itemId}/impact`, {
          signal: abort.signal,
        });
        if (abort.signal.aborted) return;
        setResult(next);
        setDetail(undefined);
      } else {
        const next = await api<ChangeDetail>(`/api/changes/${selection}`, { signal: abort.signal });
        if (abort.signal.aborted) return;
        setDetail(next);
        setResult(next.change.snapshot);
      }
    };
    void load()
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [selection, workspace]);

  const selected = result?.impacts.find((i) => i.item.id === selectedId) ?? result?.impacts[0];
  const review = detail?.reviews.find((r) => r.itemId === selected?.item.id);
  const draftKey = `${detail?.change.id ?? 'preview'}:${selected?.item.id}`;
  const draft = drafts[draftKey] ?? {
    status: review?.status === 'pending' || !review ? 'revise' : review.status,
    reason: review?.reason ?? '',
  };
  const proposal = workspace?.proposals[0];
  const current = workspace?.items.find((i) => i.id === proposal?.itemId);
  const applied = !!detail;
  const reviewed = detail?.reviews.filter((r) => r.status !== 'pending').length ?? 0;
  const setDraft = (value: Partial<typeof draft>) =>
    setDrafts((d) => ({ ...d, [draftKey]: { ...draft, ...value } }));
  async function openEvidence(id: string) {
    try {
      setEvidence(await api<EvidenceDetail>(`/api/evidence/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function apply() {
    if (!proposal || !result) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await api<ChangeDetail>('/api/changes', {
        method: 'POST',
        body: JSON.stringify({
          requestId: requestId.current,
          itemId: proposal.itemId,
          expectedRevision: result.target.revision,
          after: proposal.after,
          evidenceId: proposal.evidenceId,
        }),
      });
      setDetail(saved);
      setResult(saved.change.snapshot);
      const latest = await api<Workspace>('/api/workspace');
      setWorkspace(latest);
      setSelection(saved.change.id);
      requestId.current = crypto.randomUUID();
      setNotice('Change applied. The original paths are preserved for review.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveReview() {
    if (!detail || !selected) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await api<ChangeDetail>(
        `/api/changes/${detail.change.id}/reviews/${selected.item.id}`,
        { method: 'PUT', body: JSON.stringify(draft) },
      );
      setDetail(saved);
      setNotice(`Review saved for ${selected.item.id}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="rail">
        <a className="brand-mark" href="/" aria-label="Ripple home">
          <Radio size={28} strokeWidth={1.5} />
        </a>
        <div className="rail-divider" />
        <span className="rail-active" title="Change workspace">
          <GitBranch size={21} />
        </span>
        <span className="rail-bottom">R</span>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <a href="/" className="brand">
            ripple<span className="brand-dot">.</span>
          </a>
          <span className="topbar-divider" />
          <span className="workspace-name">Inventory workspace</span>
          <span className="demo-label">SYNTHETIC DEMO</span>
          <span className="local-status">
            <span className="small-dot" />
            Local workspace
          </span>
          <span className="avatar">AM</span>
        </header>
        <main>
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} /> Change review
          </div>
          <div className="page-heading">
            <div>
              <span className="eyebrow">CONTEXT, CONNECTED.</span>
              <h1>One change. See the ripple.</h1>
              <p>Follow a changed assumption to the decisions and work that need another look.</p>
            </div>
            <span className="workspace-tag">
              <Layers3 size={16} /> Inventory experience
            </span>
          </div>
          <div className="workflow">
            <span className="step done">
              <b>1</b> Understand the change
            </span>
            <ChevronRight size={16} />
            <span className={`step ${applied ? 'done' : 'active'}`}>
              <b>2</b> Trace the impact
            </span>
            <ChevronRight size={16} />
            <span className={`step ${applied ? 'active' : ''}`}>
              <b>3</b> Make a decision
            </span>
          </div>
          {error && (
            <div role="alert" className="banner error">
              <span>{error}</span>
              <button onClick={() => setRetry((r) => r + 1)} disabled={busy}>
                <RotateCcw size={14} /> Reload
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="banner success">
              <Check size={16} />
              {notice}
              <button aria-label="Dismiss message" onClick={() => setNotice('')}>
                <X size={16} />
              </button>
            </div>
          )}
          <div className="mobile-tabs" aria-label="Workspace panels">
            {['change', 'path', 'review'].map((p) => (
              <button key={p} className={panel === p ? 'active' : ''} onClick={() => setPanel(p)}>
                {p === 'change' ? '01 Change' : p === 'path' ? '02 Impact path' : '03 Review'}
              </button>
            ))}
          </div>
          {!workspace || !result ? (
            <div className="empty-state">
              {loading ? (
                <>
                  <LoaderCircle className="spin" />
                  Opening your workspace…
                </>
              ) : (
                <>
                  <FileText />
                  Unable to open the workspace. Use Reload to try again.
                </>
              )}
            </div>
          ) : (
            <div className={`workbench ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
              <section
                className={`panel change-panel ${panel === 'change' ? 'mobile-visible' : ''}`}
              >
                <div className="panel-title">
                  <span className="panel-number">01</span>
                  <h2>The change</h2>
                  <span className={`pill ${applied ? 'green' : 'amber'}`}>
                    {applied ? 'Applied' : 'Preview'}
                  </span>
                </div>
                <div className="panel-body">
                  <label className="field-label" htmlFor="change-select">
                    CHANGE TO EXPLORE
                  </label>
                  <select
                    id="change-select"
                    value={selection}
                    disabled={busy || loading}
                    onChange={(e) => {
                      setSelection(e.target.value);
                      setNotice('');
                    }}
                  >
                    <option value="proposal">Supplier inventory refresh</option>
                    {workspace.changes.map((c, i) => (
                      <option key={c.id} value={c.id}>
                        Applied change · revision {c.afterRevision}
                        {i === 0 ? ' · latest' : ''}
                      </option>
                    ))}
                  </select>
                  <div className="assumption-label">
                    <CircleDot size={15} />
                    <span>A1 · Assumption</span>
                    <span>v{result.target.revision}</span>
                  </div>
                  <h3>Real-time inventory updates</h3>
                  <div className="diff-card before">
                    <span className="diff-label">BEFORE</span>
                    <p>{detail?.change.before ?? result.target.body}</p>
                  </div>
                  <div className="change-arrow">
                    <ArrowDown size={17} />
                  </div>
                  <div className="diff-card after">
                    <span className="diff-label">
                      {applied ? 'CONFIRMED UPDATE' : 'PROPOSED UPDATE'}
                    </span>
                    <p>{detail?.change.after ?? proposal?.after}</p>
                    <span className="change-chip">Real-time → Daily snapshot</span>
                  </div>
                  <button
                    className="source-card"
                    onClick={() =>
                      void openEvidence(detail?.change.evidenceId ?? proposal!.evidenceId)
                    }
                  >
                    <span className="file-icon">
                      <FileText size={19} />
                    </span>
                    <span>
                      <strong>Supplier API specification</strong>
                      <small>Version 2.0 · Original source</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                  <div className="context-note">
                    <ShieldCheck size={16} />
                    <p>
                      Only confirmed dependencies are followed. Every connection links back to its
                      source.
                    </p>
                  </div>
                  {applied ? (
                    <div className="applied-stamp">
                      <CheckCircle2 size={17} />
                      Change saved · revision {detail.change.afterRevision}
                    </div>
                  ) : (
                    <button
                      className="primary apply-button"
                      onClick={() => void apply()}
                      disabled={
                        busy ||
                        loading ||
                        current?.body === proposal?.after ||
                        !!result.warnings.length
                      }
                    >
                      {busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
                      {current?.body === proposal?.after
                        ? 'Update already applied'
                        : 'Apply change & start review'}
                    </button>
                  )}
                  <p className="helper">
                    {applied
                      ? 'Original evidence and dependency paths are preserved.'
                      : 'Applying creates a review for each affected item.'}
                  </p>
                </div>
              </section>
              <section className={`panel path-panel ${panel === 'path' ? 'mobile-visible' : ''}`}>
                <div className="panel-title">
                  <span className="panel-number">02</span>
                  <h2>Follow the impact</h2>
                  <span className="pill neutral">{applied ? 'Saved paths' : 'Live preview'}</span>
                </div>
                <div className="impact-summary">
                  <div>
                    <strong>{result.impacts.length}</strong>
                    <span>items to revisit</span>
                  </div>
                  <span className="summary-separator" />
                  <p>
                    <b>{result.impacts.filter((i) => i.depth === 1).length}</b> direct{' '}
                    <span>·</span> <b>{result.impacts.filter((i) => i.depth > 1).length}</b>{' '}
                    indirect
                  </p>
                  <GitBranch size={25} />
                </div>
                {result.warnings.map((w) => (
                  <div className="inline-warning" key={w}>
                    {w}
                  </div>
                ))}
                {result.impacts.length ? (
                  <Graph
                    result={result}
                    selected={selected}
                    onSelect={setSelectedId}
                    onEvidence={setEvidence}
                  />
                ) : (
                  <div className="empty-state">
                    <ShieldCheck />
                    No confirmed dependencies lead to this item.
                  </div>
                )}
                <div className="unaffected">
                  <ShieldCheck size={17} />
                  <div>
                    <strong>
                      {result.limited ? 'Outside these results' : 'Outside this ripple'}
                    </strong>
                    <p>
                      {result.excluded.map((i) => `${i.id} · ${i.title}`).join(', ') ||
                        'All other items are connected.'}
                    </p>
                    <small>
                      {result.limited
                        ? 'No conclusion about excluded items until traversal is complete.'
                        : 'No confirmed dependency path to the changed assumption.'}
                    </small>
                  </div>
                </div>
              </section>
              <section
                className={`panel review-panel ${panel === 'review' ? 'mobile-visible' : ''}`}
              >
                <div className="panel-title">
                  <span className="panel-number">03</span>
                  <h2>Review the work</h2>
                  <span className="count-pill">
                    {reviewed}/{result.impacts.length}
                  </span>
                </div>
                <div className="impact-list" aria-label="Affected items">
                  {result.impacts.map((i) => {
                    const r = detail?.reviews.find((r) => r.itemId === i.item.id);
                    return (
                      <button
                        key={i.item.id}
                        className={`impact-row ${i.item.id === selected?.item.id ? 'selected' : ''}`}
                        onClick={() => setSelectedId(i.item.id)}
                        aria-pressed={i.item.id === selected?.item.id}
                      >
                        <span className={`item-symbol ${i.item.kind.toLowerCase()}`}>
                          {i.item.kind === 'Decision' ? (
                            <GitBranch size={15} />
                          ) : (
                            <CheckCircle2 size={15} />
                          )}
                        </span>
                        <span>
                          <small>
                            {i.item.id} · {i.depth === 1 ? 'Direct' : 'Indirect'} impact
                          </small>
                          <strong>{i.item.title}</strong>
                        </span>
                        {r && r.status !== 'pending' ? (
                          <CheckCircle2 size={16} className="reviewed-icon" />
                        ) : (
                          <ChevronRight size={15} />
                        )}
                      </button>
                    );
                  })}
                </div>
                {selected && (
                  <div className="review-detail">
                    <div className="detail-kicker">
                      <span className="eyebrow">
                        {selected.item.id} · {selected.item.kind.toUpperCase()}
                      </span>
                      <span
                        className={`pill ${review?.status && review.status !== 'pending' ? 'green' : 'amber'}`}
                      >
                        {labels[review?.status ?? 'pending']}
                      </span>
                    </div>
                    <h3>{selected.item.title}</h3>
                    <p className="item-body">{selected.item.body}</p>
                    <div className="owner">
                      <span className="avatar small">{initials(selected.item.owner)}</span>
                      {selected.item.owner}
                      <span>Owner</span>
                    </div>
                    <div className="review-divider" />
                    <label className="field-label">YOUR DECISION</label>
                    <div className="review-options">
                      {(['keep', 'revise', 'defer'] as const).map((s) => (
                        <button
                          key={s}
                          className={draft.status === s ? 'selected' : ''}
                          disabled={!applied || busy || loading}
                          onClick={() => setDraft({ status: s })}
                          aria-pressed={draft.status === s}
                        >
                          {labels[s]}
                        </button>
                      ))}
                    </div>
                    <p className="decision-help">
                      {draft.status === 'keep'
                        ? 'Keep this item as it is for this change.'
                        : draft.status === 'revise'
                          ? 'Record a plan to adapt this item. Implementation remains open.'
                          : 'Defer the decision until more context is available.'}
                    </p>
                    <label htmlFor="review-reason" className="field-label">
                      REASON
                    </label>
                    <textarea
                      id="review-reason"
                      value={draft.reason}
                      disabled={!applied || busy || loading}
                      maxLength={4000}
                      onChange={(e) => setDraft({ reason: e.target.value })}
                      placeholder={
                        applied
                          ? 'What should happen, and why?'
                          : 'Apply the change to start reviewing…'
                      }
                      rows={3}
                    />
                    <button
                      className="primary save-button"
                      disabled={!applied || busy || loading || !draft.reason.trim()}
                      onClick={() => void saveReview()}
                    >
                      {busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}Save
                      review
                    </button>
                    {!applied && (
                      <p className="helper">Start with “Apply change” in the first panel.</p>
                    )}
                    {!!review?.history.length && (
                      <details className="review-history">
                        <summary>Review history · {review.history.length}</summary>
                        {review.history.map((h) => (
                          <div key={h.id}>
                            <b>{labels[h.status]}</b>
                            <time>{new Date(h.createdAt).toLocaleString()}</time>
                            <p>{h.reason}</p>
                          </div>
                        ))}
                      </details>
                    )}
                  </div>
                )}
                {applied && reviewed === result.impacts.length && (
                  <div className="review-complete">
                    <CheckCircle2 size={18} />
                    All review decisions are recorded.
                  </div>
                )}
              </section>
            </div>
          )}
          <footer>
            <span>
              <ShieldCheck size={14} /> Your context stays in this local workspace.
            </span>
            <span>Synthetic sample · No AI extraction</span>
            <details className="developer-details">
              <summary>Developer details</summary>
              <div>
                <b>
                  {workspace?.database.engine} {workspace?.database.version}
                </b>
                <p>{workspace?.database.storage}</p>
                <code>{workspace?.database.path}</code>
                <p>
                  Traversal: up to {result?.maxDepth ?? 8} links / {result?.maxPaths ?? 500} paths.
                  A warning blocks application if results may be incomplete.
                </p>
              </div>
            </details>
          </footer>
        </main>
      </div>
      <EvidenceDialog evidence={evidence} onClose={() => setEvidence(null)} />
    </div>
  );
}
