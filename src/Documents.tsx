import { SampleSource, SampleQuote, SampleBody } from './SampleContent.js';
import { itemTitle as sampleItemTitle, sourceTitle } from './sample-content.js';
import { message } from './i18n-core.js';
import { useI18n } from './i18n.js';
import { useEffect, useRef, useState } from 'react';
import { FileText, GitBranch, ArrowRight, CheckCircle2, Layers3 } from 'lucide-react';
import type {
  Candidate,
  Evidence,
  Item,
  ItemKind,
  Proposal,
  SourceVersion,
  Workspace,
} from '../shared/types.js';
import { api } from './api.js';
import { evidenceMatches } from '../shared/evidence-selection.js';
import { Relationships } from './Relationships.js';
import type { DocumentPanel } from './workflow-overview.js';
import { useSampleGuide } from './sample-guide-context.js';
import {
  DocumentEmpty,
  FirstReviewRoute,
  SavedDocumentStep,
  type DocumentJump,
  type DocumentReceipt,
} from './DocumentGuidance.js';
import { changePreparation } from './document-guidance.js';
import { emptyDocumentDraft, unsavedDocumentSections } from './draft-safety.js';

export function Documents({
  workspace,
  onWorkspace,
  onPreview,
  onEvidence,
  panel,
  onPanel,
  onDirtyChange,
}: {
  workspace: Workspace;
  onWorkspace: (value: Workspace) => void;
  onPreview: (proposal: Proposal) => void;
  onEvidence: (id: string) => Promise<void>;
  panel: DocumentPanel;
  onPanel: (panel: DocumentPanel) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { t, locale, language } = useI18n();
  const guide = useSampleGuide();
  const sampleReading = guide?.atStep && guide.step <= 1;
  const [showDocumentTools, setShowDocumentTools] = useState(false);
  const [quoteTask, setQuoteTask] = useState<'items' | 'relationships' | 'preview'>('items');
  const [choosingEvidence, setChoosingEvidence] = useState(false);
  useEffect(() => {
    if (sampleReading) {
      setShowDocumentTools(false);
      setChoosingEvidence(false);
    }
  }, [sampleReading, guide?.step]);
  function showPanel(next: typeof panel) {
    setChoosingEvidence(false);
    if (next !== 'sources') setQuoteTask(next);
    onPanel(next);
    requestAnimationFrame(() => {
      const element = document.getElementById('document-panel');
      element?.focus({ preventScroll: true });
      element?.scrollIntoView({ block: 'start' });
    });
  }
  function jump(destination: DocumentJump) {
    if (busy) return;
    const selecting = destination === 'evidence' || destination === 'saved-evidence';
    const nextPanel = selecting
      ? destination === 'saved-evidence'
        ? quoteTask
        : panel === 'relationships' || panel === 'preview'
          ? panel
          : 'items'
      : destination === 'preview'
        ? 'preview'
        : destination === 'relationship' || destination === 'candidates'
          ? 'relationships'
          : destination === 'document' || destination === 'update-document'
            ? 'sources'
            : 'items';
    setChoosingEvidence(selecting && nextPanel !== 'items');
    setQuoteTask(
      destination === 'update-document' ? 'preview' : nextPanel === 'sources' ? 'items' : nextPanel,
    );
    onPanel(nextPanel);
    setShowDocumentTools(true);
    requestAnimationFrame(() => {
      const id = {
        document: 'document-title',
        'update-document': 'document-title',
        'saved-evidence': source ? 'evidence-quote' : 'document-evidence',
        evidence: source ? 'evidence-quote' : 'document-evidence',
        item: 'item-title',
        relationship: 'document-relationship',
        candidates: 'document-candidates',
        preview: 'document-preview',
      }[destination];
      const element = document.getElementById(id);
      element?.focus({ preventScroll: true });
      element?.scrollIntoView({ block: 'start' });
    });
  }
  const [documentId, setDocumentId] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [quote, setQuote] = useState('');
  const [occurrence, setOccurrence] = useState(-1);
  const [kind, setKind] = useState<ItemKind>('Task');
  const [itemTitle, setItemTitle] = useState('');
  const [body, setBody] = useState('');
  const [owner, setOwner] = useState('Me');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [target, setTarget] = useState('');
  const [after, setAfter] = useState('');
  const [savedDraft, setSavedDraft] = useState(emptyDocumentDraft);
  const [replacementDirty, setReplacementDirty] = useState(false);
  const inputs = {
    documentId,
    title,
    text,
    sourceId,
    quote,
    occurrence,
    kind,
    itemTitle,
    body,
    owner,
    from,
    to,
    target,
    after,
  };
  const dirty =
    replacementDirty || Object.values(unsavedDocumentSections(inputs, savedDraft)).some(Boolean);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  function markSaved(values: Partial<typeof inputs>) {
    setSavedDraft((saved) => ({ ...saved, sourceId, quote, occurrence, ...values }));
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [failedControl, setFailedControl] = useState('');
  const [receipt, setReceipt] = useState<DocumentReceipt>();
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  // Reuse the key after a lost response; changed input gets a different request.
  const requests = useRef(new Map<string, string>());
  const source = workspace.sources.find((s) => s.id === sourceId);
  const documents = [
    ...new Map(
      workspace.sources.filter((s) => /^\d+$/.test(s.version)).map((s) => [s.documentId, s]),
    ).values(),
  ];
  const latestVersion = Math.max(
    0,
    ...workspace.sources.filter((s) => s.documentId === documentId).map((s) => Number(s.version)),
  );
  const matches = source ? evidenceMatches(source.text, quote) : [];
  const match = matches.length === 1 ? matches[0] : matches.find((m) => m.start === occurrence);
  const evidence: Omit<Evidence, 'id'> | undefined =
    source && match && quote.trim() ? { sourceId: source.id, ...match } : undefined;
  const createdItems = workspace.items.filter((item) => createdIds.includes(item.id));
  const preparation = changePreparation(workspace, target, evidence, after);
  const targetItem = workspace.items.find((item) => item.id === target);
  const itemOption = (i: Item) => (
    <option key={i.id} value={i.id}>
      {t('{0} ({1}) · v{2}', [sampleItemTitle(i, language), i.id, i.revision])}
    </option>
  );
  const options = createdItems.length ? (
    <>
      <optgroup label={t('Added in this session')}>{createdItems.map(itemOption)}</optgroup>
      <optgroup label={t('Other workspace items')}>
        {workspace.items.filter((item) => !createdIds.includes(item.id)).map(itemOption)}
      </optgroup>
    </>
  ) : (
    workspace.items.map(itemOption)
  );

  async function run<T>(
    path: string,
    payload: object,
    done?: (result: T) => DocumentReceipt | void,
    method = 'POST',
  ) {
    setBusy(true);
    setError('');
    setFailedControl('');
    setReceipt(undefined);
    const key = JSON.stringify({ path, payload });
    if (!requests.current.has(key)) requests.current.set(key, crypto.randomUUID());
    try {
      const result = await api<T>(path, {
        method,
        body: JSON.stringify({ ...payload, requestId: requests.current.get(key) }),
      });
      const latest = await api<Workspace>('/api/workspace');
      onWorkspace(latest);
      const next = done?.(result);
      if (next) {
        setReceipt(next);
        requestAnimationFrame(() => {
          const element = document.getElementById('document-receipt');
          element?.focus({ preventScroll: true });
          element?.scrollIntoView({ block: 'center' });
        });
      }
    } catch (e) {
      setError((e as Error).message);
      setFailedControl(
        path === '/api/sources'
          ? 'document-save'
          : path === '/api/items'
            ? 'item-save'
            : path === '/api/proposals'
              ? 'preview-save'
              : method === 'PUT'
                ? 'document-candidates'
                : 'relationship-save',
      );
      requestAnimationFrame(() => {
        const element = document.getElementById('document-feedback');
        element?.focus({ preventScroll: true });
        element?.scrollIntoView({ block: 'center' });
      });
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    setBusy(true);
    try {
      onWorkspace(await api<Workspace>('/api/workspace'));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="documents" aria-labelledby="documents-title">
      <header className="workspace-heading">
        <div>
          <span className="workspace-caption">
            <FileText size={15} aria-hidden="true" />
            {t('Preserved context')}
          </span>
          <h1 id="documents-title">{t('Documents & relationships')}</h1>
          <p>{t('Bring in a source. Connect the evidence. Make every change traceable.')}</p>
        </div>
        <div className="workspace-inventory" aria-label={t('Workspace contents')}>
          <span>
            <strong>{workspace.sources.length}</strong>
            {t('source versions')}
          </span>
          <span>
            <strong>{workspace.items.length}</strong>
            {t('items')}
          </span>
          <span>
            <strong>{workspace.dependencies.filter((d) => d.status === 'confirmed').length}</strong>
            {t('confirmed links')}
          </span>
        </div>
      </header>
      {!guide && <FirstReviewRoute panel={panel} busy={busy} onJump={jump} />}
      <nav
        className="document-navigation"
        hidden={!guide || (sampleReading && !showDocumentTools)}
        aria-label={t('Document workflow sections')}
      >
        {(
          [
            ['sources', 'Save a source', FileText],
            ['items', 'Add evidenced items', Layers3],
            ['relationships', 'Relationships', GitBranch],
            ['preview', 'Preview change', ArrowRight],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            disabled={busy}
            aria-pressed={panel === value}
            aria-controls="document-panel"
            onClick={() => showPanel(value)}
          >
            <Icon size={17} aria-hidden="true" />
            {t(label)}
            {value === 'relationships' && (
              <span className="workspace-count">
                {t('{0} pending', [
                  workspace.candidates.filter((c) => c.status === 'proposed').length,
                ])}
              </span>
            )}
          </button>
        ))}
      </nav>
      {sampleReading && (
        <section className="sample-document-ready" aria-label={t('Ready-made sample')}>
          <FileText size={24} aria-hidden="true" />
          <div>
            <h2>
              {guide?.step === 1
                ? t('The sample connection is ready')
                : t('The sample source is ready')}
            </h2>
            <p>
              {guide?.step === 1 ? (
                t(
                  'Read the confirmed badge connection below, then open its original evidence. No new item or connection is needed.',
                )
              ) : (
                <>
                  {t('Read the supplier update with')} <strong>{t('Open sample source')}</strong>{' '}
                  {t(
                    'in the guide. Document tools are optional during this task; any drafts stay here.',
                  )}
                </>
              )}
            </p>
          </div>
          <button
            aria-expanded={showDocumentTools}
            aria-controls="document-panel"
            onClick={() => setShowDocumentTools((s) => !s)}
          >
            {showDocumentTools ? t('Hide document tools') : t('Show document tools')}
          </button>
        </section>
      )}
      <div
        hidden={
          (sampleReading && !showDocumentTools) ||
          panel === 'sources' ||
          panel === 'items' ||
          choosingEvidence
        }
        className={`document-evidence-context ${evidence ? 'matched' : ''}`}
        role="status"
      >
        {evidence ? (
          <CheckCircle2 size={18} aria-hidden="true" />
        ) : (
          <Layers3 size={18} aria-hidden="true" />
        )}
        <div>
          <strong>
            {source
              ? sourceTitle(source, language)
              : t('Select the evidence behind your next action')}
          </strong>
          <p>
            {source
              ? t('Version {0} — {1}', [
                  source.version,
                  evidence
                    ? t('Exact match, characters {0}–{1}', [evidence.start, evidence.end])
                    : t('Choose an exact quote for this task.'),
                ])
              : t(
                  'Save your own document or choose a saved version. Then select a quote for the action you want to take.',
                )}
          </p>
        </div>
        {panel !== 'sources' && (
          <button disabled={busy} onClick={() => jump('evidence')}>
            {source ? t('Change evidence') : t('Choose evidence')}
          </button>
        )}
      </div>
      {dirty && (
        <p className="document-draft-notice" role="status">
          {t(
            'You have unsaved inputs. Switching sections keeps them; save before reloading or closing this tab.',
          )}
        </p>
      )}
      {error && (
        <div className="banner error" role="alert" id="document-feedback" tabIndex={-1}>
          {t('{0} Your input is preserved.', [t(error)])}
          {failedControl && (
            <button
              disabled={busy}
              onClick={() => {
                const control = document.getElementById(failedControl);
                control?.focus({ preventScroll: true });
                control?.scrollIntoView({ block: 'center' });
              }}
            >
              {t('Return to save form')}
            </button>
          )}
          <button onClick={() => void reload()} disabled={busy}>
            {t('Reload workspace')}
          </button>
        </div>
      )}
      <div id="document-panel" tabIndex={-1}>
        <fieldset disabled={busy} className="document-controls">
          <legend className="sr-only">{t('Document workflow')}</legend>
          <div
            id="document-source-tools"
            className={`document-source-grid ${panel === 'sources' || choosingEvidence ? 'source-only' : 'items-only'}`}
            hidden={
              (panel !== 'sources' && panel !== 'items' && !choosingEvidence) ||
              (sampleReading && !showDocumentTools)
            }
          >
            <section className="document-card document-reading-panel" hidden={panel !== 'sources'}>
              <h2 className="document-card-heading">
                <span>1</span>
                {t('Save a source')}
              </h2>
              <p>
                {t(
                  'Paste a plan, specification or meeting note, or upload a text file. Saving keeps the original; you will choose its items next.',
                )}
              </p>
              <label>
                {t('Save to document')}
                <select
                  value={documentId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setDocumentId(id);
                    const chosen = workspace.sources
                      .filter((source) => source.documentId === id)
                      .sort((a, b) => Number(b.version) - Number(a.version))[0];
                    // Preserve any authored title; a blank draft can reuse the document's name.
                    if (chosen && !title.trim()) setTitle(chosen.title);
                  }}
                >
                  <option value="">{t('New document')}</option>
                  {documents.map((s) => (
                    <option key={s.documentId} value={s.documentId}>
                      {sourceTitle(s, language)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('Document title')}
                <input
                  id="document-title"
                  name="document-title"
                  autoComplete="off"
                  value={title}
                  maxLength={200}
                  placeholder={t('e.g. Dispatch policy…')}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                {t('Upload Markdown or text')}
                <input
                  name="source-upload"
                  type="file"
                  accept=".md,.markdown,.txt,text/plain,text/markdown"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    if (!/\.(md|markdown|txt)$/i.test(file.name) || file.size > 80000) {
                      setError('Choose a UTF-8 .md or .txt file up to 80 KB.');
                      return;
                    }
                    setBusy(true);
                    try {
                      const value = new TextDecoder('utf-8', {
                        fatal: true,
                        ignoreBOM: true,
                      }).decode(await file.arrayBuffer());
                      if (value.length > 20000)
                        throw new Error('Documents can contain at most 20,000 characters.');
                      setText(value);
                      setTitle(file.name);
                      setError('');
                    } catch {
                      setError(
                        'Unable to read this file. Use UTF-8 text, up to 20,000 characters.',
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </label>
              <label>
                {t('Document text')}
                <textarea
                  id="document-text"
                  name="document-text"
                  rows={7}
                  value={text}
                  maxLength={20000}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              <p className="helper">
                {text.length.toLocaleString(locale)}
                {t('/ 20,000 characters. Saving adds version {0}; earlier versions stay intact.', [
                  latestVersion + 1,
                ])}
              </p>
              {(!title.trim() || !text.trim()) && (
                <p className="helper">
                  {t(
                    'Add a title and source text to enable saving. UTF-8 .md or .txt, up to 80 KB; PDF and Word files need to be pasted as text.',
                  )}
                </p>
              )}
              <button
                className="primary"
                id="document-save"
                disabled={!text.trim() || !title.trim()}
                onClick={() =>
                  void run<SourceVersion>(
                    '/api/sources',
                    {
                      ...(documentId ? { documentId } : {}),
                      expectedVersion: latestVersion,
                      title,
                      text,
                    },
                    (s) => {
                      setSourceId(s.id);
                      setDocumentId(s.documentId);
                      setQuote('');
                      setOccurrence(-1);
                      markSaved({
                        documentId: s.documentId,
                        title,
                        text,
                        sourceId: s.id,
                        quote: '',
                        occurrence: -1,
                      });
                      return {
                        at: 'source',
                        title: message('Saved “{0}” · version {1}', [
                          sourceTitle(s, language),
                          s.version,
                        ]),
                        message:
                          'Select a passage in this saved version. Use an original fact for an item, a reason for a dependency, or new information for a change.',
                        action: 'Select a quote',
                        jump: 'saved-evidence',
                      };
                    },
                  )
                }
              >
                {t('Save source version')}
              </button>
              {receipt?.at === 'source' && <SavedDocumentStep receipt={receipt} onJump={jump} />}
            </section>
            <section
              className="document-card document-reading-panel"
              id="document-evidence"
              tabIndex={-1}
              hidden={panel !== 'items' && !choosingEvidence}
            >
              <h2 className="document-card-heading">{t('Select original evidence')}</h2>
              {choosingEvidence && (
                <div className="document-evidence-purpose">
                  <p>
                    {quoteTask === 'preview'
                      ? t('Choose the new information that supports this update.')
                      : t('Choose the passage that explains this dependency.')}
                  </p>
                  <button
                    onClick={() => jump(quoteTask === 'preview' ? 'preview' : 'relationship')}
                  >
                    {t('Return to this task')}
                  </button>
                </div>
              )}
              <label>
                {t('Saved source version')}
                <select
                  value={sourceId}
                  onChange={(e) => {
                    setSourceId(e.target.value);
                    setQuote('');
                    setOccurrence(-1);
                  }}
                >
                  <option value="">{t('Choose a source')}</option>
                  {workspace.sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {t('{0} · v{1}', [sourceTitle(s, language), s.version])}
                    </option>
                  ))}
                </select>
              </label>
              {source ? (
                <>
                  <SampleSource key={source.id} source={source} />
                  <p className="helper">
                    {t(
                      'Preserved version {0}. Copy the exact passage that supports your item, dependency or update.',
                      [source.version],
                    )}
                  </p>
                  <label>
                    {t('Exact evidence quote')}
                    <textarea
                      id="evidence-quote"
                      name="evidence-quote"
                      rows={3}
                      value={quote}
                      maxLength={10000}
                      aria-invalid={!!quote && matches.length === 0}
                      aria-describedby="evidence-match-status"
                      onChange={(e) => {
                        setQuote(e.target.value);
                        setOccurrence(-1);
                      }}
                    />
                  </label>
                  {matches.length > 1 && (
                    <label>
                      {t('Quote occurrence')}
                      <select
                        value={occurrence}
                        onChange={(e) => setOccurrence(Number(e.target.value))}
                      >
                        <option value={-1}>{t('Choose the intended occurrence')}</option>
                        {matches.slice(0, 100).map((m, i) => (
                          <option key={m.start} value={m.start}>
                            {t('Occurrence {0} · characters {1}–{2}', [i + 1, m.start, m.end])}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <p role="status" className="helper" id="evidence-match-status">
                    {matches.length > 100 &&
                      t(
                        'Showing the first 100 occurrences. Use a longer quote to narrow the match. ',
                      )}
                    {evidence
                      ? t('Exact match · characters {0}–{1}', [evidence.start, evidence.end])
                      : quote
                        ? matches.length === 0
                          ? t(
                              'This text is not in the saved original. Copy an exact passage, including punctuation and spaces; a translation or paraphrase will not match.',
                            )
                          : t(
                              'This passage appears more than once. Choose the intended occurrence above.',
                            )
                        : t('An exact quote is required for the actions below.')}
                  </p>
                  {evidence && (
                    <div className="document-evidence-actions">
                      <p>
                        {t(
                          'This quote is ready. Choose what it supports; each saved item or link keeps its own evidence.',
                        )}
                      </p>
                      {!choosingEvidence && (
                        <button onClick={() => jump('item')}>
                          {t('Add an item from this quote')}
                        </button>
                      )}
                      {(!choosingEvidence || quoteTask === 'relationships') && (
                        <button onClick={() => jump('relationship')}>
                          {t('Use for a dependency')}
                        </button>
                      )}
                      {(!choosingEvidence || quoteTask === 'preview') && (
                        <button onClick={() => jump('preview')}>{t('Use for an update')}</button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <DocumentEmpty
                  title={t('Your evidence starts here')}
                  action={t('Go to document editor')}
                  onAction={() =>
                    jump(
                      choosingEvidence && quoteTask === 'preview' ? 'update-document' : 'document',
                    )
                  }
                >
                  {t(
                    'Save a document, then copy one exact passage from its preserved text. Already saved one? Choose its version above.',
                  )}
                </DocumentEmpty>
              )}
            </section>
            <section className="document-card document-action-panel" hidden={panel !== 'items'}>
              <h2 className="document-card-heading">
                <span>2</span>
                {t('Add evidenced items')}
              </h2>
              <p>
                {t(
                  'Turn one passage into something you can track. Start with a fact or requirement, then add a separate decision or task that relies on it.',
                )}
              </p>
              {!evidence && (
                <div className="document-prerequisite">
                  <p>
                    {t(
                      'Select an exact quote before saving an item. You can draft the details now.',
                    )}
                  </p>
                  <button onClick={() => jump('evidence')}>{t('Select item evidence')}</button>
                </div>
              )}
              <label>
                {t('Item kind')}
                <select value={kind} onChange={(e) => setKind(e.target.value as ItemKind)}>
                  {['Assumption', 'Decision', 'Task'].map((k) => (
                    <option key={k} value={k}>
                      {t(k)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="helper">
                {kind === 'Assumption'
                  ? t('Assumption: a fact or requirement that could change.')
                  : kind === 'Decision'
                    ? t('Decision: a choice made because of a fact or requirement.')
                    : t('Task: work that implements a decision or relies on a requirement.')}
              </p>
              <label>
                {t('Item title')}
                <input
                  name="item-title"
                  id="item-title"
                  autoComplete="off"
                  value={itemTitle}
                  maxLength={150}
                  onChange={(e) => setItemTitle(e.target.value)}
                />
              </label>
              <label>
                {t('Item description')}
                <textarea
                  name="item-description"
                  rows={3}
                  value={body}
                  maxLength={10000}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              <label>
                {t('Owner')}
                <input
                  name="item-owner"
                  autoComplete="off"
                  value={owner}
                  maxLength={100}
                  onChange={(e) => setOwner(e.target.value)}
                />
              </label>
              <button
                className="primary"
                id="item-save"
                disabled={!evidence || !itemTitle.trim() || !body.trim() || !owner.trim()}
                onClick={() =>
                  void run<Item>(
                    '/api/items',
                    { kind, title: itemTitle, body, owner, evidence },
                    (item) => {
                      setItemTitle('');
                      setBody('');
                      markSaved({ itemTitle: '', body: '', owner, kind });
                      setCreatedIds((ids) => (ids.includes(item.id) ? ids : [...ids, item.id]));
                      return {
                        at: 'item',
                        title: message('Added “{0}”', [item.title]),
                        message: createdItems.length
                          ? 'You have items to connect. Choose which one depends on the other and select a quote that explains why.'
                          : 'For a first impact review, add a second item: a decision or task that depends on this one. Select its own supporting passage first.',
                        action: createdItems.length
                          ? 'Choose a dependency'
                          : 'Select the next item’s evidence',
                        jump: createdItems.length ? 'relationship' : 'evidence',
                      };
                    },
                  )
                }
              >
                {t('Add evidenced item')}
              </button>
              {(!itemTitle.trim() || !body.trim() || !owner.trim()) && (
                <p className="helper">
                  {t('A title, description, owner and exact evidence quote are required.')}
                </p>
              )}
              {receipt?.at === 'item' && <SavedDocumentStep receipt={receipt} onJump={jump} />}
              {!!createdItems.length && (
                <div className="document-created-items">
                  <h3>{t('Added in this session')}</h3>
                  <ul>
                    {createdItems.map((item) => (
                      <li key={item.id}>
                        <span>{t(item.kind)}</span>
                        <strong>{sampleItemTitle(item, language)}</strong>
                      </li>
                    ))}
                  </ul>
                  <p>
                    {t(
                      'These items are saved. Find them first in the relationship and change selectors.',
                    )}
                  </p>
                </div>
              )}
            </section>
          </div>
          <div
            className={`document-relationship-grid ${sampleReading && !showDocumentTools ? 'reading-only' : ''}`}
            hidden={panel !== 'relationships' || choosingEvidence}
          >
            <aside className="document-propose" hidden={sampleReading && !showDocumentTools}>
              <section
                className="document-card document-action-panel"
                id="document-relationship"
                tabIndex={-1}
              >
                <h2 className="document-card-heading">
                  <span>3</span>
                  {t('Connect items')}
                </h2>
                <p>
                  {t(
                    'The dependent needs the prerequisite. The selected quote must explain that connection.',
                  )}
                </p>
                <p className="helper">
                  {t(
                    'For a first review: the task is the dependent, and the fact it relies on is the prerequisite. Later, change that prerequisite to find the task.',
                  )}
                </p>
                {workspace.items.length < 2 && (
                  <DocumentEmpty
                    title={t('A connection needs two items')}
                    action={t('Add an evidenced item')}
                    onAction={() => jump('item')}
                  >
                    {t(
                      'Save a fact or requirement and the decision or task that depends on it. A document alone does not create those items.',
                    )}
                  </DocumentEmpty>
                )}
                {!evidence && (
                  <div className="document-prerequisite">
                    <p>
                      {t(
                        'No relationship evidence selected. Use a passage that explains why the dependent needs the prerequisite.',
                      )}
                    </p>
                    <button onClick={() => jump('evidence')}>
                      {t('Select relationship evidence')}
                    </button>
                  </div>
                )}
                <label>
                  {t('Dependent item')}
                  <select value={from} onChange={(e) => setFrom(e.target.value)}>
                    <option value="">{t('Choose dependent')}</option>
                    {options}
                  </select>
                </label>
                <p className="direction-label">{t('↓ depends on')}</p>
                <label>
                  {t('Prerequisite item')}
                  <select value={to} onChange={(e) => setTo(e.target.value)}>
                    <option value="">{t('Choose prerequisite')}</option>
                    {options}
                  </select>
                </label>
                <button
                  className="primary"
                  id="relationship-save"
                  disabled={!evidence || !from || !to || from === to}
                  onClick={() =>
                    void run<Candidate>(
                      '/api/candidates',
                      {
                        from,
                        to,
                        fromRevision: workspace.items.find((i) => i.id === from)!.revision,
                        toRevision: workspace.items.find((i) => i.id === to)!.revision,
                        evidence,
                      },
                      () => {
                        markSaved({ from, to });
                        return {
                          at: 'relationship',
                          title: 'Relationship candidate saved',
                          message:
                            'It will not carry an impact yet. Open its original evidence, check the arrow direction, then confirm the candidate.',
                          action: 'Check saved candidates',
                          jump: 'candidates',
                        };
                      },
                    )
                  }
                >
                  {t('Save relationship candidate')}
                </button>
                <p className="helper">
                  {t('Candidates are excluded from impact analysis until you confirm them below.')}
                </p>
                {from && from === to && (
                  <p className="helper">
                    {t('Choose two different items; an item cannot depend on itself.')}
                  </p>
                )}
                {receipt?.at === 'relationship' && (
                  <SavedDocumentStep receipt={receipt} onJump={jump} />
                )}
              </section>
            </aside>
            <div className="document-relationship-records">
              <section
                className="document-card candidates"
                id="document-candidates"
                tabIndex={-1}
                hidden={sampleReading && !showDocumentTools}
              >
                <h2>{t('Check relationship candidates')}</h2>
                <p>
                  {t(
                    'Open the original evidence and check the direction before confirming. Decisions are retained.',
                  )}
                </p>
                {!workspace.candidates.some(
                  (c) => c.status === 'proposed' || c.status === 'rejected',
                ) && (
                  <DocumentEmpty
                    title={t('No candidates to check')}
                    action={t('Choose a dependency')}
                    onAction={() => jump('relationship')}
                  >
                    {t(
                      'Create a candidate with two items and a quote explaining their connection. Existing confirmed links are below; they do not connect a new document automatically.',
                    )}
                  </DocumentEmpty>
                )}
                {workspace.candidates
                  .filter((c) => c.status === 'proposed' || c.status === 'rejected')
                  .map((c) => (
                    <div className="candidate-row" key={c.id}>
                      <div>
                        <strong>
                          {sampleItemTitle(
                            workspace.items.find((i) => i.id === c.from),
                            language,
                          )}{' '}
                          →{' '}
                          {sampleItemTitle(
                            workspace.items.find((i) => i.id === c.to),
                            language,
                          )}
                        </strong>
                        <p>
                          {t('{0} depends on {1} ·', [c.from, c.to])}
                          <b>{t(c.status)}</b>
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          void onEvidence(c.evidenceId).catch((e: Error) => setError(e.message))
                        }
                      >
                        {t('View original evidence')}
                      </button>
                      {c.status === 'proposed' && (
                        <>
                          <button
                            onClick={() =>
                              void run(
                                `/api/candidates/${c.id}`,
                                { expectedRevision: c.revision, status: 'confirmed' },
                                () => ({
                                  at: 'relationship',
                                  title: 'Dependency confirmed',
                                  message:
                                    'Next, save the new information as another source version or document. Select its quote, then preview an update to the prerequisite item. The original relationship evidence stays intact.',
                                  action: 'Add update evidence',
                                  jump: 'update-document',
                                }),
                                'PUT',
                              )
                            }
                          >
                            {t('Confirm dependency')}
                          </button>
                          <button
                            onClick={() =>
                              void run(
                                `/api/candidates/${c.id}`,
                                { expectedRevision: c.revision, status: 'rejected' },
                                () => ({
                                  at: 'relationship',
                                  title: 'Candidate rejected',
                                  message:
                                    'This candidate will not carry impacts. If the connection is real, select supporting evidence and propose a new candidate.',
                                  action: 'Choose relationship evidence',
                                  jump: 'evidence',
                                }),
                                'PUT',
                              )
                            }
                          >
                            {t('Reject candidate')}
                          </button>
                        </>
                      )}
                    </div>
                  ))}
              </section>
              <Relationships
                onDirtyChange={setReplacementDirty}
                readingOnly={sampleReading && !showDocumentTools}
                workspace={workspace}
                onWorkspace={onWorkspace}
                onEvidence={onEvidence}
              />
            </div>
          </div>
          <div className="document-preview-panel" hidden={panel !== 'preview' || choosingEvidence}>
            <section
              className="document-card proposal-editor document-action-panel"
              id="document-preview"
              tabIndex={-1}
            >
              <h2 className="document-card-heading">
                <span>4</span>
                {t('Preview an update')}
              </h2>
              <p>
                {t(
                  'Choose the existing item that changed, describe its new state, and cite the new information. Preview does not apply the change; you will compare its impact before saving it.',
                )}
              </p>
              {!evidence && (
                <DocumentEmpty
                  title={t('Bring the update’s evidence')}
                  action={t('Choose update evidence')}
                  onAction={() => jump('evidence')}
                >
                  {t(
                    'Save the new information as another source version or document, then select an exact quote. Keep the original items and relationship evidence intact.',
                  )}
                </DocumentEmpty>
              )}
              {evidence && source && (
                <div className="document-update-evidence">
                  <strong>{t('Evidence for this update')}</strong>
                  <p>{t('{0} · version {1}', [sourceTitle(source, language), source.version])}</p>
                  <SampleQuote evidence={{ ...evidence, id: 'draft', source }} />
                  <p>
                    {t(
                      'Check that this passage supports the new description. Your dependency keeps its original quote.',
                    )}
                  </p>
                  <button onClick={() => jump('evidence')}>
                    {t('Choose different update evidence')}
                  </button>
                </div>
              )}
              <label>
                {t('Item to change')}
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">{t('Choose an item')}</option>
                  {options}
                </select>
              </label>
              {targetItem && (
                <div>
                  <span>{t('Before')}</span>
                  <SampleBody item={targetItem} />
                </div>
              )}
              {preparation.target && (
                <div className="document-prerequisite">
                  <p>
                    {preparation.confirmed
                      ? t(
                          '{0} confirmed direct {1} can be checked. The preview calculates all downstream impacts.',
                          [
                            preparation.confirmed,
                            preparation.confirmed === 1 ? t('dependent') : t('dependents'),
                          ],
                        )
                      : t(
                          'No confirmed direct dependents for this item. You can still save a change, but it may have no items to review.',
                        )}{' '}
                    {preparation.pending
                      ? t('{0} proposed {1} excluded until confirmed.', [
                          preparation.pending,
                          preparation.pending === 1 ? t('candidate is') : t('candidates are'),
                        ])
                      : ''}
                  </p>
                  <button onClick={() => jump(preparation.pending ? 'candidates' : 'relationship')}>
                    {preparation.pending ? t('Check pending candidates') : t('Check relationships')}
                  </button>
                </div>
              )}
              <label>
                {t('Updated description')}
                <textarea
                  name="updated-description"
                  rows={3}
                  value={after}
                  maxLength={10000}
                  onChange={(e) => setAfter(e.target.value)}
                />
              </label>
              <button
                className="primary"
                id="preview-save"
                disabled={!preparation.ready}
                onClick={() =>
                  void run<Proposal>(
                    '/api/proposals',
                    {
                      itemId: target,
                      expectedRevision: workspace.items.find((i) => i.id === target)!.revision,
                      after,
                      evidence,
                    },
                    (proposal) => {
                      markSaved({ target, after });
                      onPreview(proposal);
                    },
                  )
                }
              >
                {t('Preview impact')}
              </button>
              {!!preparation.missing.length && (
                <div className="document-missing" role="status">
                  <strong>{t('Before you preview')}</strong>
                  <ul>
                    {preparation.missing.map((message) => (
                      <li key={message}>{t(message)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        </fieldset>
      </div>
      <p className="workspace-limits">
        {t(
          'Local workspace limits: 50 source versions, 100 items, 200 dependencies, 100 change proposals. No AI extraction. Markdown is displayed as plain text.',
        )}
      </p>
    </section>
  );
}
