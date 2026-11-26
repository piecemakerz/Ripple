import { SampleSource } from './SampleContent.js';
import { sourceTitle, itemTitle } from './sample-content.js';
import { LanguageSelector, useI18n } from './i18n.js';
import { useEffect, useRef, useState } from 'react';
import { Check, FileText, LoaderCircle, RotateCcw, ShieldCheck, X } from 'lucide-react';
import type {
  ChangeDetail,
  Item,
  EvidenceDetail,
  ImpactResult,
  HistoryPage,
  ReviewStatus,
  Workspace,
  SourceVersion,
} from '../shared/types.js';
import { api, ApiError } from './api.js';
import { Documents } from './Documents.js';
import { History } from './History.js';
import { ChangePicker } from './ChangePicker.js';
import { ReviewStudio, type StudioStage } from './ReviewStudio.js';
import { decisionLabels, nextPending } from './review-workflow.js';
import {
  reviewDraftState,
  updateReviewDraft,
  selectionAfterApply,
  type ReviewDraft,
} from './review-presentation.js';
import { WorkflowGuide } from './WorkflowGuide.js';
import { SampleWalkthrough } from './SampleWalkthrough.js';
import { useSampleGuide } from './sample-guide-context.js';
import { canApplyPreview } from './first-look.js';
import type { DocumentPanel, FlowDestination } from './workflow-overview.js';
import { entryUrl, resolveEntry } from '../shared/entry-link.js';
import { SourceFreshness } from './SourceFreshness.js';
function EvidenceDialog({
  evidence,
  onClose,
  sources,
}: {
  evidence: EvidenceDetail | null;
  onClose: () => void;
  sources: SourceVersion[];
}) {
  const { t, language } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const next = useSampleGuide()?.evidenceNext;
  const sampleSource = next && next.id === evidence?.id ? next : undefined;
  useEffect(() => {
    if (evidence) ref.current?.showModal();
    else ref.current?.close();
  }, [evidence]);
  function dismiss() {
    // Restore the invoker before React removes the focused dialog contents.
    ref.current?.close();
    onClose();
  }
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
      className="source-dialog"
      aria-labelledby="source-title"
    >
      {evidence && (
        <>
          <div className="dialog-header">
            <div>
              <span className="eyebrow">
                {t('Original source, version {0}', [evidence.source.version])}
              </span>
              <h2 id="source-title">{sourceTitle(evidence.source, language)}</h2>
              {sourceTitle(evidence.source, language) !== evidence.source.title && (
                <small lang="en">{evidence.source.title}</small>
              )}
            </div>
            <button className="icon-button" onClick={dismiss} aria-label={t('Close source')}>
              <X size={20} />
            </button>
          </div>
          <p className="source-caption">
            <ShieldCheck size={15} />
            {t('Exact quote from a preserved document version')}
          </p>
          <SampleSource source={evidence.source} evidence={evidence} />
          <SourceFreshness
            source={evidence.source}
            newer={evidence.newerSource}
            sources={sources}
          />
          <div className="source-foot">
            {t('{0} · Highlighted characters {1}–{2}', [
              evidence.source.id,
              evidence.start,
              evidence.end,
            ])}
          </div>
          {sampleSource && (
            <div className="sample-dialog-next">
              <p>{t(sampleSource.hint)}</p>
              <button disabled={sampleSource.disabled} onClick={sampleSource.run}>
                {t(sampleSource.label)}
              </button>
            </div>
          )}
        </>
      )}
    </dialog>
  );
}

export function App() {
  const { t, language } = useI18n();
  const [workspace, setWorkspace] = useState<Workspace>();
  const [result, setResult] = useState<ImpactResult>();
  const [detail, setDetail] = useState<ChangeDetail>();
  const [selection, setSelection] = useState('proposal:supplier-daily');
  const [selectedId, setSelectedId] = useState('T1');
  const [evidence, setEvidence] = useState<EvidenceDetail | null>(null);
  const evidenceInvoker = useRef<HTMLElement | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string | { item: Item; status: ReviewStatus }>('');
  const [entryNotice, setEntryNotice] = useState('');
  const [reviewFailure, setReviewFailure] = useState<{ key: string; message: string }>();
  const [reviewConflict, setReviewConflict] = useState<{ key: string; latest?: ChangeDetail }>();
  const reviewRequests = useRef<Record<string, { fingerprint: string; requestId: string }>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [view, setView] = useState('review');
  const [documentPanel, setDocumentPanel] = useState<DocumentPanel>('sources');
  const [historyRequest, setHistoryRequest] = useState({ itemId: '', key: 0 });
  const [historyPage, setHistoryPage] = useState<HistoryPage>();
  const [stage, setStage] = useState<StudioStage>('explore');
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [documentDirty, setDocumentDirty] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const initialized = useRef(false);
  function showView(next: string) {
    setView(next);
    requestAnimationFrame(() => {
      const main = document.getElementById('main-content');
      main?.focus({ preventScroll: true });
      main?.scrollIntoView({ block: 'start' });
    });
  }

  function openWorkflow(destination: FlowDestination) {
    if (
      destination === 'sources' ||
      destination === 'relationships' ||
      destination === 'new-change'
    ) {
      setDocumentPanel(destination === 'new-change' ? 'preview' : destination);
      showView('documents');
    } else if (destination === 'history') {
      showView('history');
    } else {
      if (destination !== 'explore' && (!detail || loading)) return;
      setStage(destination);
      showView('review');
    }
  }

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    api<Workspace>('/api/workspace', { signal: abort.signal })
      .then((data) => {
        if (abort.signal.aborted) return;
        setWorkspace(data);
        if (!initialized.current) {
          const entry = resolveEntry(data, window.location.search);
          setSelection(entry.selection);
          setSelectedId(entry.itemId);
          setEntryNotice(entry.warning);
          if (!entry.selection.startsWith('proposal:')) setStage('review');
          initialized.current = true;
        }
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
      if (selection.startsWith('proposal:')) {
        const chosen = workspace.proposals.find((p) => p.id === selection.slice(9));
        if (!chosen) throw new Error('Proposal not found. Reload the workspace.');
        const next = await api<ImpactResult>(`/api/items/${chosen.itemId}/impact`, {
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

  function navigateSample(step: number, changeId?: string) {
    if (!result && !loading) setRetry((r) => r + 1);
    const nextSelection = changeId ?? 'proposal:supplier-daily';
    if (selection !== nextSelection) {
      setSelection(nextSelection);
      requestId.current = crypto.randomUUID();
    }
    setNotice('');
    if (step < 2) {
      setDocumentPanel(step === 0 ? 'sources' : 'relationships');
      showView('documents');
    } else if (step === 6) {
      setHistoryPage(undefined);
      setHistoryRequest((r) => ({ itemId: 'A1', key: r.key + 1 }));
      showView('history');
    } else {
      setStage(
        step === 5 ? 'brief' : step === 4 || (step === 2 && changeId) ? 'review' : 'explore',
      );
      if (step === 2) setSelectedId('T1');
      if (step === 4)
        setSelectedId(
          detail && detail.change.id === changeId
            ? (nextPending(detail.change.snapshot.impacts, detail.reviews)?.item.id ?? 'D1')
            : 'D1',
        );
      showView('review');
    }
  }

  const selected = result?.impacts.find((i) => i.item.id === selectedId) ?? result?.impacts[0];
  useEffect(() => {
    if (loading || !result) return;
    const loaded = selection.startsWith('proposal:')
      ? workspace?.proposals.find((p) => `proposal:${p.id}` === selection)?.itemId ===
        result.target.id
      : detail?.change.id === selection;
    if (!loaded) return;
    // Replace, rather than push: UI navigation does not create a browser-history stack.
    // Only successful reads update the link, so a failed load remains retryable.
    const url = entryUrl(window.location.href, selection, selected?.item.id);
    try {
      window.history.replaceState(window.history.state, '', url);
    } catch {
      // Restricted browser history must not prevent local review work.
    }
  }, [loading, result, workspace, detail, selection, selected?.item.id]);
  const review = detail?.reviews.find((r) => r.itemId === selected?.item.id);
  const draftKey = `${detail?.change.id ?? 'preview'}:${selected?.item.id}`;
  const draft: ReviewDraft = drafts[draftKey] ?? {
    status: review?.status === 'pending' || !review ? '' : review.status,
    reason: review?.reason ?? '',
    expectedRevision: review?.revision ?? 0,
  };
  const proposal = workspace?.proposals.find((p) => p.id === selection.slice(9));
  const current = workspace?.items.find((i) => i.id === proposal?.itemId);
  const setDraft = (value: Partial<typeof draft>) =>
    setDrafts((entries) => updateReviewDraft(entries, draftKey, draft, review, value));
  const hasDrafts = documentDirty || Object.keys(drafts).length > 0;
  useEffect(() => {
    if (!hasDrafts) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasDrafts]);
  function presentEvidence(
    value: EvidenceDetail,
    invoker: Element | null = document.activeElement,
  ) {
    evidenceInvoker.current = invoker instanceof HTMLElement ? invoker : null;
    setEvidence(value);
  }
  function closeEvidence() {
    const invoker = evidenceInvoker.current;
    setEvidence(null);
    if (invoker?.isConnected && !invoker.closest('[hidden]') && !invoker.matches(':disabled'))
      invoker.focus();
    else document.getElementById('main-content')?.focus();
  }
  async function openEvidence(id: string) {
    const invoker = document.activeElement;
    try {
      presentEvidence(await api<EvidenceDetail>(`/api/evidence/${id}`), invoker);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function apply(preferredId = selected?.item.id) {
    if (!proposal || !result || busy || loading || !canApplyPreview(workspace, result, selection))
      return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await api<ChangeDetail>('/api/changes', {
        method: 'POST',
        body: JSON.stringify({
          requestId: requestId.current,
          itemId: proposal.itemId,
          expectedRevision: proposal.expectedRevision ?? result.target.revision,
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
      setSelectedId(selectionAfterApply(saved.change.snapshot.impacts, preferredId));
      setStage(saved.change.snapshot.impacts.length ? 'review' : 'brief');
      setNotice(
        'Change applied. Original paths preserved. Choose a decision for the selected item.',
      );
      return saved;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveReview() {
    if (
      !detail ||
      !selected ||
      busy ||
      loading ||
      !draft.status ||
      reviewConflict?.key === draftKey ||
      !reviewDraftState(draft, review).canSave
    )
      return;
    setBusy(true);
    setError('');
    setNotice('');
    setReviewFailure(undefined);
    try {
      const payload = {
        status: draft.status,
        reason: draft.reason.trim(),
        expectedRevision: draft.expectedRevision ?? review?.revision ?? 0,
      };
      const fingerprint = JSON.stringify(payload);
      if (reviewRequests.current[draftKey]?.fingerprint !== fingerprint)
        reviewRequests.current[draftKey] = { fingerprint, requestId: crypto.randomUUID() };
      const saved = await api<ChangeDetail>(
        `/api/changes/${detail.change.id}/reviews/${selected.item.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            ...payload,
            requestId: reviewRequests.current[draftKey].requestId,
          }),
        },
      );
      setDetail(saved);
      setDrafts((entries) => {
        const next = { ...entries };
        delete next[draftKey];
        return next;
      });
      setNotice({
        item: selected.item,
        status:
          saved.reviews.find((entry) => entry.itemId === selected.item.id)?.status ?? draft.status,
      });
      return saved;
    } catch (e) {
      setReviewFailure({ key: draftKey, message: (e as Error).message });
      if (e instanceof ApiError && e.code === 'REVIEW_CONFLICT') {
        setReviewConflict({ key: draftKey });
        try {
          const latest = await api<ChangeDetail>(`/api/changes/${detail.change.id}`);
          setReviewConflict({ key: draftKey, latest });
        } catch {
          // The draft stays blocked until the latest decision can be read and compared.
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function reloadReviewConflict() {
    if (!detail || busy) return;
    setBusy(true);
    try {
      const latest = await api<ChangeDetail>(`/api/changes/${detail.change.id}`);
      setReviewConflict({ key: draftKey, latest });
    } catch (e) {
      setReviewFailure({ key: draftKey, message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  function resolveReviewConflict(keepDraft: boolean) {
    const latest = reviewConflict?.latest;
    const latestReview = latest?.reviews.find((entry) => entry.itemId === selected?.item.id);
    if (!latest || !latestReview || reviewConflict?.key !== draftKey) return;
    setDetail(latest);
    setDrafts((entries) => {
      const next = { ...entries };
      if (keepDraft) next[draftKey] = { ...draft, expectedRevision: latestReview.revision };
      else delete next[draftKey];
      return next;
    });
    delete reviewRequests.current[draftKey];
    setReviewConflict(undefined);
    setReviewFailure(undefined);
  }

  return (
    <div className={`app-shell ${view === 'review' ? 'studio-shell' : ''}`}>
      <a className="skip-link" href="#main-content">
        {t('Skip to workspace')}
      </a>
      <div className="main-shell">
        <header className="topbar">
          <a href="/" className="brand">
            <span className="brand-symbol" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            ripple<span className="brand-dot">/</span>
          </a>
          <span className="topbar-divider" />
          <nav className="view-tabs" aria-label={t('Workspace views')}>
            <button
              disabled={busy}
              aria-pressed={view === 'review'}
              onClick={() => showView('review')}
            >
              {t('Change review')}
            </button>
            <button
              disabled={busy}
              aria-pressed={view === 'documents'}
              onClick={() => showView('documents')}
            >
              {t('Documents & relationships')}
            </button>
            <button
              disabled={busy}
              aria-pressed={view === 'history'}
              onClick={() => showView('history')}
            >
              {t('History')}
            </button>
          </nav>
          <LanguageSelector />
          <span className="local-status">
            <span className="small-dot" />
            {t('Local workspace')}
          </span>
        </header>
        <main id="main-content" tabIndex={-1}>
          <SampleWalkthrough
            workspace={workspace}
            detail={detail}
            result={result}
            loading={loading}
            busy={busy}
            evidence={evidence}
            selectedId={selected?.item.id ?? ''}
            selection={selection}
            view={view}
            panel={documentPanel}
            stage={stage}
            history={historyPage}
            onNavigate={navigateSample}
            onLocate={(step) => {
              if (step === 2) setSelectedId('T1');
            }}
            onEvidence={presentEvidence}
            onCloseEvidence={() => setEvidence(null)}
            onApply={apply}
            onSelectItem={setSelectedId}
            applyDisabled={!canApplyPreview(workspace, result, selection)}
            applyError={error}
            onOwnContext={() => {
              setDocumentPanel('sources');
              showView('documents');
              requestAnimationFrame(() => {
                const editor = document.getElementById('document-start');
                editor?.focus({ preventScroll: true });
                editor?.scrollIntoView({ block: 'start' });
              });
            }}
          >
            {workspace && (
              <div
                className="sample-general-guide"
                hidden={view === 'documents' || (view === 'review' && stage === 'review')}
              >
                <WorkflowGuide
                  workspace={workspace}
                  result={result}
                  detail={detail}
                  loading={loading}
                  busy={busy}
                  creatingPreview={view === 'documents' && documentPanel === 'preview'}
                  current={
                    view === 'history'
                      ? 'history'
                      : view === 'documents'
                        ? documentPanel === 'preview'
                          ? 'explore'
                          : documentPanel === 'items'
                            ? 'sources'
                            : documentPanel
                        : stage
                  }
                  onNavigate={openWorkflow}
                />
              </div>
            )}
            {workspace && (
              <div hidden={view !== 'history'}>
                <History
                  key={historyRequest.key}
                  items={workspace.items}
                  active={view === 'history'}
                  initialItem={historyRequest.itemId}
                  onPage={setHistoryPage}
                  refreshToken={detail}
                  onEvidence={presentEvidence}
                  onOpenChange={(changeId, itemId) => {
                    setSelection(changeId);
                    setSelectedId(itemId ?? '');
                    setStage(itemId ? 'review' : 'explore');
                    showView('review');
                    setNotice('');
                  }}
                />
              </div>
            )}
            {workspace && (
              <div hidden={view !== 'documents'}>
                <Documents
                  onDirtyChange={setDocumentDirty}
                  workspace={workspace}
                  panel={documentPanel}
                  onPanel={setDocumentPanel}
                  onWorkspace={setWorkspace}
                  onEvidence={async (id) => {
                    const invoker = document.activeElement;
                    presentEvidence(await api<EvidenceDetail>(`/api/evidence/${id}`), invoker);
                  }}
                  onPreview={(p) => {
                    setSelection(`proposal:${p.id}`);
                    requestId.current = crypto.randomUUID();
                    setStage('explore');
                    showView('review');
                  }}
                />
              </div>
            )}
            <div hidden={view !== 'review'}>
              {entryNotice && (
                <p role="status" className="inline-warning">
                  {t(entryNotice)}
                </p>
              )}
              {error && (
                <div role="alert" className="banner error">
                  <span>{t(error)}</span>
                  <button onClick={() => setRetry((r) => r + 1)} disabled={busy}>
                    <RotateCcw size={14} aria-hidden="true" />
                    {t('Reload')}
                  </button>
                </div>
              )}
              {notice && (
                <div role="status" className="banner success">
                  <Check size={16} aria-hidden="true" />
                  {typeof notice === 'string'
                    ? t(notice)
                    : t('{0} decision saved for “{1}”.', [
                        t(decisionLabels[notice.status]),
                        itemTitle(notice.item, language),
                      ])}
                  <button aria-label={t('Dismiss message')} onClick={() => setNotice('')}>
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
              {!workspace || !result ? (
                <div className="empty-state">
                  {loading || (!result && !error) ? (
                    <>
                      <LoaderCircle className="spin" aria-hidden="true" />
                      {t('Opening your workspace…')}
                    </>
                  ) : (
                    <>
                      <FileText aria-hidden="true" />
                      {t('Unable to open the workspace. Use Reload to try again.')}
                    </>
                  )}
                </div>
              ) : (
                <ReviewStudio
                  key={selection}
                  result={result}
                  detail={detail}
                  proposal={proposal}
                  selected={selected}
                  draft={draft}
                  busy={busy}
                  loading={loading}
                  stage={stage}
                  onStage={setStage}
                  onSelect={setSelectedId}
                  onDraft={setDraft}
                  onApply={() => void apply()}
                  onSave={saveReview}
                  onEvidence={presentEvidence}
                  onChangeEvidence={() => {
                    const id = detail?.change.evidenceId ?? proposal?.evidenceId;
                    if (id) void openEvidence(id);
                  }}
                  onRelationships={() => {
                    setDocumentPanel('relationships');
                    showView('documents');
                    requestAnimationFrame(() => {
                      const section = document.getElementById('document-relationship');
                      section?.focus({ preventScroll: true });
                      section?.scrollIntoView({ block: 'start' });
                    });
                  }}
                  onHistory={(id) => {
                    setHistoryRequest((r) => ({ itemId: id, key: r.key + 1 }));
                    showView('history');
                  }}
                  failure={reviewFailure?.key === draftKey ? reviewFailure.message : undefined}
                  sources={workspace?.sources ?? []}
                  conflict={
                    reviewConflict?.key === draftKey
                      ? {
                          latest: reviewConflict.latest?.reviews.find(
                            (entry) => entry.itemId === selected?.item.id,
                          ),
                        }
                      : undefined
                  }
                  onReloadConflict={reloadReviewConflict}
                  onResolveConflict={resolveReviewConflict}
                  unsaved={
                    result.impacts.filter(
                      (impact) => !!drafts[`${detail?.change.id}:${impact.item.id}`],
                    ).length
                  }
                  applyDisabled={!canApplyPreview(workspace, result, selection)}
                  applyLabel={
                    current?.body === proposal?.after
                      ? 'Update already applied'
                      : proposal?.expectedRevision !== undefined &&
                          proposal.expectedRevision !== current?.revision
                        ? 'Outdated proposal'
                        : busy
                          ? 'Applying change…'
                          : 'Apply & start review'
                  }
                  changePicker={
                    <ChangePicker
                      key={workspace.changePage.entries[0]?.id ?? 'empty'}
                      initialPage={workspace.changePage}
                      proposals={workspace.proposals}
                      items={workspace.items}
                      selection={selection}
                      selectedChange={detail?.change}
                      disabled={busy || loading}
                      onSelect={(value) => {
                        setSelection(value);
                        requestId.current = crypto.randomUUID();
                        setNotice('');
                        setStage('explore');
                      }}
                    />
                  }
                />
              )}
            </div>
            <footer>
              <span>
                <ShieldCheck size={14} />
                {t('Your context stays in this local workspace.')}
              </span>
              <span>
                {t('{0} · No AI extraction', [
                  workspace?.synthetic ? t('Synthetic sample') : t('Sample + imported context'),
                ])}
              </span>
              <details className="developer-details">
                <summary>{t('Developer details')}</summary>
                <div>
                  <b>
                    {workspace?.database.engine} {workspace?.database.version}
                  </b>
                  <p>{workspace?.database.storage}</p>
                  <code>{workspace?.database.path}</code>
                  <p>
                    {t(
                      'Traversal: up to {0} links / {1} paths. A warning blocks application if results may be incomplete.',
                      [result?.maxDepth ?? 8, result?.maxPaths ?? 500],
                    )}
                  </p>
                </div>
              </details>
            </footer>
            <EvidenceDialog
              evidence={evidence}
              sources={workspace?.sources ?? []}
              onClose={closeEvidence}
            />
          </SampleWalkthrough>
        </main>
      </div>
    </div>
  );
}
