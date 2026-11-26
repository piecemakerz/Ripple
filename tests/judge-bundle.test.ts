import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkJudgeSnapshot,
  inspectJudgeSnapshot,
  inventory,
  prepareJudgeSnapshot,
} from '../scripts/judge-bundle.js';

test('the real Ripple API-change case packages and reopens its indirect bundle dependency', () => {
  const root = mkdtempSync(join(tmpdir(), 'ripple-judge-test-'));
  try {
    const { directory, inspection } = prepareJudgeSnapshot(root, 'ripple-review-contract');
    assert.equal(inspection.impactedItems, 4);
    assert.ok(inspection.paths.includes('BUNDLE>WORKER>API'));
    assert.equal(
      inspection.paths.some((path) => path.includes('LANGUAGE')),
      false,
    );
    assert.equal(inspection.savedReview.status, 'defer');
    assert.equal(checkJudgeSnapshot(directory).caseName, 'ripple-review-contract');
    const state = JSON.parse(readFileSync(join(directory, 'snapshot', 'state.json'), 'utf8'));
    assert.equal(state.preparation.writeRequests, 21);
    assert.equal(state.preparation.sources, 6);
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
  }
});

test('a closed judge store reopens read-only with native paths/evidence/review; tampering fails before inspection', () => {
  const root = mkdtempSync(join(tmpdir(), 'ripple-judge-test-'));
  try {
    const { directory, inspection } = prepareJudgeSnapshot(root);
    assert.equal(inspection.ok, true);
    assert.equal(inspection.readOnly, true);
    assert.equal(inspection.impactedItems, 5);
    assert.equal(inspection.paths.length, 7);
    assert.equal(inspection.evidence.length, 6);
    assert.equal(inspection.savedReview.status, 'defer');
    const before = inventory(join(directory, 'snapshot'));
    assert.deepEqual(inspectJudgeSnapshot(directory), inspection);
    assert.deepEqual(inventory(join(directory, 'snapshot')), before);
    const path = join(directory, 'snapshot', 'state.json');
    const original = readFileSync(path, 'utf8');
    writeFileSync(path, original + '\n');
    assert.throws(() => inspectJudgeSnapshot(directory), /snapshot hash mismatch/);
    writeFileSync(path, original);
    checkJudgeSnapshot(directory);
    writeFileSync(join(directory, 'snapshot', 'unexpected.txt'), 'extra');
    assert.throws(() => checkJudgeSnapshot(directory), /snapshot hash mismatch/);
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
  }
});
