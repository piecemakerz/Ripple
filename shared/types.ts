export type ItemKind = 'Assumption' | 'Decision' | 'Task';
export interface Item {
  id: string;
  kind: ItemKind;
  title: string;
  body: string;
  revision: number;
  owner: string;
}
export interface SourceVersion {
  id: string;
  documentId: string;
  title: string;
  version: string;
  text: string;
  hash: string;
}
export interface Evidence {
  id: string;
  sourceId: string;
  start: number;
  end: number;
  quote: string;
}
export interface EvidenceDetail extends Evidence {
  source: SourceVersion;
}
export type RelationStatus = 'proposed' | 'confirmed' | 'rejected' | 'superseded';
export interface Dependency {
  id: string;
  from: string;
  to: string;
  status: RelationStatus;
  evidenceId: string;
}
export interface PathEdge extends Dependency {
  evidence: EvidenceDetail | null;
}
export interface ImpactPath {
  nodes: Item[];
  edges: PathEdge[];
}
export interface Impact {
  item: Item;
  depth: number;
  paths: ImpactPath[];
  evidenceComplete: boolean;
}
export interface ImpactResult {
  target: Item;
  impacts: Impact[];
  excluded: Item[];
  limited: boolean;
  maxDepth: number;
  maxPaths: number;
  warnings: string[];
}
export interface Change {
  id: string;
  requestId: string;
  itemId: string;
  before: string;
  after: string;
  beforeRevision: number;
  afterRevision: number;
  evidenceId: string;
  createdAt: string;
  snapshot: ImpactResult;
}
export type ReviewStatus = 'pending' | 'keep' | 'revise' | 'defer';
export interface ReviewEvent {
  id: string;
  status: ReviewStatus;
  reason: string;
  createdAt: string;
}
export interface Review {
  id: string;
  changeId: string;
  itemId: string;
  status: ReviewStatus;
  reason: string;
  updatedAt: string;
  history: ReviewEvent[];
}
export interface ChangeDetail {
  change: Change;
  reviews: Review[];
}
export type ChangeSummary = Pick<
  Change,
  'id' | 'itemId' | 'beforeRevision' | 'afterRevision' | 'createdAt'
>;
export interface ChangePage {
  entries: ChangeSummary[];
  nextCursor: string | null;
  pageSize: number;
}
export interface Proposal {
  id: string;
  itemId: string;
  title: string;
  after: string;
  evidenceId: string;
  expectedRevision?: number;
}
export interface Candidate extends Dependency {
  revision: number;
  fromRevision: number;
  toRevision: number;
}
export interface DependencyRecord extends Dependency {
  revision: number;
  supersedes?: string;
  supersededBy?: string;
  reason?: string;
  createdAt?: string;
}
export interface Workspace {
  items: Item[];
  sources: SourceVersion[];
  proposals: Proposal[];
  changePage: ChangePage;
  candidates: Candidate[];
  dependencies: DependencyRecord[];
  database: { engine: string; version: string; path: string; storage: string };
  synthetic: boolean;
}

export type HistoryKind = 'change' | 'review' | 'relationship';
interface HistoryBase {
  id: string;
  kind: HistoryKind;
  createdAt: string;
  itemIds: string[];
}
export interface ChangeHistoryEntry extends HistoryBase {
  kind: 'change';
  changeId: string;
  itemId: string;
  title: string;
  before: string;
  after: string;
  beforeRevision: number;
  afterRevision: number;
  evidenceId: string;
}
export interface ReviewHistoryEntry extends HistoryBase {
  kind: 'review';
  changeId: string;
  itemId: string;
  title: string;
  changedItemId: string;
  status: Exclude<ReviewStatus, 'pending'>;
  reason: string;
}
export interface RelationshipHistoryEntry extends HistoryBase {
  kind: 'relationship';
  previous: Pick<Dependency, 'id' | 'from' | 'to' | 'evidenceId'>;
  replacement: Pick<Dependency, 'id' | 'from' | 'to' | 'evidenceId'>;
  reason: string;
}
export type HistoryEntry = ChangeHistoryEntry | ReviewHistoryEntry | RelationshipHistoryEntry;
export interface HistoryPage {
  entries: HistoryEntry[];
  nextCursor: string | null;
  pageSize: number;
}
