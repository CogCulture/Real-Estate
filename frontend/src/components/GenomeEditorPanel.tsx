import React from 'react';
import { useSessionStore } from '../store/session';

export const GenomeEditorPanel: React.FC = () => {
  const { currentGenome, objectiveWeights, setGenome, setWeight } = useSessionStore();

  const handleFarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGenome({ ...currentGenome, far_target: parseFloat(e.target.value) });
  };

  const loadPreset = (preset: 'High Density' | 'Luxury Villas') => {
    if (preset === 'High Density') {
      setGenome({ road_topology: 'GRID', far_target: 3.5, building_templates: { type: 'TOWER' } });
    } else {
      setGenome({ road_topology: 'ORGANIC', far_target: 0.8, building_templates: { type: 'VILLA' } });
    }
  };

  return (
    <div className="absolute right-4 top-4 w-72 bg-[#2a2a2a] rounded-lg shadow-lg border border-[#444] text-white flex flex-col z-10 max-h-[90vh] overflow-y-auto">
      <div className="p-4 border-b border-[#444]">
        <h2 className="font-semibold text-lg">Design Controls</h2>
      </div>

      <div className="p-4 space-y-6">
        {/* Presets */}
        <div>
          <h3 className="text-sm text-gray-400 mb-2">Presets</h3>
          <div className="flex gap-2">
            <button onClick={() => loadPreset('High Density')} className="flex-1 bg-blue-600 hover:bg-blue-500 py-1 rounded text-xs">High Density</button>
            <button onClick={() => loadPreset('Luxury Villas')} className="flex-1 bg-green-600 hover:bg-green-500 py-1 rounded text-xs">Villas</button>
          </div>
        </div>

        {/* Genome Sliders */}
        <div>
          <h3 className="text-sm text-gray-400 mb-2">Genome Target</h3>
          <label className="block text-xs mb-1">FAR Target ({currentGenome.far_target})</label>
          <input 
            type="range" min="0.5" max="4.0" step="0.1" 
            value={currentGenome.far_target} 
            onChange={handleFarChange}
            className="w-full"
          />
        </div>

        {/* Objective Weights */}
        <div>
          <h3 className="text-sm text-gray-400 mb-2">Optimizer Weights</h3>
          {Object.entries(objectiveWeights).map(([key, val]: [string, number]) => (
            <div key={key} className="mb-2">
              <label className="block text-xs mb-1 capitalize">{key} ({(val * 100).toFixed(0)}%)</label>
              <input 
                type="range" min="0" max="1" step="0.1" 
                value={val} 
                onChange={(e) => setWeight(key, parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
