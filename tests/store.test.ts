import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { RippleStore } from '../server/store.js';
import { AppError } from '../server/errors.js';
import { digest, proposal, validateEvidence } from '../server/sample.js';

function setup() {
  const s = new RippleStore(':memory:');
  s.seed();
  return s;
}
const change = (s: RippleStore, extra = {}) =>
  s.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 1,
    after: proposal.after,
    evidenceId: proposal.evidenceId,
    ...extra,
  });
const ids = (s: RippleStore) =>
  s
    .impact('A1')
    .impacts.map((i) => i.item.id)
    .sort();
const isError = (code: string) => (e: unknown) => e instanceof AppError && e.code === code;

test('sample is idempotent and native Cypher returns exact direct/indirect paths and excludes T3', () => {
  const s = setup();
  s.seed();
  assert.equal(s.workspace().items.length, 6);
  assert.deepEqual(ids(s), ['D1', 'D2', 'T1', 'T2']);
  const result = s.impact('A1');
  assert.deepEqual(
    result.impacts.map((i) => i.depth),
    [1, 1, 2, 2],
  );
  assert.deepEqual(
    result.impacts.find((i) => i.item.id === 'T1')!.paths[0].nodes.map((n) => n.id),
    ['T1', 'D1', 'A1'],
  );
  assert.deepEqual(
    result.excluded.map((i) => i.id),
    ['T3'],
  );
  for (const i of result.impacts)
    for (const p of i.paths)
      for (const edge of p.edges) {
        assert.ok(edge.evidence);
        validateEvidence(edge.evidence, edge.evidence.source);
      }
});

test('shared owner/keywords and proposed, rejected, superseded relations do not expand impact', () => {
  const s = setup();
  for (const status of ['proposed', 'rejected', 'superseded']) {
    s.query(
      'MATCH (t:Item {id:$from}), (a:Item {id:$to}) CREATE (t)-[:DEPENDS_ON {id:$status,status:$status,evidenceId:$e}]->(a)',
      { from: 'T3', to: 'A1', status, e: 'E-T3' },
    );
  }
  assert.deepEqual(ids(s), ['D1', 'D2', 'T1', 'T2']);
  assert.equal(s.impact('T3').impacts.length, 0);
  assert.throws(() => s.impact("A1' OR 1=1"), isError('ITEM_NOT_FOUND'));
});

test('cycles terminate, exclude target, and multiple paths create only one review per item', () => {
  const s = setup();
  s.query(
    "MATCH (a:Item {id:'A1'}), (t:Item {id:'T1'}) CREATE (a)-[:DEPENDS_ON {id:'cycle',status:'confirmed',evidenceId:'E-A1'}]->(t)",
  );
  s.query(
    "MATCH (t:Item {id:'T1'}), (d:Item {id:'D2'}) CREATE (t)-[:DEPENDS_ON {id:'diamond',status:'confirmed',evidenceId:'E-T1-D1'}]->(d)",
  );
  assert.deepEqual(ids(s), ['D1', 'D2', 'T1', 'T2']);
  const result = s.impact('A1');
  assert.equal(result.impacts.find((i) => i.item.id === 'T1')!.paths.length, 2);
  assert.ok(
    result.impacts.every((i) =>
      i.paths.every((p) => new Set(p.nodes.map((n) => n.id)).size === p.nodes.length),
    ),
  );
  assert.equal(change(s).reviews.length, 4);
});

test('atomic changes, idempotent retries, revision conflicts and independent second-change reviews', () => {
  const s = setup(),
    requestId = randomUUID();
  const first = change(s, { requestId });
  assert.equal(s.getItem('A1').revision, 2);
  assert.equal(change(s, { requestId }).change.id, first.change.id);
  assert.equal(s.workspace().changes.length, 1);
  assert.throws(
    () => change(s, { requestId, after: 'different request' }),
    isError('REQUEST_REUSED'),
  );
  assert.throws(() => change(s), isError('REVISION_CONFLICT'));
  assert.throws(() => change(s, { expectedRevision: 2 }), isError('NO_CHANGE'));
  s.saveReview(first.change.id, 'T1', 'revise', 'Show last updated time.');
  s.saveReview(first.change.id, 'T1', 'revise', 'Show last updated time.');
  s.saveReview(first.change.id, 'T1', 'defer', 'Waiting for product confirmation.');
  const reviewed = s.getChange(first.change.id).reviews.find((r) => r.itemId === 'T1')!;
  assert.equal(reviewed.history.length, 2);
  const second = change(s, { expectedRevision: 2, after: 'A confirmed follow-up change.' });
  assert.ok(second.reviews.every((r) => r.status === 'pending' && r.history.length === 0));
  assert.equal(
    s.getChange(first.change.id).reviews.find((r) => r.itemId === 'T1')!.status,
    'defer',
  );
  assert.equal(s.impact('A1').impacts.length, 4);
});

test('engine rollback and failed mid-change write leave no partial change or reviews', () => {
  const s = setup();
  assert.throws(() =>
    s.transaction(() => {
      s.query("CREATE (:Item {id:'rollback-probe'})");
      throw new Error('test rollback');
    }),
  );
  assert.throws(() => s.getItem('rollback-probe'), isError('ITEM_NOT_FOUND'));
  const original = s.query.bind(s);
  s.query = (q, p = {}) => {
    if (q.includes('SET i.body='))
      throw new Error('Injected failure after Change and Reviews were written');
    return original(q, p);
  };
  assert.throws(() => change(s), /Injected failure/);
  s.query = original;
  assert.equal(s.getItem('A1').revision, 1);
  assert.equal(s.workspace().changes.length, 0);
  assert.equal(s.query('MATCH (r:Review) RETURN r').rows.length, 0);
});

test('snapshot preserves original item content, paths, evidence and source after graph edits', () => {
  const s = setup();
  const first = change(s);
  const before = JSON.stringify(first.change.snapshot);
  s.query("MATCH ()-[r:DEPENDS_ON {id:'R-T1-D1'}]->() SET r.status='superseded'");
  assert.ok(!ids(s).includes('T1'));
  assert.equal(JSON.stringify(s.getChange(first.change.id).change.snapshot), before);
  assert.equal(first.change.snapshot.target.revision, 1);
  assert.notEqual(first.change.snapshot.target.body, s.getItem('A1').body);
});

test('missing/invalid evidence is disclosed and blocks applying an ungrounded change', () => {
  const s = setup();
  s.query("MATCH ()-[r:DEPENDS_ON {id:'R-T1-D1'}]->() SET r.evidenceId='missing'");
  assert.equal(s.impact('A1').impacts.find((i) => i.item.id === 'T1')!.evidenceComplete, false);
  assert.throws(() => change(s), isError('INCOMPLETE_IMPACT'));
  assert.equal(s.getItem('A1').revision, 1);
  s.query("MATCH (s:SourceVersion {id:'S-API-v2'}) SET s.text='tampered'");
  assert.throws(() => s.getEvidence('E-API-v2'), isError('EVIDENCE_INVALID'));
});

test('UTF-16 quote offsets and hashes validate Unicode; parameter values remain data', () => {
  const text = '문서 🚀 공급업체\nSupplier\'s "API"';
  const quote = '공급업체';
  const start = text.indexOf(quote);
  const source = {
    id: 'unicode',
    documentId: 'unicode',
    title: '문서',
    version: '1',
    text,
    hash: digest(text),
  };
  const e = { id: 'E', sourceId: source.id, start, end: start + quote.length, quote };
  validateEvidence(e, source);
  assert.throws(() => validateEvidence({ ...e, start: start - 1 }, source));
  const s = setup();
  const body = "Supplier's 🚀 API '\n MATCH (n) DETACH DELETE n";
  assert.equal(change(s, { after: body }).change.after, body);
  assert.equal(s.workspace().items.length, 6);
});

test('depth limit is disclosed and incomplete preview cannot silently be applied', () => {
  const s = setup();
  for (let i = 1; i <= 9; i++) {
    s.query('CREATE (:Item {id:$id,kind:$kind,title:$id,body:$id,revision:1,owner:$owner})', {
      id: `deep-${i}`,
      kind: 'Task',
      owner: 'Test',
    });
    s.query(
      'MATCH (a:Item {id:$id}), (b:Item {id:$to}) CREATE (a)-[:DEPENDS_ON {id:$id,status:$status,evidenceId:$e}]->(b)',
      { id: `deep-${i}`, to: i === 1 ? 'A1' : `deep-${i - 1}`, status: 'confirmed', e: 'E-A1' },
    );
  }
  assert.equal(s.impact('A1').limited, true);
  assert.ok(!ids(s).includes('deep-9'));
  assert.throws(() => change(s), isError('INCOMPLETE_IMPACT'));
});

test('path count limit is explicit rather than a complete-impact claim', () => {
  const s = setup();
  s.query(
    'UNWIND $rows AS row MATCH (a:Item {id:$target}) CREATE (t:Item {id:row,kind:$kind,title:row,body:row,revision:1,owner:$owner})-[:DEPENDS_ON {id:row,status:$status,evidenceId:$e}]->(a)',
    {
      rows: Array.from({ length: 501 }, (_, i) => `wide-${i}`),
      target: 'A1',
      kind: 'Task',
      owner: 'Test',
      status: 'confirmed',
      e: 'E-A1',
    },
  );
  assert.equal(s.impact('A1').limited, true);
  assert.equal(s.impact('A1').impacts.length, 500);
});
