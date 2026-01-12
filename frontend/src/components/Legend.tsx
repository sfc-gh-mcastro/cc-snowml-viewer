const legendItems = [
  { type: 'Compute Pool', color: 'bg-pool-bg', border: 'border-pool-border' },
  { type: 'Service', color: 'bg-service-bg', border: 'border-service-border' },
  { type: 'Notebook', color: 'bg-notebook-bg', border: 'border-notebook-border' },
  { type: 'External Access', color: 'bg-eai-bg', border: 'border-eai-border' },
];

export default function Legend() {
  return (
    <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 z-10">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Legend</h3>
      <div className="space-y-2">
        {legendItems.map((item) => (
          <div key={item.type} className="flex items-center gap-2">
            <div className={`w-6 h-4 rounded border-2 ${item.color} ${item.border}`}></div>
            <span className="text-xs text-gray-600">{item.type}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-200">
        <h4 className="text-xs font-semibold text-gray-600 mb-2">Edges</h4>
        <div className="space-y-1 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-gray-400"></div>
            <span>runs on / uses</span>
          </div>
        </div>
      </div>
    </div>
  );
}
