import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Map, FormInput, ArrowLeft } from 'lucide-react';
import MapSelector from '../components/map/MapSelector';
import LocationSearch from '../components/map/LocationSearch';
import ManualInput from '../components/map/ManualInput';
import Button from '../components/ui/Button';
import { createProject, fetchProjectById, updateProject } from '../api/projects';
import { saveLayout, fetchLatestLayout } from '../api/layouts';
import toast from 'react-hot-toast';
import { generateSuggestedLayout } from '../utils/planningEngine';
import ProjectRequirementsForm from '../components/forms/ProjectRequirementsForm';

export default function NewProject() {
  const [activeTab, setActiveTab] = useState('map'); // map | manual
  const [searchCenter, setSearchCenter] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [siteData, setSiteData] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [initialProject, setInitialProject] = useState(null);

  useEffect(() => {
    if (projectId) {
      const loadProject = async () => {
        try {
          const proj = await fetchProjectById(projectId);
          setInitialProject(proj);
          if (proj.lat && proj.lng) {
            setSearchCenter({ lat: proj.lat, lng: proj.lng, displayName: proj.location_name });
          }
        } catch (err) {
          console.error("Failed to load project details", err);
          toast.error("Failed to load project details for editing boundaries");
        }
      };
      loadProject();
    }
  }, [projectId]);

  const handleLocationSelect = (lat, lng, displayName) => {
    setSearchCenter({ lat, lng, displayName });
  };

  const handleSiteFinalized = async (data) => {
    if (projectId) {
      setIsLoading(true);
      try {
        // Update existing project
        const project = await updateProject(projectId, {
          name: data.name || "My Master Plan",
          description: data.description || `Created via ${activeTab === 'map' ? 'OSM Map' : 'Manual Entry'}`,
          location_name: data.location_name,
          lat: data.lat,
          lng: data.lng,
          site_width: data.width,
          site_height: data.height,
          site_area: data.area,
          boundary_geojson: data.geojson
        });

        // Update layout meta dimensions/scaling
        const latestLayout = await fetchLatestLayout(projectId);
        if (latestLayout) {
          const layoutObj = JSON.parse(latestLayout.layout_json);
          const scale = parseFloat((960 / project.site_width).toFixed(4));
          const canvasHeight = Math.round(project.site_height * scale);

          layoutObj.meta = {
            ...layoutObj.meta,
            site_width_m: project.site_width,
            site_height_m: project.site_height,
            canvas_width_px: 960,
            canvas_height_px: canvasHeight,
            scale_px_per_m: scale,
            total_area_sqm: project.site_area
          };

          await saveLayout({
            project_id: projectId,
            layout_json: JSON.stringify(layoutObj),
            canvas_width: 960,
            canvas_height: canvasHeight,
            scale_factor: scale
          });
        }
        toast.success("Site layout boundary updated successfully!");
        navigate(`/editor/${projectId}`);
      } catch (err) {
        toast.error("Failed to update project boundaries");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    } else {
      // New project flow - move to step 2 (Requirements Form)
      setSiteData({ ...data, location_name: data.location_name || searchCenter?.displayName || "Map Boundary" });
      setShowForm(true);
    }
  };

  const handleFormSubmit = async (formData) => {
    setIsLoading(true);
    try {
      // 1. Create Project
      const project = await createProject({
        name: siteData.name || "My Master Plan",
        description: siteData.description || `Created via ${activeTab === 'map' ? 'OSM Map' : 'Manual Entry'}`,
        location_name: siteData.location_name,
        lat: siteData.lat,
        lng: siteData.lng,
        site_width: siteData.width,
        site_height: siteData.height,
        site_area: siteData.area,
        boundary_geojson: siteData.geojson,
        features: JSON.stringify(formData)
      });

      // 2. Call AI Engine with site dimensions and null features so it immediately uses fallback
      const initialLayout = await generateSuggestedLayout(project.site_width, project.site_height, project.id, null);
      initialLayout.meta.north_angle_deg = siteData.north_angle_deg || 0;

      await saveLayout({
        project_id: project.id,
        layout_json: JSON.stringify(initialLayout),
        canvas_width: initialLayout.meta.canvas_width_px,
        canvas_height: initialLayout.meta.canvas_height_px,
        scale_factor: initialLayout.meta.scale_px_per_m
      });

      toast.success("Site layout generated successfully!");
      navigate(`/editor/${project.id}`);
    } catch (err) {
      toast.error("Failed to initialize project");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Button onClick={() => navigate('/')} variant="secondary" className="py-1 px-3 text-xs">
            <ArrowLeft size={14} />
            Back to Dashboard
          </Button>
          
          {activeTab === 'map' && (
            <LocationSearch onLocationSelect={handleLocationSelect} />
          )}
        </div>

        {showForm ? (
          <ProjectRequirementsForm onSubmit={handleFormSubmit} />
        ) : (
          <>
            {/* Tab Headers */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveTab('map')}
                className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-semibold transition-all ${
                  activeTab === 'map' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Map size={16} />
                Pick on Interactive Map
              </button>
              <button
                onClick={() => setActiveTab('manual')}
                className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-semibold transition-all ${
                  activeTab === 'manual' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <FormInput size={16} />
                Enter Dimensions Manually
              </button>
            </div>

            <div className="flex-1 flex justify-center items-start">
              {activeTab === 'map' ? (
                <MapSelector 
                  searchCenter={searchCenter} 
                  initialProject={initialProject}
                  onSelectBoundary={handleSiteFinalized}
                />
              ) : (
                <div className="w-full flex justify-center mt-4">
                  <ManualInput onSubmit={handleSiteFinalized} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {isLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-indigo-900 font-bold text-lg">Generating Layout with Claude AI...</p>
          <p className="text-slate-500 text-sm mt-2">This may take up to 30 seconds.</p>
        </div>
      )}
    </div>
  );
}
