import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { caseNames } from '../scripts/evaluation/case.js';
import {
  emptyReview,
  reviewPacket,
  summarizeReview,
  validateReview,
  type SemanticReview,
} from '../scripts/evaluation/review.js';
import { readReview, saveReview } from '../scripts/evaluation/review-files.js';
import { reviewPage } from '../scripts/evaluation/review-page.js';
import { createReviewApp } from '../scripts/evaluation/review-server.js';

test('semantic checklist covers both complete fixtures and preserves exact quotes, inference and attribution', () => {
  let total = 0;
  for (const name of caseNames) {
    const packet = reviewPacket(name);
    const { fixture, subjects } = packet;
    assert.equal(
      subjects.length,
      1 + fixture.items.length + fixture.relations.length + fixture.queries.length,
    );
    total += subjects.length;
    assert.deepEqual(
      subjects.filter((s) => s.kind === 'relationship').map((s) => s.id),
      fixture.relations.map((r) => `relationship:${r.from}>${r.to}`),
    );
    const page = reviewPage(packet, emptyReview(packet));
    for (const source of fixture.sources) {
      assert.ok(page.includes(source.hash));
      assert.ok(page.includes(source.commit));
    }
    assert.match(page, /Priority review: curator inference/);
    if (name === 'semver-deprecation') {
      assert.match(page, /CORE_RESET → MAJOR → MINOR → DEPRECATE/);
      assert.match(page, /Tom Preston-Werner/);
      assert.match(page, /creativecommons.org\/licenses\/by\/3.0/);
    }
    assert.equal(summarizeReview(emptyReview(packet), packet).humanAttestedAcceptance, false);
  }
  assert.equal(total, 39);
});

test('review integrity rejects stale/cross-case identity, missing/duplicate subjects and unjustified answers', () => {
  const packet = reviewPacket('async-owner');
  const review = emptyReview(packet);
  for (const key of ['caseName', 'caseId', 'fixtureSha256', 'checklistSha256'] as const) {
    const invalid = structuredClone(review);
    invalid[key] = 'changed';
    assert.throws(() => validateReview(invalid, packet), /hash mismatch/);
  }
  assert.throws(() => validateReview(review, reviewPacket('semver-deprecation')), /hash mismatch/);
  const missing = structuredClone(review);
  missing.entries.pop();
  assert.throws(() => validateReview(missing, packet), /exactly once/);
  const duplicate = structuredClone(review);
  duplicate.entries[1] = duplicate.entries[0];
  assert.throws(() => validateReview(duplicate, packet), /exactly once/);
  for (const decision of ['accept', 'revise', 'uncertain'] as const) {
    const invalid = structuredClone(review);
    invalid.entries[0] = { ...invalid.entries[0], decision, reason: '  ' };
    assert.throws(() => validateReview(invalid, packet), /needs a reason/);
  }
  assert.throws(
    () => validateReview({ ...review, humanAttestedAcceptance: true }, packet),
    /Unrecognized key/,
  );
});

test('complete automated judgments and disagreements cannot become human-attested acceptance', () => {
  const packet = reviewPacket('async-owner');
  const review = emptyReview(packet);
  review.reviewer = { kind: 'automated', name: 'Synthetic validator test', attested: false };
  review.entries.forEach((e) => {
    e.decision = 'accept';
    e.reason = 'Synthetic test judgment, not a semantic assessment.';
  });
  assert.equal(summarizeReview(review, packet).accepted, true);
  assert.equal(summarizeReview(review, packet).humanAttestedAcceptance, false);
  review.reviewer.attested = true;
  assert.throws(() => summarizeReview(review, packet), /Human attestation requires/);
  // Exercise self-report validation only; this synthetic record is never published as human evidence.
  review.reviewer.kind = 'human';
  assert.equal(summarizeReview(review, packet).humanAttestedAcceptance, true);
  assert.equal(summarizeReview(review, packet).identityVerified, false);
  for (const decision of ['revise', 'uncertain'] as const) {
    review.entries[0].decision = decision;
    assert.equal(summarizeReview(review, packet).humanAttestedAcceptance, false);
  }
  review.entries[0].decision = 'pending';
  assert.throws(() => validateReview(review, packet), /every subject/);
});

test('immutable review snapshots survive a separate checker process and reject stale writes/corruption', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ripple-review-test-'));
  try {
    const packet = reviewPacket('semver-deprecation');
    const draft = emptyReview(packet);
    draft.reviewer.kind = 'automated';
    draft.entries[0].reason = 'Draft note 😀\r\nNo human judgment.';
    const first = saveReview(directory, packet, draft);
    const path = join(directory, packet.caseName, '000001.json');
    const bytes = readFileSync(path, 'utf8');
    const second = saveReview(directory, packet, {
      ...first,
      reviewer: { ...first.reviewer, name: 'QA only' },
    });
    assert.equal(second.revision, 2);
    assert.equal(readFileSync(path, 'utf8'), bytes);
    assert.deepEqual(readReview(directory, packet), second);
    assert.deepEqual(readReview(directory, packet, 1), first);
    assert.throws(() => saveReview(directory, packet, first), /Another save/);
    const child = spawnSync(
      process.execPath,
      ['--import', 'tsx', resolve('scripts/review-evaluation.ts'), '--check', path],
      { encoding: 'utf8', timeout: 15000 },
    );
    assert.equal(child.status, 2, child.stderr);
    assert.equal(JSON.parse(child.stdout).humanAttestedAcceptance, false);
    assert.equal(JSON.parse(child.stdout).counts.pending, 21);
    writeFileSync(join(directory, packet.caseName, '000002.json'), '{}');
    assert.throws(() => readReview(directory, packet));
    assert.throws(() => saveReview(directory, packet, second));
    assert.equal(readdirSync(join(directory, packet.caseName)).length, 2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function form(review: SemanticReview) {
  return new URLSearchParams({
    revision: String(review.revision),
    fixtureSha256: review.fixtureSha256,
    checklistSha256: review.checklistSha256,
    reviewerKind: review.reviewer.kind,
    reviewerName: review.reviewer.name,
    ...(review.reviewer.attested ? { attested: 'yes' } : {}),
    ...Object.fromEntries(
      review.entries.flatMap((entry, i) => [
        [`decision-${i}`, entry.decision],
        [`reason-${i}`, entry.reason],
      ]),
    ),
  });
}

test('review HTTP saves/reloads/downloads; validation/conflicts preserve edits; host, origin and form bounds hold', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ripple-review-http-'));
  const server = createReviewApp(directory).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const url = `${origin}/case/async-owner`;
  const post = (body: URLSearchParams, headers: Record<string, string> = { Origin: origin }) =>
    fetch(url, { method: 'POST', body, headers, redirect: 'manual' });
  try {
    const packet = reviewPacket('async-owner');
    const draft = emptyReview(packet);
    const initial = await fetch(url);
    assert.equal(initial.status, 200);
    assert.match(initial.headers.get('content-security-policy')!, /default-src 'none'/);
    assert.equal(initial.headers.get('referrer-policy'), 'same-origin');
    assert.match(await initial.text(), /18 pending/);
    const foreignHostStatus = await new Promise<number | undefined>((resolve, reject) => {
      request(url, { headers: { Host: 'evil.example' } }, (response) => {
        response.resume();
        resolve(response.statusCode);
      })
        .on('error', reject)
        .end();
    });
    assert.equal(foreignHostStatus, 403);
    assert.equal((await post(form(draft), { Origin: 'http://evil.example' })).status, 403);
    assert.equal((await post(form(draft), { Origin: 'null' })).status, 403);
    assert.equal((await post(form(draft), {})).status, 403);
    draft.reviewer = { kind: 'automated', name: 'QA <script>alert(1)</script>', attested: false };
    draft.entries[0].decision = 'uncertain';
    let response = await post(form(draft));
    assert.equal(response.status, 400);
    let html = await response.text();
    assert.match(html, /Every answered subject needs a reason/);
    assert.match(html, /value="uncertain" selected/);
    assert.ok(!html.includes('<script>alert(1)</script>'));
    draft.entries[0].reason =
      'QA only <img src=x onerror=alert(1)>; uncertainty is not acceptance.';
    response = await post(form(draft));
    assert.equal(response.status, 303);
    const saved = readReview(directory, packet);
    assert.equal(saved.revision, 1);
    const downloaded = await fetch(`${url}/records/1`);
    assert.match(downloaded.headers.get('content-disposition')!, /attachment/);
    assert.deepEqual(await downloaded.json(), saved);
    draft.entries[0].reason = 'Conflicting draft retained';
    response = await post(form(draft));
    assert.equal(response.status, 409);
    html = await response.text();
    assert.match(html, /Conflicting draft retained/);
    assert.equal(readReview(directory, packet).entries[0].reason, saved.entries[0].reason);
    assert.match(await (await fetch(url)).text(), /1 uncertain/);
    const duplicate = form(saved);
    duplicate.append('revision', '1');
    assert.equal((await post(duplicate)).status, 400);
    const oversized = form(saved);
    oversized.set('reason-0', 'x'.repeat(530000));
    assert.equal((await post(oversized)).status, 413);
    const externalPacket = reviewPacket('semver-deprecation');
    const multilingual = emptyReview(externalPacket);
    multilingual.entries.forEach((entry) => {
      entry.reason = '검'.repeat(2000);
    });
    const multilingualResponse = await fetch(`${origin}/case/semver-deprecation`, {
      method: 'POST',
      body: form(multilingual),
      headers: { Origin: origin },
      redirect: 'manual',
    });
    assert.equal(multilingualResponse.status, 303);
    assert.equal(readReview(directory, externalPacket).entries.at(-1)!.reason.length, 2000);
    assert.equal((await fetch(`${url}/records/0`)).status, 400);
    assert.equal((await fetch(`${url}/records/99`)).status, 404);
    assert.equal((await fetch(`${origin}/case/unknown`)).status, 404);
    assert.equal(readReview(directory, packet).revision, 1);
  } finally {
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
    rmSync(directory, { recursive: true, force: true });
  }
});
