import type { ChangeDetail, ImpactResult, Workspace } from '../shared/types.js';
import { decisionCounts } from './review-workflow.js';
import { translate, type Translator } from './i18n-core.js';

export type DocumentPanel = 'sources' | 'items' | 'relationships' | 'preview';
export type WorkflowStep = 'sources' | 'relationships' | 'explore' | 'review' | 'brief' | 'history';
export type FlowDestination = WorkflowStep | 'new-change';

export function workflowOverview(
  workspace: Workspace,
  result: ImpactResult | undefined,
  detail: ChangeDetail | undefined,
  loading: boolean,
  t: Translator = (key, values) => translate(key, 'en', values),
) {
  const snapshot = detail?.change.snapshot ?? result;
  const counts = snapshot ? decisionCounts(snapshot.impacts, detail?.reviews ?? []) : undefined;
  const total = snapshot?.impacts.length ?? 0;
  const recorded = total - (counts?.pending ?? 0);
  const selectedAvailable = !loading && !!snapshot;
  const applied = selectedAvailable && !!detail;
  const confirmed = workspace.dependencies.filter((edge) => edge.status === 'confirmed').length;
  const proposed = workspace.candidates.filter((edge) => edge.status === 'proposed').length;
  return {
    sourceCount: workspace.sources.length,
    itemCount: workspace.items.length,
    confirmed,
    proposed,
    selectedAvailable,
    applied,
    total: selectedAvailable ? total : undefined,
    recorded: applied ? recorded : undefined,
    pending: applied ? counts?.pending : undefined,
    limited: selectedAvailable && !!(snapshot?.limited || snapshot?.warnings.length),
    changeTitle: selectedAvailable ? snapshot!.target.title : undefined,
    metrics: {
      sources: t('{0} versions · {1} items', [workspace.sources.length, workspace.items.length]),
      relationships: t('{0} confirmed · {1} to check', [confirmed, proposed]),
      explore: loading
        ? t('Loading change…')
        : !snapshot
          ? t('Select a change')
          : snapshot.limited || snapshot.warnings.length
            ? t('Check result limits')
            : t('{0} affected {1}', [total, t(total === 1 ? 'item' : 'items')]),
      review: loading
        ? t('Loading change…')
        : !applied
          ? t('Apply a change first')
          : total
            ? t('{0} of {1} recorded', [recorded, total])
            : t('No decisions needed'),
      brief: loading
        ? t('Loading change…')
        : !applied
          ? t('Apply a change first')
          : counts?.pending
            ? t('Partial brief available')
            : t('Saved record available'),
      history: t('Every saved event'),
    } satisfies Record<WorkflowStep, string>,
  };
}
