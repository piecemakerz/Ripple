import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { RippleStore } from '../server/store.js';
import { Ingestion } from '../server/ingestion.js';
import { createApp } from '../server/app.js';
import { proposal } from '../server/sample.js';

function setup() {
  const store = new RippleStore(':memory:');
  store.seed();
  const ingest = new Ingestion(store);
  const source = ingest.source({
    requestId: randomUUID(),
    title: 'Relationship correction',
    expectedVersion: 0,
    text: '😀\r\nD1 depends on T3.\r\nD1 depends on T3.',
  });
  const start = source.text.lastIndexOf('D1');
  const evidence = {
    sourceId: source.id,
    start,
    end: source.text.length,
    quote: source.text.slice(start),
  };
  const input = {
    requestId: randomUUID(),
    expectedRevision: 1,
    from: 'D1',
    to: 'T3',
    fromRevision: 1,
    toRevision: 1,
    evidence,
    reason: 'Correct the prerequisite.',
  };
  return { store, ingest, input };
}
test('replacement changes native impact while preserving exact original evidence, changes and review events', () => {
  const { store, ingest, input } = setup();
  const applied = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 1,
    after: proposal.after,
    evidenceId: proposal.evidenceId,
  });
  const before = store.saveReview(
    applied.change.id,
    'T1',
    'revise',
    'Keep the original review rationale.',
  );
  const original = store.getEvidence('E-D1-A1');
  const saved = ingest.replace('R-D1-A1', input);
  assert.deepEqual(ingest.replace('R-D1-A1', input), saved);
  assert.deepEqual(store.getChange(applied.change.id), before);
  assert.deepEqual(store.getEvidence('E-D1-A1'), original);
  assert.deepEqual(
    store.impact('A1').impacts.map((i) => i.item.id),
    ['D2', 'T2'],
  );
  assert.deepEqual(
    store.impact('T3').impacts.map((i) => i.item.id),
    ['D1', 'T1'],
  );
  assert.equal(store.getEvidence(saved.evidenceId).quote, input.evidence.quote);
  assert.equal(store.getEvidence(saved.evidenceId).start, input.evidence.start);
  const old = store.workspace().dependencies.find((d) => d.id === 'R-D1-A1')!;
  assert.equal(old.status, 'superseded');
  assert.equal(old.revision, 2);
  assert.equal(old.supersededBy, saved.id);
  assert.equal(saved.supersedes, old.id);
  assert.equal(saved.reason, input.reason);
  // A later change uses the new graph; previous reviews are untouched.
  const later = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 2,
    after: 'Another inventory update',
    evidenceId: proposal.evidenceId,
  });
  assert.deepEqual(
    later.reviews.map((r) => r.itemId),
    ['D2', 'T2'],
  );
  assert.deepEqual(store.getChange(applied.change.id), before);
});
test('evidence-only amendments and chained endpoint replacements retain each generation', () => {
  const { store, ingest, input } = setup();
  const first = ingest.replace('R-D1-A1', { ...input, to: 'A1' });
  assert.equal(store.impact('A1').impacts.length, 4);
  const secondInput = { ...input, requestId: randomUUID() };
  const second = ingest.replace(first.id, secondInput);
  assert.equal(second.supersedes, first.id);
  assert.equal(store.workspace().dependencies.filter((d) => d.status === 'superseded').length, 2);
  assert.equal(store.getEvidence(first.evidenceId).quote, input.evidence.quote);
  // A retry returns its original receipt even after that result was superseded.
  assert.deepEqual(ingest.replace('R-D1-A1', { ...input, to: 'A1' }), first);
  assert.throws(
    () => ingest.replace(first.id, { ...secondInput, reason: 'Different' }),
    /different input/,
  );
  assert.throws(
    () => ingest.replace(first.id, { ...input, requestId: randomUUID() }),
    /relationship changed/,
  );
  // Reversing direction can introduce a cycle; native traversal still excludes its target.
  const cycle = ingest.replace(second.id, {
    ...input,
    requestId: randomUUID(),
    from: 'D1',
    to: 'T1',
  });
  assert.equal(cycle.to, 'T1');
  assert.deepEqual(
    store.impact('D1').impacts.map((i) => i.item.id),
    ['T1'],
  );
});
test('reject stale revisions, inactive edges, duplicates, no-ops, invalid evidence and missing IDs without writes', () => {
  const { store, ingest, input } = setup();
  const before = store.workspace();
  const count = () => store.query('MATCH (n) RETURN count(n) AS n').rows[0].n;
  const nodes = count();
  const original = store.getEvidence('E-D1-A1');
  const e = {
    sourceId: original.sourceId,
    quote: original.quote,
    start: original.start,
    end: original.end,
  };
  for (const [id, payload, message] of [
    ['missing', input, /not found/],
    ['R-D1-A1', { ...input, expectedRevision: 2 }, /relationship changed/],
    ['R-D1-A1', { ...input, fromRevision: 2 }, /item changed/],
    ['R-D1-A1', { ...input, toRevision: 2 }, /item changed/],
    ['R-D1-A1', { ...input, to: 'D1' }, /different items/],
    ['R-D1-A1', { ...input, from: 'T2', to: 'D2' }, /already exists/],
    ['R-D1-A1', { ...input, to: 'A1', evidence: e }, /Change the endpoints/],
    ['R-D1-A1', { ...input, evidence: { ...input.evidence, start: 0 } }, /exact/],
  ] as const)
    assert.throws(() => ingest.replace(id, payload), message);
  assert.deepEqual(store.workspace(), before);
  assert.equal(count(), nodes);
  const candidate = ingest.candidate({
    requestId: randomUUID(),
    from: input.from,
    to: input.to,
    fromRevision: 1,
    toRevision: 1,
    evidence: input.evidence,
  });
  assert.throws(
    () => ingest.replace(candidate.id, { ...input, requestId: randomUUID() }),
    /relationship changed/,
  );
  assert.throws(
    () => ingest.replace('R-D1-A1', { ...input, requestId: randomUUID() }),
    /already exists/,
  );
});
test('failure after superseding and creating the replacement rolls back evidence, edges and receipt together', () => {
  const { store, ingest, input } = setup();
  const before = store.workspace();
  const count = () => store.query('MATCH (n) RETURN count(n) AS n').rows[0].n;
  const nodes = count();
  const query = store.query.bind(store);
  store.query = (cypher, params) => {
    if (cypher.startsWith('CREATE (:Mutation')) throw new Error('Injected receipt failure');
    return query(cypher, params);
  };
  assert.throws(() => ingest.replace('R-D1-A1', input), /Injected/);
  store.query = query;
  assert.deepEqual(store.workspace(), before);
  assert.equal(count(), nodes);
  assert.equal(store.impact('A1').impacts.length, 4);
  assert.equal(ingest.replace('R-D1-A1', input).status, 'confirmed');
});
test('a confirmed manual candidate can replace its dependent while retaining the original decision receipt', () => {
  const { store, ingest, input } = setup();
  const candidate = ingest.candidate({
    requestId: randomUUID(),
    from: 'T3',
    to: 'A1',
    fromRevision: 1,
    toRevision: 1,
    evidence: input.evidence,
  });
  const decision = { requestId: randomUUID(), expectedRevision: 1, status: 'confirmed' };
  const confirmed = ingest.decide(candidate.id, decision);
  const saved = ingest.replace(candidate.id, {
    ...input,
    expectedRevision: 2,
    from: 'T1',
    to: 'A1',
  });
  assert.equal(saved.from, 'T1');
  assert.deepEqual(ingest.decide(candidate.id, decision), confirmed);
  assert.equal(
    store.workspace().candidates.find((c) => c.id === candidate.id)!.status,
    'superseded',
  );
  assert.equal(store.workspace().dependencies.find((d) => d.id === candidate.id)!.revision, 3);
  assert.equal(store.impact('A1').impacts.find((i) => i.item.id === 'T1')!.paths.length, 2);
  assert.ok(!store.impact('A1').impacts.some((i) => i.item.id === 'T3'));
});

test('replacement HTTP validation, conflicts and historical record cap', async () => {
  const { store, input } = setup();
  const server = createApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const send = (body: unknown, origin?: string) =>
    fetch(`http://127.0.0.1:${address.port}/api/dependencies/R-D1-A1/replacements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify(body),
    });
  try {
    for (const bad of [
      { ...input, reason: ' ' },
      { ...input, expectedRevision: 0 },
      { ...input, status: 'confirmed' },
      { ...input, evidence: { ...input.evidence, end: -1 } },
    ])
      assert.equal((await send(bad)).status, 400);
    assert.equal((await send(input, 'https://other.example')).status, 403);
    const first = await send(input);
    assert.equal(first.status, 201);
    const value = await first.json();
    assert.equal((await (await send(input)).json()).id, value.id);
    assert.equal((await send({ ...input, requestId: randomUUID() })).status, 409);
    for (let i = store.workspace().dependencies.length; i < 200; i++)
      store.query(
        "MATCH (a:Item {id:'T3'}), (b:Item {id:'A1'}) CREATE (a)-[:DEPENDS_ON {id:$id, status:'superseded'}]->(b)",
        { id: randomUUID() },
      );
    const ingest = new Ingestion(store);
    assert.throws(
      () => ingest.replace('R-D2-A1', { ...input, requestId: randomUUID(), from: 'D2' }),
      /including history/,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
