import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { EaiData } from '../../types';

function EaiNode({ data, selected }: NodeProps<EaiData>) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-eai-bg border-eai-border min-w-[160px] ${
        selected ? 'ring-2 ring-purple-400 ring-offset-2' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-eai-border" />

      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
        </svg>
        <span className="font-semibold text-sm text-gray-800">External Access</span>
      </div>

      <div className="text-base font-bold text-gray-900 mb-2">{data.name}</div>

      <div className="space-y-1 text-xs text-gray-600">
        <div>Type: {data.type}</div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${data.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></span>
          <span>{data.enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-eai-border" />
    </div>
  );
}

export default memo(EaiNode);
