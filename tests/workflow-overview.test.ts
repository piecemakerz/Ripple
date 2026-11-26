import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { RippleStore } from '../server/store.js';
import { proposal } from '../server/sample.js';
import { workflowOverview } from '../src/workflow-overview.js';

test('workflow progress counts persisted decisions for the selected change and keeps workspace counts separate', () => {
  const store = new RippleStore(':memory:');
  store.seed();
  const detail = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 1,
    after: proposal.after,
    evidenceId: proposal.evidenceId,
  });
  const snapshot = detail.change.snapshot;
  const preview = workflowOverview(store.workspace(), snapshot, undefined, false);
  assert.equal(preview.applied, false);
  assert.equal(preview.recorded, undefined);
  assert.equal(preview.total, 4);
  assert.equal(preview.confirmed, 4);
  assert.equal(preview.metrics.review, 'Apply a change first');
  let overview = workflowOverview(store.workspace(), snapshot, detail, false);
  assert.equal(overview.recorded, 0);
  assert.equal(overview.pending, 4);
  assert.equal(overview.metrics.brief, 'Partial brief available');
  store.saveReview(detail.change.id, 'T1', {
    requestId: crypto.randomUUID(),
    expectedRevision: store.getChange(detail.change.id).reviews.find((r) => r.itemId === 'T1')!
      .revision,
    status: 'defer',
    reason: 'Wait for the delivery contract.',
  });
  overview = workflowOverview(
    store.workspace(),
    snapshot,
    store.getChange(detail.change.id),
    false,
  );
  assert.equal(overview.recorded, 1);
  assert.equal(overview.pending, 3);
  for (const id of ['D1', 'D2', 'T2'])
    store.saveReview(detail.change.id, id, {
      requestId: crypto.randomUUID(),
      expectedRevision: store.getChange(detail.change.id).reviews.find((r) => r.itemId === id)!
        .revision,
      status: 'keep',
      reason: 'Original evidence remains applicable.',
    });
  overview = workflowOverview(
    store.workspace(),
    snapshot,
    store.getChange(detail.change.id),
    false,
  );
  assert.equal(overview.recorded, 4);
  assert.equal(overview.pending, 0);
  assert.equal(overview.metrics.brief, 'Saved record available');
  const second = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 2,
    after: 'Inventory arrives twice daily.',
    evidenceId: proposal.evidenceId,
  });
  overview = workflowOverview(store.workspace(), second.change.snapshot, second, false);
  assert.equal(overview.recorded, 0);
  assert.equal(overview.pending, 4);
  assert.equal(overview.sourceCount, preview.sourceCount);
});

test('workflow withholds stale change progress while loading and discloses limited or unavailable results', () => {
  const store = new RippleStore(':memory:');
  store.seed();
  const detail = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 1,
    after: proposal.after,
    evidenceId: proposal.evidenceId,
  });
  const workspace = store.workspace();
  const loading = workflowOverview(workspace, detail.change.snapshot, detail, true);
  assert.equal(loading.selectedAvailable, false);
  assert.equal(loading.applied, false);
  assert.equal(loading.recorded, undefined);
  assert.equal(loading.changeTitle, undefined);
  const unavailable = workflowOverview(workspace, undefined, undefined, false);
  assert.equal(unavailable.total, undefined);
  assert.equal(unavailable.applied, false);
  const limited = structuredClone(detail.change.snapshot);
  limited.limited = true;
  assert.equal(workflowOverview(workspace, limited, undefined, false).limited, true);
  limited.limited = false;
  limited.warnings = ['Original evidence is unavailable.'];
  assert.equal(
    workflowOverview(workspace, limited, undefined, false).metrics.explore,
    'Check result limits',
  );
  const empty = structuredClone(detail);
  empty.change.snapshot.impacts = [];
  const noReviews = workflowOverview(workspace, empty.change.snapshot, empty, false);
  assert.equal(noReviews.metrics.review, 'No decisions needed');
  assert.equal(noReviews.recorded, 0);
  assert.equal(noReviews.metrics.brief, 'Saved record available');
});
