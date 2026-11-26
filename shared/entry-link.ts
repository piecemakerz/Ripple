import type { Workspace } from './types.js';

const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const changePattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const entryWarning =
  'This link does not identify an available update in this workspace. The latest change or example is shown.';

// Links select existing data only; loading a URL must never apply a change or save a review.
export function resolveEntry(workspace: Workspace, search: string) {
  const params = new URLSearchParams(search);
  const proposal = params.get('proposal');
  const change = params.get('change');
  const item = params.get('item');
  const fallback = workspace.changePage.entries[0]?.id ?? 'proposal:supplier-daily';
  const malformed =
    params.getAll('proposal').length > 1 ||
    params.getAll('change').length > 1 ||
    (proposal !== null && change !== null);
  let selection = fallback;
  let warning = '';
  if (malformed) warning = entryWarning;
  else if (proposal !== null) {
    if (idPattern.test(proposal) && workspace.proposals.some((p) => p.id === proposal))
      selection = `proposal:${proposal}`;
    else warning = entryWarning;
  } else if (change !== null) {
    // A valid saved change can be outside the first summary page; its API read is authoritative.
    if (changePattern.test(change)) selection = change;
    else warning = entryWarning;
  }
  return {
    selection,
    itemId: item && idPattern.test(item) && workspace.items.some((i) => i.id === item) ? item : '',
    warning,
  };
}

export function entryUrl(href: string, selection: string, itemId?: string) {
  const url = new URL(href);
  for (const name of ['proposal', 'change', 'item']) url.searchParams.delete(name);
  const isProposal = selection.startsWith('proposal:');
  url.searchParams.set(
    isProposal ? 'proposal' : 'change',
    isProposal ? selection.slice(9) : selection,
  );
  if (itemId) url.searchParams.set('item', itemId);
  return url;
}
