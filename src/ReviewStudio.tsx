import { SampleBody } from './SampleContent.js';
import { itemTitle } from './sample-content.js';
import { useI18n } from './i18n.js';
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  GitBranch,
  LoaderCircle,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  ChangeDetail,
  EvidenceDetail,
  Impact,
  ImpactResult,
  Proposal,
  Review,
  SourceVersion,
} from '../shared/types.js';
import { EvidenceTrail } from './EvidenceTrail.js';
import { DecisionBrief } from './DecisionBrief.js';
import { DecisionChoices } from './DecisionChoices.js';
import { decisionCounts, decisionLabels, nextPending, reviewQueue } from './review-workflow.js';
import { reviewDraftState, type ReviewDraft, type PathChoice } from './review-presentation.js';
import { useSampleGuide } from './sample-guide-context.js';

const ImpactCanvas = lazy(() =>
  import('./ImpactCanvas.js').then((module) => ({ default: module.ImpactCanvas })),
);
export type StudioStage = 'explore' | 'review' | 'brief';
type Draft = ReviewDraft;

export function ReviewStudio({
  result,
  detail,
  proposal,
  selected,
  draft,
  busy,
  loading,
  applyDisabled,
  applyLabel,
  failure,
  conflict,
  onReloadConflict,
  onResolveConflict,
  unsaved,
  stage,
  changePicker,
  onStage,
  onSelect,
  onDraft,
  onApply,
  onSave,
  onEvidence,
  onChangeEvidence,
  onRelationships,
  onHistory,
  sources,
}: {
  result: ImpactResult;
  detail: ChangeDetail | undefined;
  proposal: Proposal | undefined;
  selected: Impact | undefined;
  draft: Draft;
  busy: boolean;
  loading: boolean;
  applyDisabled: boolean;
  applyLabel: string;
  failure: string | undefined;
  conflict?: { latest?: Review };
  onReloadConflict: () => void;
  onResolveConflict: (keepDraft: boolean) => void;
  unsaved: number;
  stage: StudioStage;
  changePicker: ReactNode;
  onStage: (stage: StudioStage) => void;
  onSelect: (id: string) => void;
  onDraft: (draft: Partial<Draft>) => void;
  onApply: () => void;
  onSave: () => Promise<ChangeDetail | undefined>;
  onEvidence: (evidence: EvidenceDetail) => void;
  onChangeEvidence: () => void;
  onRelationships: () => void;
  onHistory: (id: string) => void;
  sources: SourceVersion[];
}) {
  const { t, locale, language } = useI18n();
  const [choice, setChoice] = useState<PathChoice>();
  const guide = useSampleGuide();
  const sampleDecision =
    (guide?.atStep && guide.step === 4) ||
    (result.target.id === 'A1' && result.target.title === 'Real-time inventory updates');
  const [focused, setFocused] = useState(true);
  const [queueFilter, setQueueFilter] = useState('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const reviews = detail?.reviews ?? [];
  const review = reviews.find((entry) => entry.itemId === selected?.item.id);
  const counts = decisionCounts(result.impacts, reviews);
  const recorded = result.impacts.length - counts.pending;
  const draftState = reviewDraftState(draft, review);
  const queue = reviewQueue(result.impacts);
  const visibleQueue = queue.filter(
    (impact) =>
      `${itemTitle(impact.item, language)} ${impact.item.title} ${impact.item.id} ${impact.item.owner}`
        .toLowerCase()
        .includes(queueFilter.toLowerCase()) &&
      (!pendingOnly ||
        !reviews.some((entry) => entry.itemId === impact.item.id && entry.status !== 'pending')),
  );
  function focus(id: string) {
    requestAnimationFrame(() => {
      const element = document.getElementById(id);
      element?.focus({ preventScroll: true });
      if (id === 'studio-content') window.scrollTo({ top: 0, behavior: 'instant' });
      else element?.scrollIntoView({ block: 'start' });
    });
  }
  function go(next: StudioStage) {
    onStage(next);
    if (next === 'explore' || next === stage) focus('studio-content');
  }
  useEffect(() => {
    if (stage !== 'explore') focus('studio-content');
  }, [stage]);
  function reviewItem(id: string) {
    onSelect(id);
    go('review');
  }
  function startReview() {
    const next = nextPending(result.impacts, reviews);
    if (next) onSelect(next.item.id);
    go(result.impacts.length ? 'review' : 'brief');
  }
  async function save(advance: boolean) {
    const saved = await onSave();
    if (!saved || !advance) return;
    const next = nextPending(result.impacts, saved.reviews, selected?.item.id);
    if (next) {
      onSelect(next.item.id);
      focus('studio-content');
    } else go('brief');
  }
  const selectedPosition = queue.findIndex((impact) => impact.item.id === selected?.item.id) + 1;
  return (
    <div
      className={`review-studio ${stage === 'review' ? 'ripple-review' : ''}`}
      aria-busy={loading}
    >
      <div className="studio-heading">
        <div>
          <span className={`studio-change-state ${detail ? 'applied' : ''}`}>
            {detail ? (
              <CheckCircle2 size={14} aria-hidden="true" />
            ) : (
              <GitBranch size={14} aria-hidden="true" />
            )}
            {detail
              ? t('Applied change · Revision {0}', [detail.change.afterRevision])
              : t('Change preview')}
          </span>
          <h1>
            {itemTitle(stage === 'review' && selected ? selected.item : result.target, language)}
          </h1>
        </div>
        <details className="studio-switch">
          <summary>
            <SlidersHorizontal size={16} aria-hidden="true" />
            {t('Switch change')}
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <div>{changePicker}</div>
        </details>
      </div>
      <div className="studio-navigation">
        <nav aria-label={t('Change review stages')}>
          {(
            [
              ['explore', 'Explore impact'],
              ['review', 'Review decisions'],
              ['brief', 'Decision brief'],
            ] as const
          ).map(([value, label], index) => (
            <button
              key={value}
              aria-pressed={stage === value}
              aria-current={stage === value ? 'step' : undefined}
              aria-controls="studio-content"
              disabled={busy || (value !== 'explore' && !detail)}
              onClick={() => go(value)}
            >
              <span className="studio-step-number">{index + 1}</span>
              <span className="studio-step-label">{t(label)}</span>
            </button>
          ))}
        </nav>
        <div className="studio-progress">
          <progress
            value={recorded}
            max={Math.max(1, result.impacts.length)}
            aria-label={t('Decisions recorded')}
          />
          <span>
            {detail
              ? t('{0}/{1} recorded', [recorded, result.impacts.length])
              : t('{0} affected {1}', [
                  result.impacts.length,
                  result.impacts.length === 1 ? t('item') : t('items'),
                ])}
          </span>
        </div>
        {stage === 'review' && selected && (
          <div className="review-focus-bar">
            <div>
              <strong>{t('One decision at a time.')}</strong>
              <span>{t('Read the evidence, choose an action, then save your reason.')}</span>
            </div>
            {focused && (
              <label>
                {t('Current item')}
                <select
                  value={selected.item.id}
                  disabled={busy || loading}
                  onChange={(event) => onSelect(event.target.value)}
                >
                  {queue.map((impact) => (
                    <option key={impact.item.id} value={impact.item.id}>
                      {itemTitle(impact.item, language)}
                      {reviews.some((r) => r.itemId === impact.item.id && r.status !== 'pending')
                        ? ` · ${t('Decision saved')}`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="studio-button"
              aria-pressed={!focused}
              disabled={busy}
              onClick={() => setFocused((value) => !value)}
            >
              {focused ? t('Show full queue') : t('Focus on one item')}
            </button>
          </div>
        )}
      </div>
      {result.warnings.map((warning) => (
        <p key={warning} className="studio-warning" role="alert">
          {t(warning)}
        </p>
      ))}
      <div id="studio-content" className="studio-content" tabIndex={-1}>
        {stage === 'explore' && (
          <div className="studio-explore">
            <section className="studio-map" aria-label={t('Impact map')}>
              <div className="studio-map-heading">
                <div>
                  <h2>{t('Follow the ripple.')}</h2>
                  <p>
                    {t('One change. {0} {1} to reconsider.', [
                      result.impacts.length,
                      result.impacts.length === 1 ? t('item') : t('items'),
                    ])}
                  </p>
                </div>
                <span className="studio-caption">
                  {detail ? t('Preserved snapshot') : t('Confirmed dependencies')}
                </span>
              </div>
              <div className="studio-wave-legend">
                <span>
                  <i className="origin-dot" />
                  {t('Changed item')}
                </span>
                <span>
                  <i className="direct-dot" />
                  {t('{0} direct', [result.impacts.filter((impact) => impact.depth === 1).length])}
                </span>
                <span>
                  <i className="indirect-dot" />
                  {t('{0} indirect', [result.impacts.filter((impact) => impact.depth > 1).length])}
                </span>
              </div>
              {result.impacts.length ? (
                <Suspense
                  fallback={
                    <div className="empty-state" role="status">
                      {t('Loading dependency map…')}
                    </div>
                  }
                >
                  <ImpactCanvas
                    result={result}
                    selected={selected}
                    choice={choice}
                    onSelect={onSelect}
                    propagation
                    disabled={busy || loading}
                  />
                </Suspense>
              ) : (
                <div className="empty-state">
                  <GitBranch aria-hidden="true" />
                  <strong>
                    {t('No affected items found{0}.', [detail ? t(' in this saved change') : ''])}
                  </strong>
                  <p>
                    {detail
                      ? t(
                          'This snapshot stays as it was when applied. New confirmed links only affect future changes.',
                        )
                      : t(
                          'No confirmed dependency paths lead to this item. A saved document or an unconfirmed candidate alone does not create an impact.',
                        )}
                  </p>
                  <p>
                    {detail
                      ? t('The decision brief still records the change.')
                      : t(
                          'If you expected affected work, check the direction and confirm its relationship before applying. You can also apply with an empty review queue.',
                        )}
                  </p>
                  {!detail && (
                    <button
                      className="studio-button"
                      disabled={busy || loading}
                      onClick={onRelationships}
                    >
                      {t('Check relationships')}
                    </button>
                  )}
                </div>
              )}
              {selected && (
                <div className="studio-map-selection">
                  <div>
                    <span className="studio-caption">{t('Selected consequence')}</span>
                    <strong>{itemTitle(selected.item, language)}</strong>
                    <span>
                      {selected.paths.length}{' '}
                      {selected.paths.length === 1 ? t('evidence path') : t('evidence paths')} ·{' '}
                      {selected.item.owner}
                    </span>
                  </div>
                  <button
                    className="studio-button"
                    onClick={() => {
                      if (detail) reviewItem(selected.item.id);
                      else focus('preview-trail');
                    }}
                  >
                    {t('Read the evidence')}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
              <details className="studio-outside">
                <summary>
                  {result.limited ? t('Outside the returned results') : t('Outside this ripple')}{' '}
                  <span>{result.excluded.length}</span>
                </summary>
                <p>
                  {result.limited
                    ? t('Traversal is limited. No conclusion about excluded items.')
                    : t('No confirmed dependency path was found to the changed item.')}
                </p>
                <ul>
                  {result.excluded.map((item) => (
                    <li key={item.id}>
                      {itemTitle(item, language)} <small>({item.id})</small>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
            <aside
              id="sample-apply"
              tabIndex={-1}
              className="studio-change-sheet"
              aria-label={t('Change comparison')}
            >
              <span className="studio-caption">{t('The starting point')}</span>
              <h2>{t('What changes?')}</h2>
              <div className="studio-before">
                <span>{t('Before')}</span>
                <SampleBody
                  item={result.target}
                  body={detail?.change.before ?? result.target.body}
                />
              </div>
              <div className="studio-after">
                <span>{detail ? t('After') : t('Proposed')}</span>
                <SampleBody
                  item={result.target}
                  body={detail?.change.after ?? proposal?.after ?? ''}
                />
              </div>
              <button className="studio-link" onClick={onChangeEvidence}>
                <FileText size={16} aria-hidden="true" />
                {t('Read change source')}
              </button>
              <div className="studio-start">
                {detail ? (
                  <>
                    <p>
                      {t(
                        '{0} Start with direct dependencies, then follow the downstream effects.',
                        [
                          counts.pending
                            ? t('{0} decisions left to record.', [counts.pending])
                            : t('All decisions recorded.'),
                        ],
                      )}
                    </p>
                    <button className="studio-button primary" disabled={busy} onClick={startReview}>
                      {counts.pending ? t('Continue review') : t('Revisit decisions')}
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <>
                    <p>
                      {t(
                        'Apply this change to preserve the original paths and open {0} review {1}.',
                        [
                          result.impacts.length,
                          result.impacts.length === 1 ? t('decision') : t('decisions'),
                        ],
                      )}
                    </p>
                    <button
                      className="studio-button primary"
                      onClick={onApply}
                      disabled={applyDisabled || busy || loading}
                    >
                      {busy ? (
                        <LoaderCircle size={16} className="spin" aria-hidden="true" />
                      ) : (
                        <Check size={16} aria-hidden="true" />
                      )}
                      {t(applyLabel)}
                    </button>
                  </>
                )}
                <small>
                  {t(
                    'Connected does not mean broken. Review each consequence against its evidence.',
                  )}
                </small>
              </div>
            </aside>
            {!detail && selected && (
              <div id="preview-trail" className="studio-preview-trail" tabIndex={-1}>
                <div id="sample-impact-trail" tabIndex={-1}>
                  <EvidenceTrail
                    result={result}
                    selected={selected}
                    choice={choice}
                    onPath={setChoice}
                    onEvidence={onEvidence}
                    after={proposal?.after ?? ''}
                    applied={false}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {stage === 'review' && detail && (
          <div className={`studio-review-layout ${focused ? 'focused' : ''}`}>
            <aside className="studio-queue" aria-label={t('Review queue')}>
              <div className="studio-queue-heading">
                <h2>{t('Review queue')}</h2>
                <span>{t('{0} left', [counts.pending])}</span>
              </div>
              <label className="studio-search">
                <Search size={16} aria-hidden="true" />
                <span className="sr-only">{t('Find affected items')}</span>
                <input
                  type="search"
                  name="find-impact"
                  autoComplete="off"
                  placeholder={t('Find item or owner…')}
                  value={queueFilter}
                  onChange={(event) => setQueueFilter(event.target.value)}
                />
              </label>
              <label className="studio-pending-filter">
                <input
                  type="checkbox"
                  checked={pendingOnly}
                  onChange={(event) => setPendingOnly(event.target.checked)}
                />
                {t('Needs review only')}
              </label>
              <div className="studio-mobile-select">
                <label htmlFor="studio-item">{t('Review item')}</label>
                <select
                  id="studio-item"
                  value={selected?.item.id ?? ''}
                  disabled={busy}
                  onChange={(event) => onSelect(event.target.value)}
                >
                  {queue.map((impact) => (
                    <option value={impact.item.id} key={impact.item.id}>
                      {itemTitle(impact.item, language)} —{' '}
                      {t(
                        decisionLabels[
                          reviews.find((entry) => entry.itemId === impact.item.id)?.status ??
                            'pending'
                        ],
                      )}
                    </option>
                  ))}
                </select>
              </div>
              <div className="studio-queue-items">
                {[1, 2].map((group) => {
                  const entries = visibleQueue.filter((impact) =>
                    group === 1 ? impact.depth === 1 : impact.depth > 1,
                  );
                  return entries.length ? (
                    <section key={group}>
                      <h3>
                        {group === 1 ? t('Direct dependencies') : t('Downstream effects')}
                        <span>{entries.length}</span>
                      </h3>
                      {entries.map((impact) => {
                        const status =
                          reviews.find((entry) => entry.itemId === impact.item.id)?.status ??
                          'pending';
                        return (
                          <button
                            key={impact.item.id}
                            disabled={busy}
                            aria-pressed={impact.item.id === selected?.item.id}
                            onClick={() => onSelect(impact.item.id)}
                          >
                            <span className={`queue-marker ${status}`} aria-hidden="true">
                              {status !== 'pending' ? <Check size={12} /> : <span />}
                            </span>
                            <span>
                              <strong>{itemTitle(impact.item, language)}</strong>
                              <small>
                                {impact.item.owner} · {t(decisionLabels[status])}
                              </small>
                            </span>
                          </button>
                        );
                      })}
                    </section>
                  ) : null;
                })}
                {!visibleQueue.length && (
                  <p className="studio-caption">
                    {pendingOnly && !counts.pending
                      ? t('All decisions are recorded.')
                      : t('No items match. Clear the search or filter.')}
                  </p>
                )}
              </div>
              <button className="studio-link" onClick={() => go('explore')}>
                <GitBranch size={15} aria-hidden="true" />
                {t('Back to full map')}
              </button>
            </aside>
            {selected ? (
              <>
                <div id="sample-impact-trail" tabIndex={-1} className="studio-evidence-column">
                  <section className="review-change-context" aria-label={t('Change comparison')}>
                    <h2>{t('What changed?')}</h2>
                    <strong>{itemTitle(result.target, language)}</strong>
                    <div>
                      <div>
                        <span>{t('Before')}</span>
                        <SampleBody
                          item={result.target}
                          body={detail?.change.before ?? result.target.body}
                        />
                      </div>
                      <ArrowRight size={18} aria-hidden="true" />
                      <div>
                        <span>{t('After')}</span>
                        <SampleBody
                          item={result.target}
                          body={detail?.change.after ?? proposal?.after ?? ''}
                        />
                      </div>
                    </div>
                  </section>
                  {focused && (
                    <details
                      className="ripple-review-map"
                      aria-label={t('Selected path and its evidence')}
                    >
                      <summary>{t('Explore the full impact map')}</summary>
                      <Suspense
                        fallback={
                          <div className="ripple-map-loading" role="status">
                            {t('Loading dependency map…')}
                          </div>
                        }
                      >
                        <ImpactCanvas
                          result={result}
                          selected={selected}
                          choice={choice}
                          onSelect={onSelect}
                          propagation
                          disabled={busy || loading}
                        />
                      </Suspense>
                    </details>
                  )}
                  <div className="studio-position">
                    <span>{t('Item {0} of {1}', [selectedPosition, queue.length])}</span>
                    <button className="studio-link" onClick={() => focus('studio-decision')}>
                      {t('Record decision')}
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <EvidenceTrail
                    result={result}
                    selected={selected}
                    choice={choice}
                    onPath={setChoice}
                    onEvidence={onEvidence}
                    after={detail?.change.after ?? proposal?.after ?? ''}
                    applied={!!detail}
                    compact={focused}
                    sources={sources}
                    onRelationships={onRelationships}
                  />
                </div>
                <section
                  className="studio-decision"
                  id="studio-decision"
                  tabIndex={-1}
                  aria-label={t('Record decision')}
                >
                  <div className="studio-section-heading">
                    <div>
                      <h2>{t('Your decision')}</h2>
                      <span className="studio-decision-owner">{selected.item.owner}</span>
                    </div>
                    <span className={`studio-status ${review?.status ?? 'pending'}`}>
                      {t(decisionLabels[review?.status ?? 'pending'])}
                    </span>
                  </div>
                  <p className="studio-decision-target" id="decision-target">
                    {t('For {0}', [itemTitle(selected.item, language)])}
                  </p>
                  <DecisionChoices
                    value={draft.status}
                    disabled={busy || loading}
                    describedBy="decision-target"
                    onChange={(status) => onDraft({ status })}
                  />
                  <p className="studio-decision-help">
                    {!draft.status
                      ? t(
                          'Choose the response that fits this item. Ripple does not choose for you.',
                        )
                      : draft.status === 'keep'
                        ? t('This item still holds after the change.')
                        : draft.status === 'revise'
                          ? t('Plan an adaptation. The implementation stays open.')
                          : t('Wait for more context before committing to an action.')}
                  </p>
                  <label className="studio-reason-label" htmlFor="review-reason">
                    {t('Reason')}
                    <span aria-hidden="true">{t('Required')}</span>
                  </label>
                  <textarea
                    id="review-reason"
                    name="review-reason"
                    autoComplete="off"
                    required
                    maxLength={4000}
                    rows={5}
                    value={draft.reason}
                    disabled={busy || loading}
                    onChange={(event) => onDraft({ reason: event.target.value })}
                    placeholder={t('Explain the action and its reason…')}
                  />
                  {sampleDecision && draft.status && (
                    <details id="sample-reason-help" className="sample-reason-help">
                      <summary>{t('Help writing a reason')}</summary>
                      <strong>{t('A useful reason answers:')}</strong>{' '}
                      {draft.status === 'keep'
                        ? t('Why does this item still work with daily inventory?')
                        : draft.status === 'defer'
                          ? t('What information is missing, and when will you revisit it?')
                          : t('What needs to change, and why does daily inventory require it?')}
                      <span>
                        {t('{0} Write your own reason; the guide does not fill or save it.', [
                          draft.status === 'revise'
                            ? ['D1', 'T1'].includes(selected.item.id)
                              ? t('Example: “Show the snapshot date instead of calling it live.”')
                              : ['D2', 'T2'].includes(selected.item.id)
                                ? t('Example: “Run the stock check after each daily snapshot.”')
                                : t('Name the adaptation and the source that supports it.')
                            : t('Include the evidence or missing information behind your choice.'),
                        ])}
                      </span>
                    </details>
                  )}
                  <p
                    className={`studio-draft-status ${draftState.unchanged ? 'saved' : ''}`}
                    role="status"
                  >
                    {draftState.unchanged && <CheckCircle2 size={14} aria-hidden="true" />}
                    {t(draftState.message)}
                  </p>
                  {conflict && (
                    <div className="review-error review-conflict" role="alert">
                      <strong>{t('A newer decision is saved')}</strong>
                      <p>
                        {t(
                          'Your draft is preserved. Compare it with the latest decision before continuing.',
                        )}
                      </p>
                      {conflict.latest ? (
                        <>
                          <p>
                            <strong>
                              {t('Latest saved decision')}:{' '}
                              {t(decisionLabels[conflict.latest.status])}
                            </strong>
                          </p>
                          <blockquote>
                            {conflict.latest.reason || t('No reason recorded')}
                          </blockquote>
                          <button
                            className="studio-button secondary"
                            disabled={busy}
                            onClick={() => onResolveConflict(true)}
                          >
                            {t('Compared — continue with my draft')}
                          </button>
                          <button
                            className="studio-button secondary"
                            disabled={busy}
                            onClick={() => onResolveConflict(false)}
                          >
                            {t('Use the latest saved decision')}
                          </button>
                        </>
                      ) : (
                        <button
                          className="studio-button secondary"
                          disabled={busy}
                          onClick={onReloadConflict}
                        >
                          {t('Load the latest decision')}
                        </button>
                      )}
                    </div>
                  )}
                  {failure && !conflict && !draftState.unchanged && (
                    <div className="review-error" role="alert">
                      <strong>{t('Review not saved')}</strong>
                      <p>{t('Your reason is still here. Retry saving to continue.')}</p>
                      <small>{t(failure)}</small>
                    </div>
                  )}
                  <div className="studio-save-actions">
                    <button
                      className="studio-button primary"
                      disabled={busy || loading || !!conflict || !draftState.canSave}
                      onClick={() => void save(true)}
                    >
                      {busy ? (
                        <LoaderCircle className="spin" size={16} aria-hidden="true" />
                      ) : (
                        <Check size={16} aria-hidden="true" />
                      )}
                      {busy
                        ? t('Saving…')
                        : draftState.unchanged
                          ? t('Decision saved')
                          : t('Save & continue')}
                    </button>
                    <button
                      className="studio-link"
                      disabled={busy || loading || !!conflict || !draftState.canSave}
                      onClick={() => void save(false)}
                    >
                      {t('Save without moving')}
                    </button>
                  </div>
                  <button
                    className="studio-button secondary"
                    disabled={busy}
                    onClick={() => {
                      const next = nextPending(result.impacts, reviews, selected.item.id);
                      if (next) {
                        onSelect(next.item.id);
                        focus('studio-content');
                      } else go('brief');
                    }}
                  >
                    {nextPending(result.impacts, reviews, selected.item.id)
                      ? t('Next unreviewed item')
                      : t('View decision brief')}
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                  <p className="studio-caption">{t('Records a decision, not completed work.')}</p>
                  <button
                    className="studio-link studio-return-evidence"
                    onClick={() => focus('studio-trail')}
                  >
                    {t('Return to evidence')}
                  </button>
                  {!!review?.history.length && (
                    <details className="studio-review-history">
                      <summary>{t('Decision history · {0}', [review.history.length])}</summary>
                      {review.history.map((event) => (
                        <div key={event.id}>
                          <strong>{t(decisionLabels[event.status])}</strong>
                          <time>{new Date(event.createdAt).toLocaleString(locale)}</time>
                          <p>{event.reason}</p>
                        </div>
                      ))}
                    </details>
                  )}
                  <button className="studio-link" onClick={() => onHistory(selected.item.id)}>
                    {t('View item history')}
                  </button>
                </section>
              </>
            ) : (
              <div className="empty-state">
                {t('No affected items require a decision.')}
                <button className="studio-button" onClick={() => go('brief')}>
                  {t('View decision brief')}
                </button>
              </div>
            )}
          </div>
        )}
        {stage === 'brief' && detail && (
          <DecisionBrief detail={detail} unsaved={unsaved} onReview={reviewItem} />
        )}
      </div>
    </div>
  );
}
