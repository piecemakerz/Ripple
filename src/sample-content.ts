import catalog from './locales/sample-ko.json';
import type { EvidenceDetail, Item, Proposal, SourceVersion } from '../shared/types.js';
import type { Language } from './i18n-core.js';

// Presentation-only, authored translations for the bundled inventory example.
// Match identity AND original content; unknown or edited content stays verbatim.
export function sampleSource(source: SourceVersion, language: Language) {
  if (language !== 'ko') return undefined;
  return catalog.sources.find(({ original }) =>
    (Object.keys(original) as (keyof SourceVersion)[]).every(
      (key) => original[key] === source[key],
    ),
  );
}

export function sourceTitle(source: SourceVersion, language: Language) {
  return sampleSource(source, language)?.title ?? source.title;
}

export function itemTitle(item: Pick<Item, 'id' | 'title'> | undefined, language: Language) {
  if (!item) return '';
  const match =
    language === 'ko' &&
    catalog.items.find((entry) => entry.id === item.id && entry.originalTitle === item.title);
  return match ? match.title : item.title;
}

export function itemBody(item: Pick<Item, 'id' | 'title'>, body: string, language: Language) {
  if (language !== 'ko') return body;
  return (
    catalog.items
      .find((entry) => entry.id === item.id && entry.originalTitle === item.title)
      ?.bodies.find((entry) => entry.original === body)?.translation ?? body
  );
}

export function proposalTitle(proposal: Proposal, language: Language) {
  const original = catalog.proposal;
  return language === 'ko' &&
    proposal.id === original.id &&
    proposal.itemId === original.itemId &&
    proposal.title === original.title &&
    proposal.after === original.after &&
    proposal.evidenceId === original.evidenceId
    ? original.translation
    : proposal.title;
}

export function evidenceTranslation(evidence: EvidenceDetail, language: Language) {
  const source = sampleSource(evidence.source, language);
  if (
    !source ||
    evidence.sourceId !== evidence.source.id ||
    !Number.isInteger(evidence.start) ||
    !Number.isInteger(evidence.end) ||
    evidence.start < 0 ||
    evidence.end <= evidence.start ||
    evidence.end > evidence.source.text.length ||
    evidence.source.text.slice(evidence.start, evidence.end) !== evidence.quote
  )
    return undefined;
  return source.passages.find((passage) => passage.original === evidence.quote)?.translation;
}
