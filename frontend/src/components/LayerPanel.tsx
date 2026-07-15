import React, { useState } from 'react';
import { useEditorStore } from '../store/editor';
import { Layers, Eye, EyeOff, Lock, Unlock, Search } from 'lucide-react';

export const LayerPanel: React.FC = () => {
  const { layers, toggleLayer } = useEditorStore();
  const [search, setSearch] = useState('');

  // Built-in fixed layers in drawing order
  const layerNames = [
    'background', 'terrain', 'water', 'landscape', 'roads', 
    'parking', 'pedestrian', 'buildings', 'amenities', 'trees', 
    'roadMarkings', 'shadows', 'labels', 'debug'
  ];

  const filteredLayers = layerNames.filter(name => name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="absolute left-4 top-20 w-64 bg-[#2a2a2a] rounded-lg shadow-lg border border-[#444] text-white flex flex-col z-10 max-h-[60vh] overflow-hidden">
      <div className="p-3 border-b border-[#444] flex items-center gap-2">
        <Layers size={18} />
        <h2 className="font-semibold">Layer Manager</h2>
      </div>

      <div className="p-2 border-b border-[#444] flex items-center bg-[#1a1a1a]">
        <Search size={14} className="text-gray-400 mx-2" />
        <input 
          type="text" 
          placeholder="Filter layers..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent border-none outline-none text-sm w-full"
        />
      </div>

      <div className="overflow-y-auto p-2 space-y-1">
        {filteredLayers.map(name => {
          const isVisible = layers[name]?.visible ?? true;
          const isLocked = layers[name]?.locked ?? false;
          
          return (
            <div key={name} className="flex items-center justify-between p-1.5 hover:bg-[#3a3a3a] rounded text-sm group">
              <span className="capitalize">{name}</span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => toggleLayer(name)} className="text-gray-400 hover:text-white">
                  {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button className="text-gray-400 hover:text-white">
                  {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
