import assert from 'node:assert/strict';
import test from 'node:test';
import type { Item } from '../shared/types.js';
import { emptyDocumentDraft, unsavedDocumentSections } from '../src/draft-safety.js';
import { resolveHistoryTitle, translatedTitleMatches } from '../src/history-search.js';
import catalog from '../src/locales/sample-ko.json';

test('document protection covers edited text, item, dependency and update without treating source browsing as a write', () => {
  const empty = { ...emptyDocumentDraft };
  assert.equal(Object.values(unsavedDocumentSections(empty, empty)).some(Boolean), false);
  assert.equal(
    Object.values(unsavedDocumentSections({ ...empty, sourceId: 'read-only-choice' }, empty)).some(
      Boolean,
    ),
    false,
  );
  const edited = {
    ...empty,
    title: '계획 {0}',
    text: 'Line one\r\n🧭',
    itemTitle: '작업',
    from: 'task',
    to: 'fact',
    target: 'fact',
    after: '새 정보',
  };
  assert.deepEqual(unsavedDocumentSections(edited, empty), {
    source: true,
    item: true,
    relationship: true,
    update: true,
    evidence: false,
  });
  const sourceSaved = { ...empty, title: edited.title, text: edited.text };
  assert.deepEqual(unsavedDocumentSections(edited, sourceSaved), {
    source: false,
    item: true,
    relationship: true,
    update: true,
    evidence: false,
  });
  assert.equal(Object.values(unsavedDocumentSections(edited, edited)).some(Boolean), false);
  assert.equal(
    unsavedDocumentSections({ ...edited, text: `${edited.text} ` }, edited).source,
    true,
  );
});

test('quote edits and a different repeated occurrence remain unsaved until checkpointed', () => {
  const saved = { ...emptyDocumentDraft, sourceId: 'v1', quote: 'Same sentence.', occurrence: 0 };
  for (const current of [
    { ...saved, occurrence: 20 },
    { ...saved, sourceId: 'v2' },
    { ...saved, quote: '' },
  ])
    assert.equal(unsavedDocumentSections(current, saved).evidence, true);
  assert.equal(unsavedDocumentSections(saved, saved).evidence, false);
});

const items: Item[] = catalog.items.map((item) => ({
  id: item.id,
  title: item.originalTitle,
  body: item.bodies[0].original,
  kind: 'Task',
  revision: 1,
  owner: 'Reviewer',
}));

test('translated history titles resolve to stable IDs while preserving other filters and original text', () => {
  const before = JSON.stringify(items);
  const filters = {
    itemId: '',
    q: ' 실시간 재고 배지 표시 ',
    kind: 'review',
    status: 'revise',
    from: '2026-11-01',
  };
  assert.deepEqual(resolveHistoryTitle(filters, items, 'ko'), { ...filters, itemId: 'D1', q: '' });
  assert.ok(translatedTitleMatches(items, '배지', 'ko').some((item) => item.id === 'T1'));
  assert.equal(resolveHistoryTitle(filters, items, 'en'), filters);
  assert.equal(JSON.stringify(items), before);
  assert.equal(filters.q, ' 실시간 재고 배지 표시 ');
});

test('history aliases never reinterpret ordinary text, custom titles, partial matches or conflicting item filters', () => {
  for (const q of ['배지', 'My reason', 'Display a live inventory badge', 'T1']) {
    const filters = { itemId: '', q };
    assert.equal(resolveHistoryTitle(filters, items, 'ko'), filters);
  }
  const filtered = { itemId: 'T2', q: '실시간 재고 배지 표시' };
  assert.equal(resolveHistoryTitle(filtered, items, 'ko'), filtered);
  const changed = items.map((item) =>
    item.id === 'D1' ? { ...item, title: 'Custom title' } : item,
  );
  assert.equal(translatedTitleMatches(changed, '실시간 재고 배지 표시', 'ko').length, 0);
});
