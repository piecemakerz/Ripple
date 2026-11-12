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
export interface Proposal {
  id: string;
  itemId: string;
  title: string;
  after: string;
  evidenceId: string;
}
export interface Workspace {
  items: Item[];
  sources: SourceVersion[];
  proposals: Proposal[];
  changes: Change[];
  database: { engine: string; version: string; path: string; storage: string };
  synthetic: true;
}
