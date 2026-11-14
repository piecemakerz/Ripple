import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { RippleStore } from '../server/store.js';
import { Ingestion } from '../server/ingestion.js';
import { createApp } from '../server/app.js';
import { digest } from '../server/sample.js';
import { evidenceMatches } from '../shared/evidence-selection.js';

test('pasted multiline evidence preserves original CRLF, repeated occurrences and UTF-16 positions', () => {
  const text = '\ufeff😀\r\nfirst\r\nsecond\r\nfirst\r\nsecond';
  const matches = evidenceMatches(text, 'first\nsecond');
  assert.equal(matches.length, 2);
  assert.equal(matches[0].start, 5);
  for (const m of matches) {
    assert.equal(m.quote, 'first\r\nsecond');
    assert.equal(text.slice(m.start, m.end), m.quote);
  }
  assert.deepEqual(evidenceMatches(text, 'absent'), []);
});

const request = () => ({ requestId: randomUUID() });
function setup() {
  const store = new RippleStore(':memory:');
  store.seed();
  const ingest = new Ingestion(store);
  const input = {
    ...request(),
    expectedVersion: 0,
    title: '한글 source',
    text: '😀\r\nBadge depends on inventory.\r\nBadge depends on inventory.\r\nInventory refreshes daily.',
  };
  const source = ingest.source(input);
  const quote = 'Badge depends on inventory.';
  const start = source.text.lastIndexOf(quote);
  const evidence = { sourceId: source.id, start, end: start + quote.length, quote };
  return { store, ingest, source, input, evidence };
}
test('immutable versions, UTF-16/repeated quotes, idempotency and version conflicts', () => {
  const { store, ingest, source, input, evidence } = setup();
  assert.deepEqual(ingest.source(input), source);
  assert.equal(source.hash, digest(input.text));
  assert.throws(() => ingest.source({ ...input, text: 'other' }), /different input/);
  const next = ingest.source({
    ...request(),
    documentId: source.documentId,
    expectedVersion: 1,
    title: 'New title',
    text: 'New content',
  });
  assert.equal(next.version, '2');
  assert.throws(
    () =>
      ingest.source({ ...input, ...request(), documentId: source.documentId, expectedVersion: 1 }),
    /newer source/,
  );
  const item = ingest.item({
    ...request(),
    kind: 'Task',
    title: "x' MATCH (n) DELETE n",
    body: 'Badge work',
    owner: 'Me',
    evidence,
  });
  const row = store.query('MATCH (:Item {id:$id})-[:EVIDENCED_BY]->(e) RETURN e.id AS id', {
    id: item.id,
  }).rows[0];
  const saved = store.getEvidence(row.id as string);
  assert.equal(saved.start, input.text.lastIndexOf(evidence.quote));
  assert.equal(saved.source.text, input.text);
  assert.equal(saved.source.hash, source.hash);
  assert.equal(store.workspace().sources.find((s) => s.id === source.id)!.text, input.text);
});
test('manual candidate confirmation connects to native impact, snapshots and per-change reviews', () => {
  const { store, ingest, evidence } = setup();
  const item = ingest.item({
    ...request(),
    kind: 'Task',
    title: 'Imported badge',
    body: 'Implement badge',
    owner: 'Me',
    evidence,
  });
  const input = { ...request(), from: item.id, to: 'A1', fromRevision: 1, toRevision: 1, evidence };
  const candidate = ingest.candidate(input);
  assert.deepEqual(ingest.candidate(input), candidate);
  assert.equal(store.impact('A1').impacts.length, 4);
  assert.throws(() => ingest.candidate({ ...input, ...request() }), /already exists/);
  const decision = { ...request(), expectedRevision: 1, status: 'confirmed' };
  const confirmed = ingest.decide(candidate.id, decision);
  assert.deepEqual(ingest.decide(candidate.id, decision), confirmed);
  assert.equal(store.impact('A1').impacts.length, 5);
  assert.equal(
    store.impact('A1').impacts.find((i) => i.item.id === item.id)!.paths[0].edges[0].evidence!
      .quote,
    evidence.quote,
  );
  const p = ingest.proposal({
    ...request(),
    itemId: 'A1',
    expectedRevision: 1,
    after: 'Daily inventory',
    evidence,
  });
  const change = store.applyChange({
    ...request(),
    itemId: 'A1',
    expectedRevision: p.expectedRevision!,
    after: p.after,
    evidenceId: p.evidenceId,
  });
  assert.equal(change.reviews.length, 5);
  store.saveReview(change.change.id, item.id, 'revise', 'Adapt the imported badge.');
  assert.equal(
    store.getChange(change.change.id).reviews.find((r) => r.itemId === item.id)!.history.length,
    1,
  );
  assert.throws(
    () =>
      ingest.proposal({
        ...request(),
        itemId: 'A1',
        expectedRevision: 1,
        after: 'Newer',
        evidence,
      }),
    /item changed/,
  );
  assert.equal(change.change.snapshot.target.revision, 1);
});

test('an entirely imported assumption and task can run the existing change/review flow', () => {
  const { store, ingest, evidence } = setup();
  const root = ingest.item({
    ...request(),
    kind: 'Assumption',
    title: 'Imported root',
    body: 'Original assumption',
    owner: 'Me',
    evidence,
  });
  const task = ingest.item({
    ...request(),
    kind: 'Task',
    title: 'Imported task',
    body: 'Dependent task',
    owner: 'Me',
    evidence,
  });
  const candidate = ingest.candidate({
    ...request(),
    from: task.id,
    to: root.id,
    fromRevision: 1,
    toRevision: 1,
    evidence,
  });
  ingest.decide(candidate.id, { ...request(), expectedRevision: 1, status: 'confirmed' });
  const p = ingest.proposal({
    ...request(),
    itemId: root.id,
    expectedRevision: 1,
    after: 'Updated imported assumption',
    evidence,
  });
  const saved = store.applyChange({
    ...request(),
    itemId: root.id,
    expectedRevision: 1,
    after: p.after,
    evidenceId: p.evidenceId,
  });
  assert.deepEqual(
    saved.change.snapshot.impacts.map((i) => i.item.id),
    [task.id],
  );
  assert.equal(store.getItem(root.id).revision, 2);
  assert.equal(
    store.saveReview(saved.change.id, task.id, 'defer', 'Check the imported assumption.').reviews[0]
      .status,
    'defer',
  );
});
test('reject, stale endpoints, conflicting decisions and invalid evidence cannot confirm a dependency', () => {
  const { store, ingest, evidence } = setup();
  const input = { ...request(), from: 'T3', to: 'A1', fromRevision: 1, toRevision: 1, evidence };
  assert.throws(() => ingest.candidate({ ...input, from: 'A1' }), /different items/);
  assert.throws(() => ingest.candidate({ ...input, evidence: { ...evidence, start: 0 } }), /exact/);
  const candidate = ingest.candidate(input);
  const p = ingest.proposal({
    ...request(),
    itemId: 'A1',
    expectedRevision: 1,
    after: 'Daily inventory',
    evidence,
  });
  store.applyChange({
    ...request(),
    itemId: 'A1',
    expectedRevision: 1,
    after: p.after,
    evidenceId: p.evidenceId,
  });
  assert.throws(
    () => ingest.decide(candidate.id, { ...request(), expectedRevision: 1, status: 'confirmed' }),
    /item changed/,
  );
  ingest.decide(candidate.id, { ...request(), expectedRevision: 1, status: 'rejected' });
  assert.throws(
    () => ingest.decide(candidate.id, { ...request(), expectedRevision: 1, status: 'confirmed' }),
    /already been reviewed/,
  );
  assert.equal(store.impact('A1').impacts.length, 4);
  assert.equal(store.workspace().candidates[0].status, 'rejected');
});
test('failure after evidence/item writes rolls back all records including request receipts', () => {
  const { store, ingest, evidence } = setup();
  const before = store.query('MATCH (n) RETURN count(n) AS n').rows[0].n;
  const original = store.query.bind(store);
  store.query = (query, params) => {
    if (query.startsWith('CREATE (:Mutation')) throw new Error('Injected receipt failure');
    return original(query, params);
  };
  const input = {
    ...request(),
    kind: 'Task',
    title: 'Rollback',
    body: 'Rollback',
    owner: 'New owner',
    evidence,
  };
  assert.throws(() => ingest.item(input), /Injected/);
  store.query = original;
  assert.equal(store.query('MATCH (n) RETURN count(n) AS n').rows[0].n, before);
  assert.equal(ingest.item(input).revision, 1);
});
test('version-1 migration is additive and preserves previous changes and evidence', () => {
  const { store } = setup();
  store.query('MATCH (m:RippleMeta) SET m.version=1');
  const before = store.workspace();
  store.seed();
  store.seed();
  assert.deepEqual(store.workspace(), before);
  assert.equal(store.query('MATCH (m:RippleMeta) RETURN m.version AS version').rows[0].version, 2);
});
test('ingestion HTTP validation, size limits and cross-origin protections', async () => {
  const { store, evidence } = setup();
  const server = createApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const send = (path: string, body: unknown, origin?: string) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify(body),
    });
  try {
    const input = { ...request(), title: 'Test', expectedVersion: 0, text: 'Text' };
    assert.equal((await send('/api/sources', { ...input, text: ' ' })).status, 400);
    assert.equal((await send('/api/sources', { ...input, text: 'a'.repeat(20001) })).status, 400);
    assert.equal((await send('/api/sources', input, 'https://other.example')).status, 403);
    const first = await (await send('/api/sources', input)).json();
    assert.equal((await (await send('/api/sources', input)).json()).id, first.id);
    assert.equal(
      (
        await send('/api/items', {
          ...request(),
          kind: 'Task',
          title: 'Task',
          body: 'Body',
          owner: 'Me',
          evidence: { ...evidence, end: -1 },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send('/api/candidates', {
          ...request(),
          from: 'T3',
          to: 'A1',
          fromRevision: 1,
          toRevision: 1,
          evidence,
          status: 'confirmed',
        })
      ).status,
      400,
    );
    for (let i = store.workspace().sources.length; i < 50; i++)
      store.query(
        'CREATE (:SourceVersion {id:$id, documentId:$id, version:$v, title:$title, text:$text, hash:$hash})',
        { id: randomUUID(), v: '1', title: 'limit', text: 'text', hash: digest('text') },
      );
    assert.equal((await send('/api/sources', { ...input, ...request() })).status, 422);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
