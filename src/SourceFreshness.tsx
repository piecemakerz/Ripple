import type { SourceVersion } from '../shared/types.js';
import { newerSourceVersion } from '../shared/source-freshness.js';
import { useI18n } from './i18n.js';

export function SourceFreshness({
  source,
  sources = [],
  newer,
  onReview,
}: {
  source: SourceVersion;
  sources?: readonly SourceVersion[];
  newer?: SourceVersion;
  onReview?: () => void;
}) {
  const { t } = useI18n();
  const latest = newerSourceVersion(source, newer ? [...sources, newer] : sources);
  if (!latest) return null;
  return (
    <aside className="source-freshness" aria-label={t('Newer source available')}>
      <strong>{t('Source version {0} is now available', [latest.version])}</strong>
      <p>
        {t(
          'This evidence stays on version {0}. A newer document does not automatically invalidate the connection.',
          [source.version],
        )}
      </p>
      <details>
        <summary>{t('Compare with the newer document')}</summary>
        <p>
          <strong>{latest.title}</strong>
        </p>
        <pre>{latest.text}</pre>
      </details>
      {onReview && (
        <button className="studio-button secondary" onClick={onReview}>
          {t('Review connections in Documents')}
        </button>
      )}
    </aside>
  );
}
