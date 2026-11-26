import dagre from '@dagrejs/dagre';
import type { ImpactResult, PathEdge } from '../shared/types.js';

// Only presentation changes direction. Snapshot edges remain downstream -> upstream.
export function graphConnections(edges: PathEdge[], propagation: boolean) {
  return edges.map((edge) => ({
    id: edge.id,
    source: propagation ? edge.to : edge.from,
    target: propagation ? edge.from : edge.to,
  }));
}

export const nodeSize = { width: 212, height: 98 };

export function layoutImpact(result: ImpactResult, compact = false) {
  const size = compact ? { width: 160, height: 108 } : nodeSize;
  const items = [result.target, ...result.impacts.map((impact) => impact.item)];
  const edges = [
    ...new Map(
      result.impacts
        .flatMap((impact) => impact.paths.flatMap((path) => path.edges))
        .map((edge) => [edge.id, edge]),
    ).values(),
  ];
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({
    rankdir: compact ? 'TB' : 'LR',
    nodesep: compact ? 22 : 36,
    ranksep: compact ? 44 : 84,
    marginx: 14,
    marginy: 14,
  });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const item of items) graph.setNode(item.id, { ...size });
  // Only layout uses upstream-first ordering. Rendered arrows retain DEPENDS_ON direction.
  for (const edge of edges) graph.setEdge(edge.to, edge.from, {}, edge.id);
  dagre.layout(graph);
  return {
    nodes: items.map((item) => {
      const position = graph.node(item.id);
      return {
        item,
        position: { x: position.x - size.width / 2, y: position.y - size.height / 2 },
      };
    }),
    edges,
    size,
  };
}
