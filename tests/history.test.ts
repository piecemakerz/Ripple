import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { RippleStore } from '../server/store.js';
import { Ingestion } from '../server/ingestion.js';
import { readHistory } from '../server/history.js';
import { createApp } from '../server/app.js';
import { proposal } from '../server/sample.js';

function setup() {
  const store = new RippleStore(':memory:');
  store.seed();
  const first = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 1,
    after: proposal.after,
    evidenceId: proposal.evidenceId,
  });
  store.saveReview(first.change.id, 'T1', 'revise', 'Show daily freshness 😀');
  store.saveReview(first.change.id, 'T1', 'defer', 'Await supplier confirmation');
  store.saveReview(first.change.id, 'T1', 'defer', 'Await supplier confirmation');
  store.saveReview(first.change.id, 'T2', 'keep', 'Still valid');
  const ingest = new Ingestion(store);
  const e = store.getEvidence('E-D1-A1');
  const evidence = { sourceId: e.sourceId, start: e.start, end: e.end, quote: e.quote };
  const replacement = ingest.replace('R-D1-A1', {
    requestId: randomUUID(),
    expectedRevision: 1,
    from: 'D1',
    to: 'T3',
    fromRevision: 1,
    toRevision: 1,
    evidence,
    reason: 'Correct prerequisite',
  });
  const next = ingest.replace(replacement.id, {
    requestId: randomUUID(),
    expectedRevision: 1,
    from: 'T3',
    to: 'T1',
    fromRevision: 1,
    toRevision: 1,
    evidence,
    reason: 'Correct both endpoints',
  });
  const second = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 2,
    after: 'A newer schedule',
    evidenceId: proposal.evidenceId,
  });
  return { store, first, second, replacement, next };
}

test('a change with no impacted items is retained and searchable without creating review events', () => {
  const store = new RippleStore(':memory:');
  store.seed();
  const saved = store.applyChange({
    requestId: randomUUID(),
    itemId: 'T3',
    expectedRevision: 1,
    after: 'An isolated account recovery update.',
    evidenceId: proposal.evidenceId,
  });
  const page = readHistory(store, { itemId: 'T3', kind: 'change' });
  assert.equal(page.entries.length, 1);
  assert.equal(page.entries[0].id, `change:${saved.change.id}`);
  assert.deepEqual(page.entries[0].itemIds, ['T3']);
  assert.equal(readHistory(store, { kind: 'review' }).entries.length, 0);
  assert.equal(readHistory(store, { itemId: 'A1' }).entries.length, 0);
});

test('history joins real saved changes, every review event and both replacement generations without rewriting snapshots', () => {
  const { store, first, second, replacement, next } = setup();
  const before = store.getChange(first.change.id);
  const page = readHistory(store, {});
  assert.equal(page.entries.length, 7);
  assert.equal(page.nextCursor, null);
  for (const entry of page.entries)
    assert.deepEqual(
      readHistory(store, { q: entry.id }).entries.map((e) => e.id),
      [entry.id],
    );
  assert.deepEqual(
    readHistory(store, { kind: 'change', q: 'Build inventory badge UI' }).entries.map((e) => e.id),
    [`change:${first.change.id}`],
  );
  assert.equal(page.entries.filter((e) => e.kind === 'review').length, 3);
  const changes = readHistory(store, { kind: 'change', itemId: 'T1' }).entries;
  assert.deepEqual(
    changes.map((e) => e.id),
    [`change:${first.change.id}`],
  );
  assert.equal(readHistory(store, { kind: 'change', itemId: 'T3' }).entries.length, 0);
  assert.equal(readHistory(store, { itemId: 'A1' }).entries.length, 6);
  assert.equal(readHistory(store, { kind: 'review', itemId: 'T1' }).entries.length, 2);
  assert.equal(readHistory(store, { kind: 'review', itemId: 'D1' }).entries.length, 0);
  const oldDecision = readHistory(store, {
    status: 'revise',
    itemId: 'T1',
    q: 'FRESHNESS 😀',
  }).entries;
  assert.equal(oldDecision.length, 1);
  assert.ok(oldDecision[0].kind === 'review');
  assert.equal(oldDecision[0].status, 'revise');
  assert.equal(before.reviews.find((r) => r.itemId === 'T1')!.status, 'defer');
  const relations = readHistory(store, { kind: 'relationship', itemId: 'D1' }).entries;
  assert.equal(relations.length, 2);
  assert.ok(relations.every((r) => r.kind === 'relationship'));
  assert.ok(
    relations.some((r) => r.replacement.id === replacement.id && r.previous.id === 'R-D1-A1'),
  );
  assert.ok(
    relations.some((r) => r.replacement.id === next.id && r.previous.id === replacement.id),
  );
  assert.equal(readHistory(store, { kind: 'relationship', itemId: 'T1' }).entries.length, 1);
  assert.equal(readHistory(store, { q: 'Correct both' }).entries.length, 1);
  assert.equal(
    readHistory(store, { q: 'A newer schedule', kind: 'change' }).entries[0].id,
    `change:${second.change.id}`,
  );
  assert.equal(readHistory(store, { q: "' OR 1=1 //" }).entries.length, 0);
  assert.deepEqual(store.getChange(first.change.id), before);
  assert.ok(page.entries.every((e) => !('snapshot' in e)));
});

test('cursor pages are complete and deterministic at equal timestamps; filters precede pagination and dates are half-open', () => {
  const { store } = setup();
  const time = '2026-11-14T00:00:00.000Z';
  for (const label of ['Change', 'ReviewEvent'])
    store.query(`MATCH (n:${label}) SET n.createdAt=$time`, { time });
  store.query('MATCH ()-[r:DEPENDS_ON]->() WHERE r.supersedes IS NOT NULL SET r.createdAt=$time', {
    time,
  });
  const all = readHistory(store, {}).entries;
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = readHistory(store, { limit: 2, ...(cursor ? { cursor } : {}) });
    ids.push(...page.entries.map((e) => e.id));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  assert.deepEqual(
    ids,
    all.map((e) => e.id),
  );
  assert.equal(new Set(ids).size, 7);
  assert.equal(readHistory(store, { q: 'daily freshness', limit: 1 }).entries.length, 1);
  assert.equal(
    readHistory(store, { from: time, until: '2026-11-15T00:00:00.000Z' }).entries.length,
    7,
  );
  assert.equal(readHistory(store, { until: time }).entries.length, 0);
  assert.equal(readHistory(store, { from: '2026-11-14T00:00:00.001Z' }).entries.length, 0);
  assert.equal(readHistory(store, { itemId: 'unknown' }).entries.length, 0);
  assert.equal(readHistory(store, { itemId: "' OR true" }).entries.length, 0);
  // New events above a cursor do not shift the remaining page.
  const firstPage = readHistory(store, { limit: 2 });
  const restBefore = readHistory(store, { cursor: firstPage.nextCursor! }).entries;
  const changeId = store.workspace().changes[0].id;
  store.saveReview(changeId, 'D2', 'revise', 'New event after paging began');
  store.query('MATCH (h:ReviewEvent) WHERE h.reason=$reason SET h.createdAt=$time', {
    reason: 'New event after paging began',
    time: '2026-11-15T00:00:00.000Z',
  });
  assert.deepEqual(readHistory(store, { cursor: firstPage.nextCursor! }).entries, restBefore);
});

test('history HTTP validates filters, cursor, ranges and page bounds, with empty seed and encoded Unicode searches', async () => {
  const { store } = setup();
  const fresh = new RippleStore(':memory:');
  fresh.seed();
  assert.deepEqual(readHistory(fresh, {}).entries, []);
  const server = createApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/history`;
  try {
    for (const query of [
      'kind=other',
      'status=pending',
      'kind=change&status=keep',
      'limit=0',
      'limit=51',
      'limit=2.5',
      'cursor=bad',
      'from=2026-02-30T00%3A00%3A00.000Z',
      'from=2026-11-15T00%3A00%3A00.000Z&until=2026-11-14T00%3A00%3A00.000Z',
      'q=a&q=b',
      'unknown=value',
      `q=${'a'.repeat(201)}`,
    ])
      assert.equal((await fetch(`${base}?${query}`)).status, 400, query);
    const response = await fetch(
      `${base}?${new URLSearchParams({ q: 'freshness 😀', status: 'revise' })}`,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).entries.length, 1);
    const first = await (await fetch(`${base}?limit=1`)).json();
    const second = await (
      await fetch(`${base}?${new URLSearchParams({ limit: '1', cursor: first.nextCursor })}`)
    ).json();
    assert.notEqual(first.entries[0].id, second.entries[0].id);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
