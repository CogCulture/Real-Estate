import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { calculateAreaFromLatLng, getBoundingBoxMeters, rotateLatLngs } from '../../utils/geoUtils';
import Button from '../ui/Button';
import { Maximize2, Minimize2 } from 'lucide-react';

// Fix Leaflet marker path issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function MapSelector({ searchCenter, onSelectBoundary, initialProject }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const containerRef = useRef(null);
  
  const [mapMode, setMapMode] = useState('street'); // street | satellite
  const [points, setPoints] = useState([]);
  const [siteDetails, setSiteDetails] = useState(null);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [isMaximized, setIsMaximized] = useState(false);
  const [mapStep, setMapStep] = useState('draw'); // draw | finalize
  const [siteName, setSiteName] = useState('');
  const [siteDesc, setSiteDesc] = useState('');

  // Ctrl+Z: undo last boundary dot
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && mapStep === 'draw') {
        e.preventDefault();
        setPoints(prev => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mapStep]);

  // Auto-populate site name from location search or initialProject
  useEffect(() => {
    if (initialProject) {
      setSiteName(initialProject.name || "My Site Plan");
      setSiteDesc(initialProject.description || "");
    } else if (searchCenter?.displayName) {
      const shortName = searchCenter.displayName.split(',')[0];
      setSiteName(shortName + " Site Plan");
    } else {
      setSiteName("My Site Plan");
    }
  }, [searchCenter, initialProject]);

  // Handle HTML5 Fullscreen API toggle
  const toggleMaximize = () => {
    const element = containerRef.current;
    if (!element) return;
    if (!document.fullscreenElement) {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  // Sync isMaximized state and trigger Leaflet invalidateSize
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsMaximized(!!document.fullscreenElement);
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', onFullscreenChange);
    };
  }, []);

  // Trigger Leaflet invalidation on step transitions
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 200);
    }
  }, [mapStep]);

  const polylineInstanceRef = useRef(null);
  const polygonInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const tileLayers = {
    street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  };

  // Map Initialization
  useEffect(() => {
    let lat = 28.4595;
    let lng = 77.0266; // Gurugram
    
    if (searchCenter) {
      lat = searchCenter.lat;
      lng = searchCenter.lng;
    } else if (initialProject && initialProject.lat && initialProject.lng) {
      lat = initialProject.lat;
      lng = initialProject.lng;
    }

    const map = L.map(mapRef.current, {
      dragging: true,
      scrollWheelZoom: true,
      zoomControl: true,
      attributionControl: false // Disable Leaflet attribution copyright text!
    }).setView([lat, lng], 16);
    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    L.tileLayer(tileLayers[mapMode]).addTo(map);

    // Map Click Listener to add boundary dots
    map.on('click', (e) => {
      setPoints(prev => [...prev, e.latlng]);
    });

    // Load initial points if editing
    if (initialProject && initialProject.boundary_geojson) {
      try {
        const geojson = JSON.parse(initialProject.boundary_geojson);
        if (geojson && geojson.geometry && geojson.geometry.coordinates) {
          const coords = geojson.geometry.coordinates[0];
          // GeoJSON coords are [lng, lat], map expects latlng objects
          const pts = coords.slice(0, -1).map(c => L.latLng(c[1], c[0]));
          setPoints(pts);
          if (initialProject.lat && initialProject.lng) {
            map.setView([initialProject.lat, initialProject.lng], 17);
          }
        }
      } catch (err) {
        console.error("Failed to parse initial boundary geojson", err);
      }
    }

    return () => {
      map.remove();
    };
  }, [initialProject]);

  // Center update when search results fly
  useEffect(() => {
    if (searchCenter && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([searchCenter.lat, searchCenter.lng], 17);
    }
  }, [searchCenter]);

  // Sync Points and Rotation to Map Vector Layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Clear existing layers
    if (polylineInstanceRef.current) map.removeLayer(polylineInstanceRef.current);
    if (polygonInstanceRef.current) map.removeLayer(polygonInstanceRef.current);
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    if (points.length === 0) {
      setSiteDetails(null);
      return;
    }

    // Apply rotation if set
    let activePoints = points;
    if (rotationAngle !== 0) {
      activePoints = rotateLatLngs(points, rotationAngle);
    }

    // 2. Draw Polyline or Closed Polygon
    if (activePoints.length >= 3) {
      polygonInstanceRef.current = L.polygon(activePoints, {
        color: '#4f46e5',
        weight: 3,
        opacity: 0.9,
        fillColor: '#4f46e5',
        fillOpacity: 0.15
      }).addTo(map);
    } else if (activePoints.length >= 2) {
      polylineInstanceRef.current = L.polyline(activePoints, {
        color: '#4f46e5',
        weight: 3,
        opacity: 0.9
      }).addTo(map);
    }

    // 3. Draw draggable corner handles (dots)
    const dotIcon = L.divIcon({
      className: 'custom-boundary-dot',
      html: `<div style="
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #4f46e5;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 5px rgba(0,0,0,0.35);
        cursor: grab;
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    activePoints.forEach((pt, idx) => {
      const marker = L.marker(pt, {
        icon: dotIcon,
        draggable: true,
        title: "Drag to reposition. Right-click to remove."
      }).addTo(map);

      // Prevent map click trigger when clicking the dot marker
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
      });

      // Handle dragging
      marker.on('drag', (e) => {
        const newLatLng = e.target.getLatLng();
        const currentActive = [...activePoints];
        currentActive[idx] = newLatLng;
        
        if (polygonInstanceRef.current) polygonInstanceRef.current.setLatLngs(currentActive);
        if (polylineInstanceRef.current) polylineInstanceRef.current.setLatLngs(currentActive);
      });

      marker.on('dragend', (e) => {
        const newLatLng = e.target.getLatLng();
        let unrotatedLatLng = newLatLng;

        if (rotationAngle !== 0) {
          const rotatedArray = [...activePoints];
          rotatedArray[idx] = newLatLng;
          const baseUnrotated = rotateLatLngs(rotatedArray, -rotationAngle);
          unrotatedLatLng = baseUnrotated[idx];
        }

        setPoints(prev => {
          const next = [...prev];
          next[idx] = unrotatedLatLng;
          return next;
        });
      });

      // Right click to delete a dot
      marker.on('contextmenu', (e) => {
        L.DomEvent.stopPropagation(e);
        setPoints(prev => prev.filter((_, i) => i !== idx));
      });

      markersRef.current.push(marker);
    });

    // 4. Calculate Area and BBox Dimensions
    if (activePoints.length >= 3) {
      const area = calculateAreaFromLatLng(activePoints);
      const bbox = getBoundingBoxMeters(activePoints);
      
      const coords = [...activePoints.map(p => [p.lng, p.lat]), [activePoints[0].lng, activePoints[0].lat]];
      const geojson = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [coords]
        }
      };

      setSiteDetails({
        geojson: JSON.stringify(geojson),
        area: parseFloat(area.toFixed(2)),
        width: parseFloat(bbox.widthM.toFixed(2)),
        height: parseFloat(bbox.heightM.toFixed(2)),
        lat: activePoints[0].lat,
        lng: activePoints[0].lng,
        north_angle_deg: rotationAngle
      });
    } else {
      setSiteDetails(null);
    }
  }, [points, rotationAngle]);

  // Toggle map view
  const toggleMapMode = () => {
    const nextMode = mapMode === 'street' ? 'satellite' : 'street';
    setMapMode(nextMode);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          mapInstanceRef.current.removeLayer(layer);
        }
      });
      L.tileLayer(tileLayers[nextMode]).addTo(mapInstanceRef.current);
    }
  };

  // Clear points handler
  const handleClearPoints = () => {
    setPoints([]);
    setRotationAngle(0);
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* Step 1 Instruction Header */}
      {mapStep === 'draw' && (
        <div className="flex justify-between items-center bg-slate-100 border border-slate-200 p-3 rounded-md animate-fade-in">
          <span className="text-xs text-slate-700 leading-normal">
            💡 <strong>Instruction</strong>: Click anywhere on the map to add boundary dots. They will join to form the site shape. Drag any dot to move it, <strong>right-click a dot to delete it</strong>, or press <strong>Ctrl+Z</strong> to undo the last dot.
          </span>
          <div className="flex gap-2">
            {points.length > 0 && (
              <Button onClick={handleClearPoints} variant="danger" className="text-xs py-1 px-3">
                Clear Points
              </Button>
            )}
            <Button onClick={toggleMapMode} variant="secondary" className="text-xs py-1 px-3">
              Switch to {mapMode === 'street' ? 'Satellite' : 'Street'} View
            </Button>
          </div>
        </div>
      )}

      {/* Main split-screen or vertical container */}
      <div className={`flex gap-6 w-full ${mapStep === 'finalize' ? 'items-stretch' : 'items-start flex-col'}`}>
        
        {/* Step 2 Sidebar Panel */}
        {mapStep === 'finalize' && siteDetails && (
          <div className="w-[360px] bg-white border border-slate-200 p-5 rounded-lg flex flex-col gap-4 shadow-sm animate-fade-in">
            <div>
              <h3 className="text-xs font-bold text-slate-800 tracking-wide uppercase">Finalize Site Details</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Define your project metadata and boundary orientation.</p>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Site Name</label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 focus:outline-none focus:border-indigo-500 text-xs font-semibold"
                  placeholder="e.g. Green Valley Sector 4"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Description (Optional)</label>
                <textarea
                  value={siteDesc}
                  onChange={(e) => setSiteDesc(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 focus:outline-none focus:border-indigo-500 text-xs h-16 resize-none"
                  placeholder="e.g. Residential township project layout"
                />
              </div>

              <div className="border border-slate-100 rounded bg-slate-50 p-3 space-y-2">
                <span className="block text-[9px] font-bold text-slate-400 tracking-wider uppercase">Measured Dimensions</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="block text-[9px] text-slate-450 font-semibold">Total Area</span>
                    <span className="text-slate-850 font-bold leading-none">{siteDetails.area.toLocaleString()} m²</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-450 font-semibold">Acres</span>
                    <span className="text-slate-850 font-bold leading-none">{(siteDetails.area * 0.000247105).toFixed(2)} Ac</span>
                  </div>
                  <div className="col-span-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-1.5 mt-0.5">
                    <div>
                      <span className="block text-[9px] text-slate-450 font-semibold">Site Width</span>
                      <span className="text-slate-800 font-bold">{siteDetails.width} m</span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-450 font-semibold">Site Height</span>
                      <span className="text-slate-800 font-bold">{siteDetails.height} m</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1">
                  <span>Orient Boundary (North Angle)</span>
                  <span className="text-indigo-600 font-bold">{rotationAngle}°</span>
                </label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={rotationAngle}
                  onChange={(e) => setRotationAngle(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-2 border-t border-slate-100 pt-4">
              <Button 
                onClick={() => setMapStep('draw')} 
                variant="secondary" 
                className="flex-1 py-1.5 text-xs flex justify-center items-center gap-1.5"
              >
                ← Back
              </Button>
              <Button 
                onClick={() => {
                  if (!siteName.trim()) {
                    alert("Please enter a site name");
                    return;
                  }
                  onSelectBoundary({
                    ...siteDetails,
                    name: siteName,
                    description: siteDesc,
                    north_angle_deg: rotationAngle
                  });
                }} 
                variant="success" 
                className="flex-[1.5] py-1.5 text-xs flex justify-center items-center gap-1.5 shadow-sm"
              >
                Confirm Site ✨
              </Button>
            </div>
          </div>
        )}

        {/* Map Container */}
        <div 
          ref={containerRef}
          className={`relative flex-1 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 transition-all duration-300 ${
            isMaximized 
              ? 'w-full h-full' 
              : mapStep === 'finalize' 
                ? 'h-[480px]' 
                : 'w-full min-h-[480px]'
          }`}
        >
          <div ref={mapRef} className="absolute inset-0 w-full h-full z-10" />
          
          {/* Maximize/Minimize Toggle Button */}
          <button
            onClick={toggleMaximize}
            className="absolute top-3 right-3 z-[1000] bg-white text-slate-700 hover:text-slate-900 border border-slate-200 p-2 rounded-md shadow-md transition-all duration-300 hover:bg-slate-50 flex items-center justify-center"
            title={isMaximized ? "Minimize Map" : "Maximize Map"}
          >
            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {/* Satellite Mode Switch inside Map during Finalize step */}
          {mapStep === 'finalize' && (
            <button
              onClick={toggleMapMode}
              className="absolute bottom-3 left-3 z-[1000] bg-white/90 text-slate-700 hover:text-slate-900 border border-slate-200 py-1.5 px-3 rounded shadow-md text-[10px] font-bold transition-all hover:bg-white"
            >
              Mode: {mapMode === 'street' ? 'Satellite' : 'Street'}
            </button>
          )}

          {/* Floating Confirm Button in Draw step */}
          {mapStep === 'draw' && points.length >= 3 && (
            <div className="absolute bottom-6 right-6 z-[1000]">
              <Button 
                onClick={() => setMapStep('finalize')} 
                variant="success" 
                className="py-2.5 px-5 text-xs font-bold shadow-lg flex items-center gap-2 rounded-full hover:scale-105 active:scale-95 transition-all"
              >
                <span>Confirm Boundary & Next Step</span>
                <span className="text-sm">→</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
