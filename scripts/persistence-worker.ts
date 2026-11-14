import assert from 'node:assert/strict';
import { RippleStore } from '../server/store.js';
import { proposal } from '../server/sample.js';
import { Ingestion } from '../server/ingestion.js';
import { readHistory } from '../server/history.js';
const [mode, path] = process.argv.slice(2);
if (!path || !['write', 'read', 'wal-write', 'wal-read'].includes(mode))
  throw new Error('Usage: persistence-worker.ts <mode> <isolated-db-path>');
const store = new RippleStore(path);
const requestId = '96c03eb5-7f01-48b0-a991-74d19d29a44e';
const ingestion = new Ingestion(store);
const sourceRequest = {
  requestId: '06c03eb5-7f01-48b0-a991-74d19d29a44e',
  expectedVersion: 0,
  title: 'Restart source',
  text: '😀 Original\r\nT3 depends on D1.',
};
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
  const source = ingestion.source(sourceRequest);
  const evidence = {
    sourceId: source.id,
    start: 13,
    end: source.text.length,
    quote: source.text.slice(13),
  };
  const candidate = ingestion.candidate({
    requestId: '16c03eb5-7f01-48b0-a991-74d19d29a44e',
    from: 'T3',
    to: 'D1',
    fromRevision: 1,
    toRevision: 1,
    evidence,
  });
  ingestion.decide(candidate.id, {
    requestId: '26c03eb5-7f01-48b0-a991-74d19d29a44e',
    expectedRevision: 1,
    status: 'rejected',
  });
  ingestion.source({
    requestId: '36c03eb5-7f01-48b0-a991-74d19d29a44e',
    documentId: source.documentId,
    expectedVersion: 1,
    title: 'Restart source',
    text: 'A newer version.',
  });
  ingestion.replace('R-T1-D1', {
    requestId: '46c03eb5-7f01-48b0-a991-74d19d29a44e',
    expectedRevision: 1,
    from: 'T1',
    to: 'D2',
    fromRevision: 1,
    toRevision: 1,
    evidence,
    reason: 'Persist the corrected prerequisite.',
  });
  if (mode === 'write') store.checkpoint();
} else {
  const workspace = store.workspace();
  assert.equal(store.getItem('A1').revision, 2);
  assert.equal(workspace.changePage.entries.length, 1);
  assert.equal(workspace.changePage.nextCursor, null);
  const saved = store.getChange(workspace.changePage.entries[0].id);
  assert.equal(saved.change.requestId, requestId);
  assert.equal('snapshot' in workspace.changePage.entries[0], false);
  assert.equal(saved.reviews.find((r) => r.itemId === 'T1')!.status, 'revise');
  assert.equal(saved.reviews.find((r) => r.itemId === 'T1')!.history.length, 1);
  assert.equal(saved.change.snapshot.target.revision, 1);
  assert.equal(saved.change.snapshot.impacts.length, 4);
  assert.equal(store.query("MATCH (i:Item {id:'rolled-back'}) RETURN i").rows.length, 0);
  assert.equal(ingestion.source(sourceRequest).text, sourceRequest.text);
  const rejected = workspace.candidates.find((c) => c.status === 'rejected')!;
  assert.ok(rejected);
  assert.equal(store.getEvidence(rejected.evidenceId).source.text, sourceRequest.text);
  assert.equal(workspace.sources.filter((s) => s.title === 'Restart source').length, 2);
  const old = workspace.dependencies.find((d) => d.id === 'R-T1-D1')!;
  const replacement = workspace.dependencies.find((d) => d.id === old.supersededBy)!;
  assert.equal(old.status, 'superseded');
  assert.equal(replacement.to, 'D2');
  assert.equal(replacement.supersedes, old.id);
  assert.equal(replacement.reason, 'Persist the corrected prerequisite.');
  const restoredEvidence = store.getEvidence(replacement.evidenceId);
  const repeated = ingestion.replace(old.id, {
    requestId: '46c03eb5-7f01-48b0-a991-74d19d29a44e',
    expectedRevision: 1,
    from: 'T1',
    to: 'D2',
    fromRevision: 1,
    toRevision: 1,
    evidence: {
      sourceId: restoredEvidence.sourceId,
      start: restoredEvidence.start,
      end: restoredEvidence.end,
      quote: restoredEvidence.quote,
    },
    reason: 'Persist the corrected prerequisite.',
  });
  assert.equal(repeated.id, replacement.id);
  assert.equal(
    saved.change.snapshot.impacts.find((i) => i.item.id === 'T1')!.paths[0].nodes[1].id,
    'D1',
  );
  assert.equal(
    store.impact('A1').impacts.find((i) => i.item.id === 'T1')!.paths[0].nodes[1].id,
    'D2',
  );
  assert.equal(store.getEvidence(old.evidenceId).id, 'E-T1-D1');
  const history = readHistory(store, { itemId: 'T1' });
  assert.equal(history.entries.length, 3);
  assert.deepEqual(
    new Set(history.entries.map((e) => e.kind)),
    new Set(['change', 'review', 'relationship']),
  );
  assert.equal(readHistory(store, { status: 'revise', q: 'daily snapshot' }).entries.length, 1);
  assert.equal(readHistory(store, { kind: 'relationship', itemId: 'D1' }).entries.length, 1);
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
