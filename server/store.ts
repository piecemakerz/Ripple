import {
  Database,
  type NodeValue,
  type PathValue,
  type RelationshipValue,
  type ParamValue,
} from '@relate/relate';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  Change,
  ChangeDetail,
  Evidence,
  EvidenceDetail,
  Impact,
  ImpactPath,
  ImpactResult,
  Item,
  Review,
  ReviewEvent,
  SourceVersion,
  Workspace,
} from '../shared/types.js';
import {
  dependencies,
  digest,
  evidences,
  items,
  proposal,
  sources,
  validateEvidence,
} from './sample.js';
import { AppError } from './errors.js';

export const MAX_DEPTH = 8;
export const MAX_PATHS = 500;
// Bound values are application constants, not user-supplied Cypher fragments.
export const IMPACT_QUERY = `MATCH p=(i:Item)-[:DEPENDS_ON*1..${MAX_DEPTH}]->(a:Item {id:$id})
WHERE i.id <> $id AND all(r IN relationships(p) WHERE r.status = 'confirmed')
AND all(n IN nodes(p) WHERE single(m IN nodes(p) WHERE m.id = n.id))
RETURN p LIMIT ${MAX_PATHS + 1}`;

const props = <T>(value: unknown): T => (value as NodeValue).properties as T;

export class RippleStore {
  readonly db: Database;
  readonly conn: ReturnType<Database['connect']>;
  constructor(readonly path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = Database.open(path);
    this.conn = this.db.connect();
  }
  query(cypher: string, params: Record<string, ParamValue> = {}) {
    return this.conn.query(cypher, params);
  }
  transaction<T>(work: () => T): T {
    this.conn.begin();
    try {
      const value = work();
      this.conn.commit();
      return value;
    } catch (error) {
      try {
        this.conn.rollback();
      } catch {
        /* preserve the original failure */
      }
      throw error;
    }
  }
  checkpoint() {
    this.db.checkpoint();
  }
  seed() {
    const meta = this.query('MATCH (m:RippleMeta) RETURN m').rows;
    if (meta.length) {
      if (props<{ version: number }>(meta[0].m).version !== 1)
        throw new Error('Unsupported Ripple schema version');
      return;
    }
    if (this.query('MATCH (n) RETURN n LIMIT 1').rows.length)
      throw new Error('Refusing to seed a non-empty database without Ripple metadata');
    this.transaction(() => {
      for (const label of [
        'Item',
        'SourceVersion',
        'Evidence',
        'Change',
        'Review',
        'ReviewEvent',
        'Proposal',
        'Person',
      ]) {
        this.query(
          `CREATE CONSTRAINT ${label.toLowerCase()}_id IF NOT EXISTS FOR (n:${label}) REQUIRE n.id IS UNIQUE`,
        );
      }
      for (const s of sources) this.query('CREATE (s:SourceVersion $props)', { props: { ...s } });
      for (const e of evidences) {
        validateEvidence(
          e,
          sources.find((s) => s.id === e.sourceId)!,
        );
        this.query(
          'MATCH (s:SourceVersion {id:$sourceId}) CREATE (e:Evidence $props)-[:FROM_SOURCE]->(s)',
          { sourceId: e.sourceId, props: { ...e } },
        );
      }
      for (const item of items) {
        this.query('CREATE (i:Item $props)', { props: { ...item } });
        this.query('MERGE (p:Person {id:$owner}) SET p.name=$owner', { owner: item.owner });
        this.query('MATCH (i:Item {id:$id}), (p:Person {id:$owner}) CREATE (i)-[:OWNED_BY]->(p)', {
          id: item.id,
          owner: item.owner,
        });
      }
      for (const d of dependencies)
        this.query(
          'MATCH (a:Item {id:$from}), (b:Item {id:$to}) CREATE (a)-[:DEPENDS_ON $props]->(b)',
          { from: d.from, to: d.to, props: { ...d } },
        );
      const itemEvidence = ['E-A1', 'E-D1-A1', 'E-D2-A1', 'E-T1-D1', 'E-T2-D2', 'E-T3'];
      items.forEach((item, i) =>
        this.query(
          'MATCH (i:Item {id:$id}), (e:Evidence {id:$evidenceId}) CREATE (i)-[:EVIDENCED_BY {revision:1}]->(e)',
          { id: item.id, evidenceId: itemEvidence[i] },
        ),
      );
      this.query('CREATE (:Proposal $props)', { props: { ...proposal } });
      this.query('CREATE (:RippleMeta {version:1, sample:true})');
    });
    this.checkpoint();
  }
  getItem(id: string): Item {
    const row = this.query('MATCH (i:Item {id:$id}) RETURN i', { id }).rows[0];
    if (!row) throw new AppError(404, 'ITEM_NOT_FOUND', 'This item no longer exists.');
    return props<Item>(row.i);
  }
  getEvidence(id: string): EvidenceDetail {
    const row = this.query(
      'MATCH (e:Evidence {id:$id})-[:FROM_SOURCE]->(s:SourceVersion) RETURN e,s',
      { id },
    ).rows[0];
    if (!row) throw new AppError(422, 'EVIDENCE_MISSING', 'The original evidence is unavailable.');
    const e = props<Evidence>(row.e),
      source = props<SourceVersion>(row.s);
    try {
      validateEvidence(e, source);
    } catch {
      throw new AppError(
        422,
        'EVIDENCE_INVALID',
        'The evidence does not match its original source.',
      );
    }
    return { ...e, source };
  }
  workspace(): Workspace {
    return {
      items: this.query('MATCH (i:Item) RETURN i ORDER BY i.id').rows.map((r) => props<Item>(r.i)),
      sources: this.query('MATCH (s:SourceVersion) RETURN s ORDER BY s.id').rows.map((r) =>
        props<SourceVersion>(r.s),
      ),
      proposals: this.query('MATCH (p:Proposal) RETURN p').rows.map((r) =>
        props<Workspace['proposals'][number]>(r.p),
      ),
      changes: this.query('MATCH (c:Change) RETURN c ORDER BY c.createdAt DESC').rows.map((r) =>
        this.decodeChange(r.c),
      ),
      database: {
        engine: 'Relate',
        version: '1.0.1',
        path: this.path,
        storage: 'Directory · WAL + Parquet checkpoint',
      },
      synthetic: true,
    };
  }
  impact(id: string): ImpactResult {
    const target = this.getItem(id);
    const rows = this.query(IMPACT_QUERY, { id }).rows;
    const grouped = new Map<string, Impact>();
    const evidenceCache = new Map<string, EvidenceDetail | null>();
    let depthBoundary = false;
    for (const row of rows.slice(0, MAX_PATHS)) {
      const raw = row.p as PathValue;
      const nodes = raw.filter((n) => n.kind === 'node').map((n) => props<Item>(n));
      const rels = raw.filter((n) => n.kind === 'relationship') as RelationshipValue[];
      const path: ImpactPath = {
        nodes,
        edges: rels.map((r, index) => {
          const d = r.properties as unknown as ImpactPath['edges'][number];
          if (!evidenceCache.has(d.evidenceId)) {
            try {
              evidenceCache.set(d.evidenceId, this.getEvidence(d.evidenceId));
            } catch (error) {
              if (!(error instanceof AppError)) throw error;
              evidenceCache.set(d.evidenceId, null);
            }
          }
          return {
            id: d.id,
            from: nodes[index].id,
            to: nodes[index + 1].id,
            status: d.status,
            evidenceId: d.evidenceId,
            evidence: evidenceCache.get(d.evidenceId) ?? null,
          };
        }),
      };
      depthBoundary ||= rels.length === MAX_DEPTH;
      const existing = grouped.get(nodes[0].id);
      if (existing) {
        existing.paths.push(path);
        existing.depth = Math.min(existing.depth, rels.length);
        existing.evidenceComplete &&= path.edges.every((e) => !!e.evidence);
      } else
        grouped.set(nodes[0].id, {
          item: nodes[0],
          depth: rels.length,
          paths: [path],
          evidenceComplete: path.edges.every((e) => !!e.evidence),
        });
    }
    const impacts = [...grouped.values()].sort(
      (a, b) => a.depth - b.depth || a.item.id.localeCompare(b.item.id),
    );
    for (const i of impacts)
      i.paths.sort(
        (a, b) =>
          a.edges.length - b.edges.length ||
          a.edges
            .map((e) => e.id)
            .join()
            .localeCompare(b.edges.map((e) => e.id).join()),
      );
    const limited = rows.length > MAX_PATHS || depthBoundary;
    return {
      target,
      impacts,
      excluded: this.workspaceItems().filter((i) => i.id !== id && !grouped.has(i.id)),
      limited,
      maxDepth: MAX_DEPTH,
      maxPaths: MAX_PATHS,
      warnings: [
        ...(limited
          ? ['Results may be incomplete: the traversal reached its depth or path limit.']
          : []),
        ...(impacts.some((i) => !i.evidenceComplete)
          ? [
              'Some paths have missing or invalid evidence. Repair the evidence before applying this change.',
            ]
          : []),
      ],
    };
  }
  private workspaceItems() {
    return this.query('MATCH (i:Item) RETURN i ORDER BY i.id').rows.map((r) => props<Item>(r.i));
  }
  private decodeChange(value: unknown): Change {
    const c = props<Omit<Change, 'snapshot'> & { snapshot: string }>(value);
    return { ...c, snapshot: JSON.parse(c.snapshot) as ImpactResult };
  }
  getChange(id: string): ChangeDetail {
    const row = this.query('MATCH (c:Change {id:$id}) RETURN c', { id }).rows[0];
    if (!row) throw new AppError(404, 'CHANGE_NOT_FOUND', 'This change no longer exists.');
    const reviews = this.query(
      'MATCH (r:Review)-[:FOR_CHANGE]->(c:Change {id:$id}) RETURN r ORDER BY r.itemId',
      { id },
    ).rows.map((r) => {
      const review = props<Review>(r.r);
      const history = this.query(
        'MATCH (h:ReviewEvent)-[:FOR_REVIEW]->(r:Review {id:$id}) RETURN h ORDER BY h.createdAt DESC',
        { id: review.id },
      ).rows.map((h) => props<ReviewEvent>(h.h));
      return { ...review, history };
    });
    return { change: this.decodeChange(row.c), reviews };
  }
  applyChange(input: {
    requestId: string;
    itemId: string;
    expectedRevision: number;
    after: string;
    evidenceId: string;
  }): ChangeDetail {
    const fingerprint = digest(JSON.stringify(input));
    return this.transaction(() => {
      const previous = this.query('MATCH (c:Change {requestId:$requestId}) RETURN c', {
        requestId: input.requestId,
      }).rows[0];
      if (previous) {
        const saved = props<{ id: string; fingerprint: string }>(previous.c);
        if (saved.fingerprint !== fingerprint)
          throw new AppError(
            409,
            'REQUEST_REUSED',
            'This request was already used for a different change.',
          );
        return this.getChange(saved.id);
      }
      const item = this.getItem(input.itemId);
      if (item.revision !== input.expectedRevision)
        throw new AppError(
          409,
          'REVISION_CONFLICT',
          'This item changed since your preview. Reload the latest version before applying.',
        );
      if (item.body === input.after)
        throw new AppError(409, 'NO_CHANGE', 'This update is already reflected in the item.');
      this.getEvidence(input.evidenceId);
      const snapshot = this.impact(item.id);
      if (snapshot.limited || snapshot.impacts.some((i) => !i.evidenceComplete))
        throw new AppError(
          422,
          'INCOMPLETE_IMPACT',
          'This impact preview is incomplete. Resolve the warning before applying the change.',
        );
      const id = randomUUID(),
        createdAt = new Date().toISOString();
      const change = {
        id,
        requestId: input.requestId,
        fingerprint,
        itemId: item.id,
        before: item.body,
        after: input.after,
        beforeRevision: item.revision,
        afterRevision: item.revision + 1,
        evidenceId: input.evidenceId,
        createdAt,
        snapshot: JSON.stringify(snapshot),
      };
      this.query(
        'MATCH (i:Item {id:$itemId}), (e:Evidence {id:$evidenceId}) CREATE (c:Change $props)-[:CHANGES]->(i) CREATE (c)-[:EVIDENCED_BY]->(e)',
        { itemId: item.id, evidenceId: input.evidenceId, props: change },
      );
      for (const impact of snapshot.impacts) {
        const review = {
          id: `${id}:${impact.item.id}`,
          changeId: id,
          itemId: impact.item.id,
          status: 'pending',
          reason: '',
          updatedAt: createdAt,
          snapshot: JSON.stringify(impact.paths),
        };
        this.query(
          'MATCH (c:Change {id:$changeId}), (i:Item {id:$itemId}) CREATE (r:Review $props)-[:FOR_CHANGE]->(c) CREATE (r)-[:FOR_ITEM]->(i)',
          { changeId: id, itemId: impact.item.id, props: review },
        );
      }
      this.query(
        'MATCH (i:Item {id:$id}), (e:Evidence {id:$evidenceId}) SET i.body=$body, i.revision=$revision CREATE (i)-[:EVIDENCED_BY {revision:$revision}]->(e)',
        {
          id: item.id,
          body: input.after,
          revision: item.revision + 1,
          evidenceId: input.evidenceId,
        },
      );
      return this.getChange(id);
    });
  }
  saveReview(
    changeId: string,
    itemId: string,
    status: Exclude<Review['status'], 'pending'>,
    reason: string,
  ): ChangeDetail {
    return this.transaction(() => {
      const detail = this.getChange(changeId);
      const review = detail.reviews.find((r) => r.itemId === itemId);
      if (!review)
        throw new AppError(404, 'REVIEW_NOT_FOUND', 'This item is not in the change review.');
      if (review.status === status && review.reason === reason) return detail;
      const createdAt = new Date().toISOString();
      this.query(
        'MATCH (r:Review {id:$id}) SET r.status=$status, r.reason=$reason, r.updatedAt=$time CREATE (h:ReviewEvent $event)-[:FOR_REVIEW]->(r)',
        {
          id: review.id,
          status,
          reason,
          time: createdAt,
          event: { id: randomUUID(), status, reason, createdAt },
        },
      );
      return this.getChange(changeId);
    });
  }
}
