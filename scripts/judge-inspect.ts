// Internal worker: a newly copied, verified artifact; never the live application database.
import assert from 'node:assert/strict';
import { Database, type NodeValue, type PathValue } from '@relate/relate';
import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { IMPACT_QUERY } from '../server/store.js';
import { digest } from '../server/sample.js';
import type { Change, Evidence, ImpactResult, Review, SourceVersion } from '../shared/types.js';
import { loadCase } from './evaluation/case.js';
import { scoreImpact } from './evaluation/score.js';
import type { PreparedCase } from './evaluation/prepare.js';
import { judgeCase } from './judge-bundle.js';

const directory = resolve(process.argv[2] ?? '');
assert.ok(
  basename(directory).startsWith('ripple-judge-inspect-'),
  'Internal inspection directory required',
);
const state = JSON.parse(readFileSync(join(directory, 'state.json'), 'utf8')) as PreparedCase & {
  caseId: string;
  fixtureSha256: string;
  changeId: string;
};
const { fixture, fixtureHash } = loadCase(process.argv[3] ?? judgeCase);
assert.equal(state.caseId, fixture.id);
assert.equal(state.fixtureSha256, fixtureHash);
const db = Database.open(join(directory, 'db'), { readOnly: true });
const conn = db.connect();
const properties = <T>(value: unknown) => (value as NodeValue).properties as T;
const change = properties<Omit<Change, 'snapshot'> & { snapshot: string }>(
  conn.query('MATCH (c:Change {id:$id}) RETURN c LIMIT 1', { id: state.changeId }).single().c,
);
const snapshot = JSON.parse(change.snapshot) as ImpactResult;
const query = fixture.queries.find((q) => q.target === fixture.proposal.target)!;
const score = scoreImpact(snapshot, query, state, fixture);
assert.ok(score.passed, JSON.stringify(score.failures));
const keyById = new Map(Object.entries(state.items).map(([key, id]) => [id, key]));
const paths = conn
  .query(IMPACT_QUERY, { id: state.proposal.itemId })
  .rows.map((row) =>
    (row.p as PathValue)
      .filter((n) => n.kind === 'node')
      .map((n) => keyById.get(String(n.properties.id)))
      .join('>'),
  )
  .sort();
assert.deepEqual(paths, query.paths.map((p) => p.join('>')).sort());
const evidenceIds = [
  ...new Set(
    snapshot.impacts.flatMap((i) => i.paths.flatMap((p) => p.edges.map((e) => e.evidenceId))),
  ),
];
const evidence = evidenceIds.map((id) => {
  const row = conn
    .query('MATCH (e:Evidence {id:$id})-[:FROM_SOURCE]->(s:SourceVersion) RETURN e,s LIMIT 1', {
      id,
    })
    .single();
  const e = properties<Evidence>(row.e);
  const source = properties<SourceVersion>(row.s);
  assert.equal(source.id, e.sourceId);
  assert.equal(source.text.slice(e.start, e.end), e.quote);
  assert.equal(digest(source.text), source.hash);
  const frozen = snapshot.impacts
    .flatMap((i) => i.paths.flatMap((p) => p.edges))
    .find((edge) => edge.evidenceId === id)!.evidence!;
  assert.equal(e.quote, frozen.quote);
  assert.equal(source.text, frozen.source.text);
  return { quote: e.quote, sourceTitle: source.title, start: e.start, end: e.end };
});
const rows = conn.query('MATCH (r:Review)-[:FOR_CHANGE]->(c:Change {id:$id}) RETURN r LIMIT 101', {
  id: change.id,
}).rows;
assert.equal(rows.length, score.expected.length);
const review = rows
  .map((row) => properties<Review>(row.r))
  .find((r) => r.itemId === state.items[fixture.review.item])!;
assert.equal(review.status, fixture.review.status);
assert.equal(review.reason, fixture.review.reason);
assert.equal(
  conn
    .query('MATCH (h:ReviewEvent)-[:FOR_REVIEW]->(r:Review {id:$id}) RETURN count(h) AS count', {
      id: review.id,
    })
    .single().count,
  1,
);
console.log(
  JSON.stringify({
    ok: true,
    readOnly: true,
    impactedItems: score.actual.length,
    paths,
    evidence,
    savedReview: { status: review.status, reason: review.reason },
    changeId: change.id,
    selectedItemId: review.itemId,
  }),
);
