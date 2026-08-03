import React from 'react';
import { useEditorStore } from '../store/editor';

export const PropertiesPanel: React.FC = () => {
  const { selectedIds } = useEditorStore();
  
  if (selectedIds.length === 0) {
    return (
      <div className="absolute right-80 top-4 w-64 bg-[#2a2a2a] rounded-lg shadow-lg border border-[#444] p-4 text-white z-10">
        <h3 className="font-semibold mb-2">Inspector</h3>
        <div className="text-sm text-gray-400 space-y-1">
          <p>No objects selected.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute right-80 top-4 w-64 bg-[#2a2a2a] rounded-lg shadow-lg border border-[#444] p-4 text-white z-10 max-h-[80vh] overflow-y-auto">
      <h3 className="font-semibold mb-2">Inspector</h3>
      
      <div className="text-sm space-y-4">
        <div>
          <p className="text-gray-400 mb-1">Items Selected: {selectedIds.length}</p>
          <div className="bg-[#1a1a1a] p-2 rounded text-xs break-all border border-[#333] max-h-24 overflow-y-auto">
            {selectedIds.join(', ')}
          </div>
        </div>

        <div className="h-px w-full bg-[#444]" />

        <div>
          <h4 className="font-semibold mb-1 text-gray-300">Dimensions</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#1a1a1a] p-1.5 rounded border border-[#333]">Area: <span className="text-gray-400 ml-1">Auto</span></div>
            <div className="bg-[#1a1a1a] p-1.5 rounded border border-[#333]">Perimeter: <span className="text-gray-400 ml-1">Auto</span></div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-1 text-gray-300">Metadata</h4>
          <div className="bg-[#1a1a1a] p-2 rounded text-xs border border-[#333] text-gray-400 font-mono">
            Origin: AI Generated<br/>
            Layer: Auto
          </div>
        </div>
      </div>
    </div>
  );
};
