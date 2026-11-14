import { z } from 'zod';
import { digest } from '../../server/sample.js';
import { loadCase, type CaseName, type EvaluationCase } from './case.js';

export interface ReviewSubject {
  id: string;
  kind: 'scenario' | 'item' | 'relationship' | 'query';
  title: string;
  description: string;
  prompt: string;
  evidence?: EvaluationCase['proposal']['evidence'];
}

export function reviewPacket(caseName: CaseName) {
  const { fixture, fixtureHash } = loadCase(caseName);
  const subjects: ReviewSubject[] = [
    {
      id: 'scenario',
      kind: 'scenario',
      title: `Hypothetical change to ${fixture.proposal.target}`,
      description: fixture.proposal.after,
      prompt:
        'Is this a coherent hypothetical scenario? Impact means a dependent plan needs review, not that implementation must change. The sources do not describe a real customer migration.',
      evidence: fixture.proposal.evidence,
    },
    ...fixture.items.map((item): ReviewSubject => ({
      id: `item:${item.key}`,
      kind: 'item',
      title: `${item.key} · ${item.title}`,
      description: `${item.kind}: ${item.body}`,
      prompt:
        'Does the item fairly represent its source in this scenario? Identify invented planning details and synthetic controls; do not treat them as source claims.',
      evidence: item.evidence,
    })),
    ...fixture.relations.map((relation): ReviewSubject => {
      const inference =
        (caseName === 'async-owner' && relation.from === 'ATOMIC' && relation.to === 'OWNER') ||
        (caseName === 'semver-deprecation' &&
          relation.from === 'MAJOR' &&
          relation.to === 'DEPRECATE');
      return {
        id: `relationship:${relation.from}>${relation.to}`,
        kind: 'relationship',
        title: `${relation.from} → ${relation.to}`,
        description: [
          `State: ${relation.status}. Basis: ${relation.basis ?? (inference ? 'inferred' : relation.status !== 'confirmed' ? 'synthetic' : 'not labeled in v1 fixture')}.`,
          relation.rationale ?? '',
          inference
            ? 'Priority review: curator inference. The quote does not explicitly assert this dependency. Explain whether the scenario justifies it, or propose a correction.'
            : '',
        ]
          .filter(Boolean)
          .join(' '),
        prompt:
          'Does the downstream item depend on the upstream item in this scenario? Assess direction, direct support versus inference, and candidate state. Proposed/rejected controls must remain outside traversal. Give a reason even when accepting.',
        evidence: relation.evidence,
      };
    }),
    ...fixture.queries.map((query): ReviewSubject => ({
      id: `query:${query.target}`,
      kind: 'query',
      title: `Complete impact set for ${query.target}`,
      description: [
        `Changed target (excluded): ${query.target}`,
        `Expected paths:\n${query.paths.map((p) => p.join(' → ')).join('\n') || '(none)'}`,
        `Excluded: ${query.excluded.join(', ') || '(none)'}`,
      ].join('\n\n'),
      prompt:
        'Check every expected path and exclusion against all items and relationships, including missing dependencies and alternative paths. Shared owner/words alone do not imply impact. Accept only if the entire set is justified.',
    })),
  ];
  // Bind the review instructions as well as the untouched fixture bytes.
  const checklistSha256 = digest(JSON.stringify({ version: 1, fixtureHash, subjects }));
  return { caseName, fixture, fixtureHash, subjects, checklistSha256 };
}
export type ReviewPacket = ReturnType<typeof reviewPacket>;
export const decisions = ['pending', 'accept', 'revise', 'uncertain'] as const;
const recordSchema = z.strictObject({
  schemaVersion: z.literal(1),
  caseName: z.string(),
  caseId: z.string(),
  fixtureSha256: z.string(),
  checklistSha256: z.string(),
  revision: z.number().int().min(0).max(999999),
  savedAt: z.iso.datetime(),
  reviewer: z.strictObject({
    kind: z.enum(['unspecified', 'human', 'automated']),
    name: z.string().trim().max(100),
    attested: z.boolean(),
  }),
  entries: z.array(
    z.strictObject({
      id: z.string(),
      decision: z.enum(decisions),
      reason: z.string().trim().max(2000),
    }),
  ),
});
export type SemanticReview = z.infer<typeof recordSchema>;

export function emptyReview(packet: ReviewPacket): SemanticReview {
  return {
    schemaVersion: 1,
    caseName: packet.caseName,
    caseId: packet.fixture.id,
    fixtureSha256: packet.fixtureHash,
    checklistSha256: packet.checklistSha256,
    revision: 0,
    savedAt: new Date().toISOString(),
    reviewer: { kind: 'unspecified', name: '', attested: false },
    entries: packet.subjects.map((s) => ({ id: s.id, decision: 'pending', reason: '' })),
  };
}

export function validateReview(input: unknown, packet: ReviewPacket): SemanticReview {
  const review = recordSchema.parse(input);
  if (
    review.caseName !== packet.caseName ||
    review.caseId !== packet.fixture.id ||
    review.fixtureSha256 !== packet.fixtureHash ||
    review.checklistSha256 !== packet.checklistSha256
  )
    throw new Error(
      'Review case, fixture or checklist hash mismatch. Do not transfer old judgments silently.',
    );
  const expected = new Set(packet.subjects.map((s) => s.id));
  if (
    review.entries.length !== expected.size ||
    new Set(review.entries.map((e) => e.id)).size !== expected.size ||
    review.entries.some((e) => !expected.has(e.id))
  )
    throw new Error('Review must contain each checklist subject exactly once.');
  if (review.entries.some((e) => e.decision !== 'pending' && !e.reason))
    throw new Error(
      'Every answered subject needs a reason, including Accept. Your input is preserved below.',
    );
  if (
    review.reviewer.attested &&
    (review.reviewer.kind !== 'human' ||
      !review.reviewer.name ||
      review.entries.some((e) => e.decision === 'pending'))
  )
    throw new Error(
      'Human attestation requires a human reviewer name/alias and an answer with reason for every subject.',
    );
  return review;
}

export function summarizeReview(input: unknown, packet: ReviewPacket) {
  const review = validateReview(input, packet);
  const counts = Object.fromEntries(
    decisions.map((d) => [d, review.entries.filter((e) => e.decision === d).length]),
  ) as Record<(typeof decisions)[number], number>;
  const complete = counts.pending === 0;
  const accepted = complete && counts.revise === 0 && counts.uncertain === 0;
  return {
    caseName: packet.caseName,
    fixtureSha256: packet.fixtureHash,
    checklistSha256: packet.checklistSha256,
    revision: review.revision,
    counts,
    complete,
    accepted,
    humanAttestedAcceptance:
      accepted && review.reviewer.kind === 'human' && review.reviewer.attested,
    reviewerKind: review.reviewer.kind,
    identityVerified: false,
    limitation:
      'Reviewer provenance is self-reported, not authenticated. This is semantic adjudication of disclosed gold labels, not a blind benchmark, extraction score or time-saving measurement.',
  };
}
