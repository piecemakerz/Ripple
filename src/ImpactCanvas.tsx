import { itemTitle } from './sample-content.js';
import { useI18n } from './i18n.js';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import { ArrowRight, GitBranch, CircleDot, Layers, Scale, Code2 } from 'lucide-react';
import type { Impact, ImpactResult, Item } from '../shared/types.js';
import { highlightedPath, type PathChoice } from './review-presentation.js';
import { graphConnections, layoutImpact } from './graph-layout.js';
import { useCompactLayout } from './use-compact-layout.js';

type DependencyNode = Node<
  {
    item: Item;
    origin: boolean;
    active: boolean;
    selected: boolean;
    compact: boolean;
    propagation: boolean;
    disabled: boolean;
    depth: number;
    onSelect: (id: string) => void;
  },
  'dependency'
>;

const Dependency = memo(function Dependency({ data }: NodeProps<DependencyNode>) {
  const { t, language } = useI18n();
  const Icon =
    data.item.kind === 'Assumption' ? Layers : data.item.kind === 'Decision' ? Scale : Code2;
  const input = data.compact ? Position.Top : Position.Left;
  const output = data.compact ? Position.Bottom : Position.Right;
  return (
    <>
      <Handle type="target" position={data.propagation ? input : output} isConnectable={false} />
      <button
        className={`dependency-node nodrag nopan ${data.origin ? 'origin' : ''} ${data.active ? 'on-path' : ''} ${data.selected ? 'is-selected' : ''}`}
        data-kind={data.item.kind}
        onClick={() => data.onSelect(data.item.id)}
        disabled={data.origin || data.disabled}
        aria-label={`${data.item.id} ${itemTitle(data.item, language)}`}
        aria-pressed={data.selected}
        title={data.item.title}
      >
        <span className="node-kind">
          <Icon size={14} aria-hidden="true" />
          {data.propagation
            ? data.item.id
            : data.origin
              ? t('Changed')
              : t('{0} {1}', [t(data.depth === 1 ? 'Direct' : 'Indirect'), t(data.item.kind)])}
        </span>
        <strong>{itemTitle(data.item, language)}</strong>
        <span className="node-corner" aria-hidden="true">
          {data.origin ? <CircleDot size={13} /> : <ArrowRight size={14} />}
        </span>
      </button>
      <Handle type="source" position={data.propagation ? output : input} isConnectable={false} />
    </>
  );
});
const nodeTypes = { dependency: Dependency };

export function ImpactCanvas({
  result,
  selected,
  onSelect,
  choice,
  propagation = false,
  disabled = false,
}: {
  result: ImpactResult;
  selected: Impact | undefined;
  onSelect: (id: string) => void;
  choice: PathChoice | undefined;
  propagation?: boolean;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const compact = useCompactLayout();
  const [instance, setInstance] = useState<ReactFlowInstance<DependencyNode>>();
  const container = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => layoutImpact(result, compact), [result, compact]);
  const active = highlightedPath(selected, choice);
  const depths = new Map(result.impacts.map((impact) => [impact.item.id, impact.depth]));
  const nodes: DependencyNode[] = layout.nodes.map(({ item, position }) => ({
    id: item.id,
    type: 'dependency',
    position,
    width: layout.size.width,
    height: layout.size.height,
    data: {
      item,
      origin: item.id === result.target.id,
      selected: item.id === selected?.item.id,
      active: active.nodes.has(item.id),
      compact,
      propagation,
      disabled,
      depth: depths.get(item.id) ?? 0,
      onSelect,
    },
  }));
  const edges = graphConnections(layout.edges, propagation).map((edge) => ({
    ...edge,
    type: 'default',
    className: active.edges.has(edge.id) ? 'path-active' : '',
    style: {
      stroke: active.edges.has(edge.id) ? '#235c61' : '#aab6bc',
      strokeWidth: active.edges.has(edge.id) ? 2 : 1.25,
      opacity: active.edges.has(edge.id) ? 1 : 0.65,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: active.edges.has(edge.id) ? '#235c61' : '#aab6bc',
      width: 14,
      height: 14,
    },
  }));
  useEffect(() => {
    const element = container.current;
    if (!element || !instance) return;
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width && entry.contentRect.height) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => void instance.fitView({ padding: 0.12, maxZoom: 1 }));
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [instance, compact]);
  return (
    <div className={`impact-explorer ${propagation ? 'propagation-map' : ''}`}>
      <div className="canvas-bar">
        <span>
          <GitBranch size={15} aria-hidden="true" />
          {t(propagation ? 'Impact flow' : 'Dependency canvas')}
        </span>
        <span>
          {t(
            propagation
              ? 'Arrows show how the change reaches connected work'
              : 'Arrows point to prerequisites',
          )}
        </span>
        <button
          className="focus-item"
          disabled={!selected}
          onClick={() =>
            selected &&
            void instance?.fitView({
              nodes: [{ id: selected.item.id }],
              minZoom: 1,
              maxZoom: 1,
              padding: 0.4,
            })
          }
        >
          {t('Focus item')}
        </button>
      </div>
      <div
        className="dependency-canvas"
        ref={container}
        role="region"
        tabIndex={-1}
        aria-label={t('Interactive dependency map')}
      >
        <ReactFlow<DependencyNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          ariaLabelConfig={{
            'controls.zoomIn.ariaLabel': t('Zoom in'),
            'controls.zoomOut.ariaLabel': t('Zoom out'),
            'controls.fitView.ariaLabel': t('Fit view'),
          }}
          onInit={setInstance}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          deleteKeyCode={null}
          zoomOnScroll={false}
          preventScrolling={false}
          minZoom={0.2}
          maxZoom={1.6}
          fitView
          fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
          aria-label={t(
            propagation
              ? 'Impact graph. Arrows point from the changed item to affected work.'
              : 'Dependency graph. Arrows point from dependent to prerequisite.',
          )}
        >
          <Background variant={BackgroundVariant.Dots} gap={28} size={0.7} color="#d8e0e3" />
          <Controls
            aria-label={t('Map controls')}
            showInteractive={false}
            orientation="horizontal"
            position="bottom-left"
            fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
          />
        </ReactFlow>
      </div>
      <div className="canvas-caption">
        <span>{t('Drag to explore. Use + / − to zoom.')}</span>
        <span>{t('{0} connected items', [nodes.length])}</span>
      </div>
    </div>
  );
}
