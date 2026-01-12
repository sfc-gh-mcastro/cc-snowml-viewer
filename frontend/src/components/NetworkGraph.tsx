import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';

import ComputePoolNode from './nodes/ComputePoolNode';
import ServiceNode from './nodes/ServiceNode';
import NotebookNode from './nodes/NotebookNode';
import EaiNode from './nodes/EaiNode';
import type { GraphData, NodeData } from '../types';

const nodeTypes: NodeTypes = {
  computePool: ComputePoolNode,
  service: ServiceNode,
  notebook: NotebookNode,
  eai: EaiNode,
};

interface NetworkGraphProps {
  data: GraphData;
  onNodeSelect: (node: Node<NodeData> | null) => void;
}

function layoutNodes(graphData: GraphData): Node<NodeData>[] {
  const nodes: Node<NodeData>[] = [];

  // Group nodes by type
  const computePools = graphData.nodes.filter((n) => n.type === 'computePool');
  const services = graphData.nodes.filter((n) => n.type === 'service');
  const notebooks = graphData.nodes.filter((n) => n.type === 'notebook');
  const eais = graphData.nodes.filter((n) => n.type === 'eai');

  // Layout parameters
  const xPositions = { computePool: 800, service: 400, notebook: 0, eai: 1200 };
  const ySpacing = 200;
  const yOffset = 50;

  // Position compute pools
  computePools.forEach((node, index) => {
    nodes.push({
      id: node.id,
      type: node.type,
      position: { x: xPositions.computePool, y: yOffset + index * ySpacing },
      data: node.data as NodeData,
    });
  });

  // Position services
  services.forEach((node, index) => {
    nodes.push({
      id: node.id,
      type: node.type,
      position: { x: xPositions.service, y: yOffset + index * ySpacing },
      data: node.data as NodeData,
    });
  });

  // Position notebooks
  notebooks.forEach((node, index) => {
    nodes.push({
      id: node.id,
      type: node.type,
      position: { x: xPositions.notebook, y: yOffset + index * ySpacing },
      data: node.data as NodeData,
    });
  });

  // Position EAIs
  eais.forEach((node, index) => {
    nodes.push({
      id: node.id,
      type: node.type,
      position: { x: xPositions.eai, y: yOffset + index * ySpacing },
      data: node.data as NodeData,
    });
  });

  return nodes;
}

function createEdges(graphData: GraphData): Edge[] {
  return graphData.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#9ca3af', strokeWidth: 2 },
    labelStyle: { fill: '#6b7280', fontSize: 10 },
    labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
  }));
}

export default function NetworkGraph({ data, onNodeSelect }: NetworkGraphProps) {
  const initialNodes = useMemo(() => layoutNodes(data), [data]);
  const initialEdges = useMemo(() => createEdges(data), [data]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => {
      onNodeSelect(node);
    },
    [onNodeSelect]
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  const miniMapNodeColor = (node: Node) => {
    switch (node.type) {
      case 'computePool':
        return '#facc15';
      case 'service':
        return '#10b981';
      case 'notebook':
        return '#3b82f6';
      case 'eai':
        return '#a855f7';
      default:
        return '#9ca3af';
    }
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2}
    >
      <Background color="#e5e7eb" gap={20} />
      <Controls position="top-right" />
      <MiniMap
        nodeColor={miniMapNodeColor}
        nodeStrokeWidth={3}
        zoomable
        pannable
        position="bottom-right"
      />
    </ReactFlow>
  );
}
