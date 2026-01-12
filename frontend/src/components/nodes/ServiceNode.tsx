import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { ServiceData } from '../../types';

function ServiceNode({ data, selected }: NodeProps<ServiceData>) {
  const statusColor = data.status === 'RUNNING'
    ? 'bg-green-500'
    : data.status === 'SUSPENDED'
    ? 'bg-yellow-500'
    : data.status === 'PENDING'
    ? 'bg-blue-500'
    : 'bg-gray-400';

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-service-bg border-service-border min-w-[200px] ${
        selected ? 'ring-2 ring-green-400 ring-offset-2' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-service-border" />

      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
        </svg>
        <span className="font-semibold text-sm text-gray-800">Service</span>
      </div>

      <div className="text-base font-bold text-gray-900 mb-1">{data.name}</div>
      <div className="text-xs text-gray-500 mb-2">{data.database}.{data.schema}</div>

      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor}`}></span>
          <span>{data.status}</span>
        </div>
        <div>Instances: {data.currentInstances}/{data.targetInstances}</div>
        <div>Pool: {data.computePool}</div>
        {data.eaiList.length > 0 && (
          <div className="mt-2 pt-2 border-t border-green-200">
            <div className="text-gray-500 mb-1">Integrations:</div>
            <div className="flex flex-wrap gap-1">
              {data.eaiList.map((eai) => (
                <span
                  key={eai}
                  className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs"
                >
                  {eai}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="text-gray-500">Owner: {data.owner}</div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-service-border" />
    </div>
  );
}

export default memo(ServiceNode);
