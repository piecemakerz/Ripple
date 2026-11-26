import { SampleBody, SampleQuote } from './SampleContent.js';
import { itemTitle, sourceTitle } from './sample-content.js';
import { useI18n } from './i18n.js';
import { ArrowDown, ArrowUpRight, FileText, GitBranch } from 'lucide-react';
import type { EvidenceDetail, Impact, ImpactResult, SourceVersion } from '../shared/types.js';
import { SourceFreshness } from './SourceFreshness.js';
import { highlightedPath, type PathChoice } from './review-presentation.js';

export function EvidenceTrail({
  result,
  selected,
  choice,
  onPath,
  onEvidence,
  after,
  applied,
  compact = false,
  sources,
  onRelationships,
}: {
  result: ImpactResult;
  selected: Impact;
  choice: PathChoice | undefined;
  onPath: (choice: PathChoice) => void;
  onEvidence: (evidence: EvidenceDetail) => void;
  after: string;
  applied: boolean;
  compact?: boolean;
  sources?: SourceVersion[];
  onRelationships?: () => void;
}) {
  const { t, language } = useI18n();
  const active = highlightedPath(selected, choice);
  const path = selected.paths[active.index];
  return (
    <section
      className={`studio-trail ${compact ? 'compact-trail' : ''} ${selected.depth === 1 ? 'direct-trail' : ''}`}
      aria-label={t('Evidence trail')}
      id="studio-trail"
      tabIndex={-1}
    >
      <div className="studio-section-heading">
        <div>
          <span className="studio-caption">{t('Why this item needs a decision')}</span>
          <h2>
            {compact
              ? t('Original evidence for {0}', [itemTitle(selected.item, language)])
              : itemTitle(selected.item, language)}
          </h2>
        </div>
        <span className="studio-impact-tag">
          {selected.depth === 1 ? t('Direct impact') : t('{0} links away', [selected.depth])}
        </span>
      </div>
      {!compact && itemTitle(selected.item, language) !== selected.item.title && (
        <p className="sample-original-title" lang="en">
          {selected.item.title}
        </p>
      )}
      {!compact && <SampleBody item={selected.item} />}
      {(!compact || selected.paths.length > 1) && (
        <div className="studio-paths" role="group" aria-label={t('Evidence paths')}>
          {selected.paths.map((entry, index) => (
            <button
              key={index}
              aria-pressed={active.index === index}
              onClick={() => onPath({ itemId: selected.item.id, index })}
            >
              <GitBranch size={14} aria-hidden="true" />
              {t('Path {0}', [index + 1])}
              <span>
                {entry.edges.length} {entry.edges.length === 1 ? t('link') : t('links')}
              </span>
            </button>
          ))}
        </div>
      )}
      {!compact && (
        <p className="studio-caption">
          {t(
            'Read from the changed item to its consequences. Each quote supports the dependency shown.',
          )}
        </p>
      )}
      {!compact && (
        <details className="trail-context" open>
          <summary>{t('Read the changed context')}</summary>
          <div className="trail-origin">
            <span className="trail-dot" />
            <div>
              <small>{applied ? t('New context') : t('Proposed context')}</small>
              <strong>{itemTitle(result.target, language)}</strong>
              <SampleBody item={result.target} body={after} />
            </div>
          </div>
        </details>
      )}
      <ol className="trail-steps">
        {[...(path?.edges ?? [])].reverse().map((edge) => {
          const dependent = path.nodes.find((node) => node.id === edge.from);
          const prerequisite = path.nodes.find((node) => node.id === edge.to);
          return (
            <li key={edge.id}>
              <span className="trail-connector" aria-hidden="true">
                <ArrowDown size={16} />
              </span>
              <div className="trail-step-heading">
                <span className="trail-node-dot" />
                <h3>{dependent ? itemTitle(dependent, language) : edge.from}</h3>
              </div>
              <p className="trail-relation">
                {t('Depends on')}{' '}
                <strong>{prerequisite ? itemTitle(prerequisite, language) : edge.to}</strong>
              </p>
              {edge.evidence ? (
                <div className="trail-proof">
                  <button
                    id={
                      edge.from === 'T1' && edge.to === 'D1' ? 'sample-impact-evidence' : undefined
                    }
                    onClick={() => edge.evidence && onEvidence(edge.evidence)}
                    aria-label={t('Open original source for {0} to {1}', [edge.from, edge.to])}
                  >
                    <span className="trail-source-icon">
                      <FileText size={17} aria-hidden="true" />
                    </span>
                    <span className="trail-source-title">
                      {sourceTitle(edge.evidence.source, language)}
                      <small>
                        {t('Original source, version {0}', [edge.evidence.source.version])}
                      </small>
                    </span>
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </button>
                  <SampleQuote evidence={edge.evidence} />
                  <SourceFreshness
                    source={edge.evidence.source}
                    newer={edge.evidence.newerSource}
                    sources={sources}
                    onReview={onRelationships}
                  />
                </div>
              ) : (
                <p className="studio-warning">{t('Evidence unavailable for this dependency.')}</p>
              )}
            </li>
          );
        })}
      </ol>
      {!path && (
        <p className="studio-warning">{t('No preserved path is available for this item.')}</p>
      )}
    </section>
  );
}
