import { useState } from 'react';
import type { Node } from 'reactflow';
import NetworkGraph from './components/NetworkGraph';
import Sidebar from './components/Sidebar';
import Legend from './components/Legend';
import { useGraphData } from './hooks/useGraphData';
import type { NodeData } from './types';

export default function App() {
  const { data, isLoading, error, refetch } = useGraphData();
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Snowflake infrastructure...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Failed to load data</h2>
          <p className="text-gray-600 mb-4">{(error as Error).message}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || (data.nodes.length === 0)) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-2">No infrastructure found</p>
          <p className="text-sm text-gray-500">No compute pools, services, or notebooks detected.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
          </svg>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Snowflake ML Viewer</h1>
            <p className="text-xs text-gray-500">Infrastructure visualization</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            <span className="font-medium">{data.nodes.length}</span> nodes,{' '}
            <span className="font-medium">{data.edges.length}</span> connections
          </div>
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <NetworkGraph data={data} onNodeSelect={setSelectedNode} />
          <Legend />
        </div>
        <Sidebar selectedNode={selectedNode} onClose={() => setSelectedNode(null)} />
      </div>
    </div>
  );
}
