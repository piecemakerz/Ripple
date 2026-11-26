import { useI18n } from './i18n.js';
import { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  FileText,
  GitBranch,
  History,
  Route,
  ScanSearch,
  ClipboardCheck,
  BookOpen,
} from 'lucide-react';
import type { ChangeDetail, ImpactResult, Workspace } from '../shared/types.js';
import { workflowOverview, type FlowDestination, type WorkflowStep } from './workflow-overview.js';

const steps = [
  {
    id: 'sources',
    label: 'Sources & items',
    Icon: FileText,
    scope: 'Workspace context',
    input: 'A document or a saved source version.',
    task: 'Preserve the text, select an exact passage, then add an assumption, decision or task.',
    outcome: 'An item tied to its original evidence.',
    action: 'Open Sources & items',
  },
  {
    id: 'relationships',
    label: 'Relationships',
    Icon: GitBranch,
    scope: 'Workspace context',
    input: 'Two items and a quote that explains their connection.',
    task: 'Choose the dependent and prerequisite. Check the evidence before confirming the candidate.',
    outcome: 'A confirmed dependency that can carry an impact.',
    action: 'Open Relationships',
  },
  {
    id: 'explore',
    label: 'Explore impact',
    Icon: ScanSearch,
    scope: 'Selected change',
    input: 'A proposed update, its evidence and confirmed relationships.',
    task: 'Compare before and after. Select affected items and read their paths before applying.',
    outcome: 'An applied change with its original paths preserved.',
    action: 'Open Explore impact',
  },
  {
    id: 'review',
    label: 'Review decisions',
    Icon: ClipboardCheck,
    scope: 'Selected change',
    input: 'An applied change and its affected items.',
    task: 'Read each evidence trail. Choose Keep, Revise or Defer, add a reason and save.',
    outcome: 'A recorded decision for each reviewed item. Implementation remains open.',
    action: 'Open Review decisions',
  },
  {
    id: 'brief',
    label: 'Decision brief',
    Icon: BookOpen,
    scope: 'Selected change',
    input: 'Saved decisions, owners, reasons and original paths.',
    task: 'Check what is recorded and what still needs review. Download the brief when useful.',
    outcome: 'A portable Markdown record. Unsaved drafts are excluded.',
    action: 'Open Decision brief',
  },
  {
    id: 'history',
    label: 'History',
    Icon: History,
    scope: 'Workspace archive',
    input: 'Applied changes, saved decisions and relationship replacements.',
    task: 'Filter the event record. Compare versions, open original evidence or return to a review.',
    outcome: 'A traceable explanation of what changed and why.',
    action: 'Open History',
  },
] as const;

export function WorkflowGuide({
  workspace,
  result,
  detail,
  loading,
  busy,
  current,
  creatingPreview,
  onNavigate,
}: {
  workspace: Workspace;
  result: ImpactResult | undefined;
  detail: ChangeDetail | undefined;
  loading: boolean;
  busy: boolean;
  current: WorkflowStep;
  creatingPreview: boolean;
  onNavigate: (destination: FlowDestination) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [inspected, setInspected] = useState<WorkflowStep>();
  const overview = workflowOverview(workspace, result, detail, loading, t);
  const active = steps.find((step) => step.id === current)!;
  const selected = steps.find((step) => step.id === inspected);
  const canOpen =
    selected &&
    (selected.id === 'review' || selected.id === 'brief'
      ? overview.applied
      : selected.id === 'explore'
        ? overview.selectedAvailable
        : true);
  function navigate(destination: FlowDestination) {
    setOpen(false);
    setInspected(undefined);
    onNavigate(destination);
  }
  return (
    <section className="workflow-guide" aria-label={t('Workflow guide')}>
      <button
        className="workflow-toggle"
        aria-expanded={open}
        aria-controls="workflow-map"
        onClick={() => {
          setOpen(!open);
          setInspected(undefined);
        }}
      >
        <span>
          <Route size={18} aria-hidden="true" />
          <strong>{t('Workflow guide')}</strong>
        </span>
        <span className="workflow-current">
          {t('Now: {0}', [creatingPreview ? t('Create a change preview') : t(active.label)])}
        </span>
        <span className="workflow-disclosure">
          {open ? t('Hide flow') : t('Show flow')}
          <ChevronDown size={15} aria-hidden="true" />
        </span>
      </button>
      <div id="workflow-map" hidden={!open}>
        <p className="workflow-intro">
          {t('From original context to a recorded decision. Select a stage to see its tasks.')}
        </p>
        <ol className="workflow-route" aria-label={t('Stages from source to history')}>
          {steps.map(({ id, label, Icon }, index) => (
            <li key={id}>
              <button
                className={`workflow-stop ${id === current ? 'current' : ''}`}
                aria-label={t('View {0} tasks', [t(label)])}
                aria-pressed={inspected === id}
                aria-current={id === current ? 'step' : undefined}
                aria-controls="workflow-task"
                onClick={() => setInspected(inspected === id ? undefined : id)}
              >
                <span className="workflow-station">
                  <Icon size={18} aria-hidden="true" />
                  <span>{index + 1}</span>
                </span>
                <strong>{t(label)}</strong>
                <span className="workflow-metric">{overview.metrics[id]}</span>
                {id === current && <span className="workflow-here">{t('You are here')}</span>}
              </button>
            </li>
          ))}
        </ol>
        <div id="workflow-task" hidden={!selected} className="workflow-task">
          {selected && (
            <>
              <div className="workflow-task-heading">
                <h2>{t(selected.label)}</h2>
                <span>
                  {t(selected.scope)}
                  {selected.scope === 'Selected change' && overview.changeTitle
                    ? ` · ${overview.changeTitle}`
                    : ''}
                </span>
              </div>
              <dl className="workflow-task-path">
                <div>
                  <dt>{t('Start with')}</dt>
                  <dd>{t(selected.input)}</dd>
                </div>
                <div>
                  <dt>{t('Your task')}</dt>
                  <dd>{t(selected.task)}</dd>
                </div>
                <div>
                  <dt>{t('You leave with')}</dt>
                  <dd>{t(selected.outcome)}</dd>
                </div>
              </dl>
              {selected.id === 'review' && overview.applied && !!overview.total && (
                <div className="workflow-review-meter">
                  <span>{t('Saved decisions')}</span>
                  <progress
                    value={overview.recorded}
                    max={overview.total}
                    aria-label={t('Saved decisions for this change')}
                  />
                  <strong>
                    {overview.recorded} / {overview.total}
                  </strong>
                </div>
              )}
              <div className="workflow-task-footer">
                <p>
                  {selected.id === 'review' && overview.applied
                    ? overview.total
                      ? t('{0} saved. {1} still need a decision. Drafts do not count as saved.', [
                          overview.recorded,
                          overview.pending,
                        ])
                      : t(
                          'No affected items in this saved change. The brief still preserves its context.',
                        )
                    : selected.id === 'relationships'
                      ? t(
                          '{0} {1} confirmation. Proposed, rejected and superseded links do not carry new impacts.',
                          [
                            overview.proposed,
                            overview.proposed === 1 ? t('candidate awaits') : t('candidates await'),
                          ],
                        )
                      : selected.id === 'explore' && overview.limited
                        ? t(
                            'This result has limits or evidence warnings. Read them before making a decision.',
                          )
                        : (selected.id === 'review' || selected.id === 'brief') && !overview.applied
                          ? t('Apply a change from Explore impact to unlock this stage.')
                          : selected.scope === 'Workspace context'
                            ? t(
                                'These counts cover your workspace. They do not mean this step is complete for every item.',
                              )
                            : selected.id === 'brief'
                              ? t('You can read a partial brief before every decision is recorded.')
                              : t('Opening a stage keeps your current in-memory drafts.')}
                </p>
                <div>
                  {selected.id === 'explore' && (
                    <button
                      className="workflow-secondary"
                      disabled={busy}
                      onClick={() => navigate('new-change')}
                    >
                      {t('Create a change preview')}
                    </button>
                  )}
                  <button
                    className="workflow-open"
                    disabled={busy || !canOpen}
                    onClick={() => navigate(selected.id)}
                  >
                    {t(selected.action)}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
