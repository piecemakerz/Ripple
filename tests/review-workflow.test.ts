import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { RippleStore } from '../server/store.js';
import { proposal } from '../server/sample.js';
import {
  buildDecisionBrief,
  decisionCounts,
  nextPending,
  reviewQueue,
} from '../src/review-workflow.js';

function savedChange() {
  const store = new RippleStore(':memory:');
  store.seed();
  const detail = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 1,
    after: proposal.after,
    evidenceId: proposal.evidenceId,
  });
  return { store, detail };
}

test('guided review visits direct items first, wraps past recorded items and finishes only after all decisions are saved', () => {
  const { detail } = savedChange();
  const impacts = [...detail.change.snapshot.impacts].reverse();
  const original = structuredClone(impacts);
  assert.deepEqual(
    reviewQueue(impacts).map((impact) => impact.item.id),
    ['D1', 'D2', 'T1', 'T2'],
  );
  assert.deepEqual(impacts, original);
  assert.equal(nextPending(impacts, [], undefined)?.item.id, 'D1');
  assert.equal(nextPending(impacts, [], 'T2')?.item.id, 'D1');
  const reviews = detail.reviews.map((r) => ({ ...r, status: 'keep' as const }));
  assert.equal(nextPending(impacts, reviews, 'D1'), undefined);
  assert.equal(nextPending([], reviews), undefined);
  const missing = reviews.filter((r) => r.itemId !== 'D2');
  assert.equal(nextPending(impacts, missing, 'D1')?.item.id, 'D2');
  assert.deepEqual(decisionCounts(impacts, missing), { pending: 1, keep: 3, revise: 0, defer: 0 });
  assert.deepEqual(decisionCounts([], reviews), { pending: 0, keep: 0, revise: 0, defer: 0 });
});

test('brief uses real persisted reviews, preserves exact evidence and history, and does not mutate the change snapshot', () => {
  const { store, detail } = savedChange();
  const reason = '보류 🧭\n```md\n# literal source content\n```\nWait for the daily feed.';
  store.saveReview(detail.change.id, 'T1', {
    requestId: crypto.randomUUID(),
    expectedRevision: store.getChange(detail.change.id).reviews.find((r) => r.itemId === 'T1')!
      .revision,
    status: 'defer',
    reason: reason,
  });
  const saved = store.getChange(detail.change.id);
  const original = structuredClone(saved);
  const changeEvidence = store.getEvidence(saved.change.evidenceId);
  const markdown = buildDecisionBrief(saved, changeEvidence);
  assert.ok(markdown.includes(changeEvidence.quote));
  assert.ok(markdown.includes(changeEvidence.source.hash));
  assert.throws(
    () => buildDecisionBrief(saved, { ...changeEvidence, id: 'different-change' }),
    /does not match/,
  );
  assert.match(markdown, /1 of 4 decisions recorded\. 3 need review/);
  assert.ok(markdown.includes(reason));
  assert.ok(markdown.includes('````text\n' + reason + '\n````'));
  assert.ok(markdown.includes('T1 → D1 → A1'));
  assert.ok(markdown.includes('T2 → D2 → A1'));
  assert.match(markdown, /## Outside this ripple[\s\S]*T3/);
  assert.match(markdown, /Decision history/);
  assert.match(markdown, /Decisions do not mark implementation complete/);
  for (const impact of saved.change.snapshot.impacts)
    for (const path of impact.paths)
      for (const edge of path.edges) {
        assert.ok(markdown.includes(edge.evidence!.quote));
        assert.ok(markdown.includes(`[${edge.evidence!.start}, ${edge.evidence!.end})`));
        assert.ok(markdown.includes(edge.evidence!.source.hash));
      }
  assert.deepEqual(saved, original);
});

test('brief retains alternative paths and discloses limited traversal and missing evidence without calling exclusions safe', () => {
  const { store, detail } = savedChange();
  const snapshot = detail.change.snapshot;
  const first = snapshot.impacts[0];
  first.paths.push(structuredClone(first.paths[0]));
  snapshot.limited = true;
  snapshot.warnings = ['The path cap was reached.'];
  const missingId = first.paths[0].edges[0].id;
  for (const impact of snapshot.impacts)
    for (const path of impact.paths)
      for (const edge of path.edges) if (edge.id === missingId) edge.evidence = null;
  const markdown = buildDecisionBrief(detail, store.getEvidence(detail.change.evidenceId));
  assert.match(markdown, /Path 2:/);
  assert.match(markdown, /Evidence unavailable/);
  assert.match(markdown, /## Outside the returned results/);
  assert.match(markdown, /No conclusion about excluded items/);
  assert.ok(markdown.includes('The path cap was reached\\.'));
  assert.doesNotMatch(markdown, /No confirmed dependency path was found/);
});
