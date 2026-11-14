import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { RippleStore } from '../../server/store.js';
import type {
  ChangeDetail,
  ImpactResult,
  Review,
  SourceVersion,
  Workspace,
} from '../../shared/types.js';
import { loadCase } from './case.js';
import { openApi } from './http.js';
import { prepareCase, type PreparedCase } from './prepare.js';
import { scoreImpact } from './score.js';

const [mode, directory, caseName] = process.argv.slice(2);
const { fixture, fixtureHash } = loadCase(caseName);
const proposalQuery = fixture.queries.find((q) => q.target === fixture.proposal.target)!;
if (
  !['write', 'read', 'prepare'].includes(mode) ||
  !directory ||
  !basename(directory).startsWith('ripple-evaluation-')
)
  throw new Error('Internal worker requires an evaluation directory and write/read/prepare mode');
const root = resolve(directory);
const dbPath = join(root, 'db');
if (mode !== 'read' && existsSync(dbPath))
  throw new Error('Refusing to overwrite an existing evaluation store');
if (mode === 'read' && !existsSync(dbPath)) throw new Error('Missing evaluation store');
type Manifest = PreparedCase & { caseId: string; fixtureSha256: string };
type State = Manifest & { changeId: string; version2Id: string };
const statePath = join(root, 'state.json');
const restored =
  mode === 'read' ? (JSON.parse(readFileSync(statePath, 'utf8')) as State) : undefined;
if (restored && (restored.caseId !== fixture.id || restored.fixtureSha256 !== fixtureHash))
  throw new Error('Evaluation manifest case or fixture hash mismatch');
const store = new RippleStore(dbPath);
store.seed();
const api = await openApi(store);
try {
  const prepared: Manifest = restored ?? {
    ...(await prepareCase(api, fixture)),
    caseId: fixture.id,
    fixtureSha256: fixtureHash,
  };
  const scores = [];
  for (const query of fixture.queries) {
    const result = await api.request<ImpactResult>(
      `/api/items/${prepared.items[query.target]}/impact`,
    );
    scores.push(scoreImpact(result, query, prepared, fixture));
  }
  assert.ok(
    scores.every((s) => s.passed),
    JSON.stringify(scores, null, 2),
  );
  if (mode === 'prepare') {
    writeFileSync(statePath, JSON.stringify(prepared, null, 2));
  } else {
    let state: State;
    if (mode === 'write') {
      const input = {
        requestId: randomUUID(),
        itemId: prepared.proposal.itemId,
        expectedRevision: 1,
        after: prepared.proposal.after,
        evidenceId: prepared.proposal.evidenceId,
      };
      const saved = await api.request<ChangeDetail>('/api/changes', 'POST', input);
      assert.deepEqual(await api.request('/api/changes', 'POST', input), saved);
      assert.equal(saved.reviews.length, new Set(proposalQuery.paths.map((p) => p[0])).size);
      const reviewPath = `/api/changes/${saved.change.id}/reviews/${prepared.items[fixture.review.item]}`;
      const reviewInput = { status: fixture.review.status, reason: fixture.review.reason };
      await api.request<Review>(reviewPath, 'PUT', reviewInput);
      await api.request<Review>(reviewPath, 'PUT', reviewInput);
      const workspace = await api.request<Workspace>('/api/workspace');
      const original = workspace.sources.find(
        (s) => s.id === prepared.sources[fixture.proposal.evidence.source],
      )!;
      const next = await api.request<SourceVersion>('/api/sources', 'POST', {
        requestId: randomUUID(),
        documentId: original.documentId,
        expectedVersion: 1,
        title: 'Hypothetical evaluation update (not an original document)',
        text: fixture.proposal.after,
      });
      state = { ...prepared, changeId: saved.change.id, version2Id: next.id };
      writeFileSync(statePath, JSON.stringify(state, null, 2));
    } else state = prepared as State;
    const workspace = await api.request<Workspace>('/api/workspace');
    assert.equal(workspace.changePage.entries.length, 1);
    assert.equal(workspace.items.find((i) => i.id === state.proposal.itemId)?.revision, 2);
    assert.equal(
      workspace.items.find((i) => i.id === state.proposal.itemId)?.body,
      fixture.proposal.after,
    );
    for (const source of fixture.sources) {
      const saved = workspace.sources.find((s) => s.id === state.sources[source.key]);
      assert.equal(saved?.text, source.text);
      assert.equal(saved?.hash, source.hash);
      assert.equal(saved?.version, '1');
    }
    assert.equal(workspace.sources.find((s) => s.id === state.version2Id)?.version, '2');
    const detail = await api.request<ChangeDetail>(`/api/changes/${state.changeId}`);
    const savedScore = scoreImpact(detail.change.snapshot, proposalQuery, state, fixture);
    assert.ok(savedScore.passed, JSON.stringify(savedScore));
    assert.equal(detail.change.snapshot.target.revision, 1);
    assert.equal(
      detail.change.snapshot.target.body,
      fixture.items.find((i) => i.key === fixture.proposal.target)!.body,
    );
    assert.deepEqual(
      detail.reviews.map((r) => r.itemId).sort(),
      savedScore.expected.map((key) => state.items[key]).sort(),
    );
    const review = detail.reviews.find((r) => r.itemId === state.items[fixture.review.item])!;
    assert.equal(review.status, fixture.review.status);
    assert.equal(review.reason, fixture.review.reason);
    assert.equal(review.history.length, 1);
    assert.equal(review.history[0].reason, fixture.review.reason);
    for (const other of detail.reviews.filter((r) => r.itemId !== review.itemId))
      assert.equal(other.status, 'pending');
  }
  store.checkpoint();
  console.log(
    JSON.stringify({
      ok: true,
      schemaVersion: 2,
      fixtureSha256: fixtureHash,
      case: fixture.id,
      phase: mode,
      provenance: fixture.provenance,
      scores,
    }),
  );
} finally {
  await api.close();
}
// The owner process exits before the next phase reopens this directory.
