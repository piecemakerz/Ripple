import { itemTitle, itemBody, sourceTitle, evidenceTranslation } from './sample-content.js';
import { translate, type Language, type Translator } from './i18n-core.js';
import type {
  ChangeDetail,
  EvidenceDetail,
  Impact,
  Review,
  ReviewStatus,
} from '../shared/types.js';

export const decisionLabels: Record<ReviewStatus, string> = {
  pending: 'Needs review',
  keep: 'Keep',
  revise: 'Revise',
  defer: 'Defer',
};

// Ordering helps a person work through the supplied impacts; it does not infer impact or risk.
export function reviewQueue(impacts: Impact[]) {
  return [...impacts].sort((a, b) => a.depth - b.depth || a.item.id.localeCompare(b.item.id));
}

export function decisionCounts(impacts: Impact[], reviews: Review[]) {
  const byId = new Map(reviews.map((review) => [review.itemId, review]));
  const counts = { pending: 0, keep: 0, revise: 0, defer: 0 };
  for (const impact of impacts) counts[byId.get(impact.item.id)?.status ?? 'pending']++;
  return counts;
}

export function nextPending(impacts: Impact[], reviews: Review[], currentId?: string) {
  const queue = reviewQueue(impacts);
  const index = queue.findIndex((impact) => impact.item.id === currentId);
  const rotated = [...queue.slice(index + 1), ...queue.slice(0, index + 1)];
  const recorded = new Set(reviews.filter((r) => r.status !== 'pending').map((r) => r.itemId));
  return rotated.find((impact) => impact.item.id !== currentId && !recorded.has(impact.item.id));
}

const text = (value: string) =>
  value.replace(/[\\`*_{}[\]<>#+.!|~-]/g, '\\$&').replace(/\r?\n/g, ' ');
// Preserve exact user/source text, including backticks and line breaks, without turning it into markup.
function verbatim(value: string) {
  const longest = Math.max(2, ...(value.match(/`+/g) ?? []).map((match) => match.length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}text\n${value}\n${fence}`;
}

export function buildDecisionBrief(
  detail: ChangeDetail,
  changeEvidence: EvidenceDetail,
  language: Language = 'en',
) {
  const t: Translator = (key, values) => translate(key, language, values);
  const title = (original: string, translated: string) =>
    text(translated === original ? original : `${translated} (${original})`);
  const readingAid = (original: string, translated: string | undefined) =>
    translated && translated !== original
      ? ['\n' + t('Korean translation · reading aid'), verbatim(translated)]
      : [];
  const { change, reviews } = detail;
  if (changeEvidence.id !== change.evidenceId)
    throw new Error(t('The change evidence does not match this brief.'));
  const result = change.snapshot;
  const counts = decisionCounts(result.impacts, reviews);
  const reviewById = new Map(reviews.map((review) => [review.itemId, review]));
  const lines = [
    t('# Decision brief: {0}', [title(result.target.title, itemTitle(result.target, language))]),
    '',
    t('Change: {0} | Applied: {1} | Revision {2} → {3}', [
      text(change.id),
      text(change.createdAt),
      change.beforeRevision,
      change.afterRevision,
    ]),
    '',
    t('{0} of {1} decisions recorded. {2} need review.', [
      result.impacts.length - counts.pending,
      result.impacts.length,
      counts.pending,
    ]),
    t('Keep: {0} | Revise: {1} | Defer: {2}', [counts.keep, counts.revise, counts.defer]),
    '',
    t(
      'This brief contains saved decisions only. Decisions do not mark implementation complete. Confirmed dependencies identify items to review, not predicted failures.',
    ),
    '',
    ...(language === 'ko'
      ? [
          t(
            'Sample translations are reading aids. Original evidence and character ranges remain unchanged.',
          ),
          '',
        ]
      : []),
    t('## Change'),
    '',
    t('Before:'),
    verbatim(change.before),
    ...readingAid(change.before, itemBody(result.target, change.before, language)),
    '',
    t('After:'),
    verbatim(change.after),
    ...readingAid(change.after, itemBody(result.target, change.after, language)),
    '',
    t('Change evidence ID: {0}', [text(change.evidenceId)]),
    t('Source: {0} | Version: {1} | ID: {2}', [
      title(changeEvidence.source.title, sourceTitle(changeEvidence.source, language)),
      text(changeEvidence.source.version),
      text(changeEvidence.sourceId),
    ]),
    t('UTF-16 range: [{0}, {1}) | Source SHA-256: {2}', [
      changeEvidence.start,
      changeEvidence.end,
      text(changeEvidence.source.hash),
    ]),
    '',
    verbatim(changeEvidence.quote),
    ...readingAid(changeEvidence.quote, evidenceTranslation(changeEvidence, language)),
    '',
    t('## Review decisions'),
  ];
  for (const impact of reviewQueue(result.impacts)) {
    const review = reviewById.get(impact.item.id);
    lines.push(
      '',
      `### ${text(impact.item.id)}: ${title(impact.item.title, itemTitle(impact.item, language))}`,
      t('Owner: {0} | {1} impact | {2}', [
        text(impact.item.owner),
        impact.depth === 1 ? t('Direct') : t('Indirect'),
        t(decisionLabels[review?.status ?? 'pending']),
      ]),
      '',
      verbatim(impact.item.body),
      ...readingAid(impact.item.body, itemBody(impact.item, impact.item.body, language)),
      '',
      t('Saved reason:'),
      verbatim(review?.reason || t('No decision recorded.')),
      '',
      t('Dependency paths (dependent → prerequisite):'),
    );
    impact.paths.forEach((path, index) => {
      lines.push(
        t('- Path {0}: {1}. Evidence: {2}.', [
          index + 1,
          path.nodes.map((node) => text(node.id)).join(' → '),
          path.edges.map((edge) => text(edge.evidenceId)).join(', '),
        ]),
      );
    });
    if (review?.history.length) {
      lines.push('', t('Decision history:'));
      for (const event of review.history)
        lines.push(
          '',
          `${text(event.createdAt)} — ${t(decisionLabels[event.status])}`,
          verbatim(event.reason),
        );
    }
  }
  lines.push('', t('## Original evidence'));
  const edges = new Map(
    result.impacts.flatMap((i) => i.paths.flatMap((p) => p.edges)).map((e) => [e.id, e]),
  );
  for (const edge of edges.values()) {
    lines.push(
      '',
      `### ${text(edge.from)} → ${text(edge.to)}`,
      t('Evidence: {0}', [text(edge.evidenceId)]),
    );
    const evidence = edge.evidence;
    if (!evidence) {
      lines.push(t('Evidence unavailable.'));
      continue;
    }
    lines.push(
      t('Source: {0} | Version: {1} | ID: {2}', [
        title(evidence.source.title, sourceTitle(evidence.source, language)),
        text(evidence.source.version),
        text(evidence.sourceId),
      ]),
      t('UTF-16 range: [{0}, {1}) | Source SHA-256: {2}', [
        evidence.start,
        evidence.end,
        text(evidence.source.hash),
      ]),
      '',
      verbatim(evidence.quote),
      ...readingAid(evidence.quote, evidenceTranslation(evidence, language)),
    );
  }
  lines.push(
    '',
    `## ${result.limited ? t('Outside the returned results') : t('Outside this ripple')}`,
    result.limited
      ? t('Traversal is limited. No conclusion about excluded items.')
      : t('No confirmed dependency path was found to the changed item.'),
    ...result.excluded.map(
      (item) => `- ${text(item.id)}: ${title(item.title, itemTitle(item, language))}`,
    ),
    '',
    t('## Scope and limits'),
    t('Traversal bound: {0} links / {1} paths. Limited: {2}.', [
      result.maxDepth,
      result.maxPaths,
      result.limited ? t('yes') : t('no'),
    ]),
    ...result.warnings.map((warning) => `- ${text(t(warning))}`),
    t(
      'Generated locally by Ripple from the preserved change snapshot and saved reviews. No AI-written rationale.',
    ),
    '',
  );
  return lines.join('\n');
}
