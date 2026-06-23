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
  Trash2
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
    meta,
    setMeta
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
    { id: 'SELECT', label: 'Select (S)', icon: Pointer, shortcut: 's' },
    { id: 'SQUARE', label: 'Square (Q)', icon: Square, shortcut: 'q' },
    { id: 'LINE', label: 'Line (L)', icon: Milestone, shortcut: 'l' },
    { id: 'CONNECTOR', label: 'Connector (C)', icon: Milestone, shortcut: 'c' },
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
    <div className="flex flex-col gap-4 bg-white border border-slate-200 p-4 rounded-lg shadow-sm w-[220px]">
      <h3 className="text-xs font-semibold text-slate-500 tracking-wider">DESIGN TOOLS</h3>
      
      <div className="flex flex-col gap-1.5">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(isActive ? 'SELECT' : tool.id)}
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

      <hr className="border-slate-100" />

      {/* View Mode */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider">VIEW MODE</h3>
        {[
          { id: 'grass',     label: 'Grass (Unreal)',     color: '#4a8c3f' },
          { id: 'concrete',  label: 'Concrete (Unreal)',  color: '#9ca3af' },
          { id: 'satellite', label: 'Satellite',          color: '#1a2332' },
          { id: 'street',    label: 'Street Map',         color: '#3b82f6' },
        ].map(mode => (
          <button
            key={mode.id}
            onClick={() => setViewMode && setViewMode(mode.id)}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition-all text-left ${
              viewMode === mode.id
                ? 'ring-2 ring-indigo-400 bg-slate-100 text-slate-900'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span
              className="w-3.5 h-3.5 rounded-full border border-slate-300 flex-shrink-0"
              style={{ background: mode.color }}
            />
            {mode.label}
          </button>
        ))}
      </div>

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
