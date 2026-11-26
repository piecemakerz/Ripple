import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DecisionChoices } from '../src/DecisionChoices.js';
import { LanguageProvider } from '../src/i18n.js';
import type { ReviewDraft } from '../src/review-presentation.js';

function render(value: ReviewDraft['status'], disabled = false) {
  return renderToStaticMarkup(
    createElement(LanguageProvider, {
      children: createElement(DecisionChoices, {
        value,
        disabled,
        describedBy: 'current-item',
        onChange: () => assert.fail('Rendering must not choose a decision'),
      }),
    }),
  );
}

test('a new decision exposes one named single-choice group with no inferred answer and readable hints', () => {
  const html = render('');
  assert.match(html, /<legend>Choose one response<\/legend>/);
  assert.match(html, /<fieldset[^>]*aria-describedby="current-item"/);
  const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map(([input]) => input);
  assert.equal(inputs.length, 3);
  assert.equal(new Set(inputs.map((input) => input.match(/name="([^"]+)"/)?.[1])).size, 1);
  for (const input of inputs) {
    assert.match(input, /type="radio"/);
    assert.doesNotMatch(input, /\bchecked=/);
    for (const attribute of ['aria-labelledby', 'aria-describedby']) {
      const id = input.match(new RegExp(`${attribute}="([^"]+)"`))?.[1];
      assert.ok(id);
      assert.ok(html.includes(`id="${id}">`));
    }
  }
  for (const hint of ['Still valid', 'Needs adaptation', 'Revisit later'])
    assert.ok(html.includes(hint));
});

test('saved choices stay exclusive and saving disables the entire group without losing its answer', () => {
  for (const status of ['keep', 'revise', 'defer'] as const) {
    const html = render(status, true);
    assert.match(html, /<fieldset[^>]*\bdisabled=""/);
    const checked = [...html.matchAll(/<input\b[^>]*checked=""[^>]*>/g)];
    assert.equal(checked.length, 1);
    assert.ok(checked[0][0].includes(`value="${status}"`));
  }
});
