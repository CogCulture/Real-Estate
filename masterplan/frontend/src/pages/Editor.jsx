import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, FileText, Download, Eye, HelpCircle, ArrowLeft, Map, ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minimize2, FolderKanban, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, MousePointer, Square, MapPin, Eraser, Grid, Undo2, Redo2, BoxSelect, X, Sparkles, ImageDown } from 'lucide-react';
import Toolbar from '../components/editor/Toolbar';
import ProjectSidebar from '../components/editor/ProjectSidebar';
import Canvas2D from '../components/editor/Canvas2D';
import PropertiesPanel from '../components/editor/PropertiesPanel';
import Button from '../components/ui/Button';
import { useLayoutStore } from '../store/useLayoutStore';
import { useProjectStore } from '../store/useProjectStore';
import { fetchProjectById, updateProject } from '../api/projects';
import { fetchLatestLayout, saveLayout } from '../api/layouts';
import { exportLayoutToJSON } from '../utils/layoutExporter';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function Editor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { currentProject, setCurrentProject } = useProjectStore();
  const { 
    zones, 
    roads, 
    amenities, 
    labels, 
    meta, 
    setLayout, 
    resetLayout, 
    activeTool, 
    setActiveTool, 
    setSelectedElementId, 
    undo, 
    redo, 
    historyIndex, 
    history,
    landUseModalOpen
  } = useLayoutStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [exportQuality, setExportQuality] = useState('high'); // low | high | ultra
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('masterplan_viewMode') || 'street');
  
  useEffect(() => {
    localStorage.setItem('masterplan_viewMode', viewMode);
  }, [viewMode]);

  const [isLegendExpanded, setIsLegendExpanded] = useState(true);

  const legendMapping = React.useMemo(() => {
    if (!meta?.showNumberLegend) return [];
    const uniqueLabels = new Set();
    zones.forEach(z => {
      if (z.label) uniqueLabels.add(z.label.toUpperCase());
    });
    amenities.forEach(a => {
      if (a.type !== 'tree' && a.label) uniqueLabels.add(a.label.toUpperCase());
    });
    return Array.from(uniqueLabels).map((label, idx) => ({
      number: idx + 1,
      label
    }));
  }, [zones, amenities, meta?.showNumberLegend]);



  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  const handleStartEditName = () => {
    setTempName(currentProject?.name || '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    setIsEditingName(false);
    const trimmed = tempName.trim();
    if (!trimmed || trimmed === currentProject?.name) return;

    const originalProject = currentProject;
    // Optimistic update
    const updated = { ...currentProject, name: trimmed };
    setCurrentProject(updated);

    try {
      await updateProject(projectId, { name: trimmed });
      toast.success("Project name updated!");
    } catch (err) {
      console.error("Failed to update project name:", err);
      toast.error("Failed to save project name");
      setCurrentProject(originalProject);
    }
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
    }
  };

  const [showDimensions, setShowDimensions] = useState(true);
  const [showTicks, setShowTicks] = useState(true);
  const [dimensionUnit, setDimensionUnit] = useState('m');
  const [showCompass, setShowCompass] = useState(true);
  const [showBoundaryModal, setShowBoundaryModal] = useState(false);
  const [boundarySelections, setBoundarySelections] = useState({
    roads: true,
    paths: true,
    trees: true
  });
  const [leftWidth, setLeftWidth] = useState(256);
  const [rightWidth, setRightWidth] = useState(288);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [canvasViewportSize, setCanvasViewportSize] = useState({ width: 0, height: 0 });
  const canvasViewportRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const lastSavedSnapshotRef = useRef('');
  const skipNextAutosaveRef = useRef(true);

  const startLeftResize = (mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizingLeft(true);
    const startX = mouseDownEvent.clientX;
    const startWidth = leftWidth;

    const doResize = (mouseMoveEvent) => {
      const deltaX = mouseMoveEvent.clientX - startX;
      const nextWidth = Math.max(180, Math.min(450, startWidth + deltaX));
      setLeftWidth(nextWidth);
    };

    const stopResize = () => {
      setIsResizingLeft(false);
      window.removeEventListener('mousemove', doResize);
      window.removeEventListener('mouseup', stopResize);
    };

    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
  };

  const startRightResize = (mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizingRight(true);
    const startX = mouseDownEvent.clientX;
    const startWidth = rightWidth;

    const doResize = (mouseMoveEvent) => {
      const deltaX = startX - mouseMoveEvent.clientX;
      const nextWidth = Math.max(180, Math.min(450, startWidth + deltaX));
      setRightWidth(nextWidth);
    };

    const stopResize = () => {
      setIsResizingRight(false);
      window.removeEventListener('mousemove', doResize);
      window.removeEventListener('mouseup', stopResize);
    };

    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
  };

  const buildLayoutPayload = () => exportLayoutToJSON(projectId, zones, roads, amenities, labels, meta);

  const persistLayout = async ({ showSuccessToast = true, successMessage = '' } = {}) => {
    const payload = buildLayoutPayload();
    const payloadStr = JSON.stringify(payload);
    lastSavedSnapshotRef.current = payloadStr;
    await saveLayout({
      project_id: projectId,
      layout_json: payloadStr,
      canvas_width: meta.canvas_width_px,
      canvas_height: meta.canvas_height_px,
      scale_factor: meta.scale_px_per_m
    });
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
        if (!lastSavedSnapshotRef.current) {
          lastSavedSnapshotRef.current = JSON.stringify(buildLayoutPayload());
        }
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
  }, [leftCollapsed, rightCollapsed, isMaximized, isLoading, leftWidth, rightWidth]);

  const handleBackToDashboard = async () => {
    try {
      await persistLayout({ successMessage: "Design auto-saved!" });
    } catch (err) {
      console.error("Auto-save failed on back:", err);
    }
    navigate('/projects');
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

  const handleContinue = () => {
    // Do nothing for now
  };

  useEffect(() => {
    if (isLoading || isSaving || !autoSaveEnabled || !projectId) {
      return;
    }

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    const currentSnapshot = JSON.stringify(buildLayoutPayload());
    if (currentSnapshot === lastSavedSnapshotRef.current) {
      return;
    }

    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
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
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">

      {/* Slim Action Bar */}
      {!landUseModalOpen && (
        <div className="bg-white border-b border-slate-200 py-2 px-4 flex justify-between items-center shadow-sm relative z-[40]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-4 text-slate-800 font-bold text-sm tracking-wide">
               <FolderKanban className="text-indigo-600" size={18} />
               MasterPlan
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-normal">
              <span className="text-slate-300">|</span>
              {isEditingName ? (
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  onBlur={handleSaveName}
                  className="px-2 py-0.5 border border-indigo-500 rounded bg-white font-semibold text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[125px]"
                  autoFocus
                />
              ) : (
                <span 
                  onClick={handleStartEditName}
                  className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 hover:text-indigo-600 px-1.5 py-0.5 rounded transition-all flex items-center gap-1 group"
                  title="Click to edit project name"
                >
                  {currentProject?.name}
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-slate-400 font-bold ml-1">✏️</span>
                </span>
              )}
              <span className="text-slate-300">|</span>
              <span>{currentProject?.site_width}m × {currentProject?.site_height}m &nbsp;·&nbsp; {currentProject?.site_area?.toLocaleString()} m²</span>
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
            
            <div className="relative">
              <Button onClick={() => { setIsViewMenuOpen(v => !v); setIsExportMenuOpen(false); }} variant="secondary" className="text-xs px-2.5">
                <Eye size={13} />
              </Button>
              {isViewMenuOpen && (
                <div className="absolute right-0 mt-1 w-48 rounded-lg border border-slate-200 bg-white shadow-xl p-2 z-[100]">
                  {[
                    { id: 'grass',     label: 'Grass (Unreal)',     color: '#4a8c3f' },
                    { id: 'concrete',  label: 'Concrete (Unreal)',  color: '#9ca3af' },
                    { id: 'satellite', label: 'Satellite',          color: '#1a2332' },
                    { id: 'street',    label: 'Street Map',         color: '#3b82f6' },
                  ].map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => { setViewMode(mode.id); setIsViewMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition-all text-left ${
                        viewMode === mode.id
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-650 hover:bg-slate-50'
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
              )}
            </div>
            
            <div className="relative">
              <Button onClick={() => { setIsExportMenuOpen(v => !v); setIsViewMenuOpen(false); }} variant="secondary" className="text-xs px-2.5">
                <Download size={13} />
              </Button>
              {isExportMenuOpen && (
                <div className="absolute right-0 mt-1 w-52 rounded-lg border border-slate-200 bg-white shadow-xl p-2 z-[100]">
                  <button onClick={() => { handleExportJSON(); setIsExportMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-750 hover:bg-slate-50 rounded-md">
                    <Download size={13} /> Export JSON
                  </button>
                  <button onClick={() => { handleExportPDF(); setIsExportMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-750 hover:bg-slate-50 rounded-md">
                    <FileText size={13} /> Export PDF
                  </button>
                  <button onClick={() => { handleExportPNG(); setIsExportMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-750 hover:bg-slate-50 rounded-md">
                    <FileText size={13} /> Export PNG
                  </button>
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 px-3">Resolution</label>
                    <select value={exportQuality} onChange={(e) => setExportQuality(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-md text-[11px] font-semibold text-slate-750 focus:outline-none px-3 py-2">
                      <option value="low">Low Res (Draft)</option>
                      <option value="high">High Res (Print)</option>
                      <option value="ultra">Ultra Res (4K)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <Button onClick={handleContinue} variant="primary" className="text-xs">
              <ImageDown size={13} />
              Render
            </Button>
          </div>
        </div>
      )}

      {/* Editor Workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left Panels */}
        <div 
          className="relative flex-shrink-0 flex flex-col h-full border-r border-slate-200 bg-white z-10"
          style={{ width: leftCollapsed ? 48 : leftWidth }}
        >
          {/* Collapse toggle — integrated into top of sidebar */}
          <div className={`flex items-center border-b border-slate-200 shrink-0 ${leftCollapsed ? 'justify-center py-2' : 'justify-between px-3 py-2'}`}>
            {!leftCollapsed && <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Tools</span>}
            <button
              onClick={() => setLeftCollapsed(v => !v)}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              title={leftCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
            >
              {leftCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            </button>
          </div>
          {leftCollapsed ? (
            /* Collapsed: icon-only strip */
            <div className="flex flex-col items-center gap-1 pt-2">
              {[
                { icon: MousePointer, label: 'Select', tool: 'SELECT' },
                { icon: BoxSelect, label: 'Cluster Select', tool: 'CLUSTER_SELECT' },
                { icon: Square, label: 'Zone', tool: 'ZONE' },
                { icon: MapPin, label: 'Label', tool: 'LABEL' },
                { icon: Eraser, label: 'Eraser', tool: 'ERASER' },
              ].map(({ icon: Icon, label, tool }) => {
                const isActive = activeTool === tool;
                return (
                  <button
                    key={tool}
                    title={label}
                    onClick={() => {
                      const nextTool = isActive ? 'SELECT' : tool;
                      setActiveTool(nextTool);
                      if (nextTool !== 'SELECT') {
                        setSelectedElementId(null);
                      }
                    }}
                    className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon size={14} />
                  </button>
                );
              })}
              <div className="w-6 h-px bg-slate-200 my-1" />
              <button 
                title="Undo" 
                onClick={undo}
                disabled={historyIndex <= 0}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
              >
                <Undo2 size={14} />
              </button>
              <button 
                title="Redo" 
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
              >
                <Redo2 size={14} />
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto flex flex-col">
              <div className="p-3 border-b border-slate-200 shrink-0">
                <Toolbar viewMode={viewMode} setViewMode={setViewMode} />
              </div>
              <div className="flex-1">
                <ProjectSidebar 

                  showDimensions={showDimensions}
                  setShowDimensions={setShowDimensions}
                  showTicks={showTicks}
                  setShowTicks={setShowTicks}
                  dimensionUnit={dimensionUnit}
                  setDimensionUnit={setDimensionUnit}
                  showCompass={showCompass}
                  setShowCompass={setShowCompass}
                />
              </div>
            </div>
          )}
          {!leftCollapsed && (
            <div
              onMouseDown={startLeftResize}
              className="w-1.5 hover:w-1.5 cursor-col-resize absolute top-0 right-0 h-full hover:bg-indigo-500/50 bg-transparent transition-colors z-20"
              style={{ transform: 'translateX(50%)' }}
            />
          )}
        </div>

        {/* Center Canvas Viewport — scrollable, 150% height */}
        <div ref={canvasViewportRef} className="flex-1 min-w-0 min-h-0 p-4 overflow-auto flex flex-col justify-start items-center relative">
          {/* Maximize and Zoom Controls Group */}
          {!landUseModalOpen && (
            <div className="absolute top-2 right-2 z-10 flex gap-1.5">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('zoomCanvasIn'))}
                className="w-7 h-7 bg-white border border-slate-200 rounded flex items-center justify-center shadow hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors font-bold text-sm"
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('zoomCanvasOut'))}
                className="w-7 h-7 bg-white border border-slate-200 rounded flex items-center justify-center shadow hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors font-bold text-sm"
                title="Zoom Out"
              >
                −
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('rotateCanvas', { detail: { angle: 10 } }))}
                className="w-7 h-7 bg-white border border-slate-200 rounded flex items-center justify-center shadow hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors text-[10px]"
                title="Rotate Map (10°)"
              >
                🔄
              </button>
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
                className="w-7 h-7 bg-white border border-slate-200 rounded flex items-center justify-center shadow hover:bg-slate-50 transition-colors"
                title={isMaximized ? 'Restore layout' : 'Maximize canvas'}
              >
                {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </div>
          )}
          <Canvas2D
            width={canvasViewportSize.width || meta.canvas_width_px}
            height={Math.round(Math.max(canvasViewportSize.height, (meta.canvas_height_px || 576)) * 1.5)}
            viewMode={viewMode}
            showDimensions={showDimensions}
                      showTicks={showTicks}
            dimensionUnit={dimensionUnit}
            showCompass={showCompass}
          />

          {/* Static Compass Overlay with Rotating Needle pointing to Sitemap orientation */}
          {showCompass && (
            <div className="absolute bottom-6 right-6 z-20 pointer-events-none transition-all duration-300">
              <svg width="52" height="52" viewBox="0 0 100 100" className="drop-shadow-sm">
                <g 
                  transform={`rotate(${- (meta.north_angle_deg || 0)}, 50, 50)`}
                  style={{ transition: 'transform 300ms ease-out' }}
                >
                  {/* Outer compass ring (dashed) */}
                  <circle cx="50" cy="50" r="28" stroke="#0f172a" strokeWidth="1.5" fill="none" strokeDasharray="3,3" />

                  {/* Dial Cardinal Labels */}
                  <text x="50" y="11" textAnchor="middle" fontSize="15" fontWeight="900" fill="#0f172a" fontFamily="sans-serif">N</text>
                  <text x="92" y="53.5" textAnchor="middle" fontSize="12" fontWeight="900" fill="#64748b" fontFamily="sans-serif">E</text>
                  <text x="50" y="97" textAnchor="middle" fontSize="12" fontWeight="900" fill="#64748b" fontFamily="sans-serif">S</text>
                  <text x="8.5" y="53.5" textAnchor="middle" fontSize="12" fontWeight="900" fill="#64748b" fontFamily="sans-serif">W</text>

                  {/* Diagonal sub-needles (greyed out in the background) */}
                  <polygon points="26,26 50,50 43,53" fill="#cbd5e1" opacity="0.4" />
                  <polygon points="26,26 50,50 53,43" fill="#94a3b8" opacity="0.4" />
                  <polygon points="74,26 50,50 71,53" fill="#cbd5e1" opacity="0.4" />
                  <polygon points="74,26 50,50 78,45" fill="#94a3b8" opacity="0.4" />
                  <polygon points="74,74 50,50 71,78" fill="#cbd5e1" opacity="0.4" />
                  <polygon points="74,74 50,50 81,71" fill="#94a3b8" opacity="0.4" />
                  <polygon points="26,74 50,50 25,78" fill="#cbd5e1" opacity="0.4" />
                  <polygon points="26,74 50,50 22,71" fill="#94a3b8" opacity="0.4" />

                  {/* Main vertical point - North Needle (Red) */}
                  <polygon points="50,15 50,50 42,50" fill="#dc2626" />
                  <polygon points="50,15 50,50 58,50" fill="#f87171" />
                  {/* Main horizontal point - East Needle */}
                  <polygon points="85,50 50,50 50,42" fill="#475569" />
                  <polygon points="85,50 50,50 50,58" fill="#64748b" />
                  {/* Main southern point - South Needle */}
                  <polygon points="50,85 50,50 58,50" fill="#475569" />
                  <polygon points="50,85 50,50 42,50" fill="#94a3b8" />
                  {/* Main western point - West Needle */}
                  <polygon points="15,50 50,50 50,58" fill="#475569" />
                  <polygon points="15,50 50,50 50,42" fill="#94a3b8" />
                  
                  {/* Central pivot dot */}
                  <circle cx="50" cy="50" r="4.5" fill="#ffffff" stroke="#0f172a" strokeWidth="2" />
                </g>
              </svg>
            </div>
          )}

          {/* Collapsible Dropdown Legend Overlay - fixed to the bottom left */}
          {meta.showNumberLegend && legendMapping.length > 0 && (
            <div className={`absolute bottom-6 left-6 z-20 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 pointer-events-auto transition-all duration-300 ${isLegendExpanded ? 'min-w-[210px]' : 'min-w-[160px]'} overflow-hidden flex flex-col`}>
              {/* Toggle / Header */}
              <button
                type="button"
                onClick={() => setIsLegendExpanded(v => !v)}
                className={`flex items-center justify-between ${isLegendExpanded ? 'p-3 border-b border-slate-100' : 'py-1.5 px-2.5'} hover:bg-slate-50 transition-all w-full text-left font-black ${isLegendExpanded ? 'text-[9.5px]' : 'text-[9px]'} text-slate-800 uppercase tracking-widest cursor-pointer outline-none`}
              >
                <span className="flex items-center gap-1.5">📖 Sitemap Legend</span>
                <ChevronDown size={isLegendExpanded ? 13 : 11} className={`transform transition-transform ${isLegendExpanded ? 'rotate-180' : ''}`} />
              </button>
              {isLegendExpanded && (
                <div className="p-3.5 space-y-2.5 max-h-[220px] overflow-y-auto">
                  {legendMapping.map(item => (
                    <div key={item.number} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border border-slate-300 bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-855 shadow-sm shrink-0">
                        {item.number}
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 leading-tight">{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Inspector Panel */}
        <div 
          className="relative flex-shrink-0 flex flex-col h-full border-l border-slate-200 bg-white z-10"
          style={{ width: rightCollapsed ? 48 : rightWidth }}
        >
          {/* Collapse toggle */}
          <div className={`flex items-center border-b border-slate-200 shrink-0 ${rightCollapsed ? 'justify-center py-2' : 'justify-between px-3 py-2'}`}>
            <button
              onClick={() => setRightCollapsed(v => !v)}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              title={rightCollapsed ? 'Expand panel' : 'Collapse panel'}
            >
              {rightCollapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
            </button>
            {!rightCollapsed && <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Inspector</span>}
          </div>
          {rightCollapsed ? (
            /* Collapsed: icon-only strip with placement tools */
            <div className="flex flex-col items-center gap-1 pt-2">
              {[
                { icon: Grid, label: 'Properties', action: () => setRightCollapsed(false) },
              ].map(({ icon: Icon, label, action }) => (
                <button
                  key={label}
                  title={label}
                  onClick={action}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <Icon size={14} />
                </button>
              ))}
              <div className="w-6 h-px bg-slate-200 my-1" />
              {/* Placement tool shortcut icons */}
              {[
                { emoji: '🛣️', label: 'Roads Library' },
                { emoji: '🏢', label: 'Building Blocks' },
                { emoji: '🏞️', label: 'Lawn / Park' },
                { emoji: '🏊', label: 'Swimming Pools' },
                { emoji: '🌳', label: 'Trees & Foliage' },
                { emoji: '⛩️', label: 'Gates & Access' },
              ].map(({ emoji, label }) => (
                <button
                  key={label}
                  title={label}
                  onClick={() => setRightCollapsed(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-[14px] transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <PropertiesPanel />
              </div>
            </div>
          )}
          {!rightCollapsed && (
            <div
              onMouseDown={startRightResize}
              className="w-1.5 hover:w-1.5 cursor-col-resize absolute top-0 left-0 h-full hover:bg-indigo-500/50 bg-transparent transition-colors z-20"
              style={{ transform: 'translateX(-50%)' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
