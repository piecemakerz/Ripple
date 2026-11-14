import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { RippleStore } from '../server/store.js';
import { readChanges } from '../server/changes.js';
import { createApp } from '../server/app.js';
import type { ChangeDetail } from '../shared/types.js';

function setup() {
  const store = new RippleStore(':memory:');
  store.seed();
  return store;
}
function apply(store: RippleStore) {
  const revision = store.getItem('A1').revision;
  return store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: revision,
    after: `Inventory update ${revision}`,
    evidenceId: 'E-A1',
  });
}

test('workspace and change pages stay small across 55 real snapshots and load historical detail on demand', () => {
  const store = setup();
  assert.deepEqual(store.workspace().changePage, { entries: [], nextCursor: null, pageSize: 25 });
  const saved: ChangeDetail[] = [];
  for (let i = 0; i < 55; i++) saved.push(apply(store));
  const first = saved[0];
  const original = first.change.snapshot;
  store.saveReview(first.change.id, 'T1', 'revise', 'Preserve this original change context.');
  const workspace = store.workspace();
  assert.equal(workspace.changePage.entries.length, 25);
  assert.ok(workspace.changePage.nextCursor);
  const summaries = JSON.stringify(workspace.changePage);
  assert.ok(Buffer.byteLength(summaries) < 5000);
  const legacy = JSON.stringify(saved.map((s) => s.change));
  assert.ok(Buffer.byteLength(legacy) > Buffer.byteLength(summaries) * 20);
  for (const entry of workspace.changePage.entries) {
    assert.deepEqual(
      Object.keys(entry).sort(),
      ['id', 'itemId', 'beforeRevision', 'afterRevision', 'createdAt'].sort(),
    );
  }
  assert.equal('changes' in workspace, false);
  assert.equal(summaries.includes('Inventory update'), false);
  // A corrupt snapshot must not be decoded just to open the workspace or list summaries.
  store.query('MATCH (c:Change {id:$id}) SET c.snapshot=$snapshot', {
    id: first.change.id,
    snapshot: 'invalid JSON',
  });
  assert.equal(store.workspace().changePage.entries.length, 25);
  assert.equal(readChanges(store, { limit: '50' }).entries.length, 50);
  assert.throws(() => store.getChange(first.change.id));
  store.query('MATCH (c:Change {id:$id}) SET c.snapshot=$snapshot', {
    id: first.change.id,
    snapshot: JSON.stringify(original),
  });
  const restored = store.getChange(first.change.id);
  assert.deepEqual(restored.change.snapshot, original);
  assert.deepEqual(
    restored.change.snapshot.impacts.map((i) => i.item.id),
    ['D1', 'D2', 'T1', 'T2'],
  );
  const edge = restored.change.snapshot.impacts.find((i) => i.item.id === 'T1')!.paths[0].edges[0];
  assert.equal(
    edge.evidence!.source.text.slice(edge.evidence!.start, edge.evidence!.end),
    edge.evidence!.quote,
  );
  assert.equal(
    restored.reviews.find((r) => r.itemId === 'T1')!.history[0].reason,
    'Preserve this original change context.',
  );
  assert.equal(restored.change.beforeRevision, 1);
  assert.equal(store.getItem('A1').revision, 56);
});

test('change keyset paging covers equal timestamps exactly once and newer inserts do not shift later pages', () => {
  const store = setup();
  const ids = Array.from({ length: 52 }, () => apply(store).change.id)
    .sort()
    .reverse();
  store.query('MATCH (c:Change) SET c.createdAt=$time', { time: '2026-11-14T00:00:00.000Z' });
  const first = readChanges(store);
  assert.deepEqual(
    first.entries.map((e) => e.id),
    ids.slice(0, 25),
  );
  const second = readChanges(store, { cursor: first.nextCursor! });
  assert.deepEqual(
    second.entries.map((e) => e.id),
    ids.slice(25, 50),
  );
  const third = readChanges(store, { cursor: second.nextCursor! });
  assert.deepEqual(
    third.entries.map((e) => e.id),
    ids.slice(50),
  );
  assert.equal(third.nextCursor, null);
  const newChange = apply(store).change;
  store.query('MATCH (c:Change {id:$id}) SET c.createdAt=$time', {
    id: newChange.id,
    time: '2026-11-15T00:00:00.000Z',
  });
  assert.deepEqual(readChanges(store, { cursor: first.nextCursor! }), second);
  assert.equal(readChanges(store).entries[0].id, newChange.id);
  assert.equal(readChanges(store, { limit: '1' }).entries.length, 1);
});

test('change HTTP validates cursor and page bounds and serves summary versus full detail contracts', async () => {
  const store = setup();
  const server = createApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  try {
    assert.deepEqual(await (await fetch(base + '/api/changes')).json(), {
      entries: [],
      nextCursor: null,
      pageSize: 25,
    });
    const saved = apply(store);
    apply(store);
    for (const query of [
      'limit=0',
      'limit=51',
      'limit=-1',
      'limit=1.5',
      'limit=abc',
      'limit=',
      'limit=1&limit=2',
      'cursor=',
      'cursor=bad!',
      'cursor=e30',
      'cursor=x&cursor=y',
      'unknown=1',
      `cursor=${encoded({ createdAt: 'bad', id: randomUUID() })}`,
      `cursor=${encoded({ createdAt: '2026-11-14T00:00:00.000Z', id: "' OR true" })}`,
      `cursor=${encoded({ createdAt: '2026-11-14T00:00:00.000Z', id: randomUUID(), extra: true })}`,
    ])
      assert.equal((await fetch(`${base}/api/changes?${query}`)).status, 400, query);
    const response = await fetch(base + '/api/changes?limit=1');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const page = await response.json();
    assert.equal(page.entries.length, 1);
    assert.equal(page.pageSize, 1);
    assert.equal('snapshot' in page.entries[0], false);
    const next = await (await fetch(base + '/api/changes?cursor=' + page.nextCursor)).json();
    assert.equal(next.entries.length, 1);
    assert.notEqual(next.entries[0].id, page.entries[0].id);
    const detail = await (await fetch(base + '/api/changes/' + saved.change.id)).json();
    assert.deepEqual(detail, saved);
    assert.equal((await fetch(base + '/api/changes/missing')).status, 404);
    const workspace = await (await fetch(base + '/api/workspace')).json();
    assert.equal(workspace.changePage.entries.length, 2);
    assert.equal('snapshot' in workspace.changePage.entries[0], false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
