import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Video, Image, Download, ArrowLeft, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import StepIndicator from '../components/ui/StepIndicator';
import Button from '../components/ui/Button';
import ProgressBar from '../components/ui/ProgressBar';
import { fetchLatestLayout } from '../api/layouts';
import { queueRenderJob, fetchRenderJobStatus, getDownloadUrl } from '../api/renders';
import toast from 'react-hot-toast';

export default function RenderStatus() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const [layoutId, setLayoutId] = useState(null);
  const [quality, setQuality] = useState('high'); // preview | high | ultra
  const [cameraPreset, setCameraPreset] = useState('aerial'); // aerial | isometric | street | cinematic
  
  const [job, setJob] = useState(null);
  const [isRendering, setIsRendering] = useState(false);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    const loadLayout = async () => {
      try {
        const layout = await fetchLatestLayout(projectId);
        if (layout) {
          setLayoutId(layout.id);
        }
      } catch (err) {
        toast.error("Failed to load project design");
      }
    };
    loadLayout();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [projectId]);

  const triggerRender = async () => {
    if (!layoutId) return;
    setIsRendering(true);
    setJob(null);
    toast.loading("Queueing render job...", { id: 'render' });

    try {
      const renderJob = await queueRenderJob({
        project_id: projectId,
        layout_id: layoutId,
        render_type: 'still',
        quality,
        camera_preset: cameraPreset
      });
      setJob(renderJob);
      toast.success("Render job queued successfully!", { id: 'render' });
      
      // Start polling
      startPolling(renderJob.id);
    } catch (err) {
      toast.error("Failed to trigger render job", { id: 'render' });
      setIsRendering(false);
    }
  };

  const startPolling = (jobId) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusData = await fetchRenderJobStatus(jobId);
        setJob(statusData);

        if (statusData.status === 'done') {
          clearInterval(pollIntervalRef.current);
          setIsRendering(false);
          toast.success("Render completed successfully!");
        } else if (statusData.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          setIsRendering(false);
          toast.error("Rendering failed. See logs.");
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000); // Poll every 3 seconds
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <StepIndicator activeStep={4} />

      <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Back Link */}
        <div className="flex gap-2">
          <Button onClick={() => navigate('/')} variant="secondary" className="py-1 px-3 text-xs">
            <ArrowLeft size={14} />
            Back to Dashboard
          </Button>

          <Button onClick={() => navigate(`/preview/${projectId}`)} variant="secondary" className="py-1 px-3 text-xs">
            Back to 3D Preview
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Controls Column */}
          <div className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm flex flex-col gap-5 h-fit">
            <h3 className="text-sm font-bold text-slate-800 tracking-wider flex items-center gap-2">
              <Video size={16} className="text-indigo-600" />
              RENDER CONFIGURATION
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Render Quality</label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                disabled={isRendering}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-700 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="preview">Fast Preview (1280x720, EEVEE)</option>
                <option value="high">High Quality (1920x1080, EEVEE-AO)</option>
                <option value="ultra">Ultra Photorealistic (3840x2160, EEVEE-Max)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Camera Angle</label>
              <select
                value={cameraPreset}
                onChange={(e) => setCameraPreset(e.target.value)}
                disabled={isRendering}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-700 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="aerial">Aerial View (Top down)</option>
                <option value="isometric">Isometric (45-degree angle)</option>
                <option value="street">Street Level Perspective</option>
                <option value="cinematic">Cinematic Corner Perspective</option>
              </select>
            </div>

            <Button
              onClick={triggerRender}
              disabled={isRendering || !layoutId}
              variant="primary"
              className="w-full py-2.5 mt-2 flex items-center justify-center gap-2"
            >
              {isRendering ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  <span>Rendering...</span>
                </>
              ) : (
                <>
                  <Image size={16} />
                  <span>Request Render</span>
                </>
              )}
            </Button>
          </div>

          {/* Render Output Column */}
          <div className="md:col-span-2 flex flex-col gap-6 bg-white border border-slate-200 p-6 rounded-lg shadow-sm min-h-[400px]">
            <h3 className="text-sm font-bold text-slate-800 tracking-wider">RENDER VIEWPORT</h3>

            {!job && !isRendering ? (
              <div className="flex-1 flex flex-col justify-center items-center text-slate-500 text-xs border border-dashed border-slate-200 bg-slate-50/50 rounded-md p-10">
                <Video size={40} className="mb-2 text-slate-400" />
                <span>Configure settings and click "Request Render" to start rendering.</span>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between border border-slate-200 rounded-md p-4 bg-slate-50">
                {/* Rendering Status */}
                {isRendering && (
                  <div className="flex-1 flex flex-col justify-center items-center p-8 text-center gap-4">
                    {job?.status === 'queued' ? (
                      <>
                        <Clock size={36} className="text-amber-500 animate-pulse" />
                        <div>
                          <h4 className="text-slate-800 font-bold text-sm">Waiting in Queue</h4>
                          <p className="text-slate-500 text-xs mt-1">Celery worker is preparing output buffer...</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={36} className="text-indigo-650 animate-spin" />
                        <div className="w-full max-w-sm">
                          <h4 className="text-slate-800 font-bold text-sm">Processing Render Scene</h4>
                          <p className="text-slate-500 text-xs mt-1 mb-3">Blender EEVEE engine is compiling layout meshes...</p>
                          <ProgressBar value={job?.progress || 0} label="Rendering Progress" />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Render Failed */}
                {job?.status === 'failed' && (
                  <div className="flex-1 flex flex-col justify-center items-center p-8 text-center gap-3">
                    <AlertTriangle size={40} className="text-rose-500" />
                    <div>
                      <h4 className="text-rose-600 font-bold text-sm">Rendering Failed</h4>
                      <pre className="text-slate-700 text-[10px] mt-2 bg-slate-100 border border-slate-200 p-3 rounded max-w-md overflow-x-auto text-left whitespace-pre-wrap leading-relaxed">
                        {job.error_msg || "Unknown render process crash error."}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Render Success View */}
                {job?.status === 'done' && (
                  <div className="flex-1 flex flex-col gap-4 animate-fade-in">
                    <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold bg-emerald-50 border border-emerald-200/50 py-1.5 px-3 rounded-md w-fit">
                      <CheckCircle size={14} />
                      Render Complete!
                    </div>

                    <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex justify-center items-center shadow-md group">
                      <img
                        src={`${job.output_url}`}
                        alt="Blender Final Render"
                        className="max-h-[360px] object-contain w-full"
                      />
                    </div>

                    <div className="flex justify-end gap-2.5 mt-2">
                      <a 
                        href={`${getDownloadUrl(job.id)}`}
                        download
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-semibold text-xs transition-colors shadow-lg shadow-emerald-600/10"
                      >
                        <Download size={14} />
                        Download Rendered PNG
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
