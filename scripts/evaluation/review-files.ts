import { randomUUID } from 'node:crypto';
import { linkSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptyReview, validateReview, type ReviewPacket, type SemanticReview } from './review.js';

export class ReviewConflict extends Error {}
const filename = (revision: number) => `${String(revision).padStart(6, '0')}.json`;

export function readReview(directory: string, packet: ReviewPacket, revision?: number) {
  const folder = join(directory, packet.caseName);
  mkdirSync(folder, { recursive: true });
  const files = readdirSync(folder)
    .filter((name) => /^\d{6}\.json$/.test(name))
    .sort();
  if (revision === undefined && files.length === 0) return emptyReview(packet);
  const name = revision === undefined ? files.at(-1)! : filename(revision);
  const review = validateReview(JSON.parse(readFileSync(join(folder, name), 'utf8')), packet);
  if (filename(review.revision) !== name || review.revision === 0)
    throw new Error('Review artifact revision does not match its filename.');
  return review;
}

export function saveReview(directory: string, packet: ReviewPacket, input: SemanticReview) {
  const review = validateReview(input, packet);
  const current = readReview(directory, packet);
  if (review.revision !== current.revision)
    throw new ReviewConflict(
      'Another save changed this worksheet. Your draft is shown below. Copy your edits before reloading the saved version.',
    );
  if (current.revision >= 1000)
    throw new Error(
      'This case reached the 1,000-snapshot limit. Start a separate review directory; existing snapshots are preserved.',
    );
  const next = { ...review, revision: current.revision + 1, savedAt: new Date().toISOString() };
  const folder = join(directory, packet.caseName);
  const temporary = join(folder, `.pending-${randomUUID()}`);
  writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { flag: 'wx' });
  try {
    // Publish a fully written file without overwriting an existing revision, even across owners.
    linkSync(temporary, join(folder, filename(next.revision)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new ReviewConflict(
        'Another save won this revision. Copy your edits before reloading the saved version.',
      );
    throw error;
  } finally {
    unlinkSync(temporary);
  }
  return next;
}
