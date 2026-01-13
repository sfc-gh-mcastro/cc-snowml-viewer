import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { GraphData, NodeData, ServiceData, ComputePoolData } from '../types';

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

interface LayoutResult {
  nodes: Node<NodeData>[];
  hiddenServiceIds: Set<string>;
}

function layoutNodesWithClusters(
  graphData: GraphData,
  collapsedPools: Record<string, boolean>,
  togglePoolCollapse: (poolId: string) => void
): LayoutResult {
  const nodes: Node<NodeData>[] = [];
  const hiddenServiceIds = new Set<string>();

  // Layout parameters
  const xPositions = {
    notebook: 0,
    service: 400,
    computePool: 750,
    eai: 1100,
  };
  const clusterSpacing = 40;
  const serviceYSpacing = 70;
  const notebookYSpacing = 100;
  const eaiYSpacing = 80;
  const yOffset = 50;

  // Group services by compute pool
  const servicesByPool = new Map<string, typeof graphData.nodes>();
  graphData.nodes
    .filter((n) => n.type === 'service')
    .forEach((service) => {
      const poolName = (service.data as ServiceData).computePool;
      if (!servicesByPool.has(poolName)) {
        servicesByPool.set(poolName, []);
      }
      servicesByPool.get(poolName)!.push(service);
    });

  // Get compute pools and sort by service count (pools with more services first)
  const computePools = graphData.nodes
    .filter((n) => n.type === 'computePool')
    .sort((a, b) => {
      const aCount = servicesByPool.get((a.data as ComputePoolData).name)?.length || 0;
      const bCount = servicesByPool.get((b.data as ComputePoolData).name)?.length || 0;
      return bCount - aCount;
    });

  // Position compute pools and their services in clusters
  let currentY = yOffset;

  computePools.forEach((pool) => {
    const poolData = pool.data as ComputePoolData;
    const poolServices = servicesByPool.get(poolData.name) || [];
    const isCollapsed = collapsedPools[pool.id] ?? false;

    // Calculate cluster height
    const visibleServiceCount = isCollapsed ? 0 : poolServices.length;
    const clusterHeight = Math.max(
      80,
      visibleServiceCount * serviceYSpacing
    );

    // Position compute pool at vertical center of its cluster
    const poolY = currentY + (clusterHeight > 0 ? clusterHeight / 2 - 40 : 0);

    nodes.push({
      id: pool.id,
      type: pool.type,
      position: { x: xPositions.computePool, y: poolY },
      data: {
        ...poolData,
        __collapsed: isCollapsed,
        __serviceCount: poolServices.length,
        __onToggleCollapse: () => togglePoolCollapse(pool.id),
      } as NodeData,
    });

    // Position services for this pool
    if (!isCollapsed) {
      poolServices.forEach((service, idx) => {
        nodes.push({
          id: service.id,
          type: service.type,
          position: {
            x: xPositions.service,
            y: currentY + idx * serviceYSpacing,
          },
          data: service.data as NodeData,
        });
      });
    } else {
      // Track hidden services for edge filtering
      poolServices.forEach((s) => hiddenServiceIds.add(s.id));
    }

    currentY += clusterHeight + clusterSpacing;
  });

  // Position notebooks (left column, independent)
  const notebooks = graphData.nodes.filter((n) => n.type === 'notebook');
  notebooks.forEach((node, index) => {
    nodes.push({
      id: node.id,
      type: node.type,
      position: { x: xPositions.notebook, y: yOffset + index * notebookYSpacing },
      data: node.data as NodeData,
    });
  });

  // Position EAIs (right column, independent)
  const eais = graphData.nodes.filter((n) => n.type === 'eai');
  eais.forEach((node, index) => {
    nodes.push({
      id: node.id,
      type: node.type,
      position: { x: xPositions.eai, y: yOffset + index * eaiYSpacing },
      data: node.data as NodeData,
    });
  });

  return { nodes, hiddenServiceIds };
}

function createEdges(graphData: GraphData, hiddenServiceIds: Set<string>): Edge[] {
  return graphData.edges
    .filter(
      (edge) =>
        !hiddenServiceIds.has(edge.source) && !hiddenServiceIds.has(edge.target)
    )
    .map((edge) => ({
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
  const [collapsedPools, setCollapsedPools] = useState<Record<string, boolean>>({});

  const togglePoolCollapse = useCallback((poolId: string) => {
    setCollapsedPools((prev) => ({
      ...prev,
      [poolId]: !prev[poolId],
    }));
  }, []);

  const { nodes: layoutedNodes, hiddenServiceIds } = useMemo(
    () => layoutNodesWithClusters(data, collapsedPools, togglePoolCollapse),
    [data, collapsedPools, togglePoolCollapse]
  );

  const initialEdges = useMemo(
    () => createEdges(data, hiddenServiceIds),
    [data, hiddenServiceIds]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when layout changes
  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(initialEdges);
  }, [layoutedNodes, initialEdges, setNodes, setEdges]);

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
