import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, ArrowLeft, Video, Compass } from 'lucide-react';
import Scene3D from '../components/preview/Scene3D';
import Button from '../components/ui/Button';
import { fetchProjectById } from '../api/projects';
import { fetchLatestLayout } from '../api/layouts';
import { useProjectStore } from '../store/useProjectStore';
import { useLayoutStore } from '../store/useLayoutStore';
import toast from 'react-hot-toast';

export default function Preview3D() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { currentProject, setCurrentProject } = useProjectStore();
  const { setLayout } = useLayoutStore();
  const [cameraPreset, setCameraPreset] = useState('aerial');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initPreview = async () => {
      setIsLoading(true);
      try {
        if (!currentProject || currentProject.id !== projectId) {
          const proj = await fetchProjectById(projectId);
          setCurrentProject(proj);
        }

        const latestLayout = await fetchLatestLayout(projectId);
        if (latestLayout) {
          setLayout(JSON.parse(latestLayout.layout_json));
        }
      } catch (err) {
        toast.error("Failed to load project details");
      } finally {
        setIsLoading(false);
      }
    };
    initPreview();
  }, [projectId, currentProject?.id, setCurrentProject, setLayout]);

  const presets = [
    { id: 'aerial', label: 'Aerial View', desc: 'Top-down plan view looking straight down' },
    { id: 'isometric', label: 'Isometric View', desc: 'Classic 45-degree orthographic layout look' },
    { id: 'street', label: 'Street Level', desc: 'Ground-level perspective at 2m height' },
    { id: 'cinematic', label: 'Cinematic View', desc: 'Wide-angle dramatic perspective from corner' }
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
        <span className="text-slate-600 text-sm">Loading 3D scene...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">

      {/* Editor Header Bar */}
      <div className="bg-white/85 border-b border-slate-200 py-3 px-6 flex justify-between items-center shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-800">{currentProject?.name} &mdash; 3D Preview</h2>
          <span className="text-[10px] text-slate-500">
            Interactive lightweight massing preview. Rotate: Left click + Drag | Pan: Right click + Drag | Zoom: Scroll
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/')} variant="secondary" className="text-xs py-1.5 px-3">
            <ArrowLeft size={14} />
            Back to Dashboard
          </Button>

          <Button onClick={() => navigate(`/editor/${projectId}`)} variant="secondary" className="text-xs py-1.5 px-3">
            Back to 2D Editor
          </Button>

          <Button onClick={() => navigate(`/render/${projectId}`)} variant="primary" className="text-xs py-1.5 px-3">
            <Video size={14} />
            Photorealistic Render
          </Button>
        </div>
      </div>

      {/* 3D Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar - Presets */}
        <div className="p-4 bg-white border-r border-slate-200 flex flex-col gap-4 w-[240px] shadow-sm">
          <h3 className="text-xs font-bold text-slate-700 tracking-wider flex items-center gap-1.5">
            <Compass size={14} />
            CAMERA PRESETS
          </h3>

          <div className="flex flex-col gap-2">
            {presets.map((preset) => {
              const isActive = cameraPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => setCameraPreset(preset.id)}
                  className={`px-3 py-3 rounded-lg text-left transition-all duration-300 border ${
                    isActive 
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm font-bold' 
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="text-xs font-bold">{preset.label}</div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-relaxed">{preset.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center WebGL Viewport */}
        <div className="flex-1 relative bg-slate-50">
          {!isLoading && <Scene3D cameraPreset={cameraPreset} />}
        </div>
      </div>
    </div>
  );
}
