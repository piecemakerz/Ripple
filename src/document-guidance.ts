import type { Evidence, Workspace } from '../shared/types.js';

// Readiness describes this draft, never completion inferred from sample workspace totals.
export function changePreparation(
  workspace: Workspace,
  targetId: string,
  evidence: Omit<Evidence, 'id'> | undefined,
  after: string,
) {
  const target = workspace.items.find((item) => item.id === targetId);
  const missing: string[] = [];
  if (!target) missing.push('Choose the existing item whose description has changed.');
  if (!evidence) missing.push('Choose an exact quote that supports the update.');
  if (!after.trim()) missing.push('Write the updated description.');
  else if (target?.body === after.trim())
    missing.push('Change the description; it is still the same as the saved item.');
  return {
    target,
    missing,
    ready: missing.length === 0,
    confirmed: workspace.dependencies.filter(
      (edge) => edge.to === targetId && edge.status === 'confirmed',
    ).length,
    pending: workspace.candidates.filter(
      (edge) => edge.to === targetId && edge.status === 'proposed',
    ).length,
  };
}
