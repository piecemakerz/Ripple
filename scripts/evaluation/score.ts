import type { ImpactResult } from '../../shared/types.js';
import { digest } from '../../server/sample.js';
import { evaluationCase, type EvaluationCase, type QueryCase } from './case.js';

export interface IdentityMap {
  items: Record<string, string>;
  sources: Record<string, string>;
}
const equalSet = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

// The expected paths are explicitly curated in the fixture, never computed by a second traversal.
export function scoreImpact(
  result: ImpactResult,
  query: QueryCase,
  ids: IdentityMap,
  fixture: EvaluationCase = evaluationCase,
) {
  const keyById = new Map(Object.entries(ids.items).map(([key, id]) => [id, key]));
  const key = (id: string) => keyById.get(id) ?? `unknown:${id}`;
  const expected = [...new Set(query.paths.map((p) => p[0]))];
  const actual = result.impacts.map((i) => key(i.item.id));
  const uniqueActual = [...new Set(actual)];
  const falsePositives = uniqueActual.filter((id) => !expected.includes(id));
  const falseNegatives = expected.filter((id) => !actual.includes(id));
  const truePositives = uniqueActual.filter((id) => expected.includes(id)).length;
  const failures: string[] = [];
  const fail = (condition: boolean, message: string) => {
    if (!condition) failures.push(message);
  };
  fail(key(result.target.id) === query.target, 'Wrong target');
  fail(!result.limited && result.warnings.length === 0, 'Incomplete traversal or warnings');
  fail(actual.length === uniqueActual.length, 'Duplicate impacted items');
  fail(equalSet(actual, expected), 'Impact set mismatch');
  fail(
    query.excluded.every((id) => result.excluded.some((i) => key(i.id) === id)),
    'Missing excluded item',
  );
  fail(
    result.excluded.every((i) => !expected.includes(key(i.id)) && key(i.id) !== query.target),
    'Invalid excluded item',
  );
  const paths: string[] = [];
  const evidenceChecks = new Map<string, boolean>();
  for (const impact of result.impacts) {
    const expectedDepths = query.paths
      .filter((p) => p[0] === key(impact.item.id))
      .map((p) => p.length - 1);
    fail(impact.depth === Math.min(...expectedDepths), `Wrong depth: ${key(impact.item.id)}`);
    fail(impact.evidenceComplete, `Incomplete evidence: ${key(impact.item.id)}`);
    for (const path of impact.paths) {
      paths.push(path.nodes.map((n) => key(n.id)).join('>'));
      fail(
        path.nodes[0]?.id === impact.item.id && path.edges.length === path.nodes.length - 1,
        'Malformed path',
      );
      for (const [index, edge] of path.edges.entries()) {
        const edgeKey = `${key(edge.from)}>${key(edge.to)}`;
        const gold = fixture.relations.find(
          (r) => r.from === key(edge.from) && r.to === key(edge.to) && r.status === 'confirmed',
        );
        const source = fixture.sources.find((s) => s.key === gold?.evidence.source);
        const e = edge.evidence;
        const valid =
          !!gold &&
          !!source &&
          !!e &&
          edge.status === 'confirmed' &&
          edge.from === path.nodes[index]?.id &&
          edge.to === path.nodes[index + 1]?.id &&
          e.id === edge.evidenceId &&
          e.sourceId === ids.sources[source.key] &&
          e.source.id === e.sourceId &&
          e.source.version === '1' &&
          e.source.text === source.text &&
          e.source.hash === source.hash &&
          digest(e.source.text) === e.source.hash &&
          e.quote === gold.evidence.quote &&
          e.start === source.text.indexOf(gold.evidence.quote) &&
          e.end === e.start + e.quote.length &&
          e.source.text.slice(e.start, e.end) === e.quote;
        evidenceChecks.set(edgeKey, (evidenceChecks.get(edgeKey) ?? true) && valid);
        fail(valid, `Invalid evidence or edge: ${edgeKey}`);
      }
    }
  }
  const expectedPaths = query.paths.map((p) => p.join('>'));
  fail(equalSet(paths, expectedPaths), 'Path set mismatch');
  const expectedEdges = new Set(
    query.paths.flatMap((p) => p.slice(0, -1).map((from, i) => `${from}>${p[i + 1]}`)),
  );
  fail(equalSet([...evidenceChecks.keys()], [...expectedEdges]), 'Evidence coverage mismatch');
  return {
    target: query.target,
    passed: failures.length === 0,
    expected,
    actual: uniqueActual.sort(),
    falsePositives,
    falseNegatives,
    precision: uniqueActual.length ? truePositives / uniqueActual.length : null,
    recall: expected.length ? truePositives / expected.length : null,
    pathsMatched: new Set(paths.filter((p) => expectedPaths.includes(p))).size,
    expectedPaths: expectedPaths.length,
    validEvidence: [...evidenceChecks.values()].filter(Boolean).length,
    expectedEvidence: expectedEdges.size,
    failures: [...new Set(failures)],
  };
}
