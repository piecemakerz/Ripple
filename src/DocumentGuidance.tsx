import type { Message } from './i18n-core.js';
import { useI18n } from './i18n.js';
import { ArrowRight, CheckCircle2, FileText, GitBranch, Quote, ScanSearch } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DocumentPanel } from './workflow-overview.js';

export type DocumentJump =
  | 'document'
  | 'update-document'
  | 'saved-evidence'
  | 'evidence'
  | 'item'
  | 'relationship'
  | 'candidates'
  | 'preview';
export type DocumentReceipt = {
  at: 'source' | 'item' | 'relationship';
  title: Message;
  message: Message;
  action: Message;
  jump: DocumentJump;
};

export function FirstReviewRoute({
  panel,
  busy,
  onJump,
}: {
  panel: DocumentPanel;
  busy: boolean;
  onJump: (destination: DocumentJump) => void;
}) {
  const { t } = useI18n();
  return (
    <section
      className="first-review-route"
      id="document-start"
      tabIndex={-1}
      aria-labelledby="first-review-title"
    >
      <div className="first-review-intro">
        <div>
          <h2 id="first-review-title">{t('Your document. Your first review.')}</h2>
          <p>
            {t(
              'Start with a plan or requirement you already use. Save a fact and a piece of work that depends on it, then explore what a new update changes.',
            )}
          </p>
        </div>
        <button disabled={busy} onClick={() => onJump('document')}>
          {t('Start with a document')}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      <ol aria-label={t('Prepare your first change review')}>
        {(
          [
            ['document', 'Save a source', 'Keep the original text.', FileText, 'sources'],
            ['item', 'Add evidenced items', 'A fact and its dependent work.', Quote, 'items'],
            [
              'relationship',
              'Connect items',
              'Check why the work needs that fact.',
              GitBranch,
              'relationships',
            ],
            [
              'preview',
              'Preview an update',
              'Use new evidence, then apply.',
              ScanSearch,
              'preview',
            ],
          ] as const
        ).map(([destination, title, hint, Icon, location], index) => (
          <li key={destination}>
            <button
              disabled={busy}
              onClick={() => onJump(destination)}
              className={panel === location ? 'in-view' : ''}
              aria-current={panel === location ? 'step' : undefined}
            >
              <span>
                <Icon size={18} aria-hidden="true" />
                <small>{index + 1}</small>
              </span>
              <strong>{t(title)}</strong>
              <span>{t(hint)}</span>
            </button>
          </li>
        ))}
      </ol>
      <details>
        <summary>{t('What makes a useful first document?')}</summary>
        <p>
          {t(
            'A short specification, meeting note or plan with a fact and a decision that relies on it. For example: “Orders close at 16:00” and “Offer same-day dispatch because orders close at 16:00.” Save these as separate items. Later, a notice moving the cutoff to 14:00 supplies evidence for a change.',
          )}
        </p>
        <p>
          {t(
            'Your document stays local. You choose the items and relationships; saving text does not extract them automatically. Your saved sample records stay available.',
          )}
        </p>
      </details>
    </section>
  );
}

export function DocumentEmpty({
  title,
  children,
  action,
  onAction,
}: {
  title: string;
  children: ReactNode;
  action: string;
  onAction: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="document-empty">
      <div className="document-empty-path" aria-hidden="true">
        <FileText size={23} />
        <span />
        <Quote size={20} />
        <span />
        <GitBranch size={22} />
      </div>
      <h3>{t(title)}</h3>
      <p>{children}</p>
      <button onClick={onAction}>
        {t(action)} <ArrowRight size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

export function SavedDocumentStep({
  receipt,
  onJump,
}: {
  receipt: DocumentReceipt;
  onJump: (destination: DocumentJump) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="document-receipt" role="status" tabIndex={-1} id="document-receipt">
      <CheckCircle2 size={20} aria-hidden="true" />
      <div>
        <strong>{t(receipt.title)}</strong>
        <p>{t(receipt.message)}</p>
        <button onClick={() => onJump(receipt.jump)}>
          {t(receipt.action)} <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
