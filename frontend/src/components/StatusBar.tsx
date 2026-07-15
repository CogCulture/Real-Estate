import React from 'react';
import { useEditorStore } from '../store/editor';

export const StatusBar: React.FC = () => {
  const { scale, tool, selectedIds, layers } = useEditorStore();

  const visibleLayers = Object.values(layers).filter(l => l.visible).length;
  const zoomPercent = Math.round(scale * 100);

  return (
    <div className="absolute bottom-0 left-0 w-full h-8 bg-[#1a1a1a] border-t border-[#333] flex items-center px-4 text-xs text-gray-400 z-50">
      <div className="flex items-center gap-6">
        <span>Tool: <span className="text-white capitalize">{tool}</span></span>
        <span>Zoom: <span className="text-white">{zoomPercent}%</span></span>
        <span>Selected: <span className="text-white">{selectedIds.length}</span></span>
        <span>Layers: <span className="text-white">{visibleLayers} visible</span></span>
      </div>
      
      <div className="flex-1" />
      
      <div>
        <span>Render Engine: <span className="text-white">React-Konva + RBush</span></span>
      </div>
    </div>
  );
};
