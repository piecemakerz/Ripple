import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { RippleStore } from '../server/store.js';
import { proposal } from '../server/sample.js';
import { AppError } from '../server/errors.js';
import { Ingestion } from '../server/ingestion.js';
import { newerSourceVersion } from '../shared/source-freshness.js';
import { updateReviewDraft } from '../src/review-presentation.js';

function setup() {
  const store = new RippleStore(':memory:');
  store.seed();
  const detail = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 1,
    after: proposal.after,
    evidenceId: proposal.evidenceId,
  });
  return { store, id: detail.change.id };
}
const isCode = (code: string) => (error: unknown) =>
  error instanceof AppError && error.code === code;

test('stale and ABA writes are rejected; retry identity never replays an old decision', () => {
  const { store, id } = setup();
  const first = {
    requestId: randomUUID(),
    expectedRevision: 0,
    status: 'defer' as const,
    reason: 'Wait for proof.',
  };
  store.saveReview(id, 'T1', first);
  assert.equal(
    store.saveReview(id, 'T1', first).reviews.find((r) => r.itemId === 'T1')!.history.length,
    1,
  );
  assert.throws(
    () => store.saveReview(id, 'T1', { ...first, reason: 'Reused token.' }),
    isCode('REQUEST_REUSED'),
  );
  assert.throws(
    () => store.saveReview(id, 'T1', { ...first, requestId: randomUUID(), status: 'keep' }),
    isCode('REVIEW_CONFLICT'),
  );
  store.saveReview(id, 'T1', {
    requestId: randomUUID(),
    expectedRevision: 1,
    status: 'keep',
    reason: 'Confirmed.',
  });
  store.saveReview(id, 'T1', {
    requestId: randomUUID(),
    expectedRevision: 2,
    status: 'defer',
    reason: 'Wait for proof.',
  });
  assert.throws(
    () => store.saveReview(id, 'T1', { ...first, requestId: randomUUID(), expectedRevision: 1 }),
    isCode('REVIEW_CONFLICT'),
  );
  const retried = store.saveReview(id, 'T1', first).reviews.find((r) => r.itemId === 'T1')!;
  assert.equal(retried.revision, 3);
  assert.equal(retried.history.length, 3);
  assert.equal(store.workspace().synthetic, true);
});

test('a failed review receipt rolls back status, revision and event; identical retry then succeeds', () => {
  const { store, id } = setup();
  const before = store.getChange(id);
  const input = {
    requestId: randomUUID(),
    expectedRevision: 0,
    status: 'revise' as const,
    reason: 'Change the payload.',
  };
  const query = store.query.bind(store);
  store.query = (cypher, params = {}) => {
    if (cypher.startsWith('CREATE (:Mutation')) throw new Error('Injected receipt failure');
    return query(cypher, params);
  };
  assert.throws(() => store.saveReview(id, 'T1', input), /Injected receipt failure/);
  store.query = query;
  assert.deepEqual(store.getChange(id), before);
  const saved = store.saveReview(id, 'T1', input).reviews.find((r) => r.itemId === 'T1')!;
  assert.equal(saved.revision, 1);
  assert.equal(saved.history.length, 1);
});

test('legacy reviews derive revisions from events and acquire explicit revisions without rewriting history', () => {
  const { store, id } = setup();
  store.saveReview(id, 'T1', {
    requestId: randomUUID(),
    expectedRevision: 0,
    status: 'keep',
    reason: 'Legacy decision.',
  });
  store.query('MATCH (r:Review {changeId:$id}) REMOVE r.revision', { id });
  const old = store.getChange(id).reviews.find((r) => r.itemId === 'T1')!;
  assert.equal(old.revision, 1);
  const saved = store
    .saveReview(id, 'T1', {
      requestId: randomUUID(),
      expectedRevision: 1,
      status: 'revise',
      reason: 'New guarded write.',
    })
    .reviews.find((r) => r.itemId === 'T1')!;
  assert.equal(saved.revision, 2);
  assert.ok(
    saved.history.some(
      (event) => event.id === old.history[0].id && event.reason === 'Legacy decision.',
    ),
  );
});

test('newer source signal preserves old quote and saved impact while comparing numeric versions', () => {
  const { store, id } = setup(),
    ingest = new Ingestion(store);
  const source = ingest.source({
    requestId: randomUUID(),
    expectedVersion: 0,
    title: 'Review contract',
    text: 'The worker depends on review writes.',
  });
  const quote = { sourceId: source.id, start: 0, end: source.text.length, quote: source.text };
  const candidate = ingest.candidate({
    requestId: randomUUID(),
    from: 'T3',
    to: 'A1',
    fromRevision: 1,
    toRevision: 2,
    evidence: quote,
  });
  ingest.decide(candidate.id, {
    requestId: randomUUID(),
    expectedRevision: candidate.revision,
    status: 'confirmed',
  });
  const snapshot = JSON.stringify(store.getChange(id).change.snapshot);
  const before = store.getEvidence(candidate.evidenceId);
  const latest = ingest.source({
    requestId: randomUUID(),
    expectedVersion: 1,
    documentId: source.documentId,
    title: source.title,
    text: 'The worker needs revision and request ID.',
  });
  const after = store.getEvidence(candidate.evidenceId);
  assert.deepEqual(after.source, before.source);
  assert.equal(after.quote, before.quote);
  assert.equal(after.newerSource?.id, latest.id);
  assert.equal(
    store.impact('A1').impacts.find((i) => i.item.id === 'T3')!.paths[0].edges[0].evidence
      ?.newerSource?.id,
    latest.id,
  );
  assert.equal(JSON.stringify(store.getChange(id).change.snapshot), snapshot);
  assert.equal(
    newerSourceVersion(source, [
      { ...latest, version: '10' },
      { ...latest, version: '2' },
    ])?.version,
    '10',
  );
  assert.equal(newerSourceVersion(source, [{ ...latest, documentId: 'other' }]), undefined);
});

test('editing a preserved draft keeps the revision originally read after a background refresh', () => {
  const draft = { status: 'keep' as const, reason: 'Local reason', expectedRevision: 0 };
  const next = updateReviewDraft(
    { key: draft },
    'key',
    { ...draft, expectedRevision: 2 },
    { status: 'defer', reason: 'Remote reason' },
    { reason: 'Still my draft' },
  );
  assert.equal(next.key.expectedRevision, 0);
  assert.equal(next.key.reason, 'Still my draft');
});
