import React, { useState } from 'react';

export default function BoundaryGeneratorModal({ isOpen, onClose, onGenerate }) {
  const [generateRoad, setGenerateRoad] = useState(true);
  const [generateTrees, setGenerateTrees] = useState(true);
  const [generatePath, setGeneratePath] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = () => {
    onGenerate({
      road: generateRoad,
      trees: generateTrees,
      path: generatePath
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <span>✨</span> Auto-Generate Boundaries
          </h2>
          <button 
            onClick={onClose}
            className="text-indigo-100 hover:text-white hover:bg-indigo-700/50 p-1.5 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-slate-600 text-sm mb-6">
            Which boundary features would you like me to auto-generate for your site? I'll automatically calculate your site's perimeter and place them perfectly along the edges.
          </p>

          <div className="space-y-4">
            
            {/* Road Option */}
            <label className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${generateRoad ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-200'}`}>
              <div className="flex-shrink-0 pt-0.5">
                <input 
                  type="checkbox" 
                  checked={generateRoad} 
                  onChange={(e) => setGenerateRoad(e.target.checked)}
                  className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm">Boundary Roads</div>
                <div className="text-slate-500 text-xs mt-0.5">Generates an Inner Ring Road (4m) perfectly offset from the site boundary.</div>
              </div>
            </label>

            {/* Trees Option */}
            <label className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${generateTrees ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 hover:border-emerald-200'}`}>
              <div className="flex-shrink-0 pt-0.5">
                <input 
                  type="checkbox" 
                  checked={generateTrees} 
                  onChange={(e) => setGenerateTrees(e.target.checked)}
                  className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm">Boundary Trees</div>
                <div className="text-slate-500 text-xs mt-0.5">Lines the outer perimeter with a lush foliage buffer (trees every 15m).</div>
              </div>
            </label>

            {/* Path Option */}
            <label className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${generatePath ? 'border-amber-500 bg-amber-50/50' : 'border-slate-200 hover:border-amber-200'}`}>
              <div className="flex-shrink-0 pt-0.5">
                <input 
                  type="checkbox" 
                  checked={generatePath} 
                  onChange={(e) => setGeneratePath(e.target.checked)}
                  className="w-5 h-5 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm">Pedestrian / Jogging Path</div>
                <div className="text-slate-500 text-xs mt-0.5">Spawns a continuous 2m wide jogging track alongside the boundary road.</div>
              </div>
            </label>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleGenerate}
            disabled={!generateRoad && !generateTrees && !generatePath}
            className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all flex items-center gap-2"
          >
            <span>✨</span> Generate Selected
          </button>
        </div>

      </div>
    </div>
  );
}
