import test from 'node:test';
import assert from 'node:assert/strict';
import { RippleStore } from '../server/store.js';
import type { ImpactResult } from '../shared/types.js';
import { evaluationCase, validateCase } from '../scripts/evaluation/case.js';
import { openApi } from '../scripts/evaluation/http.js';
import { prepareCase } from '../scripts/evaluation/prepare.js';
import { scoreImpact } from '../scripts/evaluation/score.js';
import { runEvaluation } from '../scripts/evaluation/run.js';

test('real-document evaluation runs HTTP ingestion, exact golden paths and separate-process restoration', () => {
  const result = runEvaluation();
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.phases.map((p) => p.phase),
    ['write', 'read'],
  );
});

test('frozen evaluation rejects changed source text, ambiguous quotes and incomplete gold labels', () => {
  const corrupt = structuredClone(evaluationCase);
  corrupt.sources[0].text += ' ';
  assert.throws(() => validateCase(corrupt), /Source integrity/);
  const missing = structuredClone(evaluationCase);
  missing.items[0].evidence.quote = 'Not present';
  assert.throws(() => validateCase(missing), /exactly once/);
  const incomplete = structuredClone(evaluationCase);
  incomplete.queries[0].excluded.pop();
  assert.throws(() => validateCase(incomplete), /classify every/);
});

test('evaluation scorer fails on false positives, omissions, wrong paths, evidence corruption and truncation', async () => {
  const store = new RippleStore(':memory:');
  store.seed();
  const api = await openApi(store);
  try {
    const ids = await prepareCase(api);
    const query = evaluationCase.queries[0];
    const result = await api.request<ImpactResult>(`/api/items/${ids.items.OWNER}/impact`);
    assert.equal(scoreImpact(result, query, ids).passed, true);
    const missing = structuredClone(result);
    missing.impacts.pop();
    assert.equal(scoreImpact(missing, query, ids).recall, 0.75);
    assert.equal(scoreImpact(missing, query, ids).passed, false);
    const extra = structuredClone(result);
    const fake = structuredClone(extra.impacts[0]);
    fake.item.id = ids.items.FONTS;
    extra.impacts.push(fake);
    assert.equal(scoreImpact(extra, query, ids).precision, 0.8);
    assert.equal(scoreImpact(extra, query, ids).passed, false);
    const mutations: ((r: ImpactResult) => void)[] = [
      (r) => {
        r.limited = true;
      },
      (r) => {
        r.impacts.push(structuredClone(r.impacts[0]));
      },
      (r) => {
        r.impacts[0].paths.push(structuredClone(r.impacts[0].paths[0]));
      },
      (r) => {
        r.impacts[0].paths[0].nodes.reverse();
      },
      (r) => {
        r.impacts[0].paths[0].edges[0].status = 'proposed';
      },
      (r) => {
        r.impacts[0].paths[0].edges[0].evidence!.start++;
      },
      (r) => {
        r.impacts[0].paths[0].edges[0].evidence!.quote += 'wrong';
      },
      (r) => {
        r.impacts[0].paths[0].edges[0].evidence!.source.text += 'changed';
      },
      (r) => {
        r.impacts[0].paths[0].edges[0].evidence = null;
      },
    ];
    for (const mutate of mutations) {
      const broken = structuredClone(result);
      mutate(broken);
      assert.equal(scoreImpact(broken, query, ids).passed, false);
    }
    const zero = evaluationCase.queries[2];
    const zeroScore = scoreImpact(
      await api.request(`/api/items/${ids.items.FONTS}/impact`),
      zero,
      ids,
    );
    assert.equal(zeroScore.passed, true);
    assert.equal(zeroScore.precision, null);
    assert.equal(zeroScore.recall, null);
  } finally {
    await api.close();
  }
});
