import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { RippleStore } from '../server/store.js';
import { Ingestion } from '../server/ingestion.js';
import { changePreparation } from '../src/document-guidance.js';

test('personal preview readiness is scoped to a real target and evidence, not sample counts', () => {
  const store = new RippleStore(':memory:');
  store.seed();
  const workspace = store.workspace();
  const empty = changePreparation(workspace, '', undefined, '');
  assert.equal(empty.ready, false);
  assert.equal(empty.missing.length, 3);
  assert.equal(empty.confirmed, 0);
  const source = workspace.sources[0];
  const evidence = { sourceId: source.id, start: 0, end: 1, quote: source.text.slice(0, 1) };
  const body = workspace.items.find((item) => item.id === 'A1')!.body;
  const unchanged = changePreparation(workspace, 'A1', evidence, `  ${body}  `);
  assert.equal(unchanged.ready, false);
  assert.match(unchanged.missing[0], /same as the saved item/);
  assert.equal(changePreparation(workspace, 'missing', evidence, 'Updated').ready, false);
  assert.equal(changePreparation(workspace, 'A1', undefined, 'Updated').ready, false);
});

test('personal guidance distinguishes pending and confirmed dependents while allowing zero-impact previews', () => {
  const store = new RippleStore(':memory:');
  store.seed();
  const ingest = new Ingestion(store);
  const original = ingest.source({
    requestId: randomUUID(),
    expectedVersion: 0,
    title: 'Dispatch policy',
    text: 'Orders close at 16:00. Offer same-day dispatch because orders close at 16:00.',
  });
  const fact = { sourceId: original.id, start: 0, end: 21, quote: original.text.slice(0, 21) };
  const dependentEvidence = {
    sourceId: original.id,
    start: 22,
    end: original.text.length,
    quote: original.text.slice(22),
  };
  const prerequisite = ingest.item({
    requestId: randomUUID(),
    kind: 'Assumption',
    title: 'Dispatch cutoff',
    body: fact.quote,
    owner: 'Me',
    evidence: fact,
  });
  const dependent = ingest.item({
    requestId: randomUUID(),
    kind: 'Task',
    title: 'Dispatch promise',
    body: dependentEvidence.quote,
    owner: 'Me',
    evidence: dependentEvidence,
  });
  const update = ingest.source({
    requestId: randomUUID(),
    documentId: original.documentId,
    expectedVersion: 1,
    title: original.title,
    text: 'Orders now close at 14:00.',
  });
  const evidence = { sourceId: update.id, start: 0, end: update.text.length, quote: update.text };
  let readiness = changePreparation(store.workspace(), prerequisite.id, evidence, update.text);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.confirmed, 0);
  assert.equal(readiness.pending, 0);
  const candidate = ingest.candidate({
    requestId: randomUUID(),
    from: dependent.id,
    to: prerequisite.id,
    fromRevision: 1,
    toRevision: 1,
    evidence: dependentEvidence,
  });
  readiness = changePreparation(store.workspace(), prerequisite.id, evidence, update.text);
  assert.equal(readiness.confirmed, 0);
  assert.equal(readiness.pending, 1);
  ingest.decide(candidate.id, {
    requestId: randomUUID(),
    expectedRevision: 1,
    status: 'confirmed',
  });
  readiness = changePreparation(store.workspace(), prerequisite.id, evidence, update.text);
  assert.equal(readiness.confirmed, 1);
  assert.equal(readiness.pending, 0);
  assert.equal(
    changePreparation(store.workspace(), dependent.id, evidence, 'New task').confirmed,
    0,
  );
  const proposal = ingest.proposal({
    requestId: randomUUID(),
    itemId: prerequisite.id,
    expectedRevision: 1,
    after: update.text,
    evidence,
  });
  const saved = store.applyChange({
    requestId: randomUUID(),
    itemId: prerequisite.id,
    expectedRevision: 1,
    after: proposal.after,
    evidenceId: proposal.evidenceId,
  });
  assert.deepEqual(
    saved.change.snapshot.impacts.map((impact) => impact.item.id),
    [dependent.id],
  );
  const edge = saved.change.snapshot.impacts[0].paths[0].edges[0];
  assert.equal(edge.evidence?.sourceId, original.id);
  assert.equal(edge.evidence?.quote, dependentEvidence.quote);
  assert.equal(
    store.workspace().sources.find((source) => source.id === original.id)?.text,
    original.text,
  );
});
