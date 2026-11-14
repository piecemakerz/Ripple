import { readFileSync } from 'node:fs';
import { caseNames } from './case.js';
import { decisions, summarizeReview, type ReviewPacket, type SemanticReview } from './review.js';

const reviewStyles = readFileSync(new URL('./review.css', import.meta.url), 'utf8');

export const escapeHtml = (value: string | number) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

export function reviewPage(packet: ReviewPacket, review: SemanticReview, error?: string) {
  const e = escapeHtml;
  const selected = (a: string, b: string) => (a === b ? ' selected' : '');
  const quote = (ref: NonNullable<ReviewPacket['subjects'][number]['evidence']>) => {
    const source = packet.fixture.sources.find((s) => s.key === ref.source)!;
    const start = source.text.indexOf(ref.quote);
    return `<blockquote>${e(ref.quote)}</blockquote><p class="meta"><a href="#source-${e(source.key)}">${e(source.title)}</a> · excerpt UTF-16 [${start}, ${start + ref.quote.length}) · original [${source.start + start}, ${source.start + start + ref.quote.length})</p>`;
  };
  let progress = 'Draft needs attention';
  if (!error) {
    const summary = summarizeReview(review, packet);
    progress = `${summary.counts.accept}/${review.entries.length} accepted · ${summary.counts.pending} pending · ${summary.counts.revise} revise · ${summary.counts.uncertain} uncertain`;
    if (summary.humanAttestedAcceptance)
      progress += ' · Human-attested acceptance (identity not verified)';
    else progress += ' · No human-attested acceptance';
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ripple · Semantic review</title>
<style>${reviewStyles}</style></head><body><a class="skip" href="#worksheet">Skip to worksheet</a><main><header><p class="kind">Ripple / Evaluation</p><h1>Check the evidence.<br>Record your judgment.</h1><p>Check the scenario, items, dependency direction and complete expected impact sets against the frozen sources. Every judgment starts pending.</p><nav aria-label="Evaluation cases">${caseNames.map((name) => `<a href="/case/${name}"${name === packet.caseName ? ' aria-current="page"' : ''}>${name === 'async-owner' ? 'Database ownership' : 'SemVer deprecation'}</a>`).join('')}</nav></header>
<h2>${e(packet.fixture.id)}</h2><p>${e(packet.fixture.provenance)}</p><p>Arrow direction: <strong>downstream → upstream</strong>. Acceptance concerns this hypothetical scenario. It does not certify customer accuracy or implementation completion.</p>
<p class="hash">Fixture SHA-256: ${e(packet.fixtureHash)}<br>Checklist SHA-256: ${e(packet.checklistSha256)}</p><p class="status" role="status">${e(progress)} · Saved revision ${review.revision}</p>
${error ? `<div class="error" role="alert"><strong>Not saved.</strong> ${e(error)}</div>` : ''}
<p><a href="#sources">Read all frozen sources</a> · <a href="#relationship-section">Review relationships</a> · <a href="#query-section">Check full impact sets</a></p>
<form id="worksheet" method="post" action="/case/${packet.caseName}"><input type="hidden" name="revision" value="${review.revision}"><input type="hidden" name="fixtureSha256" value="${e(review.fixtureSha256)}"><input type="hidden" name="checklistSha256" value="${e(review.checklistSha256)}">
<div class="reviewer"><h3>Reviewer provenance</h3><div class="fields"><div><label for="reviewerKind">Reviewer type</label><select id="reviewerKind" name="reviewerKind">${['unspecified', 'human', 'automated'].map((kind) => `<option value="${kind}"${selected(review.reviewer.kind, kind)}>${kind === 'unspecified' ? 'Not specified' : kind === 'human' ? 'Human' : 'Automated / QA'}</option>`).join('')}</select></div><div><label for="reviewerName">Name or alias</label><input type="text" id="reviewerName" name="reviewerName" maxlength="100" value="${e(review.reviewer.name)}"></div></div><label class="check"><input type="checkbox" name="attested" value="yes"${review.reviewer.attested ? ' checked' : ''}><span>I am the named human reviewer and personally assessed every subject below. This self-report does not verify my identity or expertise.</span></label><p class="meta">Leave attestation unchecked for drafts and automated checks. Give a reason for every answered subject. Revise and Uncertain preserve disagreements; they do not approve the gold graph.</p></div>
<div class="actions"><button type="submit">Save review snapshot</button><a class="button" href="/case/${packet.caseName}">Reload saved version</a>${review.revision ? `<a class="button" href="/case/${packet.caseName}/records/${review.revision}">Download saved JSON</a>` : ''}</div><p class="meta">Save before switching cases or reloading. Unsaved input is not stored. Each successful save creates a new immutable JSON snapshot; older revisions stay available on disk. These artifacts do not change the application database or gold labels.</p>
${packet.subjects
  .map((subject, i) => {
    const entry = review.entries.find((entry) => entry.id === subject.id)!;
    const section =
      i === packet.subjects.findIndex((s) => s.kind === subject.kind)
        ? `<h2 id="${subject.kind}-section" class="anchor">${{ scenario: 'Scenario', item: 'Items', relationship: 'Relationships', query: 'Complete impact sets' }[subject.kind]}</h2>`
        : '';
    return `${section}<article><p class="kind">${i + 1} / ${packet.subjects.length} · ${subject.kind}</p><h3>${e(subject.title)}</h3><p class="description">${e(subject.description)}</p>${subject.evidence ? quote(subject.evidence) : ''}<p class="prompt">${e(subject.prompt)}</p><div class="fields"><div><label for="decision-${i}">Judgment · ${e(subject.title)}</label><select id="decision-${i}" name="decision-${i}">${decisions.map((d) => `<option value="${d}"${selected(entry.decision, d)}>${d[0].toUpperCase() + d.slice(1)}</option>`).join('')}</select></div><div><label for="reason-${i}">Reason · ${e(subject.title)}</label><textarea id="reason-${i}" name="reason-${i}" maxlength="2000">${e(entry.reason)}</textarea></div></div></article>`;
  })
  .join('')}
<div class="actions"><button type="submit">Save review snapshot</button></div></form>
<section id="sources" class="anchor"><h2>Frozen sources</h2><p>Exact excerpts are unchanged. Quote offsets use JavaScript UTF-16 code units, end-exclusive. Source links let a reviewer inspect omitted context; this tool does not fetch or authenticate remote originals.</p>${packet.fixture.sources
    .map((source) => {
      const url =
        source.url ?? `https://github.com/piecemakerz/Ripple/blob/${source.commit}/${source.path}`;
      const safeUrl = /^https:\/\//i.test(url) ? url : '';
      return `<details class="source anchor" id="source-${e(source.key)}"><summary>${e(source.title)}</summary><p>${e(source.attribution ?? 'Ripple contributors')} · ${e(source.license)}${source.license === 'CC-BY-3.0' ? ' · <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">License</a>' : ''} · Unmodified excerpt</p><p>${safeUrl ? `<a href="${e(safeUrl)}" target="_blank" rel="noreferrer">Pinned original: ${e(source.path)}</a>` : e(source.path)} · Original UTF-16 [${source.start}, ${source.end})</p><p class="hash">Commit ${e(source.commit)}<br>Excerpt SHA-256 ${e(source.hash)}</p><div class="source-text">${e(source.text)}</div></details>`;
    })
    .join(
      '',
    )}</section><footer><p>Human judgments remain separate from automated graph scores. The tool checks record integrity and completeness; it cannot prove a dependency is true or authenticate a reviewer.</p></footer></main></body></html>`;
}
