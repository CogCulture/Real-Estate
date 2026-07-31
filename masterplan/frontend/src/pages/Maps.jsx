import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Map, Check, Layers } from 'lucide-react';
import { Map as MapLibreMap, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import toast from 'react-hot-toast';

export default function Maps() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Available tile providers (including vector OpenFreeMap styles)
  const providers = [
    {
      id: 'carto-positron',
      name: 'Carto Positron (Light Raster)',
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      description: 'Classic clean, minimalist light gray raster style. Fast and reliable (Recommended).',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      type: 'street'
    },
    {
      id: 'carto-dark',
      name: 'Carto Dark Matter (Dark Raster)',
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      description: 'Classic dark minimal raster style basemap. Fast and reliable.',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      type: 'street'
    },
    {
      id: 'osm-standard',
      name: 'OpenStreetMap Standard',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      description: 'The standard detailed global map dataset. Fully detailed and open-source.',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      type: 'street'
    },
    {
      id: 'arcgis-satellite',
      name: 'ArcGIS Satellite Imagery',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      description: 'High-resolution global satellite photography. Crucial for real site validation.',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      type: 'satellite'
    }
  ];

  const currentStreetUrl = localStorage.getItem('active_basemap_street') || 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  const initialProvider = providers.find(p => p.url === currentStreetUrl) || providers[0];
  
  const [selectedProvider, setSelectedProvider] = useState(initialProvider);
  const [activeProvider, setActiveProvider] = useState(initialProvider);

  // Helper to convert provider URL to MapLibre style JSON format
  const getMaplibreStyle = (provider) => {
    if (provider.url.startsWith('http') && !provider.url.includes('{z}')) {
      // It's a direct style JSON URL
      return provider.url;
    }
    // It's a raster provider, generate a dynamic style JSON
    const rasterUrl = provider.url.replace('{s}', 'a'); // Fallback subdomains
    return {
      version: 8,
      sources: {
        'raster-tiles': {
          type: 'raster',
          tiles: [rasterUrl],
          tileSize: 256,
          attribution: provider.attribution
        }
      },
      layers: [
        {
          id: 'raster-layer',
          type: 'raster',
          source: 'raster-tiles',
          minzoom: 0,
          maxzoom: 22
        }
      ]
    };
  };

  // Initialize Map
  useEffect(() => {
    // Gurugram coordinates as default
    const lat = 28.4595;
    const lng = 77.0266;

    const map = new MapLibreMap({
      container: mapRef.current,
      style: getMaplibreStyle(selectedProvider),
      center: [lng, lat],
      zoom: 14,
      dragPan: true,
      scrollZoom: true
    });
    
    mapInstanceRef.current = map;
    map.addControl(new NavigationControl(), 'top-right');

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle previewing different tile providers
  const handlePreview = (provider) => {
    setSelectedProvider(provider);
    
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setStyle(getMaplibreStyle(provider));
    }
  };

  // Set active provider in localStorage to apply across the app
  const handleApply = () => {
    if (selectedProvider.type === 'street') {
      localStorage.setItem('active_basemap_street', selectedProvider.url);
      setActiveProvider(selectedProvider);
      toast.success(`Applied ${selectedProvider.name} as active planning map!`);
    } else {
      // Satellite mode
      localStorage.setItem('active_basemap_satellite', selectedProvider.url);
      setActiveProvider(selectedProvider);
      toast.success(`Applied ${selectedProvider.name} as active satellite base!`);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900 flex flex-col font-sans antialiased">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200/80 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/projects')}
              className="text-neutral-500 hover:text-neutral-950 p-2 rounded hover:bg-neutral-100 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-black text-white p-2 rounded">
                <Map size={18} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-neutral-950">Map Tile Providers</h1>
                <p className="text-xs text-neutral-500">Configure global map layouts for MasterPlan layouts</p>
              </div>
            </div>
          </div>
          <button 
            onClick={() => navigate('/projects')}
            className="text-xs font-semibold text-neutral-600 hover:text-neutral-950 border border-neutral-200 hover:bg-neutral-50 px-4 py-2 rounded transition-colors"
          >
            Dashboard
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
        {/* Left Side: Providers List */}
        <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-2">
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Layers size={16} /> Active Map Provider
              </h2>
              <p className="text-xs text-neutral-500">
                The map tiles selected here will automatically load in your 2D CAD planning canvas and project selectors.
              </p>
            </div>

            <div className="space-y-3">
              {providers.map((p) => {
                const isSelected = selectedProvider.id === p.id;
                const isActive = activeProvider.id === p.id;

                return (
                  <div
                    key={p.id}
                    onClick={() => handlePreview(p)}
                    className={`bg-white border rounded-xl p-4 cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-black ring-1 ring-black shadow-sm' 
                        : 'border-neutral-200 hover:border-neutral-350'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                          {p.name}
                          {isActive && (
                            <span className="text-[10px] bg-neutral-100 text-neutral-800 font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                              <Check size={10} /> Active
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-neutral-500 mt-1">{p.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={handleApply}
              className="w-full bg-black hover:bg-neutral-800 text-white font-semibold py-3 px-6 rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Check size={16} />
              Set as Platform Basemap
            </button>
          </div>
        </div>

        {/* Right Side: Map Preview */}
        <div className="lg:col-span-7 bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[550px] lg:h-auto min-h-[450px]">
          <div className="border-b border-neutral-150 px-5 py-3.5 bg-neutral-50 flex justify-between items-center">
            <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Live Map Preview</span>
            <span className="text-xs text-neutral-500 font-semibold bg-neutral-200 px-2.5 py-0.5 rounded">
              {selectedProvider.name}
            </span>
          </div>
          <div ref={mapRef} className="flex-1 w-full h-full z-10" />
        </div>
      </main>
    </div>
  );
}
