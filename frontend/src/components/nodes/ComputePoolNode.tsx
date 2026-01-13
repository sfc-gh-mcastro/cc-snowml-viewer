import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { ComputePoolData } from '../../types';

function ComputePoolNode({ data, selected }: NodeProps<ComputePoolData>) {
  const stateColor = data.state === 'ACTIVE' || data.state === 'RUNNING'
    ? 'bg-green-500'
    : data.state === 'SUSPENDED'
    ? 'bg-yellow-500'
    : 'bg-gray-400';

  const hasServices = (data.__serviceCount ?? 0) > 0;
  const isCollapsed = data.__collapsed ?? false;

  return (
    <div
      className={`relative px-4 py-3 rounded-lg border-2 bg-pool-bg border-pool-border min-w-[180px] ${
        selected ? 'ring-2 ring-yellow-400 ring-offset-2' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-pool-border" />

      {/* Collapse toggle button */}
      {hasServices && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.__onToggleCollapse?.();
          }}
          className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6
                     bg-white border border-gray-300 rounded-full
                     flex items-center justify-center
                     hover:bg-gray-100 transition-colors shadow-sm
                     z-10"
          title={isCollapsed ? 'Expand services' : 'Collapse services'}
        >
          <svg
            className={`w-3 h-3 text-gray-600 transition-transform duration-200 ${
              isCollapsed ? '' : 'rotate-90'
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}

      {/* Service count badge (shown when collapsed or has services) */}
      {hasServices && (
        <div
          className={`absolute -right-2 -top-2
                      text-white text-xs font-bold
                      rounded-full min-w-[24px] h-6 px-1.5
                      flex items-center justify-center
                      border-2 border-white shadow
                      ${isCollapsed ? 'bg-green-500' : 'bg-gray-400'}`}
          title={`${data.__serviceCount} service${data.__serviceCount === 1 ? '' : 's'}`}
        >
          {data.__serviceCount}
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414z" />
        </svg>
        <span className="font-semibold text-sm text-gray-800">Compute Pool</span>
      </div>

      <div className="text-base font-bold text-gray-900 mb-2">{data.name}</div>

      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${stateColor}`}></span>
          <span>{data.state}</span>
        </div>
        <div>Nodes: {data.minNodes} - {data.maxNodes}</div>
        <div>Family: {data.instanceFamily}</div>
        <div className="text-gray-500">Owner: {data.owner}</div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-pool-border" />
    </div>
  );
}

export default memo(ComputePoolNode);
