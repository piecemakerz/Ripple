import assert from 'node:assert/strict';
import { RippleStore } from '../server/store.js';
import { proposal } from '../server/sample.js';
const [mode, path] = process.argv.slice(2);
if (!path || !['write', 'read', 'wal-write', 'wal-read'].includes(mode))
  throw new Error('Usage: persistence-worker.ts <mode> <isolated-db-path>');
const store = new RippleStore(path);
const requestId = '96c03eb5-7f01-48b0-a991-74d19d29a44e';
if (mode === 'write' || mode === 'wal-write') {
  store.seed();
  const saved = store.applyChange({
    requestId,
    itemId: 'A1',
    expectedRevision: 1,
    after: proposal.after,
    evidenceId: proposal.evidenceId,
  });
  store.saveReview(
    saved.change.id,
    'T1',
    'revise',
    'Use a daily snapshot badge with its last update time.',
  );
  store.conn.begin();
  store.query("CREATE (:Item {id:'rolled-back'})");
  store.conn.rollback();
  if (mode === 'write') store.checkpoint();
} else {
  const workspace = store.workspace();
  assert.equal(store.getItem('A1').revision, 2);
  assert.equal(workspace.changes.length, 1);
  assert.equal(workspace.changes[0].requestId, requestId);
  const saved = store.getChange(workspace.changes[0].id);
  assert.equal(saved.reviews.find((r) => r.itemId === 'T1')!.status, 'revise');
  assert.equal(saved.reviews.find((r) => r.itemId === 'T1')!.history.length, 1);
  assert.equal(saved.change.snapshot.target.revision, 1);
  assert.equal(saved.change.snapshot.impacts.length, 4);
  assert.equal(store.query("MATCH (i:Item {id:'rolled-back'}) RETURN i").rows.length, 0);
}
assert.deepEqual(
  store
    .impact('A1')
    .impacts.map((i) => i.item.id)
    .sort(),
  ['D1', 'D2', 'T1', 'T2'],
);
console.log(
  JSON.stringify({
    mode,
    ok: true,
    engine: 'Relate',
    version: '1.0.1',
    impactIds: ['D1', 'D2', 'T1', 'T2'],
    excluded: 'T3',
    path,
  }),
);
