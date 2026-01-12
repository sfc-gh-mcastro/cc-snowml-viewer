import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NotebookData } from '../../types';

function NotebookNode({ data, selected }: NodeProps<NotebookData>) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-notebook-bg border-notebook-border min-w-[180px] ${
        selected ? 'ring-2 ring-blue-400 ring-offset-2' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-notebook-border" />

      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
        </svg>
        <span className="font-semibold text-sm text-gray-800">Notebook</span>
      </div>

      <div className="text-base font-bold text-gray-900 mb-1">{data.name}</div>
      <div className="text-xs text-gray-500 mb-2">{data.database}.{data.schema}</div>

      <div className="space-y-1 text-xs text-gray-600">
        {data.warehouse && <div>Warehouse: {data.warehouse}</div>}
        {data.idleTimeout && <div>Idle timeout: {data.idleTimeout}s</div>}
        <div className="text-gray-500">Owner: {data.owner}</div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-notebook-border" />
    </div>
  );
}

export default memo(NotebookNode);
