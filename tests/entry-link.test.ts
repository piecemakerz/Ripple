import assert from 'node:assert/strict';
import test from 'node:test';
import { entryUrl, entryWarning, resolveEntry } from '../shared/entry-link.js';
import { RippleStore } from '../server/store.js';
import { loadCase } from '../scripts/evaluation/case.js';
import { prepareCase } from '../scripts/evaluation/prepare.js';
import { openApi } from '../scripts/evaluation/http.js';
import type { Workspace } from '../shared/types.js';

test('a case link selects its native proposal and item without mutating the workspace', async () => {
  const store = new RippleStore(':memory:');
  store.seed();
  const api = await openApi(store);
  try {
    const fixture = loadCase('semver-deprecation').fixture;
    const ids = await prepareCase(api, fixture);
    const before = await api.request<Workspace>('/api/workspace');
    const url = entryUrl(
      'http://127.0.0.1:4323/?lang=en#main',
      `proposal:${ids.proposal.id}`,
      ids.items.CORE_RESET,
    );
    const entry = resolveEntry(before, url.search);
    assert.equal(entry.selection, `proposal:${ids.proposal.id}`);
    assert.equal(entry.itemId, ids.items.CORE_RESET);
    assert.equal(entry.warning, '');
    assert.equal(url.searchParams.get('lang'), 'en');
    assert.equal(url.hash, '#main');
    assert.deepEqual(await api.request('/api/workspace'), before);
  } finally {
    await api.close();
  }
});

test('saved links survive paging, replace proposal parameters, and reject ambiguous or invalid entry', () => {
  const store = new RippleStore(':memory:');
  store.seed();
  const workspace = store.workspace();
  const id = 'b1563fc1-ce4f-4a63-8850-dcbce76407cb';
  const url = entryUrl('http://localhost/?proposal=supplier-daily&item=T1', id, 'D1');
  assert.equal(url.searchParams.has('proposal'), false);
  assert.equal(resolveEntry(workspace, url.search).selection, id);
  assert.equal(resolveEntry(workspace, '').warning, '');
  for (const search of [
    '?proposal=missing',
    '?proposal=',
    '?change=../../api',
    '?change=',
    '?proposal=supplier-daily&change=' + id,
    '?proposal=supplier-daily&proposal=other',
  ]) {
    const entry = resolveEntry(workspace, search);
    assert.equal(entry.selection, 'proposal:supplier-daily');
    assert.equal(entry.warning, entryWarning);
  }
  assert.equal(resolveEntry(workspace, '?item=missing').itemId, '');
});
