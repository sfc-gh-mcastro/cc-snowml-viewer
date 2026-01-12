import type { Node } from 'reactflow';
import type { NodeData, ComputePoolData, ServiceData, NotebookData, EaiData } from '../types';

interface SidebarProps {
  selectedNode: Node<NodeData> | null;
  onClose: () => void;
}

function ComputePoolDetails({ data }: { data: ComputePoolData }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Name</label>
        <p className="text-lg font-semibold text-gray-900">{data.name}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">State</label>
          <p className="text-sm text-gray-800">{data.state}</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Instance Family</label>
          <p className="text-sm text-gray-800">{data.instanceFamily}</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Min Nodes</label>
          <p className="text-sm text-gray-800">{data.minNodes}</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Max Nodes</label>
          <p className="text-sm text-gray-800">{data.maxNodes}</p>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Owner</label>
        <p className="text-sm text-gray-800">{data.owner}</p>
      </div>
    </div>
  );
}

function ServiceDetails({ data }: { data: ServiceData }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Name</label>
        <p className="text-lg font-semibold text-gray-900">{data.name}</p>
      </div>
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Location</label>
        <p className="text-sm text-gray-800">{data.database}.{data.schema}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Status</label>
          <p className="text-sm text-gray-800">{data.status}</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Compute Pool</label>
          <p className="text-sm text-gray-800">{data.computePool}</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Current Instances</label>
          <p className="text-sm text-gray-800">{data.currentInstances}</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Target Instances</label>
          <p className="text-sm text-gray-800">{data.targetInstances}</p>
        </div>
      </div>
      {data.eaiList.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">External Access Integrations</label>
          <div className="mt-1 flex flex-wrap gap-1">
            {data.eaiList.map((eai) => (
              <span
                key={eai}
                className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs"
              >
                {eai}
              </span>
            ))}
          </div>
        </div>
      )}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Owner</label>
        <p className="text-sm text-gray-800">{data.owner}</p>
      </div>
    </div>
  );
}

function NotebookDetails({ data }: { data: NotebookData }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Name</label>
        <p className="text-lg font-semibold text-gray-900">{data.name}</p>
      </div>
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Location</label>
        <p className="text-sm text-gray-800">{data.database}.{data.schema}</p>
      </div>
      {data.warehouse && (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Warehouse</label>
          <p className="text-sm text-gray-800">{data.warehouse}</p>
        </div>
      )}
      {data.idleTimeout && (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Idle Timeout</label>
          <p className="text-sm text-gray-800">{data.idleTimeout} seconds</p>
        </div>
      )}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Owner</label>
        <p className="text-sm text-gray-800">{data.owner}</p>
      </div>
    </div>
  );
}

function EaiDetails({ data }: { data: EaiData }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Name</label>
        <p className="text-lg font-semibold text-gray-900">{data.name}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Type</label>
          <p className="text-sm text-gray-800">{data.type}</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Status</label>
          <p className="text-sm text-gray-800">{data.enabled ? 'Enabled' : 'Disabled'}</p>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ selectedNode, onClose }: SidebarProps) {
  if (!selectedNode) return null;

  const typeLabels: Record<string, string> = {
    computePool: 'Compute Pool',
    service: 'Service',
    notebook: 'Notebook',
    eai: 'External Access Integration',
  };

  const typeColors: Record<string, string> = {
    computePool: 'bg-pool-bg border-pool-border',
    service: 'bg-service-bg border-service-border',
    notebook: 'bg-notebook-bg border-notebook-border',
    eai: 'bg-eai-bg border-eai-border',
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className={`px-2 py-1 rounded border ${typeColors[selectedNode.type || 'service']}`}>
          <span className="text-xs font-medium text-gray-700">
            {typeLabels[selectedNode.type || 'service']}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {selectedNode.type === 'computePool' && (
        <ComputePoolDetails data={selectedNode.data as ComputePoolData} />
      )}
      {selectedNode.type === 'service' && (
        <ServiceDetails data={selectedNode.data as ServiceData} />
      )}
      {selectedNode.type === 'notebook' && (
        <NotebookDetails data={selectedNode.data as NotebookData} />
      )}
      {selectedNode.type === 'eai' && (
        <EaiDetails data={selectedNode.data as EaiData} />
      )}
    </div>
  );
}
