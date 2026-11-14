import { randomUUID } from 'node:crypto';
import type { Candidate, Item, Proposal, SourceVersion } from '../../shared/types.js';
import { evaluationCase, type EvaluationCase } from './case.js';
import type { EvaluationApi } from './http.js';
import type { IdentityMap } from './score.js';

export interface PreparedCase extends IdentityMap {
  proposal: Proposal;
}
export async function prepareCase(
  api: EvaluationApi,
  fixture: EvaluationCase = evaluationCase,
): Promise<PreparedCase> {
  const ids: IdentityMap = { items: {}, sources: {} };
  for (const source of fixture.sources) {
    const saved = await api.request<SourceVersion>('/api/sources', 'POST', {
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
    const saved = await api.request<Item>('/api/items', 'POST', {
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
    const saved = await api.request<Candidate>('/api/candidates', 'POST', {
      requestId: randomUUID(),
      from: ids.items[relation.from],
      to: ids.items[relation.to],
      fromRevision: 1,
      toRevision: 1,
      evidence: evidence(relation.evidence),
    });
    if (relation.status !== 'proposed')
      await api.request(`/api/candidates/${saved.id}`, 'PUT', {
        requestId: randomUUID(),
        expectedRevision: saved.revision,
        status: relation.status,
      });
  }
  const proposal = await api.request<Proposal>('/api/proposals', 'POST', {
    requestId: randomUUID(),
    itemId: ids.items[fixture.proposal.target],
    expectedRevision: 1,
    after: fixture.proposal.after,
    evidence: evidence(fixture.proposal.evidence),
  });
  return { ...ids, proposal };
}
