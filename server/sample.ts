import { createHash } from 'node:crypto';
import type { Dependency, Evidence, Item, Proposal, SourceVersion } from '../shared/types.js';

export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const source = (
  id: string,
  documentId: string,
  title: string,
  version: string,
  text: string,
): SourceVersion => ({ id, documentId, title, version, text, hash: digest(text) });
export const sources: SourceVersion[] = [
  source(
    'S-PRD-v1',
    'PRD',
    'Inventory experience · Product brief',
    '1.0',
    '# Inventory experience\n\nSynthetic demo · Product planning\n\nThe supplier API updates inventory in real time.\nWe will display a live inventory badge because the supplier API updates inventory in real time.\nWe will send out-of-stock alerts because the supplier API provides real-time inventory changes.\n\nPassword reset is part of the account recovery workstream. It does not depend on supplier inventory.\n',
  ),
  source(
    'S-PLAN-v1',
    'PLAN',
    'Sprint planning · Engineering notes',
    '1.0',
    '# Sprint planning\n\nSynthetic demo · Engineering\n\nBuild the inventory badge UI to implement the decision to display a live inventory badge.\nImplement out-of-stock alert conditions to support the decision to send inventory-change alerts.\nBuild the password reset screen independently of the inventory features.\n',
  ),
  source(
    'S-API-v2',
    'API',
    'Supplier API · Updated specification',
    '2.0',
    '# Supplier API\n\nSynthetic demo · Updated specification\n\nInventory quantities are refreshed once per day at 00:00 UTC, not in real time.\nThe API returns the most recent daily snapshot. Consumers should show the snapshot timestamp.\n',
  ),
];
const evidence = (id: string, sourceId: string, quote: string): Evidence => {
  const text = sources.find((s) => s.id === sourceId)!.text;
  const start = text.indexOf(quote);
  if (start < 0) throw new Error(`Sample quote missing: ${id}`);
  return { id, sourceId, start, end: start + quote.length, quote };
};
export const evidences = [
  evidence('E-A1', 'S-PRD-v1', 'The supplier API updates inventory in real time.'),
  evidence(
    'E-D1-A1',
    'S-PRD-v1',
    'We will display a live inventory badge because the supplier API updates inventory in real time.',
  ),
  evidence(
    'E-D2-A1',
    'S-PRD-v1',
    'We will send out-of-stock alerts because the supplier API provides real-time inventory changes.',
  ),
  evidence(
    'E-T1-D1',
    'S-PLAN-v1',
    'Build the inventory badge UI to implement the decision to display a live inventory badge.',
  ),
  evidence(
    'E-T2-D2',
    'S-PLAN-v1',
    'Implement out-of-stock alert conditions to support the decision to send inventory-change alerts.',
  ),
  evidence(
    'E-T3',
    'S-PLAN-v1',
    'Build the password reset screen independently of the inventory features.',
  ),
  evidence(
    'E-API-v2',
    'S-API-v2',
    'Inventory quantities are refreshed once per day at 00:00 UTC, not in real time.',
  ),
];
export const items: Item[] = [
  {
    id: 'A1',
    kind: 'Assumption',
    title: 'Real-time inventory updates',
    body: evidences[0].quote,
    revision: 1,
    owner: 'Alex Morgan',
  },
  {
    id: 'D1',
    kind: 'Decision',
    title: 'Display a live inventory badge',
    body: 'Show a live availability badge on the product screen.',
    revision: 1,
    owner: 'Alex Morgan',
  },
  {
    id: 'D2',
    kind: 'Decision',
    title: 'Send out-of-stock alerts',
    body: 'Notify shoppers when inventory changes to out of stock.',
    revision: 1,
    owner: 'Jamie Chen',
  },
  {
    id: 'T1',
    kind: 'Task',
    title: 'Build inventory badge UI',
    body: 'Implement the live inventory badge on product details.',
    revision: 1,
    owner: 'Jamie Chen',
  },
  {
    id: 'T2',
    kind: 'Task',
    title: 'Implement alert conditions',
    body: 'Trigger notifications from inventory changes.',
    revision: 1,
    owner: 'Sam Rivera',
  },
  {
    id: 'T3',
    kind: 'Task',
    title: 'Build password reset screen',
    body: 'Implement account recovery independently of inventory.',
    revision: 1,
    owner: 'Jamie Chen',
  },
];
export const dependencies: Dependency[] = [
  { id: 'R-D1-A1', from: 'D1', to: 'A1', status: 'confirmed', evidenceId: 'E-D1-A1' },
  { id: 'R-D2-A1', from: 'D2', to: 'A1', status: 'confirmed', evidenceId: 'E-D2-A1' },
  { id: 'R-T1-D1', from: 'T1', to: 'D1', status: 'confirmed', evidenceId: 'E-T1-D1' },
  { id: 'R-T2-D2', from: 'T2', to: 'D2', status: 'confirmed', evidenceId: 'E-T2-D2' },
];
export const proposal: Proposal = {
  id: 'supplier-daily',
  itemId: 'A1',
  title: 'Supplier inventory refresh',
  after: evidences[6].quote,
  evidenceId: 'E-API-v2',
};
export function validateEvidence(e: Evidence, s: SourceVersion) {
  if (
    s.id !== e.sourceId ||
    !Number.isInteger(e.start) ||
    !Number.isInteger(e.end) ||
    e.start < 0 ||
    e.end <= e.start ||
    e.end > s.text.length ||
    s.text.slice(e.start, e.end) !== e.quote ||
    digest(s.text) !== s.hash
  ) {
    throw new Error(`Evidence ${e.id} does not match its immutable source version`);
  }
}
