import { lazy, Suspense, useRef, useState } from 'react';
import { ArrowRight, Check, FileText, GitBranch, LoaderCircle } from 'lucide-react';
import type { ChangeDetail, EvidenceDetail, ImpactResult, Proposal } from '../shared/types.js';
import { useI18n } from './i18n.js';
import { itemTitle } from './sample-content.js';
import { useCompactLayout } from './use-compact-layout.js';
import { SampleQuote } from './SampleContent.js';

const ImpactCanvas = lazy(() =>
  import('./ImpactCanvas.js').then((m) => ({ default: m.ImpactCanvas })),
);

export function FirstLook({
  result,
  selectedId,
  onSelectItem,
  busy,
  disabled,
  error,
  onSource,
  onEvidence,
  onApply,
  onExit,
  onOwn,
  onGuide,
}: {
  result: ImpactResult;
  selectedId: string;
  onSelectItem: (id: string) => void;
  proposal: Proposal;
  busy: boolean;
  disabled: boolean;
  error: string;
  onSource: () => void;
  onEvidence: (evidence: EvidenceDetail) => void;
  onApply: (selectedId?: string) => Promise<ChangeDetail | undefined>;
  onExit: () => void;
  onOwn: () => void;
  onGuide: () => void;
}) {
  const { t, language } = useI18n();
  const compact = useCompactLayout();
  const [revealed, setRevealed] = useState(false);
  const [applying, setApplying] = useState(false);
  const revealHeading = useRef<HTMLHeadingElement>(null);
  const selected = result.impacts.find((i) => i.item.id === selectedId) ?? result.impacts[0];
  const path = selected?.paths[0];
  const waiting = busy || applying;
  function reveal(id?: string) {
    if (id) onSelectItem(id);
    setRevealed(true);
    requestAnimationFrame(() => {
      const heading =
        id && compact ? document.getElementById('first-look-proof-title') : revealHeading.current;
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }
  async function apply() {
    if (waiting || disabled) return;
    setApplying(true);
    try {
      if (await onApply(selected?.item.id)) onExit();
    } finally {
      setApplying(false);
    }
  }
  const entryActions = (
    <div className="ripple-entry-action">
      <button className="first-look-primary" disabled={waiting} onClick={() => reveal()}>
        {revealed ? t('Return to affected work') : t('Learn with an example')}
        <ArrowRight size={18} aria-hidden="true" />
      </button>
      <button className="first-look-text" disabled={waiting} onClick={onOwn}>
        {t('Start with my own document')}
      </button>
    </div>
  );
  return (
    <section className="first-look ripple-entry" aria-labelledby="first-look-title">
      <div className="ripple-intro">
        <div>
          <span className="ripple-example">{t('Interactive example')}</span>
          <h1 id="first-look-title" tabIndex={-1}>
            {t('When requirements change, find the work to review.')}
          </h1>
          <p>
            {t(
              'Connect facts, decisions and tasks from your documents. Ripple traces what a change affects and shows the original evidence, so you can record what to keep, revise or defer.',
            )}
          </p>
          <p className="ripple-scope">
            {t(
              'You prepare the items and connections. Ripple finds the impact. Carrying out the work remains your next step.',
            )}
          </p>
          {entryActions}
        </div>
        <div className="ripple-change-note" aria-label={t('Change comparison')}>
          <span className="ripple-note-label">{t('Example: supplier inventory updates')}</span>
          <div>
            <span>
              <small>{t('Before')}</small>
              {t('Real-time updates')}
            </span>
            <ArrowRight size={24} aria-hidden="true" />
            <strong>
              <small>{t('After')}</small>
              {t('Once a day')}
            </strong>
          </div>
          <p>{t('Would the live stock badge and stock alerts still be right?')}</p>
          <button className="first-look-text" onClick={onSource} disabled={waiting}>
            <FileText size={16} aria-hidden="true" />
            {t('Read the preserved source')}
          </button>
        </div>
      </div>
      <section className="ripple-entry-map" aria-label={t('Impact map')}>
        <div className="ripple-map-key">
          <span className="premise">{t('Changed premise')}</span>
          <span className="decision">{t('Decisions')}</span>
          <span className="task">{t('Tasks')}</span>
        </div>
        <Suspense
          fallback={
            <div className="ripple-map-loading" role="status">
              {t('Loading dependency map…')}
            </div>
          }
        >
          <ImpactCanvas
            result={result}
            selected={selected}
            choice={undefined}
            propagation
            disabled={waiting}
            onSelect={reveal}
          />
        </Suspense>
      </section>
      {result.warnings.map((warning) => (
        <p className="studio-warning" role="alert" key={warning}>
          {t(warning)}
        </p>
      ))}
      {revealed && (
        <section className="first-look-discovery" aria-labelledby="first-look-result">
          <div className="first-look-result-heading">
            <div>
              <h2 id="first-look-result" ref={revealHeading} tabIndex={-1}>
                {t('{0} items deserve a second look.', [result.impacts.length])}
              </h2>
              <p>
                {t(
                  'Select a piece of work to see why. A connection means review it; it does not mean it is broken.',
                )}
              </p>
            </div>
            <span className="first-look-read-only">
              <Check size={15} aria-hidden="true" />
              {t('Preview only · nothing saved yet')}
            </span>
          </div>
          <div className="first-look-work">
            <div className="first-look-items" role="group" aria-label={t('Choose affected work')}>
              {result.impacts.map((impact) => (
                <button
                  key={impact.item.id}
                  aria-pressed={impact.item.id === selected?.item.id}
                  aria-controls="first-look-proof"
                  disabled={waiting}
                  onClick={() => {
                    onSelectItem(impact.item.id);
                    if (window.matchMedia('(max-width: 720px)').matches)
                      requestAnimationFrame(() => {
                        const proof = document.getElementById('first-look-proof-title');
                        proof?.focus({ preventScroll: true });
                        proof?.scrollIntoView({ block: 'start' });
                      });
                  }}
                >
                  <span className="first-look-item-icon">
                    <GitBranch size={19} aria-hidden="true" />
                  </span>
                  <span>
                    <small>
                      {impact.depth === 1 ? t('Direct connection') : t('Through another decision')}
                    </small>
                    <strong>{itemTitle(impact.item, language)}</strong>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              ))}
              <details className="first-look-outside">
                <summary>{t('{0} items outside this change', [result.excluded.length])}</summary>
                <p>{t('No confirmed dependency path was found for these items in this result.')}</p>
                {result.excluded.map((item) => (
                  <span key={item.id}>{itemTitle(item, language)}</span>
                ))}
              </details>
            </div>
            <article
              className="first-look-proof"
              id="first-look-proof"
              aria-label={t('Why this work is connected')}
            >
              {selected && path ? (
                <>
                  <h3 id="first-look-proof-title" tabIndex={-1}>
                    {itemTitle(selected.item, language)}
                  </h3>
                  <p>{t('Follow the change to this work:')}</p>
                  <ol className="first-look-chain">
                    {[...path.nodes].reverse().map((item) => (
                      <li key={item.id}>
                        <span>{itemTitle(item, language)}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="first-look-quotes">
                    {[...path.edges].reverse().map((edge) => (
                      <div key={edge.id}>
                        {edge.evidence ? (
                          <>
                            <SampleQuote evidence={edge.evidence} />
                            <button
                              className="first-look-text"
                              disabled={waiting}
                              onClick={() => onEvidence(edge.evidence!)}
                            >
                              {t('Open original evidence for {0}', [
                                itemTitle(
                                  path.nodes.find((node) => node.id === edge.from),
                                  language,
                                ) || edge.from,
                              ])}
                              <ArrowRight size={14} aria-hidden="true" />
                            </button>
                          </>
                        ) : (
                          <p>{t('Original evidence unavailable')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {selected.paths.length > 1 && (
                    <p>
                      {t(
                        'Showing one of {0} preserved paths. All paths remain available in the workspace.',
                        [selected.paths.length],
                      )}
                    </p>
                  )}
                </>
              ) : (
                <p>
                  {t(
                    'No affected work was found. Open the workspace to inspect the relationships.',
                  )}
                </p>
              )}
              <button
                className="first-look-text first-look-back"
                disabled={waiting}
                onClick={() => reveal()}
              >
                {t('Choose another item')}
              </button>
            </article>
          </div>
          <div className="first-look-handoff">
            <div>
              <h3>{t('You decide what happens next.')}</h3>
              <p>
                {t(
                  'Apply saves this update locally. Then keep, revise or defer each item, with your own reason.',
                )}
              </p>
            </div>
            <button
              className="first-look-primary"
              disabled={waiting || disabled}
              onClick={() => void apply()}
            >
              {waiting ? (
                <LoaderCircle size={18} className="spin" aria-hidden="true" />
              ) : (
                <ArrowRight size={18} aria-hidden="true" />
              )}
              {waiting ? t('Applying change…') : t('Apply & start review')}
            </button>
            {disabled && (
              <p className="first-look-error">
                {t('This preview is not ready to apply. Open the workspace to inspect its state.')}
              </p>
            )}
          </div>
        </section>
      )}
      {error && (
        <p className="first-look-feedback" role="alert">
          {t(error)}
        </p>
      )}
      <div className="first-look-exits">
        <span>{t('Want to explore your own way?')}</span>
        <button className="first-look-text" disabled={waiting} onClick={onExit}>
          {t('Open full workspace')}
        </button>
        <button className="first-look-text" disabled={waiting} onClick={onGuide}>
          {t('Follow the detailed walkthrough')}
        </button>
      </div>
    </section>
  );
}
