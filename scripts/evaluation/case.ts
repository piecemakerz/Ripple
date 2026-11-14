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
      license: z.literal('MIT'),
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
  for (const source of value.sources) {
    if (digest(source.text) !== source.hash || source.end - source.start !== source.text.length)
      throw new Error(`Source integrity failed: ${source.key}`);
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
  return value;
}
const fixtureText = readFileSync(
  new URL('../../evaluation/async-owner.json', import.meta.url),
  'utf8',
);
export const fixtureHash = digest(fixtureText);
export const evaluationCase = validateCase(JSON.parse(fixtureText));
