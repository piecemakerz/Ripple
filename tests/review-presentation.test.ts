import assert from 'node:assert/strict';
import test from 'node:test';
import type { Impact, Item, PathEdge } from '../shared/types.js';
import {
  highlightedPath,
  reviewDraftState,
  selectionAfterApply,
  updateReviewDraft,
} from '../src/review-presentation.js';

const item = (id: string): Item => ({
  id,
  title: id,
  body: id,
  kind: 'Task',
  revision: 1,
  owner: 'Reviewer',
});
const edge = (from: string, to: string): PathEdge => ({
  id: `${from}-${to}`,
  from,
  to,
  status: 'confirmed',
  evidenceId: `E-${from}-${to}`,
  evidence: null,
});
const impact: Impact = {
  item: item('C'),
  depth: 1,
  evidenceComplete: false,
  paths: [
    { nodes: [item('C'), item('B'), item('A')], edges: [edge('C', 'B'), edge('B', 'A')] },
    { nodes: [item('C'), item('A')], edges: [edge('C', 'A')] },
  ],
};

test('path highlighting excludes a shortcut between nodes of the selected longer path', () => {
  const first = highlightedPath(impact, undefined);
  assert.deepEqual([...first.nodes], ['C', 'B', 'A']);
  assert.deepEqual([...first.edges], ['C-B', 'B-A']);
  assert.equal(first.edges.has('C-A'), false);
  const alternate = highlightedPath(impact, { itemId: 'C', index: 1 });
  assert.equal(alternate.index, 1);
  assert.deepEqual([...alternate.nodes], ['C', 'A']);
  assert.deepEqual([...alternate.edges], ['C-A']);
});

test('another item or an unavailable path falls back to its first path; an empty result is safe', () => {
  for (const choice of [
    { itemId: 'D', index: 1 },
    { itemId: 'C', index: 5 },
  ]) {
    assert.equal(highlightedPath(impact, choice).index, 0);
    assert.deepEqual([...highlightedPath(impact, choice).edges], ['C-B', 'B-A']);
  }
  const empty = highlightedPath(undefined, { itemId: 'C', index: 1 });
  assert.equal(empty.nodes.size, 0);
  assert.equal(empty.edges.size, 0);
});

test('review feedback distinguishes persisted decisions, edits and missing reasons using server trim semantics', () => {
  const saved = { status: 'defer' as const, reason: 'Wait for the feed.' };
  assert.deepEqual(reviewDraftState({ ...saved, reason: '  Wait for the feed.  ' }, saved), {
    unchanged: true,
    canSave: false,
    message: 'Decision saved',
  });
  for (const draft of [
    { status: 'revise' as const, reason: saved.reason },
    { ...saved, reason: 'Wait until Monday.' },
  ]) {
    assert.deepEqual(reviewDraftState(draft, saved), {
      unchanged: false,
      canSave: true,
      message: 'Unsaved changes',
    });
  }
  assert.equal(reviewDraftState({ ...saved, reason: '   ' }, saved).canSave, false);
  assert.equal(reviewDraftState({ ...saved, reason: '   ' }, saved).message, 'Unsaved changes');
  assert.equal(
    reviewDraftState(saved, { status: 'pending', reason: saved.reason }).unchanged,
    false,
  );
  assert.equal(reviewDraftState(saved, undefined).unchanged, false);
  assert.deepEqual(reviewDraftState({ status: 'revise', reason: '' }, undefined), {
    unchanged: false,
    canSave: false,
    message: 'Add a reason to save your decision',
  });
});

test('a reason alone never implies a review choice; an explicit decision and reason are both required', () => {
  for (const reason of ['', 'The API now updates daily.']) {
    assert.deepEqual(reviewDraftState({ status: '', reason }, undefined), {
      unchanged: false,
      canSave: false,
      message: 'Choose Keep, Revise or Defer before saving.',
    });
  }
  for (const status of ['keep', 'revise', 'defer'] as const) {
    assert.equal(reviewDraftState({ status, reason: ' ' }, undefined).canSave, false);
    assert.equal(
      reviewDraftState({ status, reason: 'An explicit reason.' }, undefined).canSave,
      true,
    );
  }
});

test('apply continues with the inspected item and safely falls back if that item is absent', () => {
  const second = { ...impact, item: item('D') };
  assert.equal(selectionAfterApply([impact, second], 'D'), 'D');
  assert.equal(selectionAfterApply([impact, second], 'missing'), 'C');
  assert.equal(selectionAfterApply([], 'D'), '');
});

test('consecutive decision and reason events merge against current drafts, and reverting clears only that item', () => {
  const baseline = { status: '' as const, reason: '' };
  const other = { status: 'defer' as const, reason: 'Wait.' };
  const initial = { 'change:other': other };
  const choice = updateReviewDraft(initial, 'change:item', baseline, undefined, { status: 'keep' });
  const reason = updateReviewDraft(choice, 'change:item', baseline, undefined, {
    reason: 'Still applies.',
  });
  assert.deepEqual(reason['change:item'], { status: 'keep', reason: 'Still applies.' });
  assert.deepEqual(initial, { 'change:other': other });
  const saved = { status: 'keep' as const, reason: 'Still applies.' };
  const reverted = updateReviewDraft(reason, 'change:item', baseline, saved, {
    reason: '  Still applies.  ',
  });
  assert.deepEqual(reverted, initial);
});
