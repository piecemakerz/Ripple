import type { ReactNode } from 'react';
import type { EvidenceDetail, Item, SourceVersion } from '../shared/types.js';
import { useI18n } from './i18n.js';
import { evidenceTranslation, itemBody, sampleSource } from './sample-content.js';

function Bilingual({
  translated,
  original,
  hint = false,
  originalOpen = false,
}: {
  translated: ReactNode;
  original: ReactNode;
  hint?: boolean;
  originalOpen?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="sample-bilingual">
      <span className="sample-translation-label">{t('Korean translation · reading aid')}</span>
      {hint && (
        <p className="sample-translation-hint">
          {t(
            'Evidence quotes and character ranges refer to the preserved English original. Copy evidence from the original.',
          )}
        </p>
      )}
      <div lang="ko" className="sample-translated">
        {translated}
      </div>
      <details className="sample-original" open={originalOpen || undefined}>
        <summary>{t('View English original')}</summary>
        <div lang="en">{original}</div>
      </details>
    </div>
  );
}

export function SampleBody({
  item,
  body = item.body ?? '',
}: {
  item: Pick<Item, 'id' | 'title'> & { body?: string };
  body?: string;
}) {
  const { language } = useI18n();
  const translated = itemBody(item, body, language);
  return translated === body ? (
    <p>{body}</p>
  ) : (
    <Bilingual translated={<p>{translated}</p>} original={<p>{body}</p>} />
  );
}

export function SampleQuote({
  evidence,
  originalOpen = false,
}: {
  evidence: EvidenceDetail;
  originalOpen?: boolean;
}) {
  const { language } = useI18n();
  const translated = evidenceTranslation(evidence, language);
  const original = <blockquote>{evidence.quote}</blockquote>;
  return translated ? (
    <Bilingual
      translated={<blockquote>{translated}</blockquote>}
      original={original}
      originalOpen={originalOpen}
    />
  ) : (
    original
  );
}

export function SampleSource({
  source,
  evidence,
}: {
  source: SourceVersion;
  evidence?: EvidenceDetail;
}) {
  const { language, t } = useI18n();
  const translated = sampleSource(source, language);
  // The original alone uses the stored UTF-16 offsets. A translation highlight is
  // allowed only for an exact, authored sentence; no Korean offsets are invented.
  const quote = evidence && evidenceTranslation({ ...evidence, source }, language);
  const validEvidence =
    evidence &&
    evidence.sourceId === source.id &&
    Number.isInteger(evidence.start) &&
    Number.isInteger(evidence.end) &&
    evidence.start >= 0 &&
    evidence.end > evidence.start &&
    evidence.end <= source.text.length &&
    source.text.slice(evidence.start, evidence.end) === evidence.quote;
  const original = (
    <pre className="preserved-source" tabIndex={0} aria-label={t('Preserved original text')}>
      {validEvidence ? (
        <>
          {source.text.slice(0, evidence.start)}
          <mark>{evidence.quote}</mark>
          {source.text.slice(evidence.end)}
        </>
      ) : (
        source.text
      )}
    </pre>
  );
  if (!translated) return original;
  return (
    <Bilingual
      hint
      original={original}
      translated={
        <pre
          className="preserved-source sample-translated-source"
          tabIndex={0}
          aria-label={t('Korean sample document')}
        >
          {translated.passages.map((passage, index) => (
            <span key={index}>
              {quote && passage.original === evidence?.quote ? (
                <mark>{passage.translation}</mark>
              ) : (
                passage.translation
              )}
              {index < translated.passages.length - 1 ? '\n' : ''}
            </span>
          ))}
        </pre>
      }
    />
  );
}
