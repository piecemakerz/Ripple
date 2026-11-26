import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { RippleStore } from '../server/store.js';
import { proposal } from '../server/sample.js';
import { canApplyPreview, canShowFirstLook } from '../src/first-look.js';

test('first encounter uses real native impacts and leaves original records untouched until explicit apply', () => {
  const store = new RippleStore(':memory:');
  store.seed();
  const workspace = store.workspace();
  const result = store.impact('A1');
  const selection = 'proposal:supplier-daily';
  assert.equal(canShowFirstLook(workspace, result, selection), true);
  assert.equal(canApplyPreview(workspace, result, selection), true);
  assert.deepEqual(result.impacts.map((i) => i.item.id).sort(), ['D1', 'D2', 'T1', 'T2']);
  assert.deepEqual(
    result.excluded.map((i) => i.id),
    ['T3'],
  );
  for (const impact of result.impacts)
    for (const path of impact.paths)
      for (const edge of path.edges) {
        assert.ok(edge.evidence);
        assert.equal(
          edge.evidence.source.text.slice(edge.evidence.start, edge.evidence.end),
          edge.evidence.quote,
        );
      }
  assert.deepEqual(store.workspace(), workspace);
  const saved = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 1,
    after: proposal.after,
    evidenceId: proposal.evidenceId,
  });
  assert.equal(saved.reviews.length, 4);
  assert.ok(saved.reviews.every((r) => r.status === 'pending'));
  assert.equal(canShowFirstLook(store.workspace(), store.impact('A1'), selection), false);
  assert.equal(canApplyPreview(store.workspace(), result, selection), false);
  assert.deepEqual(saved.change.snapshot, result);
});

test('intro and both apply controls reject mismatched, stale, missing and incomplete previews', () => {
  const store = new RippleStore(':memory:');
  store.seed();
  const workspace = store.workspace();
  const result = store.impact('A1');
  const selection = 'proposal:supplier-daily';
  assert.equal(canApplyPreview(workspace, undefined, selection), false);
  assert.equal(canApplyPreview(undefined, result, selection), false);
  assert.equal(canApplyPreview(workspace, result, 'saved-change'), false);
  assert.equal(canApplyPreview(workspace, store.impact('D1'), selection), false);
  assert.equal(canApplyPreview(workspace, { ...result, limited: true }, selection), false);
  assert.equal(
    canApplyPreview(workspace, { ...result, warnings: ['incomplete'] }, selection),
    false,
  );
  assert.equal(
    canApplyPreview(
      workspace,
      { ...result, impacts: result.impacts.map((i) => ({ ...i, evidenceComplete: false })) },
      selection,
    ),
    false,
  );
  const stale = structuredClone(workspace);
  stale.proposals[0].expectedRevision = 2;
  assert.equal(canApplyPreview(stale, result, selection), false);
  // A valid zero-impact preview remains a real change, not a fabricated four-item result.
  assert.equal(canApplyPreview(workspace, { ...result, impacts: [] }, selection), true);
  const changed = structuredClone(workspace);
  changed.proposals[0].after = 'A different update';
  assert.equal(canShowFirstLook(changed, result, selection), false);
  assert.equal(
    canShowFirstLook(
      workspace,
      { ...result, target: { ...result.target, body: 'Custom content' } },
      selection,
    ),
    false,
  );
  assert.equal(canShowFirstLook(workspace, result, 'proposal:custom'), false);
});
