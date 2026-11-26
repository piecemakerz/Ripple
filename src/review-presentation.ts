import type { Impact, ReviewStatus } from '../shared/types.js';

export type ReviewDraft = {
  status: Exclude<ReviewStatus, 'pending'> | '';
  reason: string;
  expectedRevision?: number;
};

export function updateReviewDraft(
  entries: Record<string, ReviewDraft>,
  key: string,
  baseline: ReviewDraft,
  saved: { status: ReviewStatus; reason: string } | undefined,
  patch: Partial<ReviewDraft>,
) {
  // Consecutive input events may share a render. Merge with the latest queued state.
  const next = { ...(entries[key] ?? baseline), ...patch };
  const updated = { ...entries, [key]: next };
  if (
    reviewDraftState(next, saved).unchanged ||
    ((!saved || saved.status === 'pending') && !next.status && !next.reason)
  )
    delete updated[key];
  return updated;
}

export function reviewDraftState(
  draft: ReviewDraft,
  saved: { status: ReviewStatus; reason: string } | undefined,
) {
  const reason = draft.reason.trim();
  const recorded = !!saved && saved.status !== 'pending';
  const unchanged = recorded && draft.status === saved.status && reason === saved.reason;
  return {
    unchanged,
    canSave: !!draft.status && !!reason && !unchanged,
    message: !draft.status
      ? 'Choose Keep, Revise or Defer before saving.'
      : unchanged
        ? 'Decision saved'
        : recorded || reason
          ? 'Unsaved changes'
          : 'Add a reason to save your decision',
  };
}

export function selectionAfterApply(impacts: Impact[], preferred: string | undefined) {
  return (
    impacts.find((impact) => impact.item.id === preferred)?.item.id ?? impacts[0]?.item.id ?? ''
  );
}

export interface PathChoice {
  itemId: string;
  index: number;
}

// A highlight identifies an actual saved path, not all edges between its nodes.
export function highlightedPath(impact: Impact | undefined, choice: PathChoice | undefined) {
  const index =
    choice && impact && choice.itemId === impact.item.id && impact.paths[choice.index]
      ? choice.index
      : 0;
  const path = impact?.paths[index];
  return {
    index,
    nodes: new Set(path?.nodes.map((node) => node.id)),
    edges: new Set(path?.edges.map((edge) => edge.id)),
  };
}
