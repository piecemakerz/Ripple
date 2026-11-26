import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { parsers } from 'prettier/plugins/typescript';
import { RippleStore } from '../server/store.js';
import { proposal } from '../server/sample.js';
import { buildDecisionBrief } from '../src/review-workflow.js';
import { tourSteps } from '../src/sample-walkthrough.js';
import {
  koreanMessages,
  languageStorageKey,
  message,
  readLanguage,
  saveLanguage,
  translate,
} from '../src/i18n-core.js';

test('language preference defaults to English and tolerates invalid or denied browser storage', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  assert.equal(readLanguage(storage), 'en');
  assert.equal(saveLanguage(storage, 'ko'), true);
  assert.equal(readLanguage(storage), 'ko');
  assert.equal(values.size, 1);
  values.set(languageStorageKey, '{"language":"ko"}');
  assert.equal(readLanguage(storage), 'en');
  values.set(languageStorageKey, 'fr');
  assert.equal(readLanguage(storage), 'en');
  const denied = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('quota');
    },
  };
  assert.equal(readLanguage(denied), 'en');
  assert.equal(saveLanguage(denied, 'ko'), false);
  assert.equal(saveLanguage(storage, 'en'), true);
  assert.equal(readLanguage(storage), 'en');
});

test('Korean messages preserve placeholders and do not translate or re-interpolate user values', () => {
  const slots = (text: string) => [...text.matchAll(/\{\d+\}/g)].map((match) => match[0]).sort();
  for (const [english, korean] of Object.entries(koreanMessages)) {
    assert.ok(korean.trim(), english);
    assert.deepEqual(slots(korean), slots(english), english);
  }
  const title = 'History 🧭 {0} <script> $&\r\nKeep';
  const receipt = message('Saved “{0}” · version {1}', [title, '2']);
  assert.equal(translate(receipt, 'ko'), `“${title}” 저장됨 · 버전 2`);
  assert.equal(translate(receipt, 'en'), `Saved “${title}” · version 2`);
  const notice = message('{0} decision saved for “{1}”.', [message('Keep'), title]);
  assert.equal(translate(notice, 'ko'), `“${title}”의 유지 판단이 저장되었습니다.`);
  assert.equal(translate('Unknown diagnostic', 'ko'), 'Unknown diagnostic');
  assert.equal(translate('toString', 'ko'), 'toString');
});

test('all explicit UI messages and walkthrough instructions have Korean catalog entries', async () => {
  // Scan translation call sites to catch new English UI without a Korean entry.
  const missing = new Set<string>();
  function inspect(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, any>;
    if (node.type === 'JSXOpeningElement' && node.name?.name === 'option') {
      assert.ok(
        node.attributes.some(
          (attribute: { name?: { name?: string } }) => attribute.name?.name === 'value',
        ),
        'Translated option labels must not become wire values',
      );
    }
    if (node.type === 'JSXAttribute' && node.name?.name === 'key') {
      assert.notEqual(
        node.value?.expression?.callee?.name,
        't',
        'Language changes must not change React keys',
      );
    }
    if (
      node.type === 'CallExpression' &&
      ['t', 'message', 'translate'].includes(node.callee?.name)
    ) {
      const first = node.arguments?.[0];
      if (
        first?.type === 'Literal' &&
        typeof first.value === 'string' &&
        !Object.hasOwn(koreanMessages, first.value)
      )
        missing.add(first.value);
    }
    for (const [key, child] of Object.entries(node)) {
      if (['loc', 'range', 'comments', 'tokens'].includes(key)) continue;
      if (Array.isArray(child)) child.forEach(inspect);
      else inspect(child);
    }
  }
  for (const file of readdirSync('src').filter((file) => /\.tsx?$/.test(file))) {
    inspect(
      await parsers.typescript.parse(readFileSync(`src/${file}`, 'utf8'), {
        filepath: file,
      } as Parameters<typeof parsers.typescript.parse>[1]),
    );
  }
  for (const step of tourSteps)
    for (const key of [
      'title',
      'short',
      'task',
      'next',
      'sourceHint',
      'instruction',
      'action',
    ] as const) {
      if (step[key] && !Object.hasOwn(koreanMessages, step[key])) missing.add(step[key]);
    }
  assert.deepEqual([...missing], []);
});

test('both brief languages use the same real Relate snapshots, exact quotes and saved review history', () => {
  const store = new RippleStore(':memory:');
  store.seed();
  const initial = store.applyChange({
    requestId: randomUUID(),
    itemId: 'A1',
    expectedRevision: 1,
    after: proposal.after,
    evidenceId: proposal.evidenceId,
  });
  const reason = 'History / Keep / 유지 🧭\n```md\n{0} 원문을 그대로\n```';
  store.saveReview(initial.change.id, 'T1', {
    requestId: crypto.randomUUID(),
    expectedRevision: store.getChange(initial.change.id).reviews.find((r) => r.itemId === 'T1')!
      .revision,
    status: 'defer',
    reason: reason,
  });
  const detail = store.getChange(initial.change.id);
  const before = structuredClone(detail);
  const evidence = store.getEvidence(detail.change.evidenceId);
  const english = buildDecisionBrief(detail, evidence);
  const korean = buildDecisionBrief(detail, evidence, 'ko');
  assert.match(english, /^# Decision brief:/);
  assert.match(korean, /^# 판단 요약:/);
  assert.ok(korean.includes('총 4건 중 1건의 판단이 기록되었습니다. 3건은 검토가 필요합니다.'));
  for (const brief of [english, korean]) {
    assert.ok(brief.includes(evidence.quote));
    assert.ok(brief.includes(reason));
    assert.ok(brief.includes('T1 → D1 → A1'));
    assert.ok(brief.includes('T2 → D2 → A1'));
    for (const impact of detail.change.snapshot.impacts)
      for (const path of impact.paths)
        for (const edge of path.edges) {
          assert.ok(brief.includes(edge.evidence!.quote));
          assert.ok(brief.includes(`[${edge.evidence!.start}, ${edge.evidence!.end})`));
          assert.ok(brief.includes(edge.evidence!.source.hash));
        }
  }
  assert.deepEqual(store.getChange(initial.change.id), before);
  assert.deepEqual(detail, before);
});
