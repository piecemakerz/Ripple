import { z } from 'zod';
import type { ChangePage, ChangeSummary } from '../shared/types.js';
import type { RippleStore } from './store.js';
import { AppError } from './errors.js';

const cursorSchema = z
  .object({
    createdAt: z.iso.datetime({ precision: 3 }),
    id: z.uuid(),
  })
  .strict();
const inputSchema = z
  .object({
    cursor: z
      .string()
      .min(1)
      .max(500)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(50))
      .optional(),
  })
  .strict();

export function readChanges(store: RippleStore, raw: unknown = {}): ChangePage {
  const input = inputSchema.parse(raw);
  const limit = input.limit ?? 25;
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (input.cursor) {
    try {
      cursor = cursorSchema.parse(
        JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')),
      );
    } catch {
      throw new AppError(400, 'INVALID_CURSOR', 'Invalid change cursor. Refresh the change list.');
    }
  }
  // Only project scalar metadata. Returning c would decode every saved source/path snapshot.
  const rows = store.query(
    `MATCH (c:Change)
WHERE ($time = '' OR c.createdAt < $time OR (c.createdAt = $time AND c.id < $id))
RETURN c.id AS id, c.itemId AS itemId, c.beforeRevision AS beforeRevision,
  c.afterRevision AS afterRevision, c.createdAt AS createdAt
ORDER BY c.createdAt DESC, c.id DESC LIMIT $take`,
    {
      time: cursor?.createdAt ?? '',
      id: cursor?.id ?? '',
      take: limit + 1,
    },
  ).rows as unknown as ChangeSummary[];
  const entries = rows.slice(0, limit);
  const last = entries.at(-1);
  return {
    entries,
    pageSize: limit,
    nextCursor:
      rows.length > limit && last
        ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString(
            'base64url',
          )
        : null,
  };
}
