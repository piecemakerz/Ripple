import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { RippleStore } from '../server/store.js';
import { readHistory } from '../server/history.js';
import { proposal } from '../server/sample.js';
import {
  findSampleChange,
  isSampleChange,
  newTour,
  parseTour,
  readTour,
  sampleProposal,
  tourCompletion,
  tourStorageKey,
  writeTour,
} from '../src/sample-walkthrough.js';

test('walkthrough gates each task on reads and this sample’s persisted decisions and visible history', () => {
  const store = new RippleStore(':memory:');
  store.seed();
  const sample = sampleProposal(store.workspace());
  assert.equal(sample?.id, 'supplier-daily');
  const state = newTour();
  assert.equal(tourCompletion(state, undefined, sample, undefined, true).complete, false);
  state.seen = ['source', 'relationship', 'impact'];
  for (const step of [0, 1, 2])
    assert.equal(
      tourCompletion({ ...state, step }, undefined, sample, undefined, true).complete,
      true,
    );
  assert.equal(
    tourCompletion({ ...state, step: 3 }, undefined, sample, undefined, true).complete,
    false,
  );
  let detail = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 1,
    after: proposal.after,
    evidenceId: proposal.evidenceId,
  });
  state.changeId = detail.change.id;
  assert.equal(
    tourCompletion({ ...state, step: 3 }, detail, sample, undefined, false, true).complete,
    true,
  );
  assert.equal(tourCompletion({ ...state, step: 4 }, detail, sample, undefined, true).pending, 4);
  store.saveReview(detail.change.id, 'T1', {
    requestId: crypto.randomUUID(),
    expectedRevision: store.getChange(detail.change.id).reviews.find((r) => r.itemId === 'T1')!
      .revision,
    status: 'defer',
    reason: 'Wait for the supplier contract.',
  });
  detail = store.getChange(detail.change.id);
  assert.equal(tourCompletion({ ...state, step: 4 }, detail, sample, undefined, true).pending, 3);
  for (const id of ['D1', 'D2', 'T2'])
    store.saveReview(detail.change.id, id, {
      requestId: crypto.randomUUID(),
      expectedRevision: store.getChange(detail.change.id).reviews.find((r) => r.itemId === id)!
        .revision,
      status: 'revise',
      reason: 'Use the daily snapshot contract.',
    });
  detail = store.getChange(detail.change.id);
  assert.equal(
    tourCompletion({ ...state, step: 4 }, detail, sample, undefined, false, true).complete,
    true,
  );
  assert.equal(
    tourCompletion({ ...state, step: 5 }, detail, sample, undefined, false).complete,
    false,
  );
  assert.equal(
    tourCompletion({ ...state, step: 5 }, detail, sample, undefined, true).complete,
    true,
  );
  assert.equal(
    tourCompletion({ ...state, step: 6 }, detail, sample, undefined, true).complete,
    false,
  );
  assert.equal(
    tourCompletion(
      { ...state, step: 6 },
      detail,
      sample,
      readHistory(store, { itemId: 'A1' }),
      true,
    ).complete,
    true,
  );
  assert.equal(
    tourCompletion({ ...state, step: 4 }, undefined, sample, undefined, true).complete,
    false,
  );
  const other = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 2,
    after: 'Twice daily inventory.',
    evidenceId: proposal.evidenceId,
  });
  assert.equal(isSampleChange(other, sample), false);
  assert.equal(
    tourCompletion({ ...state, step: 4 }, other, sample, undefined, true).complete,
    false,
  );
});

test('leaving a completed task requires returning, while successful apply/save transitions keep the next action available', () => {
  const store = new RippleStore(':memory:');
  store.seed();
  const sample = sampleProposal(store.workspace());
  let detail = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 1,
    after: proposal.after,
    evidenceId: proposal.evidenceId,
  });
  for (const impact of detail.change.snapshot.impacts)
    store.saveReview(detail.change.id, impact.item.id, {
      requestId: crypto.randomUUID(),
      expectedRevision: store
        .getChange(detail.change.id)
        .reviews.find((r) => r.itemId === impact.item.id)!.revision,
      status: 'defer',
      reason: 'Clarify daily delivery before implementing.',
    });
  detail = store.getChange(detail.change.id);
  const state = {
    ...newTour(),
    changeId: detail.change.id,
    seen: ['source', 'relationship', 'impact'] as ('source' | 'relationship' | 'impact')[],
  };
  const history = readHistory(store, { itemId: 'A1' });
  for (let step = 0; step < 7; step++) {
    assert.equal(
      tourCompletion({ ...state, step }, detail, sample, history, false).complete,
      false,
    );
    assert.equal(tourCompletion({ ...state, step }, detail, sample, history, true).complete, true);
  }
  for (const step of [3, 4])
    assert.equal(
      tourCompletion({ ...state, step }, detail, sample, history, false, true).complete,
      true,
    );
  // A newly selected, different change cannot inherit this sample's successful transition.
  const other = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 2,
    after: 'Another delivery schedule.',
    evidenceId: proposal.evidenceId,
  });
  assert.equal(
    tourCompletion({ ...state, step: 3 }, other, sample, history, false, true).complete,
    false,
  );
  // A previously opened source cannot authorize a different screen through the save exception.
  assert.equal(
    tourCompletion({ ...state, step: 0 }, detail, sample, history, false, true).complete,
    false,
  );
});

test('replay locates the exact saved sample beyond the first page without creating another change', async () => {
  const store = new RippleStore(':memory:');
  store.seed();
  const first = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 1,
    after: proposal.after,
    evidenceId: proposal.evidenceId,
  });
  store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 2,
    after: 'A different update.',
    evidenceId: proposal.evidenceId,
  });
  let pages = 0;
  const found = await findSampleChange(proposal, async (cursor) => {
    pages++;
    return readHistory(store, { kind: 'change', limit: '1', ...(cursor ? { cursor } : {}) });
  });
  assert.equal(found, first.change.id);
  assert.equal(pages, 2);
  assert.equal(readHistory(store, { kind: 'change' }).entries.length, 2);
  await assert.rejects(
    findSampleChange(proposal, async () => {
      throw new Error('Read failed');
    }),
    /Read failed/,
  );
  await assert.rejects(
    findSampleChange(proposal, async () => ({ entries: [], nextCursor: 'repeat', pageSize: 1 })),
    /repeated a page/,
  );
  let n = 0;
  await assert.rejects(
    findSampleChange(proposal, async () => ({ entries: [], nextCursor: String(++n), pageSize: 1 })),
    /reached its limit/,
  );
  assert.equal(n, 20);
  assert.equal(
    await findSampleChange(proposal, async () => ({ entries: [], nextCursor: null, pageSize: 1 })),
    undefined,
  );
});

test('browser progress validates input, scopes workspaces and tolerates denied storage', () => {
  const state = {
    ...newTour(),
    status: 'paused' as const,
    step: 4,
    seen: ['source', 'relationship', 'impact'] as const,
    changeId: 'sample-change',
  };
  assert.deepEqual(parseTour(JSON.stringify(state)), state);
  for (const invalid of [
    'bad JSON',
    JSON.stringify({ ...state, step: 99 }),
    JSON.stringify({ ...state, seen: ['invented'] }),
    JSON.stringify({ ...state, version: 2 }),
    JSON.stringify({ ...state, changeId: 3 }),
  ])
    assert.deepEqual(parseTour(invalid), newTour());
  assert.deepEqual(
    readTour(
      {
        getItem: () => {
          throw new Error('Denied');
        },
      },
      'key',
    ),
    newTour(),
  );
  assert.equal(
    writeTour(
      {
        setItem: () => {
          throw new Error('Full');
        },
      },
      'key',
      newTour(),
    ),
    false,
  );
  const store = new RippleStore(':memory:');
  store.seed();
  const w = store.workspace();
  assert.notEqual(
    tourStorageKey(w),
    tourStorageKey({ ...w, database: { ...w.database, path: 'another-runtime-store' } }),
  );
});
