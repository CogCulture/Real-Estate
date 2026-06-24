import React, { useEffect } from 'react';
import { 
  Pointer, 
  Square, 
  MapPin, 
  Milestone, 
  Eraser, 
  Grid,
  Sparkles,
  Undo2,
  Redo2,
  Trash2,
  BoxSelect
} from 'lucide-react';
import { useLayoutStore } from '../../store/useLayoutStore';
import { useParams } from 'react-router-dom';
import { generateSuggestedLayout } from '../../utils/planningEngine';

export default function Toolbar({ viewMode, setViewMode }) {
  const { projectId } = useParams();
  const { 
    activeTool, 
    setActiveTool, 
    gridSnapped, 
    setGridSnapped,
    undo,
    redo,
    setLayout,
    resetLayout,
    setSelectedElementId,
    meta,
    setMeta,
    selectedCluster,
    duplicateClusterElements,
    clearSelectedCluster
  } = useLayoutStore();

  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleSuggestLayout = async () => {
    if (confirm("Are you sure you want to replace current design with an AI-generated luxury masterplan? This will overwrite your current changes.")) {
      setIsGenerating(true);
      try {
        const suggested = await generateSuggestedLayout(meta.site_width_m, meta.site_height_m, projectId, {
          boundary_geojson: meta.boundary_geojson || null
        });
        setLayout(suggested);
      } catch (err) {
        console.error("Failed to generate layout:", err);
        alert("Failed to generate layout. See console for details.");
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const tools = [
    { id: 'CLUSTER_SELECT', label: 'Select Area (C)', icon: BoxSelect, shortcut: 'c' },
    { id: 'LABEL', label: 'Label (T)', icon: MapPin, shortcut: 't' },
    { id: 'ERASER', label: 'Eraser (E)', icon: Eraser, shortcut: 'e' }
  ];

  // Hotkey listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      // Do not trigger hotkeys if user typing in input fields
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();
      
      // Control shortcuts
      if (e.ctrlKey) {
        if (key === 'z') {
          e.preventDefault();
          undo();
        } else if (key === 'y') {
          e.preventDefault();
          redo();
        }
        return;
      }

      // Check standard keys
      const toolMatch = tools.find(t => t.shortcut === key);
      if (toolMatch) {
        setActiveTool(toolMatch.id);
        if (toolMatch.id !== 'SELECT') {
          setSelectedElementId(null);
        }
      }

      // Custom toggles
      if (key === 'g') {
        if (e.shiftKey) {
          setGridSnapped(!gridSnapped);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gridSnapped, undo, redo]);

  return (
    <div className="flex flex-col gap-4 w-full">
      <h3 className="text-xs font-semibold text-slate-500 tracking-wider">DESIGN TOOLS</h3>
      
      <div className="flex flex-col gap-1.5">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => {
                const nextTool = isActive ? 'SELECT' : tool.id;
                setActiveTool(nextTool);
                if (nextTool !== 'SELECT') {
                  setSelectedElementId(null);
                }
              }}
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition-all duration-300 text-left ${
                isActive 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title={tool.label}
            >
              <Icon size={14} />
              <span>{tool.label.split(' ')[0]}</span>
              {tool.shortcut && (
                <span className="ml-auto text-[10px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded uppercase">
                  {tool.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedCluster && (
        <div className="p-3 border border-indigo-200 bg-indigo-50/50 rounded-lg my-2">
          <div className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider mb-2">Clustered Group</div>
          <div className="text-[11px] text-slate-600 mb-3 space-y-1">
            {selectedCluster.zoneIds?.length > 0 && (
              <div className="flex justify-between">
                <span>Zones</span>
                <span className="font-semibold bg-slate-100 px-1.5 py-0.2 rounded text-indigo-700">{selectedCluster.zoneIds.length}</span>
              </div>
            )}
            {selectedCluster.roadIds?.length > 0 && (
              <div className="flex justify-between">
                <span>Roads</span>
                <span className="font-semibold bg-slate-100 px-1.5 py-0.2 rounded text-indigo-700">{selectedCluster.roadIds.length}</span>
              </div>
            )}
            {selectedCluster.amenityIds?.length > 0 && (
              <div className="flex justify-between">
                <span>Amenities</span>
                <span className="font-semibold bg-slate-100 px-1.5 py-0.2 rounded text-indigo-700">{selectedCluster.amenityIds.length}</span>
              </div>
            )}
            {selectedCluster.labelIds?.length > 0 && (
              <div className="flex justify-between">
                <span>Labels</span>
                <span className="font-semibold bg-slate-100 px-1.5 py-0.2 rounded text-indigo-700">{selectedCluster.labelIds.length}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => duplicateClusterElements(selectedCluster)}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-1.5 px-2 rounded-md transition-all shadow-sm"
              title="Duplicate clustered selection"
            >
              Duplicate
            </button>
            <button
              onClick={clearSelectedCluster}
              className="flex-1 bg-slate-200 hover:bg-slate-355 text-slate-700 text-xs font-semibold py-1.5 px-2 rounded-md transition-all border border-slate-300"
              title="Deselect all"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <hr className="border-slate-100" />

      {/* Map Overlays */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider">MAP OVERLAYS</h3>
        <button
          onClick={() => setMeta({ showPublicRoads: meta.showPublicRoads !== false ? false : true })}
          className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition-all text-left ${
            meta.showPublicRoads !== false
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'text-slate-650 border border-transparent hover:bg-slate-100'
          }`}
          title="Show/Hide Connected Public Roads"
        >
          <Milestone size={14} />
          <span>Connected Roads</span>
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('clearMapConnections'))}
          className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition-all text-left text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 hover:shadow-sm"
          title="Clear all connected public road guides from the map"
        >
          <Trash2 size={14} />
          <span>Clear Map Connections</span>
        </button>
        {meta.deleted_osm_road_ids && meta.deleted_osm_road_ids.length > 0 && (
          <button
            onClick={() => setMeta({ deleted_osm_road_ids: [] })}
            className="flex items-center justify-center gap-1.5 py-1 text-slate-500 hover:text-indigo-600 rounded text-[9px] font-bold transition-all border border-dashed border-slate-200 hover:border-indigo-300"
            title="Restore all removed public roads context"
          >
            Restore Roads ({meta.deleted_osm_road_ids.length})
          </button>
        )}
      </div>

      <hr className="border-slate-100" />

      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => setGridSnapped(!gridSnapped)}
          className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition-all text-left ${
            gridSnapped 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'text-slate-600 border border-transparent hover:bg-slate-100'
          }`}
          title="Toggle Grid Snapping (Shift+G)"
        >
          <Grid size={14} />
          <span>Grid Snap</span>
          <span className="ml-auto text-[10px] text-slate-400">Shift+G</span>
        </button>

        <div className="grid grid-cols-2 gap-1.5 mt-2">
          <button
            onClick={undo}
            className="flex items-center justify-center gap-1.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold transition-all border border-slate-200"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={12} />
            Undo
          </button>
          <button
            onClick={redo}
            className="flex items-center justify-center gap-1.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold transition-all border border-slate-200"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={12} />
            Redo
          </button>
        </div>

        <button
          onClick={handleSuggestLayout}
          disabled={isGenerating}
          className="flex items-center justify-center gap-2.5 px-3 py-2 text-xs font-bold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 rounded-md border border-indigo-200 transition-all text-left mt-2 disabled:opacity-50"
          title="Suggest Procedural Layout"
        >
          <Sparkles size={14} />
          <span>{isGenerating ? 'Generating...' : 'Suggest Layout'}</span>
        </button>

        <button
          onClick={() => {
            if (confirm("Are you sure you want to clear the entire site layout?")) {
              resetLayout();
            }
          }}
          className="flex items-center justify-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-md border border-rose-200 transition-all text-left mt-2"
          title="Clear Layout"
        >
          <Trash2 size={14} />
          <span>Clear Layout</span>
        </button>
      </div>
    </div>
  );
}
