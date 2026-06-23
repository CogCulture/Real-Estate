import React from 'react';
import { useLayoutStore } from '../../store/useLayoutStore';
import { Layers, PieChart, Info, Map } from 'lucide-react';

export default function ProjectSidebar() {
  const { meta } = useLayoutStore();
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
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Map className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-700">Legend</h3>
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            {legend.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div 
                  className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm"
                  style={{ backgroundColor: item.color || '#4A90E2' }}
                >
                  {item.number}
                </div>
                <span className="leading-tight">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
