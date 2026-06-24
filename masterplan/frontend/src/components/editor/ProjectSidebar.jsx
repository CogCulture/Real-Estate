import React, { useState } from 'react';
import { useLayoutStore } from '../../store/useLayoutStore';
import { Layers, PieChart, Info, Map, Sparkles, X } from 'lucide-react';

export default function ProjectSidebar() {
  const { meta } = useLayoutStore();
  const [showBoundaryModal, setShowBoundaryModal] = useState(false);
  const [boundarySelections, setBoundarySelections] = useState({
    roads: true,
    paths: true,
    trees: true
  });
  const masterplan = meta?.masterplan_ai;

  if (!masterplan) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center text-slate-500">
        <Map className="w-12 h-12 text-slate-300 mb-3" />
        <p className="text-sm font-medium">No Masterplan Data</p>
        <p className="text-xs mt-1">Use the "Suggest Layout" button to generate an AI masterplan.</p>
      </div>
    );
  }

  const { project, land_use, legend } = masterplan;

  return (
    <div className="w-full flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-800">{project?.name || "Project Overview"}</h2>
        <p className="text-xs text-slate-500 mt-1">{project?.location || "Location not specified"}</p>
      </div>

      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-700">Details</h3>
        </div>
        <div className="space-y-2 text-xs text-slate-600">
          <div className="flex justify-between">
            <span className="font-medium">Total Area</span>
            <span>{project?.total_area_acres || "-"} Acres</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Total Towers</span>
            <span>{project?.total_towers || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Theme</span>
            <span className="truncate w-32 text-right" title={project?.theme}>{project?.theme || "-"}</span>
          </div>
        </div>
      </div>

      {project?.unit_mix && (
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-700">Unit Mix</h3>
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            {Object.entries(project.unit_mix).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="capitalize">{key.replace('_pct', '').replace('_', ' ')}</span>
                <span className="font-semibold bg-slate-100 px-2 py-0.5 rounded text-indigo-700">{value}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {land_use && (
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-700">Land Use Summary</h3>
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            {Object.entries(land_use).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="capitalize truncate w-32">{key.replace('_pct', '').replace('_', ' ')}</span>
                <span className="font-semibold">{value}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {legend && legend.length > 0 && (
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Map className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-700">Legend</h3>
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            {legend.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color || '#cbd5e1' }} />
                <span className="truncate">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 mt-auto">
        <button
          onClick={() => setShowBoundaryModal(true)}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white py-2.5 px-4 rounded-lg font-medium text-sm transition-all shadow-sm hover:shadow-md"
        >
          <Sparkles className="w-4 h-4" />
          Boundary Features
        </button>
      </div>

      {showBoundaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 rounded-md text-indigo-600">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-slate-800">Generate Boundaries</h3>
              </div>
              <button 
                onClick={() => setShowBoundaryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-500 mb-2">Select the boundary features you want the AI to automatically place around the site perimeter.</p>
              
              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  checked={boundarySelections.roads}
                  onChange={(e) => setBoundarySelections(s => ({ ...s, roads: e.target.checked }))}
                />
                <div>
                  <div className="text-sm font-medium text-slate-700">Boundary Ring Road</div>
                  <div className="text-xs text-slate-500">A major perimeter road enclosing the site</div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  checked={boundarySelections.trees}
                  onChange={(e) => setBoundarySelections(s => ({ ...s, trees: e.target.checked }))}
                />
                <div>
                  <div className="text-sm font-medium text-slate-700">Perimeter Trees</div>
                  <div className="text-xs text-slate-500">Lush green foliage buffer around the site</div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  checked={boundarySelections.paths}
                  onChange={(e) => setBoundarySelections(s => ({ ...s, paths: e.target.checked }))}
                />
                <div>
                  <div className="text-sm font-medium text-slate-700">Jogging / Pedestrian Path</div>
                  <div className="text-xs text-slate-500">A walking trail just inside the boundary</div>
                </div>
              </label>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
              <button 
                onClick={() => setShowBoundaryModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (boundarySelections.roads) window.dispatchEvent(new Event('generateBoundaryRoad'));
                  if (boundarySelections.paths) window.dispatchEvent(new Event('generateBoundaryPath'));
                  if (boundarySelections.trees) window.dispatchEvent(new Event('generateBoundaryTrees'));
                  setShowBoundaryModal(false);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
              >
                Generate Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
