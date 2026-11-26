import { randomUUID } from 'node:crypto';
import type { Candidate, Item, Proposal, SourceVersion } from '../../shared/types.js';
import { evaluationCase, type EvaluationCase } from './case.js';
import type { EvaluationApi } from './http.js';
import type { IdentityMap } from './score.js';

export interface PreparedCase extends IdentityMap {
  proposal: Proposal;
  preparation?: {
    elapsedMs: number;
    writeRequests: number;
    sources: number;
    items: number;
    relations: number;
    note: string;
  };
}
export async function prepareCase(
  api: EvaluationApi,
  fixture: EvaluationCase = evaluationCase,
): Promise<PreparedCase> {
  const started = performance.now();
  let writeRequests = 0;
  const request: EvaluationApi['request'] = async <T>(
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<T> => {
    const value = await api.request<T>(path, method, body);
    if (method !== 'GET') writeRequests++;
    return value;
  };
  const ids: IdentityMap = { items: {}, sources: {} };
  for (const source of fixture.sources) {
    const saved = await request<SourceVersion>('/api/sources', 'POST', {
      requestId: randomUUID(),
      expectedVersion: 0,
      title: source.title,
      text: source.text,
    });
    ids.sources[source.key] = saved.id;
  }
  const evidence = (ref: { source: string; quote: string }) => {
    const source = fixture.sources.find((s) => s.key === ref.source)!;
    const start = source.text.indexOf(ref.quote);
    return {
      sourceId: ids.sources[ref.source],
      start,
      end: start + ref.quote.length,
      quote: ref.quote,
    };
  };
  for (const item of fixture.items) {
    const saved = await request<Item>('/api/items', 'POST', {
      requestId: randomUUID(),
      kind: item.kind,
      title: item.title,
      body: item.body,
      owner: 'Evaluation maintainer',
      evidence: evidence(item.evidence),
    });
    ids.items[item.key] = saved.id;
  }
  for (const relation of fixture.relations) {
    const saved = await request<Candidate>('/api/candidates', 'POST', {
      requestId: randomUUID(),
      from: ids.items[relation.from],
      to: ids.items[relation.to],
      fromRevision: 1,
      toRevision: 1,
      evidence: evidence(relation.evidence),
    });
    if (relation.status !== 'proposed')
      await request(`/api/candidates/${saved.id}`, 'PUT', {
        requestId: randomUUID(),
        expectedRevision: saved.revision,
        status: relation.status,
      });
  }
  const proposal = await request<Proposal>('/api/proposals', 'POST', {
    requestId: randomUUID(),
    itemId: ids.items[fixture.proposal.target],
    expectedRevision: 1,
    after: fixture.proposal.after,
    evidence: evidence(fixture.proposal.evidence),
  });
  return {
    ...ids,
    proposal,
    preparation: {
      elapsedMs: Math.round(performance.now() - started),
      writeRequests,
      sources: fixture.sources.length,
      items: fixture.items.length,
      relations: fixture.relations.length,
      note: 'Automated import of manually curated context; excludes source reading, graph authoring and human review. Not a time-saving measurement.',
    },
  };
}
