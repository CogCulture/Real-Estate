import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, FileText, Download, Eye, HelpCircle, ArrowLeft, Map, ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minimize2, FolderKanban } from 'lucide-react';
import Toolbar from '../components/editor/Toolbar';
import ProjectSidebar from '../components/editor/ProjectSidebar';
import Canvas2D from '../components/editor/Canvas2D';
import PropertiesPanel from '../components/editor/PropertiesPanel';
import Button from '../components/ui/Button';
import { useLayoutStore } from '../store/useLayoutStore';
import { useProjectStore } from '../store/useProjectStore';
import { fetchProjectById } from '../api/projects';
import { fetchLatestLayout, saveLayout } from '../api/layouts';
import { exportLayoutToJSON } from '../utils/layoutExporter';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function Editor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { currentProject, setCurrentProject } = useProjectStore();
  const { zones, roads, amenities, labels, meta, setLayout, resetLayout } = useLayoutStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportQuality, setExportQuality] = useState('high'); // low | high | ultra
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [viewMode, setViewMode] = useState('grass');
  const [canvasViewportSize, setCanvasViewportSize] = useState({ width: 0, height: 0 });
  const canvasViewportRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const lastSavedSnapshotRef = useRef('');
  const skipNextAutosaveRef = useRef(true);

  const buildLayoutPayload = () => exportLayoutToJSON(projectId, zones, roads, amenities, labels, meta);

  const persistLayout = async ({ showSuccessToast = true, successMessage = '' } = {}) => {
    const payload = buildLayoutPayload();
    await saveLayout({
      project_id: projectId,
      layout_json: JSON.stringify(payload),
      canvas_width: meta.canvas_width_px,
      canvas_height: meta.canvas_height_px,
      scale_factor: meta.scale_px_per_m
    });
    lastSavedSnapshotRef.current = JSON.stringify(payload);
    if (showSuccessToast && successMessage) {
      toast.success(successMessage);
    }
  };

  useEffect(() => {
    if (!projectId || typeof window === 'undefined') {
      return;
    }

    const savedAutoSave = window.localStorage.getItem(`masterplan.autosave.${projectId}`);
    setAutoSaveEnabled(savedAutoSave === null ? true : savedAutoSave === 'true');
    skipNextAutosaveRef.current = true;
  }, [projectId]);

  useEffect(() => {
    if (!projectId || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(`masterplan.autosave.${projectId}`, String(autoSaveEnabled));
  }, [projectId, autoSaveEnabled]);

  useEffect(() => {
    const initEditor = async () => {
      setIsLoading(true);
      try {
        const proj = await fetchProjectById(projectId);
        setCurrentProject(proj);

        // Fetch latest layout version
        try {
          const latestLayout = await fetchLatestLayout(projectId);
          if (latestLayout) {
            lastSavedSnapshotRef.current = latestLayout.layout_json;
            skipNextAutosaveRef.current = true;
            setLayout(JSON.parse(latestLayout.layout_json));
          }
        } catch (layoutErr) {
          if (layoutErr.response && layoutErr.response.status === 404) {
            console.log("No layout saved yet for this project.");
          } else {
            throw layoutErr;
          }
        }
      } catch (err) {
        console.error("Initialization error:", err);
        toast.error("Failed to load project design workspace");
      } finally {
        setIsLoading(false);
      }
    };

    initEditor();
  }, [projectId]);

  useEffect(() => {
    const el = canvasViewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const updateSize = () => {
      setCanvasViewportSize({
        width: Math.max(0, el.clientWidth - 32),
        height: Math.max(0, el.clientHeight - 32)
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [leftCollapsed, rightCollapsed, isMaximized]);

  const handleBackToDashboard = async () => {
    try {
      await persistLayout({ successMessage: "Design auto-saved!" });
    } catch (err) {
      console.error("Auto-save failed on back:", err);
    }
    navigate('/');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await persistLayout({ successMessage: "Site layout version saved successfully!" });
    } catch (err) {
      toast.error("Failed to save layout");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportJSON = () => {
    const payload = exportLayoutToJSON(projectId, zones, roads, amenities, labels, meta);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `masterplan_${projectId}_layout.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("JSON exported successfully");
  };

  const handleExportPDF = () => {
    toast.loading("Generating PDF...", { id: 'pdf' });
    const canvasElement = document.querySelector('.konvajs-content');
    if (canvasElement) {
      const scaleMap = { low: 1, high: 2, ultra: 4 };
      const currentScale = scaleMap[exportQuality] || 2;
      
      html2canvas(canvasElement, { scale: currentScale }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        // A3 size Landscape: 420mm x 297mm
        const pdf = new jsPDF('l', 'mm', 'a3');
        pdf.addImage(imgData, 'PNG', 10, 10, 400, 277);
        pdf.save(`masterplan_${currentProject?.name || 'layout'}_2D.pdf`);
        toast.dismiss('pdf');
        toast.success(`A3 PDF (${exportQuality.toUpperCase()} RES) exported successfully`);
      }).catch(err => {
        toast.dismiss('pdf');
        toast.error("Failed to generate PDF");
      });
    } else {
      toast.dismiss('pdf');
      toast.error("Canvas element not found");
    }
  };

  const handleExportPNG = () => {
    toast.loading("Generating Image...", { id: 'png' });
    const canvasElement = document.querySelector('.konvajs-content');
    if (canvasElement) {
      const scaleMap = { low: 1, high: 2, ultra: 4 };
      const currentScale = scaleMap[exportQuality] || 2;
      
      html2canvas(canvasElement, { scale: currentScale }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", imgData);
        downloadAnchor.setAttribute("download", `masterplan_${currentProject?.name || 'layout'}_2D_${exportQuality}.png`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        
        toast.dismiss('png');
        toast.success(`PNG Image (${exportQuality.toUpperCase()} RES) exported successfully`);
      }).catch(err => {
        toast.dismiss('png');
        toast.error("Failed to generate Image");
      });
    } else {
      toast.dismiss('png');
      toast.error("Canvas element not found");
    }
  };

  const handleContinue = async () => {
    // Auto-save before continuing
    try {
      await persistLayout({ showSuccessToast: false });
      navigate(`/preview/${projectId}`);
    } catch (err) {
      toast.error("Auto-save failed before routing. Please save manually.");
    }
  };

  useEffect(() => {
    if (isLoading || isSaving || !autoSaveEnabled || !projectId) {
      return;
    }

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      const currentSnapshot = JSON.stringify(buildLayoutPayload());
      if (currentSnapshot === lastSavedSnapshotRef.current) {
        return;
      }
      persistLayout({ showSuccessToast: false }).catch((err) => {
        console.error("Auto-save failed:", err);
      });
    }, 2000); // 2-second debounce for autosave to ensure smooth dragging

    return () => clearTimeout(autosaveTimerRef.current);
  }, [projectId, isLoading, isSaving, autoSaveEnabled, zones, roads, amenities, labels, meta]);

  useEffect(() => () => clearTimeout(autosaveTimerRef.current), []);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
        <span className="text-slate-650 text-sm">Opening project design editor...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">

      {/* Slim Action Bar */}
      <div className="bg-white border-b border-slate-200 py-2 px-4 flex justify-between items-center shadow-sm relative z-10">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-4 text-slate-800 font-bold text-sm tracking-wide">
             <FolderKanban className="text-indigo-600" size={18} />
             MasterPlan
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleBackToDashboard} variant="secondary" className="text-xs">
            <ArrowLeft size={13} />
            Dashboard
          </Button>
          <Button onClick={() => navigate(`/new-project?projectId=${projectId}`)} variant="secondary" className="text-xs">
            <Map size={13} />
            Boundary
          </Button>
          <div className="w-px h-4 bg-slate-200 mx-1"></div>
          <Button onClick={handleSave} disabled={isSaving} variant="secondary" className="text-xs">
            <Save size={13} />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button onClick={() => setAutoSaveEnabled(v => !v)} variant={autoSaveEnabled ? 'success' : 'secondary'} className="text-xs">
            Auto {autoSaveEnabled ? 'On' : 'Off'}
          </Button>
          <div className="relative">
            <Button onClick={() => setIsExportMenuOpen(v => !v)} variant="secondary" className="text-xs">
              <Download size={13} />
              Export
              <ChevronDown size={13} />
            </Button>
            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1 w-52 rounded-lg border border-slate-200 bg-white shadow-lg p-2 z-50">
                <button onClick={() => { handleExportJSON(); setIsExportMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-md">
                  <Download size={13} /> Export JSON
                </button>
                <button onClick={() => { handleExportPDF(); setIsExportMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-md">
                  <FileText size={13} /> Export PDF
                </button>
                <button onClick={() => { handleExportPNG(); setIsExportMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-md">
                  <FileText size={13} /> Export PNG
                </button>
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 px-3">Resolution</label>
                  <select value={exportQuality} onChange={(e) => setExportQuality(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-md text-[11px] font-semibold text-slate-700 focus:outline-none px-3 py-2">
                    <option value="low">Low Res (Draft)</option>
                    <option value="high">High Res (Print)</option>
                    <option value="ultra">Ultra Res (4K)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          <Button onClick={handleContinue} variant="primary" className="text-xs">
            <Eye size={13} />
            3D Preview
          </Button>
        </div>
      </div>

      {/* Project Info Bar */}
      <div className="bg-white border-b border-slate-200 py-1.5 px-6 flex items-center gap-3 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">{currentProject?.name}</h2>
        <span className="text-slate-300">|</span>
        <span className="text-[10px] text-slate-500">
          {currentProject?.site_width}m × {currentProject?.site_height}m &nbsp;·&nbsp; {currentProject?.site_area?.toLocaleString()} m²
        </span>
      </div>

      {/* Editor Workspace */}
      <div 
        className="flex-1 flex overflow-hidden" 
        style={{ height: `max(calc(100vh - 100px), ${meta?.canvas_height_px ? meta.canvas_height_px + 200 : 950}px)` }}
      >
        {/* Left Panels */}
        <div className={`relative flex-shrink-0 flex flex-col h-full border-r border-slate-200 bg-white transition-all duration-300 w-64 ${leftCollapsed ? '!w-8' : ''}`}>
          <button
            onClick={() => setLeftCollapsed(v => !v)}
            className="absolute -right-3 top-4 z-20 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow hover:bg-slate-50 transition-colors"
            title={leftCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
          >
            {leftCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
          {!leftCollapsed && (
            <div className="flex-1 overflow-y-auto flex flex-col">
              <div className="p-4 border-b border-slate-200 shrink-0">
                <Toolbar viewMode={viewMode} setViewMode={setViewMode} />
              </div>
              <div className="flex-1">
                <ProjectSidebar />
              </div>
            </div>
          )}
        </div>

        {/* Center Canvas Viewport */}
        <div ref={canvasViewportRef} className="flex-1 min-w-0 min-h-0 p-4 overflow-auto flex flex-col justify-start items-center relative">
          {/* Maximize Button */}
          <button
            onClick={() => {
              setIsMaximized(v => {
                const next = !v;
                if (next) {
                  setLeftCollapsed(true);
                  setRightCollapsed(true);
                } else {
                  setLeftCollapsed(false);
                  setRightCollapsed(false);
                }
                return next;
              });
            }}
            className="absolute top-2 right-2 z-20 w-7 h-7 bg-white border border-slate-200 rounded flex items-center justify-center shadow hover:bg-slate-50 transition-colors"
            title={isMaximized ? 'Restore layout' : 'Maximize canvas'}
          >
            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <Canvas2D
            width={canvasViewportSize.width || meta.canvas_width_px}
            height={Math.max(canvasViewportSize.height, (meta.canvas_height_px || 576) + 150)}
            viewMode={viewMode}
          />
        </div>

        {/* Right Inspector Panel */}
        <div className={`relative flex-shrink-0 border-l border-slate-200 bg-white transition-all duration-300 ${rightCollapsed ? 'w-8' : 'w-auto'}`}>
          <button
            onClick={() => setRightCollapsed(v => !v)}
            className="absolute -left-3 top-4 z-20 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow hover:bg-slate-50 transition-colors"
            title={rightCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {rightCollapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </button>
          {!rightCollapsed && (
            <div className="p-4 overflow-y-auto h-full">
              <PropertiesPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
