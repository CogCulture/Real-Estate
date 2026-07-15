import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Map, ArrowLeft } from 'lucide-react';
import MapSelector from '../components/map/MapSelector';
import LocationSearch from '../components/map/LocationSearch';
import Button from '../components/ui/Button';
import { fetchProjectById, updateProject } from '../api/projects';
import { saveLayout, fetchLatestLayout } from '../api/layouts';
import toast from 'react-hot-toast';

export default function EditBoundary() {
  const { projectId } = useParams();
  const [searchCenter, setSearchCenter] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialProject, setInitialProject] = useState(null);
  const navigate = useNavigate();

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
    setIsLoading(true);
    try {
      // Update existing project
      const project = await updateProject(projectId, {
        name: data.name || "My Master Plan",
        description: data.description || "Created via OSM Map",
        location_name: data.location_name,
        lat: data.lat,
        lng: data.lng,
        site_width: data.width,
        site_height: data.height,
        site_area: data.area,
        boundary_geojson: data.geojson,
        features: initialProject?.features
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
      try {
        window.localStorage.removeItem(`masterplan.backup.${projectId}`);
      } catch (err) {
        console.warn("Failed to clear layout backup:", err);
      }
      toast.success("Site layout boundary updated successfully!");
      navigate(`/editor/${projectId}`);
    } catch (err) {
      toast.error("Failed to update project boundaries");
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
          <Button onClick={() => navigate(`/editor/${projectId}`)} variant="secondary" className="py-1 px-3 text-xs">
            <ArrowLeft size={14} />
            Back to Editor
          </Button>
          
          <LocationSearch onLocationSelect={handleLocationSelect} />
        </div>

        <div className="flex-1 flex justify-center items-start">
          <MapSelector 
            searchCenter={searchCenter} 
            initialProject={initialProject}
            onSelectBoundary={handleSiteFinalized}
          />
        </div>
      </div>
      
      {isLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-indigo-900 font-bold text-lg">Saving Boundary...</p>
        </div>
      )}
    </div>
  );
}
