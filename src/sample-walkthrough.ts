import type { ChangeDetail, HistoryPage, Proposal, Workspace } from '../shared/types.js';
import { decisionCounts } from './review-workflow.js';

export type TourStatus = 'ready' | 'active' | 'paused' | 'dismissed' | 'complete';
export type TourRead = 'source' | 'relationship' | 'impact';
export interface TourState {
  version: 1;
  status: TourStatus;
  step: number;
  seen: TourRead[];
  changeId?: string;
}
export const newTour = (): TourState => ({ version: 1, status: 'ready', step: 0, seen: [] });
export function parseTour(raw: string | null): TourState {
  try {
    const v = JSON.parse(raw ?? 'null');
    if (
      !v ||
      v.version !== 1 ||
      !['ready', 'active', 'paused', 'dismissed', 'complete'].includes(v.status) ||
      !Number.isInteger(v.step) ||
      v.step < 0 ||
      v.step > 6 ||
      !Array.isArray(v.seen) ||
      v.seen.length > 3 ||
      !v.seen.every(
        (s: unknown) => typeof s === 'string' && ['source', 'relationship', 'impact'].includes(s),
      ) ||
      (v.changeId !== undefined &&
        (typeof v.changeId !== 'string' || !v.changeId || v.changeId.length > 200))
    )
      return newTour();
    return {
      version: 1,
      status: v.status,
      step: v.step,
      seen: [...new Set<TourRead>(v.seen)],
      ...(v.changeId ? { changeId: v.changeId } : {}),
    };
  } catch {
    return newTour();
  }
}
// Runtime-only scope. No source content, reasons or credentials are stored in browser progress.
export const tourStorageKey = (workspace: Workspace) =>
  `ripple:sample-tour:v1:${encodeURIComponent(workspace.database.path)}`;
export function readTour(storage: Pick<Storage, 'getItem'>, key: string) {
  try {
    return parseTour(storage.getItem(key));
  } catch {
    return newTour();
  }
}
export function writeTour(storage: Pick<Storage, 'setItem'>, key: string, state: TourState) {
  try {
    storage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
export const sampleProposal = (workspace: Workspace) =>
  workspace.proposals.find((p) => p.id === 'supplier-daily' && p.itemId === 'A1');
export function isSampleChange(detail: ChangeDetail | undefined, proposal: Proposal | undefined) {
  return (
    !!detail &&
    !!proposal &&
    detail.change.itemId === proposal.itemId &&
    detail.change.after === proposal.after &&
    detail.change.evidenceId === proposal.evidenceId
  );
}
export async function findSampleChange(
  proposal: Proposal,
  page: (cursor?: string) => Promise<HistoryPage>,
) {
  let cursor: string | undefined;
  const visited = new Set<string>();
  for (let n = 0; n < 20; n++) {
    const result = await page(cursor);
    const match = result.entries.find(
      (e) =>
        e.kind === 'change' &&
        e.itemId === proposal.itemId &&
        e.after === proposal.after &&
        e.evidenceId === proposal.evidenceId,
    );
    if (match?.kind === 'change') return match.changeId;
    if (!result.nextCursor) return undefined;
    if (visited.has(result.nextCursor))
      throw new Error('The saved-change list repeated a page. Retry opening the walkthrough.');
    visited.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new Error(
    'The saved-change search reached its limit. Find the inventory change in History before retrying.',
  );
}
export function tourCompletion(
  state: TourState,
  detail: ChangeDetail | undefined,
  proposal: Proposal | undefined,
  history: HistoryPage | undefined,
  atStep: boolean,
  savedTransition = false,
) {
  const applied = isSampleChange(detail, proposal) && detail?.change.id === state.changeId;
  const pending = applied
    ? decisionCounts(detail!.change.snapshot.impacts, detail!.reviews).pending
    : undefined;
  const done = [
    atStep && state.seen.includes('source'),
    atStep && state.seen.includes('relationship'),
    atStep && state.seen.includes('impact'),
    applied && (atStep || savedTransition),
    applied && pending === 0 && (atStep || savedTransition),
    applied && pending === 0 && atStep,
    applied &&
      pending === 0 &&
      atStep &&
      !!history?.entries.some((e) => e.kind !== 'relationship' && e.changeId === state.changeId),
  ];
  return { applied, pending, complete: !!done[state.step] };
}
export const tourSteps = [
  {
    title: 'Read the new source',
    short: 'Source',
    task: 'Read supplier update',
    next: 'Next: Relationships',
    sourceHint: 'Look for the new update frequency: once per day at 00:00 UTC.',
    instruction:
      'The sample documents are already saved. Open the supplier update and find how often inventory arrives. No upload or new document is needed.',
    action: 'Open sample source',
    target: 'sample-source-action',
  },
  {
    title: 'Check what depends on it',
    short: 'Link',
    task: 'Check badge dependency',
    next: 'Next: Impact evidence',
    sourceHint:
      'The live badge was chosen because the supplier updated inventory in real time. That is the dependency to review.',
    instruction:
      'The live inventory badge depends on real-time API updates. Open the highlighted relationship’s original evidence to see why. The arrow points from the badge to the API it needs.',
    action: 'Go to badge evidence',
    target: 'sample-relationship',
  },
  {
    title: 'Follow the downstream evidence',
    short: 'Impact',
    task: 'Read task evidence',
    next: 'Next: Apply change',
    sourceHint:
      'This task implements the live badge decision. The API change reaches it through that decision, two links away.',
    instruction:
      'Follow the change: inventory API → live badge decision → Build inventory badge UI. Open Sprint planning · Engineering notes to read why the task depends on the badge. Affected means review it, not that it is broken.',
    action: 'Go to task evidence',
    target: 'sample-impact-evidence',
  },
  {
    title: 'Apply the sample change',
    short: 'Apply',
    task: 'Apply sample change',
    next: 'Next: Review items',
    sourceHint: '',
    instruction:
      'Compare real-time inventory with the proposed daily snapshot. Use “Apply & start review” to save the change and preserve its original paths. This writes to the local sample workspace.',
    action: 'Go to Apply',
    target: 'sample-apply',
  },
  {
    title: 'Record a decision for each item',
    short: 'Decide',
    task: 'Review affected items',
    next: 'Next: Decision brief',
    sourceHint: '',
    instruction:
      'Choose Keep, Revise or Defer, write your own reason, then use “Save & continue”. Work through all affected items. Saving records a decision; implementation remains open.',
    action: 'Go to decision form',
    target: 'studio-decision',
  },
  {
    title: 'Read the saved decision brief',
    short: 'Brief',
    task: 'Read decision brief',
    next: 'Next: History',
    sourceHint: '',
    instruction:
      'Check the decisions, owners, reasons and preserved paths. You can download the Markdown brief. When you have read it, continue to History.',
    action: 'Read saved brief',
    target: 'sample-brief',
  },
  {
    title: 'Find the record in History',
    short: 'History',
    task: 'Check saved history',
    next: 'Finish walkthrough',
    sourceHint: '',
    instruction:
      'The history is filtered to the inventory assumption. Find its applied change and saved decisions. Expand “Compare before and after” or open the original evidence to trace what happened.',
    action: 'View saved events',
    target: 'sample-history',
  },
] as const;
