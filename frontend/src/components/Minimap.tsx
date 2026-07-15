import React from 'react';
import { useEditorStore } from '../store/editor';

export const Minimap: React.FC = () => {
  const { x, y, scale, setViewport } = useEditorStore();
  
  // Mock minimap rendering. A real implementation would render a low-res version of the scene graph.
  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Simple mock projection
    const worldX = (clickX / rect.width) * 2000 - 1000;
    const worldY = (clickY / rect.height) * 2000 - 1000;
    
    setViewport(-worldX * scale + rect.width / 2, -worldY * scale + rect.height / 2, scale);
  };

  return (
    <div 
      className="absolute bottom-12 right-4 w-48 h-48 bg-[#111] border border-[#444] rounded-lg shadow-lg cursor-crosshair z-20 overflow-hidden"
      onClick={handleMinimapClick}
    >
      <div className="absolute top-2 left-2 text-xs text-gray-500 font-semibold z-10 pointer-events-none">MINIMAP</div>
      {/* Viewport Indicator */}
      <div 
        className="absolute border border-blue-500 bg-blue-500/10 pointer-events-none"
        style={{
          left: `${(x / -3000) * 100 + 50}%`,
          top: `${(y / -3000) * 100 + 50}%`,
          width: `${(1 / scale) * 20}%`,
          height: `${(1 / scale) * 20}%`,
          transform: 'translate(-50%, -50%)'
        }}
      />
    </div>
  );
};
