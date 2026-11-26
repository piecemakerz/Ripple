import type { Item } from '../shared/types.js';
import type { Language } from './i18n-core.js';
import { itemTitle } from './sample-content.js';

// Reading aids are aliases for existing item IDs, never substitutions in stored source text.
export function translatedTitleMatches(items: Item[], query: string, language: Language) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return [];
  return items.filter((item) => {
    const displayed = itemTitle(item, language);
    return displayed !== item.title && displayed.toLocaleLowerCase().includes(term);
  });
}

export function resolveHistoryTitle<T extends { itemId: string; q: string }>(
  filters: T,
  items: Item[],
  language: Language,
): T {
  const exact = translatedTitleMatches(items, filters.q, language).filter(
    (item) =>
      itemTitle(item, language).toLocaleLowerCase() === filters.q.trim().toLocaleLowerCase(),
  );
  if (exact.length !== 1 || (filters.itemId && filters.itemId !== exact[0].id)) return filters;
  return { ...filters, itemId: exact[0].id, q: '' };
}
