import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { digest } from '../../server/sample.js';

const evidence = z.object({ source: z.string(), quote: z.string().min(1) });
const schema = z.object({
  id: z.string(),
  provenance: z.string(),
  sources: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      path: z.string(),
      commit: z.string().regex(/^[a-f0-9]{40}$/),
      license: z.enum(['MIT', 'CC-BY-3.0']),
      url: z.url().optional(),
      attribution: z.string().min(1).optional(),
      start: z.number().int().nonnegative(),
      end: z.number().int(),
      hash: z.string(),
      text: z.string().min(1).max(20000),
    }),
  ),
  items: z.array(
    z.object({
      key: z.string(),
      kind: z.enum(['Assumption', 'Decision', 'Task']),
      title: z.string(),
      body: z.string(),
      evidence,
    }),
  ),
  relations: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      status: z.enum(['confirmed', 'proposed', 'rejected']),
      evidence,
      basis: z.enum(['direct', 'inferred', 'synthetic']).optional(),
      rationale: z.string().min(1).optional(),
    }),
  ),
  queries: z.array(
    z.object({
      target: z.string(),
      paths: z.array(z.array(z.string()).min(2)),
      excluded: z.array(z.string()),
    }),
  ),
  proposal: z.object({ target: z.string(), after: z.string(), evidence }),
  review: z.object({
    item: z.string(),
    status: z.enum(['keep', 'revise', 'defer']),
    reason: z.string(),
  }),
});
export type EvaluationCase = z.infer<typeof schema>;
export type QueryCase = EvaluationCase['queries'][number];
export function validateCase(input: unknown): EvaluationCase {
  const value = schema.parse(input);
  const unique = (values: string[]) => {
    if (new Set(values).size !== values.length) throw new Error('Duplicate fixture key');
  };
  unique(value.sources.map((s) => s.key));
  unique(value.items.map((i) => i.key));
  unique(value.relations.map((r) => `${r.from}>${r.to}`));
  unique(value.queries.map((q) => q.target));
  for (const source of value.sources) {
    if (digest(source.text) !== source.hash || source.end - source.start !== source.text.length)
      throw new Error(`Source integrity failed: ${source.key}`);
    if (source.license === 'CC-BY-3.0' && (!source.url || !source.attribution))
      throw new Error('CC BY sources require an original URL and attribution');
  }
  const itemKeys = new Set(value.items.map((i) => i.key));
  for (const key of [
    value.proposal.target,
    value.review.item,
    ...value.relations.flatMap((r) => [r.from, r.to]),
  ])
    if (!itemKeys.has(key)) throw new Error(`Unknown fixture item: ${key}`);
  for (const ref of [
    ...value.items.map((i) => i.evidence),
    ...value.relations.map((r) => r.evidence),
    value.proposal.evidence,
  ]) {
    const source = value.sources.find((s) => s.key === ref.source);
    if (
      !source ||
      source.text.indexOf(ref.quote) < 0 ||
      source.text.indexOf(ref.quote) !== source.text.lastIndexOf(ref.quote)
    )
      throw new Error('Fixture quote must occur exactly once in its frozen source');
  }
  for (const query of value.queries) {
    unique(query.paths.map((p) => p.join('>')));
    unique(query.excluded);
    if (!itemKeys.has(query.target)) throw new Error('Unknown query target');
    for (const path of query.paths) {
      unique(path);
      if (path.at(-1) !== query.target || path.some((key) => !itemKeys.has(key)))
        throw new Error('Invalid gold path');
      for (let i = 0; i < path.length - 1; i++)
        if (
          !value.relations.some(
            (r) => r.from === path[i] && r.to === path[i + 1] && r.status === 'confirmed',
          )
        )
          throw new Error('Gold path must use confirmed fixture relations');
    }
    const impacted = new Set(query.paths.map((p) => p[0]));
    const partition = new Set([query.target, ...impacted, ...query.excluded]);
    if (
      partition.size !== itemKeys.size ||
      [...partition].some((key) => !itemKeys.has(key)) ||
      query.excluded.some((key) => key === query.target || impacted.has(key))
    )
      throw new Error('Gold expectations must classify every fixture item');
  }
  const proposalQuery = value.queries.find((q) => q.target === value.proposal.target);
  if (!proposalQuery?.paths.some((p) => p[0] === value.review.item))
    throw new Error('Proposal needs a gold query containing the review item');
  return value;
}
export const caseNames = ['async-owner', 'semver-deprecation'] as const;
export type CaseName = (typeof caseNames)[number];
export function loadCase(name: string = 'async-owner') {
  if (!caseNames.includes(name as CaseName)) throw new Error(`Unknown evaluation case: ${name}`);
  const fixtureText = readFileSync(
    new URL(`../../evaluation/${name}.json`, import.meta.url),
    'utf8',
  );
  return { fixture: validateCase(JSON.parse(fixtureText)), fixtureHash: digest(fixtureText) };
}
export const { fixture: evaluationCase, fixtureHash } = loadCase();
