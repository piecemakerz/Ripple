import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app.js';
import { RippleStore } from '../server/store.js';
import { proposal } from '../server/sample.js';

test('HTTP flow uses Relate, validates writes, rejects stale revisions and cross-origin requests', async () => {
  const store = new RippleStore(':memory:');
  store.seed();
  const server = createApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const send = (path: string, body: unknown, method = 'POST', origin?: string) =>
    fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await (await fetch(base + '/api/health')).json()).engine, 'Relate');
    const preview = await (await fetch(base + '/api/items/A1/impact')).json();
    assert.equal(preview.impacts.length, 4);
    assert.equal((await send('/api/changes', {})).status, 400);
    const payload = {
      requestId: randomUUID(),
      itemId: 'A1',
      expectedRevision: 1,
      after: proposal.after,
      evidenceId: proposal.evidenceId,
    };
    assert.equal(
      (await send('/api/changes', payload, 'POST', 'https://unrelated.example')).status,
      403,
    );
    const savedResponse = await send('/api/changes', payload);
    assert.equal(savedResponse.status, 201);
    const saved = await savedResponse.json();
    const retry = await (await send('/api/changes', payload)).json();
    assert.equal(saved.change.id, retry.change.id);
    assert.equal((await send('/api/changes', { ...payload, requestId: randomUUID() })).status, 409);
    const reviewPath = `/api/changes/${saved.change.id}/reviews/T1`;
    assert.equal((await send(reviewPath, { status: 'revise', reason: ' ' }, 'PUT')).status, 400);
    assert.equal(
      (await send(reviewPath, { status: 'done', reason: 'Bad enum' }, 'PUT')).status,
      400,
    );
    assert.equal(
      (await send(reviewPath, { status: 'revise', reason: 'Show daily snapshot time.' }, 'PUT'))
        .status,
      200,
    );
    const reread = await (await fetch(base + `/api/changes/${saved.change.id}`)).json();
    assert.equal(
      reread.reviews.find((r: { itemId: string }) => r.itemId === 'T1').history.length,
      1,
    );
    assert.equal((await fetch(base + '/api/items/missing/impact')).status, 404);
    assert.equal((await fetch(base + '/api/unknown')).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
