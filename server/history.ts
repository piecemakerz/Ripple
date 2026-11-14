import { z } from 'zod';
import type { HistoryEntry, HistoryPage } from '../shared/types.js';
import type { RippleStore } from './store.js';
import { AppError } from './errors.js';

const timestamp = z.iso.datetime({ precision: 3 });
const cursorSchema = z.object({ createdAt: timestamp, id: z.string().min(1).max(200) }).strict();
const inputSchema = z
  .object({
    itemId: z.string().min(1).max(150).optional(),
    kind: z.enum(['change', 'review', 'relationship']).optional(),
    status: z.enum(['keep', 'revise', 'defer']).optional(),
    q: z.string().trim().max(200).default(''),
    from: timestamp.optional(),
    until: timestamp.optional(),
    cursor: z.string().min(1).max(500).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25),
  })
  .strict()
  .refine((v) => !v.from || !v.until || v.from < v.until, 'Start must be before end.')
  .refine(
    (v) => !v.status || !v.kind || v.kind === 'review',
    'Decisions filter review events only.',
  );

// Project summaries rather than returning the full saved path/source snapshots.
// Each query filters BEFORE its page bound. Values, dates and cursors are always bound.
const projections = {
  change: `MATCH (c:Change)-[:CHANGES]->(i:Item)
OPTIONAL MATCH (affectedItem:Item)<-[:FOR_ITEM]-(r:Review)-[:FOR_CHANGE]->(c)
WITH c, i, collect(r.itemId) AS affected, collect(affectedItem.title) AS affectedTitles
WITH {id:'change:' + c.id, kind:'change', createdAt:c.createdAt,
  itemIds:[i.id] + affected, changeId:c.id, itemId:i.id, title:i.title,
  before:c.before, after:c.after, beforeRevision:c.beforeRevision,
  afterRevision:c.afterRevision, evidenceId:c.evidenceId} AS event,
  [c.id, i.id, i.title, c.before, c.after] + affected + affectedTitles AS search`,
  review: `MATCH (h:ReviewEvent)-[:FOR_REVIEW]->(r:Review)-[:FOR_CHANGE]->(c:Change)-[:CHANGES]->(changed:Item)
MATCH (r)-[:FOR_ITEM]->(i:Item)
WITH {id:'review:' + h.id, kind:'review', createdAt:h.createdAt,
  itemIds:[i.id, changed.id], changeId:c.id, itemId:i.id, title:i.title,
  changedItemId:changed.id, status:h.status, reason:h.reason} AS event,
  [h.id, c.id, i.id, i.title, changed.id, changed.title, h.reason, h.status] AS search`,
  relationship: `MATCH (a:Item)-[old:DEPENDS_ON]->(b:Item), (x:Item)-[next:DEPENDS_ON]->(y:Item)
WHERE old.supersededBy = next.id AND next.supersedes = old.id
WITH {id:'relationship:' + next.id, kind:'relationship', createdAt:next.createdAt,
  itemIds:[a.id, b.id, x.id, y.id], reason:next.reason,
  previous:{id:old.id, from:a.id, to:b.id, evidenceId:old.evidenceId},
  replacement:{id:next.id, from:x.id, to:y.id, evidenceId:next.evidenceId}} AS event,
  [old.id, next.id, a.id, b.id, x.id, y.id, a.title, b.title, x.title, y.title, next.reason] AS search`,
};
const filter = `
WHERE ($itemId = '' OR $itemId IN event.itemIds)
AND ($status = '' OR event.status = $status)
AND ($q = '' OR toLower(event.id) CONTAINS $q OR any(value IN search WHERE toLower(value) CONTAINS $q))
AND ($from = '' OR event.createdAt >= $from)
AND ($until = '' OR event.createdAt < $until)
AND ($cursorTime = '' OR event.createdAt < $cursorTime OR (event.createdAt = $cursorTime AND event.id < $cursorId))
RETURN event ORDER BY event.createdAt DESC, event.id DESC LIMIT $take`;

export function readHistory(store: RippleStore, raw: unknown): HistoryPage {
  const input = inputSchema.parse(raw);
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (input.cursor) {
    try {
      cursor = cursorSchema.parse(
        JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')),
      );
    } catch {
      throw new AppError(400, 'INVALID_CURSOR', 'Invalid history cursor. Reset the filters.');
    }
  }
  const kinds = input.kind
    ? [input.kind]
    : input.status
      ? ['review' as const]
      : (['change', 'review', 'relationship'] as const);
  const entries = kinds.flatMap((kind) =>
    store
      .query(projections[kind] + filter, {
        itemId: input.itemId ?? '',
        status: input.status ?? '',
        q: input.q.toLowerCase(),
        from: input.from ?? '',
        until: input.until ?? '',
        cursorTime: cursor?.createdAt ?? '',
        cursorId: cursor?.id ?? '',
        take: input.limit + 1,
      })
      .rows.map((r) => r.event as unknown as HistoryEntry),
  );
  // Match Cypher's lexicographic tie-breaker, including equal-millisecond events.
  entries.sort((a, b) =>
    a.createdAt === b.createdAt
      ? a.id < b.id
        ? 1
        : a.id > b.id
          ? -1
          : 0
      : a.createdAt < b.createdAt
        ? 1
        : -1,
  );
  const page = entries
    .slice(0, input.limit)
    .map((e) => ({ ...e, itemIds: [...new Set(e.itemIds)] }));
  const last = page.at(-1);
  return {
    entries: page,
    nextCursor:
      entries.length > input.limit && last
        ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString(
            'base64url',
          )
        : null,
    pageSize: input.limit,
  };
}
