import type { ImpactResult, Workspace } from '../shared/types.js';
import { sampleProposal } from './sample-walkthrough.js';
import sample from './locales/sample-ko.json';

// Entry eligibility only. Impacts always come from the native API response.
export function canShowFirstLook(
  workspace: Workspace,
  result: ImpactResult | undefined,
  selection: string,
) {
  const proposal = sampleProposal(workspace);
  const original = sample.items.find((item) => item.id === 'A1')!;
  return (
    !!proposal &&
    proposal.after === sample.proposal.after &&
    proposal.evidenceId === sample.proposal.evidenceId &&
    selection === `proposal:${proposal.id}` &&
    result?.target.id === proposal.itemId &&
    result.target.revision === 1 &&
    result.target.title === original.originalTitle &&
    result.target.body === original.bodies[0].original
  );
}

export function canApplyPreview(
  workspace: Workspace | undefined,
  result: ImpactResult | undefined,
  selection: string,
) {
  const proposal = workspace?.proposals.find((p) => `proposal:${p.id}` === selection);
  const current = workspace?.items.find((i) => i.id === proposal?.itemId);
  return (
    !!proposal &&
    !!current &&
    !!result &&
    result.target.id === current.id &&
    result.target.revision === current.revision &&
    current.body !== proposal.after &&
    (proposal.expectedRevision === undefined || proposal.expectedRevision === current.revision) &&
    !result.limited &&
    result.warnings.length === 0 &&
    result.impacts.every((i) => i.evidenceComplete)
  );
}
