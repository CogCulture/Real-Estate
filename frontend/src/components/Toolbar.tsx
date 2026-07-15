import React from 'react';
import { Hand, MousePointer2, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useEditorStore } from '../store/editor';

export const Toolbar: React.FC = () => {
  const { tool, setTool, setViewport } = useEditorStore();

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#2a2a2a] p-2 rounded-lg shadow-lg flex flex-col gap-2 border border-[#444] z-10">
      <button 
        className={`p-2 rounded ${tool === 'select' ? 'bg-blue-600' : 'hover:bg-[#444]'}`}
        onClick={() => setTool('select')}
        title="Select (V)"
      >
        <MousePointer2 size={20} className="text-white" />
      </button>
      <button 
        className={`p-2 rounded ${tool === 'pan' ? 'bg-blue-600' : 'hover:bg-[#444]'}`}
        onClick={() => setTool('pan')}
        title="Pan (H)"
      >
        <Hand size={20} className="text-white" />
      </button>
      
      <div className="h-px w-full bg-[#444] my-1" />
      
      <button 
        className="p-2 rounded hover:bg-[#444]"
        onClick={() => setViewport(0, 0, 1)}
        title="Fit View"
      >
        <Maximize size={20} className="text-white" />
      </button>
    </div>
  );
};
