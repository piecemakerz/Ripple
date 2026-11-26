import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { sources, items, evidences, proposal } from '../server/sample.js';
import { RippleStore } from '../server/store.js';
import { buildDecisionBrief } from '../src/review-workflow.js';
import {
  sampleSource,
  sourceTitle,
  itemTitle,
  itemBody,
  proposalTitle,
  evidenceTranslation,
} from '../src/sample-content.js';

test('all bundled inventory documents, titles, bodies and evidence sentences have authored Korean reading aids', () => {
  for (const source of sources) {
    const translation = sampleSource(source, 'ko');
    assert.ok(translation, source.id);
    assert.equal(translation.passages.map((passage) => passage.original).join('\n'), source.text);
    for (const passage of translation.passages) {
      assert.equal(!!passage.translation, !!passage.original);
      if (passage.original) assert.match(passage.translation, /[가-힣]/);
    }
    assert.notEqual(sourceTitle(source, 'ko'), source.title);
    assert.equal(sourceTitle(source, 'en'), source.title);
    assert.equal(sampleSource(source, 'en'), undefined);
  }
  for (const item of items) {
    assert.notEqual(itemTitle(item, 'ko'), item.title);
    assert.notEqual(itemBody(item, item.body, 'ko'), item.body);
    assert.equal(itemTitle(item, 'en'), item.title);
    assert.equal(itemBody(item, item.body, 'en'), item.body);
  }
  for (const evidence of evidences) {
    const detail = {
      ...evidence,
      source: sources.find((source) => source.id === evidence.sourceId)!,
    };
    assert.match(evidenceTranslation(detail, 'ko')!, /[가-힣]/);
    assert.equal(evidenceTranslation(detail, 'en'), undefined);
  }
  assert.notEqual(proposalTitle(proposal, 'ko'), proposal.title);
  assert.equal(proposalTitle(proposal, 'en'), proposal.title);
  assert.notEqual(itemBody(items[0], proposal.after, 'ko'), proposal.after);
});

test('unknown, changed, copied and invalid evidence content stays original instead of receiving a stale sample translation', () => {
  const source = sources[0];
  for (const field of ['id', 'documentId', 'title', 'version', 'text', 'hash'] as const) {
    const changed = { ...source, [field]: source[field] + ' 🧭' };
    assert.equal(sampleSource(changed, 'ko'), undefined, field);
    assert.equal(sourceTitle(changed, 'ko'), changed.title);
  }
  const item = items[0];
  assert.equal(itemTitle({ ...item, id: randomUUID() }, 'ko'), item.title);
  assert.equal(itemTitle({ ...item, title: 'History' }, 'ko'), 'History');
  assert.equal(
    itemBody(item, 'Keep 🧭 {0}\nEdited by the user.', 'ko'),
    'Keep 🧭 {0}\nEdited by the user.',
  );
  assert.equal(itemBody({ ...item, title: 'Different item' }, item.body, 'ko'), item.body);
  assert.equal(proposalTitle({ ...proposal, after: 'Edited update' }, 'ko'), proposal.title);
  const detail = { ...evidences[0], source };
  for (const invalid of [
    { ...detail, sourceId: 'copy' },
    { ...detail, start: -1 },
    { ...detail, start: 1.5 },
    { ...detail, end: source.text.length + 1 },
    { ...detail, quote: 'Wrong quote' },
    { ...detail, start: detail.start + 1, quote: detail.quote.slice(1) },
  ])
    assert.equal(evidenceTranslation(invalid, 'ko'), undefined);
});

test('Korean sample reading and exports leave native source versions, snapshots, quotes and review reasons intact', () => {
  const store = new RippleStore(':memory:');
  store.seed();
  const initial = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 1,
    after: proposal.after,
    evidenceId: proposal.evidenceId,
  });
  const reason = '공급업체 API는 재고를 실시간으로 갱신합니다. Keep 🧭 {0}';
  store.saveReview(initial.change.id, 'T1', {
    requestId: crypto.randomUUID(),
    expectedRevision: store.getChange(initial.change.id).reviews.find((r) => r.itemId === 'T1')!
      .revision,
    status: 'defer',
    reason: reason,
  });
  const detail = store.getChange(initial.change.id);
  const original = structuredClone(detail);
  const evidence = store.getEvidence(proposal.evidenceId);
  const originalEvidence = structuredClone(evidence);
  const korean = buildDecisionBrief(detail, evidence, 'ko');
  const english = buildDecisionBrief(detail, evidence, 'en');
  assert.ok(korean.includes('실시간 재고 갱신 (Real'));
  assert.ok(korean.includes('재고 수량은 실시간이 아니라 매일 00:00 UTC에 한 번 갱신됩니다.'));
  assert.ok(korean.includes('한국어 번역 · 이해를 돕기 위한 참고'));
  assert.ok(!english.includes('한국어 번역'));
  for (const brief of [korean, english]) {
    assert.ok(brief.includes(evidence.quote));
    assert.ok(brief.includes(`[${evidence.start}, ${evidence.end})`));
    assert.ok(brief.includes(evidence.source.hash));
    assert.ok(brief.includes(reason));
    assert.ok(brief.includes('T1 → D1 → A1'));
  }
  assert.deepEqual(detail, original);
  assert.deepEqual(store.getChange(initial.change.id), original);
  assert.deepEqual(evidence, originalEvidence);
  assert.deepEqual(store.getEvidence(proposal.evidenceId), originalEvidence);
});
