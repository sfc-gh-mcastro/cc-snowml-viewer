export interface ComputePoolData {
  name: string;
  state: string;
  minNodes: number;
  maxNodes: number;
  instanceFamily: string;
  owner: string;
}

export interface ServiceData {
  name: string;
  database: string;
  schema: string;
  owner: string;
  computePool: string;
  status: string;
  currentInstances: number;
  targetInstances: number;
  eaiList: string[];
}

export interface NotebookData {
  name: string;
  database: string;
  schema: string;
  owner: string;
  warehouse: string | null;
  idleTimeout: number | null;
}

export interface EaiData {
  name: string;
  type: string;
  enabled: boolean;
}

export type NodeData = ComputePoolData | ServiceData | NotebookData | EaiData;

export interface GraphNode {
  id: string;
  type: 'computePool' | 'service' | 'notebook' | 'eai';
  data: NodeData;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
