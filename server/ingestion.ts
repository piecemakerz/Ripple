import { z } from 'zod';
import type {
  Candidate,
  DependencyRecord,
  Evidence,
  Item,
  Proposal,
  SourceVersion,
} from '../shared/types.js';
import type { RippleStore } from './store.js';
import { randomUUID } from 'node:crypto';
import { digest, validateEvidence } from './sample.js';
import { AppError } from './errors.js';

const id = z.string().min(1).max(150);
const requestId = z.uuid();
const text = z
  .string()
  .min(1)
  .max(20000)
  .refine((s) => !!s.trim(), 'Enter document text.');
export const sourceInput = z
  .object({
    requestId,
    documentId: id.optional(),
    expectedVersion: z.number().int().nonnegative(),
    title: z.string().trim().min(1).max(200),
    text,
  })
  .strict();
const evidence = z
  .object({
    sourceId: id,
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    quote: z.string().min(1).max(10000),
  })
  .strict();
export const itemInput = z
  .object({
    requestId,
    kind: z.enum(['Assumption', 'Decision', 'Task']),
    title: z.string().trim().min(1).max(150),
    body: z.string().trim().min(1).max(10000),
    owner: z.string().trim().min(1).max(100),
    evidence,
  })
  .strict();
export const candidateInput = z
  .object({
    requestId,
    from: id,
    to: id,
    fromRevision: z.number().int().positive(),
    toRevision: z.number().int().positive(),
    evidence,
  })
  .strict();
export const decisionInput = z
  .object({
    requestId,
    expectedRevision: z.number().int().positive(),
    status: z.enum(['confirmed', 'rejected']),
  })
  .strict();
export const replacementInput = candidateInput.extend({
  expectedRevision: z.number().int().positive(),
  reason: z.string().trim().min(1).max(4000),
});
export const proposalInput = z
  .object({
    requestId,
    itemId: id,
    expectedRevision: z.number().int().positive(),
    after: z.string().trim().min(1).max(10000),
    evidence,
  })
  .strict();

const properties = <T>(value: unknown) => (value as { properties: T }).properties;
export class Ingestion {
  constructor(private store: RippleStore) {}
  private mutate<T>(operation: string, input: { requestId: string }, work: () => T): T {
    const s = this.store;
    return s.transaction(() => {
      const fingerprint = digest(JSON.stringify({ operation, input }));
      const row = s.query('MATCH (m:Mutation {id:$id}) RETURN m', { id: input.requestId }).rows[0];
      if (row) {
        const saved = properties<{ fingerprint: string; result: string }>(row.m);
        if (saved.fingerprint !== fingerprint)
          throw new AppError(
            409,
            'REQUEST_REUSED',
            'This request was already used with different input.',
          );
        return JSON.parse(saved.result) as T;
      }
      const result = work();
      s.query('CREATE (:Mutation $props)', {
        props: { id: input.requestId, fingerprint, result: JSON.stringify(result) },
      });
      return result;
    });
  }
  private limit(label: 'SourceVersion' | 'Item' | 'Proposal', maximum: number) {
    if (this.store.query(`MATCH (n:${label}) RETURN n.id LIMIT ${maximum}`).rows.length >= maximum)
      throw new AppError(
        422,
        'WORKSPACE_LIMIT',
        `This local workspace supports up to ${maximum} ${label} records.`,
      );
  }
  private revision(id: string, expected: number) {
    const item = this.store.getItem(id);
    if (item.revision !== expected)
      throw new AppError(
        409,
        'REVISION_CONFLICT',
        'An item changed. Reload and create a new candidate or proposal from the current version.',
      );
    return item;
  }
  private saveEvidence(input: z.infer<typeof evidence>): Evidence {
    const row = this.store.query('MATCH (s:SourceVersion {id:$id}) RETURN s', {
      id: input.sourceId,
    }).rows[0];
    if (!row) throw new AppError(404, 'SOURCE_NOT_FOUND', 'Select a saved source version.');
    const value = { id: randomUUID(), ...input };
    try {
      validateEvidence(value, properties<SourceVersion>(row.s));
    } catch {
      throw new AppError(
        422,
        'EVIDENCE_INVALID',
        'Select an exact, non-empty quote from the saved source.',
      );
    }
    if (!value.quote.trim())
      throw new AppError(422, 'EVIDENCE_INVALID', 'Evidence cannot contain only whitespace.');
    this.store.query(
      'MATCH (s:SourceVersion {id:$sourceId}) CREATE (e:Evidence $props)-[:FROM_SOURCE]->(s)',
      { sourceId: value.sourceId, props: { ...value } },
    );
    return value;
  }
  source(raw: unknown): SourceVersion {
    const input = sourceInput.parse(raw);
    return this.mutate('source', input, () => {
      this.limit('SourceVersion', 50);
      const previous = input.documentId
        ? this.store
            .query('MATCH (s:SourceVersion {documentId:$id}) RETURN s LIMIT 51', {
              id: input.documentId,
            })
            .rows.map((r) => properties<SourceVersion>(r.s))
        : [];
      if (input.documentId && !previous.length)
        throw new AppError(404, 'SOURCE_NOT_FOUND', 'This document does not exist.');
      // Imported versions use an integer sequence. Built-in sample version strings are not import targets.
      if (previous.some((s) => !/^\d+$/.test(s.version)))
        throw new AppError(
          409,
          'SAMPLE_SOURCE',
          'Import a new document instead of updating the built-in sample.',
        );
      const latest = Math.max(0, ...previous.map((s) => Number(s.version)));
      if (latest !== input.expectedVersion)
        throw new AppError(
          409,
          'VERSION_CONFLICT',
          'A newer source version exists. Reload before saving another version.',
        );
      const value: SourceVersion = {
        id: randomUUID(),
        documentId: input.documentId ?? randomUUID(),
        version: String(latest + 1),
        title: input.title,
        text: input.text,
        hash: digest(input.text),
      };
      this.store.query('CREATE (:SourceVersion $props)', { props: { ...value } });
      return value;
    });
  }
  item(raw: unknown): Item {
    const input = itemInput.parse(raw);
    return this.mutate('item', input, () => {
      this.limit('Item', 100);
      const e = this.saveEvidence(input.evidence);
      const value: Item = {
        id: `I-${randomUUID().slice(0, 8)}`,
        kind: input.kind,
        title: input.title,
        body: input.body,
        owner: input.owner,
        revision: 1,
      };
      this.store.query(
        'MATCH (e:Evidence {id:$e}) CREATE (i:Item $props)-[:EVIDENCED_BY {revision:1}]->(e)',
        { e: e.id, props: { ...value } },
      );
      this.store.query('MERGE (p:Person {id:$owner}) SET p.name=$owner', { owner: value.owner });
      this.store.query(
        'MATCH (i:Item {id:$id}), (p:Person {id:$owner}) CREATE (i)-[:OWNED_BY]->(p)',
        { id: value.id, owner: value.owner },
      );
      return value;
    });
  }
  candidate(raw: unknown): Candidate {
    const input = candidateInput.parse(raw);
    return this.mutate('candidate', input, () => {
      if (input.from === input.to)
        throw new AppError(422, 'SELF_DEPENDENCY', 'Choose two different items.');
      this.revision(input.from, input.fromRevision);
      this.revision(input.to, input.toRevision);
      if (this.store.query('MATCH ()-[r:DEPENDS_ON]->() RETURN r.id LIMIT 200').rows.length >= 200)
        throw new AppError(
          422,
          'WORKSPACE_LIMIT',
          'This workspace supports up to 200 dependency records.',
        );
      if (
        this.store.query(
          "MATCH (:Item {id:$from})-[r:DEPENDS_ON]->(:Item {id:$to}) WHERE r.status IN ['proposed', 'confirmed'] RETURN r LIMIT 1",
          { from: input.from, to: input.to },
        ).rows.length
      )
        throw new AppError(
          409,
          'DUPLICATE_DEPENDENCY',
          'An active dependency already exists for these items.',
        );
      const e = this.saveEvidence(input.evidence);
      const value: Candidate = {
        id: randomUUID(),
        from: input.from,
        to: input.to,
        fromRevision: input.fromRevision,
        toRevision: input.toRevision,
        status: 'proposed',
        evidenceId: e.id,
        revision: 1,
      };
      this.store.query(
        'MATCH (a:Item {id:$from}), (b:Item {id:$to}) CREATE (a)-[:DEPENDS_ON $props]->(b)',
        { from: value.from, to: value.to, props: { ...value } },
      );
      return value;
    });
  }
  decide(id: string, raw: unknown): Candidate {
    const input = decisionInput.parse(raw);
    return this.mutate(`decision:${id}`, input, () => {
      const row = this.store.query('MATCH ()-[r:DEPENDS_ON {id:$id}]->() RETURN r', { id }).rows[0];
      if (!row) throw new AppError(404, 'CANDIDATE_NOT_FOUND', 'Candidate not found.');
      const candidate = properties<Candidate>(row.r);
      if (candidate.revision !== input.expectedRevision || candidate.status !== 'proposed')
        throw new AppError(
          409,
          'REVISION_CONFLICT',
          'This candidate has already been reviewed. Reload to see its decision.',
        );
      if (input.status === 'confirmed') {
        this.revision(candidate.from, candidate.fromRevision);
        this.revision(candidate.to, candidate.toRevision);
        this.store.getEvidence(candidate.evidenceId);
      }
      this.store.query(
        'MATCH ()-[r:DEPENDS_ON {id:$id}]->() SET r.status=$status, r.revision=$revision',
        { id, status: input.status, revision: candidate.revision + 1 },
      );
      return { ...candidate, status: input.status, revision: candidate.revision + 1 };
    });
  }
  replace(id: string, raw: unknown): DependencyRecord {
    const input = replacementInput.parse(raw);
    return this.mutate(`replace:${id}`, input, () => {
      const row = this.store.query(
        'MATCH (a:Item)-[r:DEPENDS_ON {id:$id}]->(b:Item) RETURN r, a.id AS from, b.id AS to LIMIT 1',
        { id },
      ).rows[0];
      if (!row) throw new AppError(404, 'DEPENDENCY_NOT_FOUND', 'Dependency not found.');
      const old = properties<DependencyRecord>(row.r);
      const revision = old.revision ?? 1; // Original sample edges predate candidate revisions.
      if (old.status !== 'confirmed' || revision !== input.expectedRevision)
        throw new AppError(
          409,
          'REVISION_CONFLICT',
          'This relationship changed. Reload and reopen the editor.',
        );
      if (input.from === input.to)
        throw new AppError(422, 'SELF_DEPENDENCY', 'Choose two different items.');
      this.revision(input.from, input.fromRevision);
      this.revision(input.to, input.toRevision);
      if (this.store.query('MATCH ()-[r:DEPENDS_ON]->() RETURN r.id LIMIT 200').rows.length >= 200)
        throw new AppError(
          422,
          'WORKSPACE_LIMIT',
          'This workspace supports up to 200 dependency records, including history.',
        );
      if (
        this.store.query(
          "MATCH (:Item {id:$from})-[r:DEPENDS_ON]->(:Item {id:$to}) WHERE r.id <> $id AND r.status IN ['proposed', 'confirmed'] RETURN r LIMIT 1",
          { id, from: input.from, to: input.to },
        ).rows.length
      )
        throw new AppError(
          409,
          'DUPLICATE_DEPENDENCY',
          'An active dependency already exists for these items.',
        );
      const original = this.store.getEvidence(old.evidenceId);
      const e = input.evidence;
      if (
        row.from === input.from &&
        row.to === input.to &&
        original.sourceId === e.sourceId &&
        original.start === e.start &&
        original.end === e.end &&
        original.quote === e.quote
      )
        throw new AppError(409, 'NO_CHANGE', 'Change the endpoints or select different evidence.');
      const saved = this.saveEvidence(e);
      const value = {
        id: randomUUID(),
        from: input.from,
        to: input.to,
        fromRevision: input.fromRevision,
        toRevision: input.toRevision,
        status: 'confirmed' as const,
        revision: 1,
        evidenceId: saved.id,
        supersedes: id,
        reason: input.reason,
        createdAt: new Date().toISOString(),
      };
      // Preserve the old edge and evidence; only its lifecycle fields change.
      this.store.query(
        "MATCH ()-[r:DEPENDS_ON {id:$id}]->() SET r.status='superseded', r.revision=$revision, r.supersededBy=$next",
        { id, revision: revision + 1, next: value.id },
      );
      this.store.query(
        'MATCH (a:Item {id:$from}), (b:Item {id:$to}) CREATE (a)-[:DEPENDS_ON $props]->(b)',
        { from: value.from, to: value.to, props: { ...value } },
      );
      return value;
    });
  }
  proposal(raw: unknown): Proposal {
    const input = proposalInput.parse(raw);
    return this.mutate('proposal', input, () => {
      this.limit('Proposal', 100);
      const item = this.revision(input.itemId, input.expectedRevision);
      if (item.body === input.after)
        throw new AppError(409, 'NO_CHANGE', 'Enter an updated item description.');
      const e = this.saveEvidence(input.evidence);
      const value: Proposal = {
        id: randomUUID(),
        itemId: item.id,
        title: item.title,
        after: input.after,
        expectedRevision: item.revision,
        evidenceId: e.id,
      };
      this.store.query('CREATE (:Proposal $props)', { props: { ...value } });
      return value;
    });
  }
}
