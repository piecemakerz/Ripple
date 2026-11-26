// Form selections are UI state. A checkpoint only advances after an explicit save succeeds.
export interface DocumentDraft {
  documentId: string;
  title: string;
  text: string;
  sourceId: string;
  quote: string;
  occurrence: number;
  kind: string;
  itemTitle: string;
  body: string;
  owner: string;
  from: string;
  to: string;
  target: string;
  after: string;
}

export const emptyDocumentDraft: DocumentDraft = {
  documentId: '',
  title: '',
  text: '',
  sourceId: '',
  quote: '',
  occurrence: -1,
  kind: 'Task',
  itemTitle: '',
  body: '',
  owner: 'Me',
  from: '',
  to: '',
  target: '',
  after: '',
};

export function unsavedDocumentSections(current: DocumentDraft, saved: DocumentDraft) {
  const changed = (...keys: (keyof DocumentDraft)[]) =>
    keys.some((key) => current[key] !== saved[key]);
  return {
    source: changed('title', 'text') || (!!current.text && changed('documentId')),
    item: changed('itemTitle', 'body', 'kind', 'owner'),
    relationship: changed('from', 'to'),
    update: changed('target', 'after'),
    evidence: (!!current.quote || !!saved.quote) && changed('sourceId', 'quote', 'occurrence'),
  };
}
