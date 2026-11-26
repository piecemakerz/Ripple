import assert from 'node:assert/strict';
import test from 'node:test';
import type { ImpactResult, Item, PathEdge } from '../shared/types.js';
import { graphConnections, layoutImpact, nodeSize } from '../src/graph-layout.js';

const item = (id: string): Item => ({
  id,
  title: id,
  body: id,
  kind: 'Task',
  owner: 'Test',
  revision: 1,
});
const edge = (from: string, to: string): PathEdge => ({
  id: `${from}-${to}`,
  from,
  to,
  status: 'confirmed',
  evidenceId: `E-${from}-${to}`,
  evidence: null,
});
const a = item('A'),
  b = item('B'),
  c = item('C');
const ba = edge('B', 'A'),
  cb = edge('C', 'B'),
  ca = edge('C', 'A');
const result: ImpactResult = {
  target: a,
  impacts: [
    { item: b, depth: 1, evidenceComplete: false, paths: [{ nodes: [b, a], edges: [ba] }] },
    {
      item: c,
      depth: 1,
      evidenceComplete: false,
      paths: [
        { nodes: [c, a], edges: [ca] },
        { nodes: [c, b, a], edges: [cb, ba] },
      ],
    },
  ],
  excluded: [item('X')],
  limited: false,
  warnings: [],
  maxDepth: 8,
  maxPaths: 500,
};

test('canvas layout deduplicates multipath edges and preserves prerequisite direction without mutating the snapshot', () => {
  const before = structuredClone(result);
  const graph = layoutImpact(result);
  assert.deepEqual(result, before);
  assert.deepEqual(
    graph.nodes.map((n) => n.item.id),
    ['A', 'B', 'C'],
  );
  assert.equal(graph.edges.length, 3);
  assert.equal(graph.edges.find((e) => e.id === ba.id)?.from, 'B');
  assert.equal(graph.edges.find((e) => e.id === ba.id)?.to, 'A');
  const positions = new Map(graph.nodes.map((n) => [n.item.id, n.position]));
  assert.ok(positions.get('A')!.x < positions.get('B')!.x);
  assert.ok(positions.get('B')!.x < positions.get('C')!.x);
  const mobile = layoutImpact(result, true);
  assert.ok(mobile.nodes[0].position.y < mobile.nodes[1].position.y);
  assert.ok(mobile.nodes[1].position.y < mobile.nodes[2].position.y);
  assert.deepEqual(mobile.edges, graph.edges);
});

test('auto layout keeps dense peer nodes apart and handles an empty impact result', () => {
  const peers = Array.from({ length: 16 }, (_, index) => item(`T${index}`));
  const graph = layoutImpact({
    ...result,
    impacts: peers.map((peer) => ({
      item: peer,
      depth: 1,
      evidenceComplete: false,
      paths: [{ nodes: [peer, a], edges: [edge(peer.id, a.id)] }],
    })),
  });
  for (let i = 0; i < graph.nodes.length; i++) {
    const first = graph.nodes[i].position;
    assert.ok(Number.isFinite(first.x) && Number.isFinite(first.y));
    for (let j = i + 1; j < graph.nodes.length; j++) {
      const second = graph.nodes[j].position;
      assert.ok(
        Math.abs(first.x - second.x) >= nodeSize.width ||
          Math.abs(first.y - second.y) >= nodeSize.height,
      );
    }
  }
  const empty = layoutImpact({ ...result, impacts: [] });
  assert.equal(empty.nodes.length, 1);
  assert.equal(empty.edges.length, 0);
});

test('impact propagation reverses only display endpoints and keeps evidence identity and snapshots intact', () => {
  const original = structuredClone(result);
  const edges = layoutImpact(result).edges;
  const flow = graphConnections(edges, true);
  assert.deepEqual(
    flow.find((e) => e.id === ba.id),
    { id: ba.id, source: 'A', target: 'B' },
  );
  assert.deepEqual(
    flow.find((e) => e.id === cb.id),
    { id: cb.id, source: 'B', target: 'C' },
  );
  assert.deepEqual(
    graphConnections(edges, false).find((e) => e.id === ba.id),
    { id: ba.id, source: 'B', target: 'A' },
  );
  assert.deepEqual(result, original);
  assert.equal(flow.length, 3);
  assert.deepEqual(graphConnections([], true), []);
});
