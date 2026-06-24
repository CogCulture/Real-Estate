import React, { useState, useEffect } from 'react';
import { useLayoutStore } from '../../store/useLayoutStore';

export default function BoundaryGeneratorModal({ isOpen, onClose, onGenerate }) {
  const [layers, setLayers] = useState([]);

  useEffect(() => {
    if (isOpen) {
      const state = useLayoutStore.getState();
      const storedLayers = state.meta.boundary_layers || [];
      
      // Sync check: if there are no boundary elements actually on the canvas,
      // reset both local state and the store to [] so the modal reflects the canvas state.
      const hasBoundaryRoads = state.roads.some(r => r.label && r.label.toLowerCase().includes('boundary'));
      const hasBoundaryTrees = state.amenities.some(a => a.id && a.id.startsWith('tree_'));
      
      if (storedLayers.length > 0 && !hasBoundaryRoads && !hasBoundaryTrees) {
        state.setMeta({ boundary_layers: [] });
        setLayers([]);
      } else {
        setLayers(storedLayers);
      }
    }
  }, [isOpen]);

  // When layers change, send a preview event
  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new CustomEvent('previewBoundaryLayers', { detail: { layers } }));
    }
  }, [layers, isOpen]);

  if (!isOpen) return null;

  const handleReserve = () => {
    onGenerate(layers);
    onClose();
  };

  const handleClearPrior = () => {
    window.dispatchEvent(new CustomEvent('clearOldBoundaries'));
    setLayers([]);
  };

  const handleClose = () => {
    // Clear previews on cancel
    window.dispatchEvent(new CustomEvent('previewBoundaryLayers', { detail: { layers: [] } }));
    onClose();
  };

  const addLayer = (type) => {
    window.dispatchEvent(new CustomEvent('clearOldBoundaries'));
    setLayers([...layers, type]);
  };

  const removeLayer = (index) => {
    window.dispatchEvent(new CustomEvent('clearOldBoundaries'));
    setLayers(layers.filter((_, i) => i !== index));
  };

  const layerOptions = [
    { type: 'trees', label: 'Boundary Trees (6m)', icon: '🌳', color: 'emerald' },
    { type: 'road', label: 'Ring Road (10m)', icon: '🛣️', color: 'indigo' },
    { type: 'path', label: 'Pedestrian Path (4m)', icon: '🚶', color: 'amber' }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <span>✨</span> Dynamic Boundary Builder
          </h2>
          <button 
            onClick={handleClose}
            className="text-indigo-100 hover:text-white hover:bg-indigo-700/50 p-1.5 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <p className="text-slate-600 text-sm mb-4">
            Build your boundary inwards. The first layer is placed directly against the red site perimeter. Subsequent layers automatically offset inwards to perfectly align without overlapping.
          </p>

          {/* Add Layer Buttons */}
          <div className="flex gap-2 mb-6 pb-4 border-b border-slate-100 overflow-x-auto">
            {layerOptions.map(opt => (
              <button
                key={opt.type}
                onClick={() => addLayer(opt.type)}
                className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors border-${opt.color}-200 text-${opt.color}-700 hover:bg-${opt.color}-50`}
              >
                <span>{opt.icon}</span> Add {opt.type.charAt(0).toUpperCase() + opt.type.slice(1)}
              </button>
            ))}
          </div>

          {/* Layer Sequence */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Boundary Sequence (Outward to Inward)</h3>
            
            {layers.length === 0 ? (
              <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400">
                <span className="text-2xl mb-2">📥</span>
                <p className="text-sm">No layers added yet.</p>
                <p className="text-xs">Click above to add your first outer boundary layer.</p>
              </div>
            ) : (
              layers.map((layer, index) => {
                const opt = layerOptions.find(o => o.type === layer);
                return (
                  <div key={`${layer}-${index}`} className={`flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white shadow-sm animate-in slide-in-from-right-4`}>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                        {index + 1}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{opt.icon}</span>
                        <span className="font-semibold text-slate-700 text-sm">{opt.label}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeLayer(index)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                      title="Remove Layer"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
          <button 
            onClick={handleClearPrior}
            className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200"
          >
            Trash Prior Boundaries
          </button>
          
          <div className="flex gap-3">
            <button 
              onClick={handleClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleReserve}
              disabled={layers.length === 0}
              className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <span>✨</span> Reserve Boundaries
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
