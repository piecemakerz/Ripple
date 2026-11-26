import { message, type Message } from './i18n-core.js';
import { useI18n } from './i18n.js';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ArrowRight, CheckCircle2, GraduationCap, Pause, Play, RotateCcw } from 'lucide-react';
import type {
  ChangeDetail,
  EvidenceDetail,
  HistoryPage,
  ImpactResult,
  Workspace,
} from '../shared/types.js';
import { api } from './api.js';
import { FirstLook } from './FirstLook.js';
import { canShowFirstLook } from './first-look.js';
import { SampleGuideContext } from './sample-guide-context.js';
import {
  findSampleChange,
  isSampleChange,
  newTour,
  readTour,
  sampleProposal,
  tourCompletion,
  tourSteps,
  tourStorageKey,
  writeTour,
  type TourRead,
} from './sample-walkthrough.js';

function focusTarget(id: string) {
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'start' });
  });
}
type WalkthroughProps = {
  workspace: Workspace;
  detail: ChangeDetail | undefined;
  result: ImpactResult | undefined;
  loading: boolean;
  busy: boolean;
  evidence: EvidenceDetail | null;
  selectedId: string;
  onSelectItem: (id: string) => void;
  selection: string;
  view: string;
  panel: string;
  stage: string;
  history: HistoryPage | undefined;
  onNavigate: (step: number, changeId?: string) => void;
  onLocate: (step: number) => void;
  onEvidence: (evidence: EvidenceDetail, invoker?: Element | null) => void;
  onCloseEvidence: () => void;
  onOwnContext: () => void;
  onApply: (selectedId?: string) => Promise<ChangeDetail | undefined>;
  applyDisabled: boolean;
  applyError: string;
  children: ReactNode;
};
export function SampleWalkthrough(
  props: Omit<WalkthroughProps, 'workspace'> & { workspace: Workspace | undefined },
) {
  return props.workspace ? (
    <Walkthrough key={tourStorageKey(props.workspace)} {...props} workspace={props.workspace} />
  ) : (
    <>{props.children}</>
  );
}
function Walkthrough({
  workspace,
  detail,
  result,
  loading,
  busy,
  evidence,
  selectedId,
  onSelectItem,
  selection,
  view,
  panel,
  stage,
  history,
  onNavigate,
  onLocate,
  onEvidence,
  onCloseEvidence,
  onOwnContext,
  onApply,
  applyDisabled,
  applyError,
  children,
}: WalkthroughProps) {
  const { t, language } = useI18n();
  const key = tourStorageKey(workspace);
  const [tour, setTour] = useState(() => {
    try {
      const saved = readTour(localStorage, key);
      return saved.status === 'active' ? { ...saved, status: 'paused' as const } : saved;
    } catch {
      return newTour();
    }
  });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<Message>('');
  const [stored, setStored] = useState(true);
  const [handedOff, setHandedOff] = useState(false);
  const [helpOpen, setHelpOpen] = useState(tour.status === 'paused');
  const tracker = useRef<HTMLDivElement>(null);
  const [trackerHeight, setTrackerHeight] = useState(0);
  const request = useRef<AbortController | undefined>(undefined);
  const proposal = sampleProposal(workspace);
  const sampleReviewed =
    !!detail &&
    isSampleChange(detail, proposal) &&
    detail.change.snapshot.impacts.length > 0 &&
    detail.change.snapshot.impacts.every((impact) =>
      detail.reviews.some(
        (review) => review.itemId === impact.item.id && review.status !== 'pending',
      ),
    );
  const personalHandoff =
    tour.status !== 'active' &&
    !handedOff &&
    ((view === 'review' && stage === 'brief') ||
      (tour.status === 'complete' && view === 'history')) &&
    sampleReviewed;
  const active = tour.status === 'active';
  const firstLook =
    tour.status === 'ready' &&
    view === 'review' &&
    !detail &&
    canShowFirstLook(workspace, result, selection);
  function exitFirstLook() {
    setTour((state) => ({ ...state, status: 'dismissed' }));
    focusTarget('studio-content');
  }
  const info = tourSteps[tour.step];
  const matching =
    !loading &&
    (tour.changeId
      ? detail?.change.id === tour.changeId && isSampleChange(detail, proposal)
      : selection === 'proposal:supplier-daily' && result?.target.id === 'A1');
  const location =
    tour.step === 0
      ? view === 'documents' && panel === 'sources'
      : tour.step === 1
        ? view === 'documents' && panel === 'relationships'
        : tour.step === 6
          ? view === 'history'
          : view === 'review' &&
            stage ===
              (tour.step === 5
                ? 'brief'
                : tour.step === 4 || (tour.step === 2 && tour.changeId)
                  ? 'review'
                  : 'explore');
  const atStep = matching && location;
  const savedTransition =
    matching &&
    view === 'review' &&
    ((tour.step === 3 && stage === 'review') || (tour.step === 4 && stage === 'brief'));
  const completion = tourCompletion(
    tour,
    loading ? undefined : detail,
    proposal,
    history,
    atStep,
    savedTransition,
  );
  const relationship = workspace.dependencies.find(
    (e) => e.from === 'D1' && e.to === 'A1' && e.status === 'confirmed',
  );
  const savedRelationship = detail?.change.snapshot.impacts
    .flatMap((i) => i.paths.flatMap((p) => p.edges))
    .find((e) => e.from === 'D1' && e.to === 'A1');
  const relationshipEvidence = relationship?.evidenceId ?? savedRelationship?.evidenceId;
  const impactEvidence = result?.impacts
    .find((i) => i.item.id === 'T1')
    ?.paths.flatMap((p) => p.edges)
    .find((e) => e.from === 'T1' && e.to === 'D1')?.evidenceId;
  const expectedEvidence =
    tour.step === 0
      ? proposal?.evidenceId
      : tour.step === 1
        ? relationshipEvidence
        : tour.step === 2
          ? impactEvidence
          : undefined;
  useLayoutEffect(() => {
    if (!active || !tracker.current) return;
    const observer = new ResizeObserver((entries) =>
      setTrackerHeight(entries[0].borderBoxSize[0].blockSize),
    );
    observer.observe(tracker.current);
    return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    try {
      setStored(writeTour(localStorage, key, tour));
    } catch {
      setStored(false);
    }
  }, [key, tour]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (
      !active ||
      !isSampleChange(detail, proposal) ||
      (tour.changeId && tour.changeId !== detail?.change.id)
    )
      return;
    if (!tour.changeId) setTour((t) => ({ ...t, changeId: detail!.change.id }));
  }, [active, detail, proposal, tour.changeId]);
  useEffect(() => {
    if (!active || !atStep || !evidence) return;
    const read: TourRead | undefined =
      tour.step === 0 && evidence.id === proposal?.evidenceId
        ? 'source'
        : tour.step === 1 && evidence.id === relationshipEvidence
          ? 'relationship'
          : tour.step === 2 && selectedId === 'T1' && evidence.id === impactEvidence
            ? 'impact'
            : undefined;
    if (read) setTour((t) => (t.seen.includes(read) ? t : { ...t, seen: [...t.seen, read] }));
  }, [
    active,
    atStep,
    evidence,
    tour.step,
    proposal,
    relationshipEvidence,
    impactEvidence,
    selectedId,
  ]);
  useEffect(() => {
    if (active && !loading && (atStep || completion.complete)) focusTarget('sample-coach');
    // Only a new screen/step should move focus, never typing, opening evidence or saving an intermediate review.
  }, [active, tour.step, view, panel, stage, loading]);

  function beginRequest() {
    request.current?.abort();
    const abort = new AbortController();
    request.current = abort;
    setWorking(true);
    setError('');
    return abort;
  }
  async function start(restart = false) {
    if (working || busy || !proposal) return;
    const abort = beginRequest();
    try {
      const id = await findSampleChange(proposal, (cursor) => {
        const query = new URLSearchParams({ itemId: 'A1', kind: 'change', q: proposal.after });
        if (cursor) query.set('cursor', cursor);
        return api<HistoryPage>(`/api/history?${query}`, { signal: abort.signal });
      });
      if (abort.signal.aborted) return;
      if (!id && workspace.items.find((i) => i.id === 'A1')?.revision !== 1)
        throw new Error(
          'This inventory sample has changed and no matching saved sample was found. Use History to inspect it, or open a fresh sample demo. Your data has not been reset.',
        );
      const next = restart || tour.status === 'complete' ? newTour() : tour;
      setHandedOff(false);
      setHelpOpen(false);
      setTour({ ...next, status: 'active', changeId: id });
      onNavigate(next.step, id);
    } catch (e) {
      if (!abort.signal.aborted) setError((e as Error).message);
    } finally {
      if (!abort.signal.aborted) setWorking(false);
    }
  }
  async function openSource(id: string | undefined) {
    if (!id || working) return;
    // Loading disables the source button; keep its identity before focus is lost.
    const invoker = document.activeElement;
    const abort = beginRequest();
    try {
      const source = await api<EvidenceDetail>(`/api/evidence/${encodeURIComponent(id)}`, {
        signal: abort.signal,
      });
      if (!abort.signal.aborted) onEvidence(source, invoker);
    } catch (e) {
      if (!abort.signal.aborted)
        setError(
          message('Could not open the source. {0} Try the source button again.', [
            message((e as Error).message),
          ]),
        );
    } finally {
      if (!abort.signal.aborted) setWorking(false);
    }
  }
  function pause() {
    request.current?.abort();
    setWorking(false);
    setError('');
    setHelpOpen(true);
    setTour((t) => ({ ...t, status: 'paused' }));
    focusTarget('sample-welcome');
  }
  function move(step: number) {
    setError('');
    setTour((t) => ({ ...t, step }));
    onNavigate(step, tour.changeId);
  }
  function next() {
    if (!completion.complete || busy || working || evidence) return;
    if (tour.step === 6) {
      setTour((t) => ({ ...t, status: 'complete' }));
      setHelpOpen(false);
      focusTarget('sample-personal-handoff');
    } else move(tour.step + 1);
  }
  function nextFromSource() {
    if (
      !active ||
      !atStep ||
      !completion.complete ||
      evidence?.id !== expectedEvidence ||
      busy ||
      working
    )
      return;
    onCloseEvidence();
    move(tour.step + 1);
  }
  function locateTask() {
    if (working || busy || loading) return;
    if (!atStep) {
      void start();
      return;
    }
    if (tour.step === 0 || (tour.step === 1 && !relationship)) void openSource(expectedEvidence);
    else {
      onLocate(tour.step);
      focusTarget(info.target);
    }
  }
  const pendingText =
    tour.step === 0
      ? 'Open the supplier source to inspect its highlighted update.'
      : tour.step === 1
        ? 'Open “View original evidence” on the highlighted badge relationship.'
        : tour.step === 2
          ? 'Open the highlighted original source for the selected task.'
          : tour.step === 3
            ? 'Apply saves this change and opens its review queue. The guide never applies it for you.'
            : tour.step === 4
              ? message('{0} decisions left. Save each reason; unsaved text does not count.', [
                  completion.pending ?? '—',
                ])
              : tour.step === 5
                ? 'Inspect the saved reasons before moving to History.'
                : 'Load the sample events in History. If loading fails, use Retry history.';
  const completedText =
    tour.step < 3
      ? 'Evidence opened. When you have read it, choose the next step here or in the top bar.'
      : tour.step === 3
        ? 'Change saved. Next, decide what each affected item needs.'
        : tour.step === 4
          ? 'Every affected item has a saved decision. Next, inspect the brief.'
          : tour.step === 5
            ? 'Your saved decisions are ready. Download is optional; History is next.'
            : 'The saved sample events have loaded. Inspect the records, then finish the walkthrough.';
  const away = !atStep && !completion.complete;
  const missingPath =
    atStep && ((tour.step === 1 && !relationshipEvidence) || (tour.step === 2 && !impactEvidence));
  const status = loading
    ? 'Loading sample…'
    : away
      ? 'You are outside this task'
      : error
        ? 'Action failed · retry below'
        : completion.complete
          ? tour.step >= 5
            ? 'Ready to inspect'
            : 'Task complete'
          : tour.step === 4
            ? message('{0} decisions left', [completion.pending ?? '—'])
            : 'Action needed';
  const actionLabel = completion.complete
    ? info.next
    : away
      ? 'Return to sample task'
      : tour.step === 1 && !relationship
        ? 'Open preserved evidence'
        : info.action;
  function primaryAction(id?: string) {
    return (
      <button
        id={id}
        className={completion.complete ? 'sample-next' : 'sample-primary'}
        disabled={busy || loading || !!evidence || !!missingPath}
        aria-disabled={working}
        onClick={() => {
          if (working) return;
          if (completion.complete) next();
          else locateTask();
        }}
      >
        {working ? t('Opening sample…') : t(actionLabel)}
        <ArrowRight size={15} aria-hidden="true" />
      </button>
    );
  }
  return (
    <SampleGuideContext
      value={
        active
          ? {
              step: tour.step,
              atStep,
              evidenceNext:
                expectedEvidence && atStep
                  ? {
                      id: expectedEvidence,
                      label: info.next,
                      hint: info.sourceHint,
                      disabled: !completion.complete || working || busy,
                      run: nextFromSource,
                    }
                  : undefined,
            }
          : undefined
      }
    >
      <div
        className="sample-walkthrough"
        style={{ '--tour-bar-height': `${trackerHeight}px` } as CSSProperties}
        data-active={active}
        data-step={active ? tour.step : undefined}
        data-show-guide={tour.status !== 'ready' && !active}
      >
        {personalHandoff && (
          <section
            id="sample-personal-handoff"
            tabIndex={-1}
            className="sample-personal-handoff"
            aria-label={t('Your next review')}
          >
            <div>
              <h2>{t('You have recorded your sample decisions.')}</h2>
              <p>
                {t(
                  'Now try a short document of your own. Start with one fact and one task that depends on it.',
                )}
              </p>
            </div>
            <button
              className="sample-primary"
              disabled={busy}
              onClick={() => {
                setHandedOff(true);
                onOwnContext();
              }}
            >
              {t('Start my first document review')} <ArrowRight size={16} aria-hidden="true" />
            </button>
          </section>
        )}
        {firstLook && result && proposal ? (
          <FirstLook
            result={result}
            selectedId={selectedId}
            onSelectItem={onSelectItem}
            proposal={proposal}
            busy={busy || working || loading}
            disabled={applyDisabled}
            error={applyError || (typeof error === 'string' ? error : t(error))}
            onSource={() => void openSource(proposal.evidenceId)}
            onEvidence={onEvidence}
            onApply={onApply}
            onExit={exitFirstLook}
            onOwn={() => {
              setTour((state) => ({ ...state, status: 'dismissed' }));
              onOwnContext();
            }}
            onGuide={() => void start()}
          />
        ) : active ? (
          <>
            <div
              className="sample-tracker"
              ref={tracker}
              role="navigation"
              aria-label={t('Sample walkthrough controls')}
            >
              <div className="sample-current-task">
                <span>{t('Sample · {0}/7', [tour.step + 1])}</span>
                <strong>{t(info.task)}</strong>
                <span className="sample-tracker-status" role="status">
                  {t(status)}
                </span>
              </div>
              <div className="sample-tracker-actions">
                <button onClick={() => focusTarget('sample-coach')}>{t('Instructions')}</button>
                <button disabled={busy} onClick={pause}>
                  <Pause size={14} aria-hidden="true" />
                  {t('Pause')}
                </button>
                {primaryAction()}
              </div>
            </div>
            <section
              id="sample-coach"
              className="sample-coach"
              tabIndex={-1}
              aria-labelledby="sample-step-title"
            >
              <ol className="sample-steps" aria-label={t('Walkthrough steps')}>
                {tourSteps.map((step, i) => (
                  <li
                    key={step.short}
                    aria-current={i === tour.step ? 'step' : undefined}
                    aria-label={`${i + 1}. ${t(step.short)}`}
                    className={i < tour.step ? 'passed' : ''}
                  >
                    <span>
                      {i < tour.step ? <CheckCircle2 size={14} aria-hidden="true" /> : i + 1}
                    </span>
                    <span>{t(step.short)}</span>
                  </li>
                ))}
              </ol>
              <div className="sample-coach-body">
                <div>
                  <h2 id="sample-step-title">{t(info.title)}</h2>
                  <p>
                    {tour.step === 3 && completion.applied
                      ? t(
                          'The inventory change is saved with its original evidence and dependency paths. Continue to the affected items. If you are replaying, these are the existing records; no second change is needed.',
                        )
                      : t(info.instruction)}
                  </p>
                  {tour.step === 4 && completion.pending !== undefined && (
                    <progress
                      aria-label={t('Sample decisions recorded')}
                      max={Math.max(1, detail!.change.snapshot.impacts.length)}
                      value={detail!.change.snapshot.impacts.length - completion.pending}
                    />
                  )}
                  <p className={`sample-check ${completion.complete ? 'done' : ''}`} role="status">
                    {completion.complete && <CheckCircle2 size={16} aria-hidden="true" />}
                    {loading
                      ? t('Loading the sample context…')
                      : away
                        ? t(
                            'Use Return to sample task to restore the right screen and change. Your drafts stay here.',
                          )
                        : completion.complete
                          ? t(completedText)
                          : t(pendingText)}
                  </p>
                </div>
                <div className="sample-task-actions">
                  {primaryAction('sample-source-action')}
                  {!completion.complete && (
                    <span className="sample-up-next">
                      {t('Then: {0}', [
                        t(info.next).replace(language === 'ko' ? '다음: ' : 'Next: ', ''),
                      ])}
                    </span>
                  )}
                  <div>
                    <button
                      disabled={tour.step === 0 || working || busy}
                      onClick={() => move(tour.step - 1)}
                    >
                      {t('Back')}
                    </button>
                    {completion.complete && atStep && (
                      <button disabled={working || busy} onClick={locateTask}>
                        {t(info.action)}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {error && (
                <p className="sample-error" role="alert">
                  {t(error)}
                </p>
              )}
              {missingPath && (
                <p className="sample-note" role="status">
                  {t(
                    'The expected sample path is no longer available. Pause to inspect your relationships, or use a fresh sample demo. Existing data is preserved.',
                  )}
                </p>
              )}
              {!stored && (
                <p className="sample-note">
                  {t(
                    'Browser storage is unavailable. Continue here; the guide position will reset on reload.',
                  )}
                </p>
              )}
            </section>
          </>
        ) : (
          <details
            className="sample-help-disclosure compact"
            open={helpOpen}
            onToggle={(event) => setHelpOpen(event.currentTarget.open)}
          >
            <summary>{t('Optional walkthrough')}</summary>
            <section
              id="sample-welcome"
              tabIndex={-1}
              className={`sample-welcome ${tour.status === 'ready' || (tour.status === 'complete' && !handedOff) ? 'expanded' : ''}`}
              aria-label={t('Sample walkthrough')}
            >
              <GraduationCap size={26} aria-hidden="true" />
              <div>
                <h2>
                  {tour.status === 'complete'
                    ? t('Your sample review is complete.')
                    : tour.status === 'paused'
                      ? t('Resume at step {0}: {1}', [tour.step + 1, t(info.task)])
                      : t('What changes when live inventory becomes daily?')}
                </h2>
                {(tour.status === 'ready' || (tour.status === 'complete' && !handedOff)) && (
                  <p>
                    {tour.status === 'complete'
                      ? t(
                          'Bring a plan or requirement of your own. Save its evidence, connect dependent work, then preview your first update. The document guide walks you through it; your sample records stay saved.',
                        )
                      : t(
                          'Follow seven tasks to find which badge and alert work needs review, then save your decisions. The sample is already loaded; no uploads needed. You choose when to apply and save.',
                        )}
                  </p>
                )}
                {tour.status === 'paused' && (
                  <p>
                    {t(
                      'Your guide position is saved in this browser. Restart replays the instructions; it keeps all saved changes and decisions.',
                    )}
                  </p>
                )}
              </div>
              <div className="sample-welcome-actions">
                {tour.status === 'dismissed' && canShowFirstLook(workspace, result, selection) && (
                  <button
                    disabled={working || busy}
                    onClick={() => {
                      setTour(newTour());
                      onNavigate(3);
                      focusTarget('first-look-title');
                    }}
                  >
                    {t('Try the interactive example')}
                  </button>
                )}
                {tour.status === 'complete' && (
                  <button
                    className="sample-primary"
                    disabled={busy}
                    onClick={() => {
                      setHandedOff(true);
                      onOwnContext();
                    }}
                  >
                    {t('Open document editor')}
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                )}
                <button
                  className={tour.status === 'complete' ? '' : 'sample-primary'}
                  disabled={working || busy || !proposal}
                  onClick={() => void start(tour.status === 'complete')}
                >
                  <Play size={15} aria-hidden="true" />
                  {working
                    ? t('Opening sample…')
                    : tour.status === 'paused'
                      ? t('Resume walkthrough')
                      : tour.status === 'complete'
                        ? t('Replay guide')
                        : t('Start sample walkthrough')}
                </button>
                {tour.status === 'ready' && (
                  <button onClick={() => setTour((t) => ({ ...t, status: 'dismissed' }))}>
                    {t('Not now')}
                  </button>
                )}
                {tour.status === 'paused' && (
                  <button disabled={working || busy} onClick={() => void start(true)}>
                    <RotateCcw size={14} aria-hidden="true" />
                    {t('Restart guide')}
                  </button>
                )}
              </div>
              {error && (
                <p className="sample-error" role="alert">
                  {t(error)}
                </p>
              )}
              {!proposal && (
                <p className="sample-note">
                  {t(
                    'The inventory sample is unavailable in this workspace. Your regular tools remain available below.',
                  )}
                </p>
              )}
            </section>
          </details>
        )}
        <div className="sample-workspace" data-hidden={firstLook}>
          {children}
        </div>
      </div>
    </SampleGuideContext>
  );
}
