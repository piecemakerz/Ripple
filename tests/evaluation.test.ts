import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RippleStore } from '../server/store.js';
import type { ImpactResult } from '../shared/types.js';
import { caseNames, evaluationCase, loadCase, validateCase } from '../scripts/evaluation/case.js';
import { parseEvaluationArgs } from '../scripts/evaluation/cli.js';
import { openApi } from '../scripts/evaluation/http.js';
import { prepareCase } from '../scripts/evaluation/prepare.js';
import { scoreImpact } from '../scripts/evaluation/score.js';
import { runEvaluation, runPhase } from '../scripts/evaluation/run.js';

for (const name of caseNames)
  test(`${name}: HTTP ingestion, golden paths, one review per item and separate-process restoration`, () => {
    const result = runEvaluation(name);
    assert.equal(result.ok, true);
    assert.deepEqual(
      result.phases.map((p) => p.phase),
      ['write', 'read'],
    );
    assert.ok(
      result.phases.every(
        (p) =>
          p.case === loadCase(name).fixture.id && p.fixtureSha256 === loadCase(name).fixtureHash,
      ),
    );
    if (name === 'semver-deprecation')
      for (const phase of result.phases) {
        const primary = phase.scores.find((s) => s.target === 'DEPRECATE')!;
        assert.equal(primary.actual.length, 5);
        assert.equal(primary.pathsMatched, 7);
        assert.equal(primary.validEvidence, 6);
      }
  });

test('evaluation selection is explicit and rejects unknown, duplicate or incomplete arguments', () => {
  assert.deepEqual(parseEvaluationArgs([]), { demo: false, caseName: undefined });
  assert.deepEqual(parseEvaluationArgs(['--demo']), { demo: true, caseName: 'async-owner' });
  assert.deepEqual(parseEvaluationArgs(['--demo', '--case', 'semver-deprecation']), {
    demo: true,
    caseName: 'semver-deprecation',
  });
  assert.deepEqual(parseEvaluationArgs(['--case', 'async-owner']), {
    demo: false,
    caseName: 'async-owner',
  });
  for (const args of [
    ['--case'],
    ['--case', '../other'],
    ['--demo', '--demo'],
    ['--case', 'async-owner', '--case', 'semver-deprecation'],
    ['--all'],
  ])
    assert.throws(() => parseEvaluationArgs(args), /Usage/);
  assert.throws(() => loadCase('../other'), /Unknown evaluation case/);
});

test('reopening refuses cross-case and modified-fixture manifests before opening the store', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ripple-evaluation-'));
  try {
    runPhase('write', directory, 'semver-deprecation');
    assert.throws(
      () => runPhase('read', directory, 'async-owner'),
      /manifest case or fixture hash mismatch/,
    );
    const path = join(directory, 'state.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    manifest.fixtureSha256 = 'changed';
    writeFileSync(path, JSON.stringify(manifest));
    assert.throws(
      () => runPhase('read', directory, 'semver-deprecation'),
      /manifest case or fixture hash mismatch/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
  }
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
  const external = structuredClone(loadCase('semver-deprecation').fixture);
  delete external.sources[0].attribution;
  assert.throws(() => validateCase(external), /attribution/);
  const unconfirmed = structuredClone(evaluationCase);
  unconfirmed.relations[0].status = 'proposed';
  assert.throws(() => validateCase(unconfirmed), /confirmed fixture relations/);
  const noReview = structuredClone(evaluationCase);
  noReview.review.item = 'OWNER';
  assert.throws(() => validateCase(noReview), /review item/);
});

test('external case scorer rejects a lost alternate path even when all impacted items remain', async () => {
  const fixture = loadCase('semver-deprecation').fixture;
  const store = new RippleStore(':memory:');
  store.seed();
  const api = await openApi(store);
  try {
    const ids = await prepareCase(api, fixture);
    const query = fixture.queries[0];
    const result = await api.request<ImpactResult>(`/api/items/${ids.items.DEPRECATE}/impact`);
    const reset = result.impacts.find((i) => i.item.id === ids.items.CORE_RESET)!;
    assert.equal(reset.paths.length, 2);
    assert.equal(reset.depth, 2);
    reset.paths.pop();
    const score = scoreImpact(result, query, ids, fixture);
    assert.equal(score.precision, 1);
    assert.equal(score.recall, 1);
    assert.equal(score.passed, false);
    assert.ok(score.failures.includes('Path set mismatch'));
  } finally {
    await api.close();
  }
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
