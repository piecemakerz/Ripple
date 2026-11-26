import { itemTitle } from './sample-content.js';
import { message, type Message } from './i18n-core.js';
import { useI18n } from './i18n.js';
import { useEffect, useRef, useState } from 'react';
import { Download, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { ChangeDetail, EvidenceDetail } from '../shared/types.js';
import { api } from './api.js';
import {
  buildDecisionBrief,
  decisionCounts,
  decisionLabels,
  reviewQueue,
} from './review-workflow.js';

export function DecisionBrief({
  detail,
  unsaved,
  onReview,
}: {
  detail: ChangeDetail;
  unsaved: number;
  onReview: (itemId: string) => void;
}) {
  const { t, language } = useI18n();
  const result = detail.change.snapshot;
  const counts = decisionCounts(result.impacts, detail.reviews);
  const pathCount = result.impacts.reduce((sum, impact) => sum + impact.paths.length, 0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<Message>('');
  const downloadRequest = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => downloadRequest.current?.abort(), []);
  async function download() {
    if (downloading) return;
    const abort = new AbortController();
    downloadRequest.current = abort;
    setDownloading(true);
    setDownloadError('');
    try {
      const evidence = await api<EvidenceDetail>(`/api/evidence/${detail.change.evidenceId}`, {
        signal: abort.signal,
      });
      if (abort.signal.aborted) return;
      const url = URL.createObjectURL(
        new Blob([buildDecisionBrief(detail, evidence, language)], {
          type: 'text/markdown;charset=utf-8',
        }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `ripple-decision-brief-${detail.change.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (!abort.signal.aborted)
        setDownloadError(
          message('Could not prepare the complete brief. {0} Try Download brief again.', [
            message((error as Error).message),
          ]),
        );
    } finally {
      if (!abort.signal.aborted) setDownloading(false);
    }
  }
  return (
    <section
      id="sample-brief"
      tabIndex={-1}
      className="studio-brief"
      aria-labelledby="brief-heading"
    >
      <div className="brief-heading">
        <div>
          <span className="studio-caption">{t('Preserved context. Recorded decisions.')}</span>
          <h2 id="brief-heading">{t('The decision brief')}</h2>
          <p>
            {t('{0} Implementation remains open.', [
              counts.pending
                ? t('{0} {1} a decision.', [
                    counts.pending,
                    counts.pending === 1 ? t('item still needs') : t('items still need'),
                  ])
                : t('Every affected item has a recorded decision.'),
            ])}
          </p>
        </div>
        <button
          className="studio-button primary"
          onClick={() => void download()}
          disabled={downloading}
        >
          <Download size={17} aria-hidden="true" />{' '}
          {downloading ? t('Preparing brief…') : t('Download brief')}
        </button>
      </div>
      {downloadError && (
        <p className="studio-warning" role="alert">
          {t(downloadError)}
        </p>
      )}
      {!!unsaved && (
        <p className="studio-warning" role="status">
          {t('{0} {1} unsaved edits. This brief and download include saved decisions only.', [
            unsaved,
            unsaved === 1 ? t('item has') : t('items have'),
          ])}
        </p>
      )}
      <div className="brief-counts" aria-label={t('Saved decision totals')}>
        {(['keep', 'revise', 'defer', 'pending'] as const).map((status) => (
          <div key={status} className={`brief-count ${status}`}>
            <strong>{counts[status]}</strong>
            <span>{t(decisionLabels[status])}</span>
          </div>
        ))}
      </div>
      <p className="studio-caption">
        {t('{0} affected {1} · {2} preserved {3} · Saved revision {4}', [
          result.impacts.length,
          result.impacts.length === 1 ? t('item') : t('items'),
          pathCount,
          pathCount === 1 ? t('path') : t('paths'),
          detail.change.afterRevision,
        ])}
      </p>
      <div className="brief-decisions">
        {reviewQueue(result.impacts).map((impact) => {
          const review = detail.reviews.find((entry) => entry.itemId === impact.item.id);
          const status = review?.status ?? 'pending';
          return (
            <article key={impact.item.id}>
              <span className={`studio-status ${status}`}>
                {status !== 'pending' && <CheckCircle2 size={14} aria-hidden="true" />}
                {t(decisionLabels[status])}
              </span>
              <div>
                <h3>{itemTitle(impact.item, language)}</h3>
                <p>{status === 'pending' ? t('No decision recorded yet.') : review?.reason}</p>
                <small>
                  {t('{0} · {1} impact · {2} {3}', [
                    impact.item.owner,
                    impact.depth === 1 ? t('Direct') : t('Indirect'),
                    impact.paths.length,
                    impact.paths.length === 1 ? t('path') : t('paths'),
                  ])}
                </small>
              </div>
              <button
                className="studio-link"
                onClick={() => onReview(impact.item.id)}
                aria-label={t('Review {0}', [itemTitle(impact.item, language)])}
              >
                {t('Review')}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </article>
          );
        })}
      </div>
      <details className="brief-scope">
        <summary>
          {t('{0} · {1} items', [
            result.limited ? t('Outside the returned results') : t('Outside this ripple'),
            result.excluded.length,
          ])}
        </summary>
        <p>
          {result.limited
            ? t('The traversal is limited. Do not treat these items as unaffected.')
            : t('No confirmed dependency path connects these items to the changed item.')}
        </p>
        <ul>
          {result.excluded.map((item) => (
            <li key={item.id}>
              {itemTitle(item, language)} <span>({item.id})</span>
            </li>
          ))}
        </ul>
      </details>
      <p className="brief-footnote">
        {t(
          'The download includes saved decisions, review history, dependency paths and original quotes with their source versions and character ranges. Unsaved drafts are excluded. Ripple does not generate decision reasons.',
        )}
      </p>
    </section>
  );
}
