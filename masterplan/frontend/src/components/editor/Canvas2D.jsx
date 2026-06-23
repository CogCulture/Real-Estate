import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Stage, Layer, Rect, Line, Text, Transformer, Group, Circle, Shape, Path, Arc, Ellipse } from 'react-konva';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLayoutStore } from '../../store/useLayoutStore';
import { useProjectStore } from '../../store/useProjectStore';
import { pxToM, mToPx } from '../../utils/scaleUtils';
import { ZONE_COLORS, ROAD_COLORS } from '../../utils/colorMap';
import { loadGeneratedAssets } from '../../utils/textureGenerator';
import { calculatePolygonArea, rotatePoint } from '../../utils/geoUtils';
import * as turf from '@turf/turf';

export default function Canvas2D({ width, height, viewMode = 'grass' }) {
  const {
    zones,
    roads,
    amenities,
    labels,
    meta,
    selectedElementId,
    activeTool,
    gridSnapped,
    addZone,
    updateZone,
    deleteZone,
    addRoad,
    updateRoad,
    deleteRoad,
    addAmenity,
    updateAmenity,
    deleteAmenity,
    addLabel,
    updateLabel,
    deleteLabel,
    setSelectedElementId,
    setActiveTool,
    updateRoadPoints,
    setMeta,
    shiftAllElements
  } = useLayoutStore();

  const { currentProject } = useProjectStore();

  const scale = meta.scale_px_per_m || 2.4;
  const gridUnit = scale; // 1 meter = scale pixels
  const transformerRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const contextMenuRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapWrapperRef = useRef(null);

  const rotationStartPointsRef = useRef([]);
  const rotationCenterRef = useRef({ x: 0, y: 0 });
  const rotationStartAngleRef = useRef(0);
  const clipboardRef = useRef(null); // { itemType, item }

  const getZonePoints = (zone) => {
    if (zone.points_px && zone.points_px.length > 0) {
      return zone.points_px;
    }
    const x = zone.x_px;
    const y = zone.y_px;
    const w = zone.width_px;
    const h = zone.height_px;
    
    if (zone.rotation_deg) {
      const rad = (zone.rotation_deg * Math.PI) / 180;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rotate = (px, py) => {
        const dx = px - cx;
        const dy = py - cy;
        return [
          dx * Math.cos(rad) - dy * Math.sin(rad) + cx,
          dx * Math.sin(rad) + dy * Math.cos(rad) + cy
        ];
      };
      return [
        rotate(x, y),
        rotate(x + w, y),
        rotate(x + w, y + h),
        rotate(x, y + h)
      ];
    }

    return [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h]
    ];
  };

  const getAmenityPoints = (amenity) => {
    if (amenity.points_px && amenity.points_px.length > 0) {
      return amenity.points_px;
    }
    const x = amenity.x_px;
    const y = amenity.y_px;
    const w = amenity.width_px;
    const h = amenity.height_px;

    if (amenity.rotation_deg) {
      const rad = (amenity.rotation_deg * Math.PI) / 180;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rotate = (px, py) => {
        const dx = px - cx;
        const dy = py - cy;
        return [
          dx * Math.cos(rad) - dy * Math.sin(rad) + cx,
          dx * Math.sin(rad) + dy * Math.cos(rad) + cy
        ];
      };
      return [
        rotate(x, y),
        rotate(x + w, y),
        rotate(x + w, y + h),
        rotate(x, y + h)
      ];
    }

    return [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h]
    ];
  };

  const getPolygonBoundingBox = (points) => {
    if (!points || points.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, cx: 0, cy: 0 };
    }
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2
    };
  };

  const drawImageContain = (context, image, x, y, w, h) => {
    if (!image?.width || !image?.height) return;
    const scale = Math.min(w / image.width, h / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    const drawX = x + (w - drawW) / 2;
    const drawY = y + (h - drawH) / 2;
    context.drawImage(image, drawX, drawY, drawW, drawH);
  };

  const drawImageCover = (context, image, x, y, w, h) => {
    if (!image?.width || !image?.height) return;
    const scale = Math.max(w / image.width, h / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    const drawX = x + (w - drawW) / 2;
    const drawY = y + (h - drawH) / 2;
    context.drawImage(image, drawX, drawY, drawW, drawH);
  };

  const drawRoadTexture = (context, pts, roadWidthPx, texture) => {
    if (!texture?.width || !texture?.height || pts.length < 2) return false;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len <= 0.5) continue;
      const angle = Math.atan2(dy, dx);
      context.save();
      context.translate((x1 + x2) / 2, (y1 + y2) / 2);
      context.rotate(angle);
      context.drawImage(texture, -len / 2, -roadWidthPx / 2, len, roadWidthPx);
      context.restore();
    }
    return true;
  };

  const roadWidthMap = {
    primary: 6,
    secondary: 4,
    tertiary: 3,
    service: 2.5,
    pedestrian: 2,
    cycle_track: 2,
    ring_primary: 6,
    ring_secondary: 4
  };

  const roadLabels = {
    primary: 'Primary Boulevard',
    secondary: 'Secondary Avenue',
    tertiary: 'Local Street',
    service: 'Service Lane',
    pedestrian: 'Pedestrian Walkway',
    cycle_track: 'Cycle Track',
    ring_primary: 'Outer Ring Road',
    ring_secondary: 'Inner Ring Road'
  };

  const buildingPlacementMap = {
    building_residential: {
      type: 'residential',
      label: 'Residential Block',
      widthM: 28,
      heightM: 18,
      floors: 5,
      variant: 'warm'
    },
    building_commercial: {
      type: 'commercial',
      label: 'Commercial Block',
      widthM: 26,
      heightM: 16,
      floors: 9,
      variant: 'glass'
    },
    building_mixed_use: {
      type: 'mixed_use',
      label: 'Mixed Use Block',
      widthM: 24,
      heightM: 18,
      floors: 8,
      variant: 'modern'
    },
    building_institutional: {
      type: 'institutional',
      label: 'Institutional Block',
      widthM: 22,
      heightM: 16,
      floors: 4,
      variant: 'modern'
    },
    building_industrial: {
      type: 'industrial',
      label: 'Industrial Block',
      widthM: 30,
      heightM: 20,
      floors: 3,
      variant: 'warm'
    },
    building_minimal: {
      type: 'amenity',
      label: 'Minimal Block',
      widthM: 20,
      heightM: 14,
      floors: 2,
      variant: 'modern'
    }
  };

  const accessPlacementMap = {
    access_single: { label: 'Entry / Exit Gate', widthM: 2.5, heightM: 1.8, variant: 'minimal' },
    access_multi: { label: 'Multi Entry Gate', widthM: 4, heightM: 2.2, variant: 'grand' },
    access_minimal: { label: 'Minimal Gate', widthM: 2.8, heightM: 1.6, variant: 'minimal' },
    access_modern: { label: 'Modern Gate', widthM: 3.2, heightM: 1.9, variant: 'modern' },
    access_large: { label: 'Grand Gate', widthM: 5.2, heightM: 2.6, variant: 'grand' }
  };

  const getBuildingTextureKey = (zone) => {
    if (zone?.building_variant === 'glass' || zone?.type === 'commercial') return 'buildingCommercial';
    if (zone?.building_variant === 'warm' || zone?.type === 'industrial') return 'buildingResidential';
    if (zone?.building_variant === 'minimal' || zone?.type === 'amenity') return 'buildingMinimal';
    if (zone?.type === 'mixed_use') return 'buildingMixedUse';
    if (zone?.type === 'institutional') return 'buildingInstitutional';
    return 'buildingResidential';
  };

  const getAmenityTextureKey = (amenity) => {
    if (!amenity) return null;
    if (amenity.type === 'pool' || amenity.label?.toLowerCase().includes('pool')) {
      const hash = parseInt(amenity.id.replace(/\D/g, '') || '0', 10) || Math.floor(Math.random() * 3);
      const variants = ['swimmingPoolTopdown1', 'swimmingPoolTopdown2', 'swimmingPoolTopdown3'];
      return variants[hash % 3];
    }
    if (amenity.type === 'sports' || amenity.label?.toLowerCase().includes('tennis')) return 'tennisCourtTopdown';
    if (amenity.type === 'kids' || amenity.type === 'playground') return 'kidsPlaygroundTopdown';
    if (amenity.type === 'central_lawn' || amenity.type === 'event_lawn') return 'centralLawnTopdown';
    if (amenity.type === 'garden' || amenity.label?.toLowerCase().includes('flower')) return 'flowerGardenTopdown';
    if (amenity.type === 'clubhouse') return 'clubhouseTopdown';
    if (amenity.type === 'tree' && amenity.label?.toLowerCase().includes('cluster')) return 'treeClusterTopdown';
    return null;
  };

  const getAccessTextureKey = (variant) => {
    if (variant === 'access_large' || variant === 'access_multi') return 'gateGrand';
    if (variant === 'access_modern') return 'gateModern';
    return 'gateMinimal';
  };

  // Asset/Texture Cache State
  const [assets, setAssets] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nextAssets = await loadGeneratedAssets();
      if (!cancelled) setAssets(nextAssets);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Stop tree painting on global mouseup (in case mouse leaves canvas while dragging)
  useEffect(() => {
    const handleStopPainting = () => {
      setIsPaintingTrees(false);
    };

    window.addEventListener('mouseup', handleStopPainting);

    return () => {
      window.removeEventListener('mouseup', handleStopPainting);
    };
  }, []);

  // Ctrl+C / Ctrl+V keyboard handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        if (!selectedElementId) return;
        const zone = zones.find(z => z.id === selectedElementId);
        if (zone) { clipboardRef.current = { itemType: 'zone', item: zone }; return; }
        const road = roads.find(r => r.id === selectedElementId);
        if (road) { clipboardRef.current = { itemType: 'road', item: road }; return; }
        const amenity = amenities.find(a => a.id === selectedElementId);
        if (amenity) { clipboardRef.current = { itemType: 'amenity', item: amenity }; }
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        const cb = clipboardRef.current;
        if (!cb) return;
        const dx = Math.max(gridUnit * 2, 20);
        const dy = Math.max(gridUnit * 2, 20);
        if (cb.itemType === 'zone') duplicateZone(cb.item);
        else if (cb.itemType === 'road') duplicateRoad(cb.item);
        else if (cb.itemType === 'amenity') duplicateAmenity(cb.item);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, zones, roads, amenities, gridUnit]);

  // Leaflet Background Map initialization and bounds sync
  useEffect(() => {
    if (viewMode !== 'satellite' && viewMode !== 'street') {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    if (!mapContainerRef.current) return;

    // Destroy existing map if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Determine center and bounds mapping
    let centerLat = 28.4595;
    let centerLng = 77.0266;
    let bounds = null;

    if (currentProject && currentProject.boundary_geojson) {
      try {
        const geojson = JSON.parse(currentProject.boundary_geojson);
        if (geojson && geojson.geometry && geojson.geometry.coordinates) {
          const coords = geojson.geometry.coordinates[0];
          const pts = coords.map(c => ({ lat: c[1], lng: c[0] }));
          const lats = pts.map(p => p.lat);
          const lngs = pts.map(p => p.lng);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          centerLat = (minLat + maxLat) / 2;
          centerLng = (minLng + Math.max(...lngs)) / 2;

          const lngMax = minLng + width / (111320 * Math.cos(centerLat * Math.PI / 180) * scale);
          const latMin = maxLat - height / (111320 * scale);
          bounds = [
            [latMin, minLng],
            [maxLat, lngMax]
          ];
        }
      } catch (err) {
        console.error("Error parsing boundary geojson in Canvas2D map init:", err);
      }
    }

    // Initialize Leaflet Map
    const map = L.map(mapContainerRef.current, {
      dragging: false,
      zoomControl: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      attributionControl: false
    });

    if (bounds) {
      map.fitBounds(bounds, { padding: [0, 0] });
    } else {
      map.setView([centerLat, centerLng], 17);
    }

    const tileUrl = viewMode === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    L.tileLayer(tileUrl).addTo(map);
    mapInstanceRef.current = map;

    // Trigger invalidateSize to ensure correct tile loading
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 100);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [viewMode, width, height, currentProject, scale]);

  // Boundary points in pixels
  const [boundaryPoints, setBoundaryPoints] = useState([]);
  useEffect(() => {
    if (currentProject && currentProject.boundary_geojson) {
      try {
        const geojson = JSON.parse(currentProject.boundary_geojson);
        if (geojson && geojson.geometry && geojson.geometry.coordinates) {
          const coords = geojson.geometry.coordinates[0];
          const pts = coords.map(c => ({ lat: c[1], lng: c[0] }));
          
          const lats = pts.map(p => p.lat);
          const lngs = pts.map(p => p.lng);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const centerLat = (minLat + maxLat) / 2;

          const ptsM = pts.map(p => {
            const x = (p.lng - minLng) * 111320 * Math.cos(centerLat * Math.PI / 180);
            const y = (maxLat - p.lat) * 111320;
            return { x, y };
          });

          const ptsPx = ptsM.map(p => [
            (p.x + (meta.land_offset_x_m || 0)) * scale,
            (p.y + (meta.land_offset_y_m || 0)) * scale
          ]);
          setBoundaryPoints(ptsPx.flat());
        }
      } catch (err) {
        console.error("Error parsing boundary geojson:", err);
      }
    }
  }, [currentProject, scale, meta.land_offset_x_m, meta.land_offset_y_m]);

  // State to hold fetched OSM roads
  const [osmRoads, setOsmRoads] = useState([]);

  // Fetch OSM public highways in the background
  useEffect(() => {
    if (!currentProject || !currentProject.boundary_geojson) return;
    
    let isCancelled = false;
    
    (async () => {
      try {
        const geojson = JSON.parse(currentProject.boundary_geojson);
        if (!geojson || !geojson.geometry || !geojson.geometry.coordinates) return;
        
        const coords = geojson.geometry.coordinates[0];
        const pts = coords.map(c => ({ lat: c[1], lng: c[0] }));
        
        const lats = pts.map(p => p.lat);
        const lngs = pts.map(p => p.lng);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const centerLat = (minLat + maxLat) / 2;
        
        // Expand bounding box by ~300 meters (approx 0.003 degrees)
        const buffer = 0.003;
        const bboxQuery = `${minLat - buffer},${minLng - buffer},${maxLat + buffer},${maxLng + buffer}`;
        
        const overpassUrl = 'https://overpass-api.de/api/interpreter';
        const query = `[out:json][timeout:25];
(
  way["highway"](${bboxQuery});
);
out body;
>;
out skel qt;`;
        
        const response = await fetch(overpassUrl, {
          method: 'POST',
          body: query
        });
        
        if (!response.ok) {
          throw new Error(`Overpass API error: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (isCancelled) return;
        
        // Map nodes
        const nodesMap = {};
        data.elements.forEach(el => {
          if (el.type === 'node') {
            nodesMap[el.id] = { lat: el.lat, lng: el.lon };
          }
        });
        
        // Map ways
        const ways = [];
        data.elements.forEach(el => {
          if (el.type === 'way' && el.nodes) {
            const wayPts = el.nodes
              .map(nodeId => nodesMap[nodeId])
              .filter(Boolean)
              .map(p => {
                const x = (p.lng - minLng) * 111320 * Math.cos(centerLat * Math.PI / 180);
                const y = (maxLat - p.lat) * 111320;
                return [x * scale, y * scale];
              });
            
            if (wayPts.length >= 2) {
              ways.push({
                id: el.id,
                name: el.tags?.name || '',
                highway: el.tags?.highway,
                points: wayPts
              });
            }
          }
        });
        
        setOsmRoads(ways);
      } catch (err) {
        console.error("Failed to fetch OSM roads:", err);
      }
    })();
    
    return () => {
      isCancelled = true;
    };
  }, [currentProject, scale]);

  // Drawing state
  const [drawingRect, setDrawingRect] = useState(null); // { startX, startY, x, y, width, height }
  const [roadPoints, setRoadPoints] = useState([]); // Array of waypoints in pixels for active road drawing
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Clear road drawing when tool changes
  useEffect(() => {
    if (activeTool !== 'CONNECTOR' && activeTool !== 'LINE') {
      setRoadPoints([]);
    }
  }, [activeTool]);

  // Escape key handler to clear drawing and reset tool
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setRoadPoints([]);
        setActiveTool('SELECT');
        setSelectedElementId(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [setActiveTool, setSelectedElementId]);

  // Listen for boundary trees generation
  useEffect(() => {
    const genTrees = () => {
      if (boundaryPoints.length < 6) return;
      const pts = [];
      for (let i = 0; i < boundaryPoints.length; i += 2) {
        pts.push([boundaryPoints[i], boundaryPoints[i + 1]]);
      }
      if (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1]) {
        pts.push(pts[0]);
      }

      const intervalM = 15; // 15 meters between trees
      const intervalPx = intervalM * scale;
      let leftOver = 0;
      
      const newAmenities = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const segLen = Math.sqrt(dx * dx + dy * dy);
        let dist = intervalPx - leftOver;

        while (dist <= segLen) {
          const ratio = dist / segLen;
          const x = p1[0] + dx * ratio;
          const y = p1[1] + dy * ratio;
          
          newAmenities.push({
            id: `tree_${Date.now()}_${newAmenities.length}`,
            type: 'tree_cluster',
            x: x,
            y: y,
            width_m: 6,
            height_m: 6,
            rotation: Math.random() * 360
          });
          dist += intervalPx;
        }
        leftOver = segLen - (dist - intervalPx);
      }
      
      newAmenities.forEach(am => addAmenity(am));
    };

    window.addEventListener('generateBoundaryTrees', genTrees);
    return () => window.removeEventListener('generateBoundaryTrees', genTrees);
  }, [boundaryPoints, scale, addAmenity]);

  // Listen for boundary road generation
  useEffect(() => {
    const genRoad = () => {
      if (!currentProject || !currentProject.boundary_geojson) return;
      try {
        const geojson = JSON.parse(currentProject.boundary_geojson);
        if (!geojson || !geojson.geometry || !geojson.geometry.coordinates) return;
        const poly = turf.polygon(geojson.geometry.coordinates);
        
        // 12 meters inset
        const inset = turf.buffer(poly, -0.012, { units: 'kilometers' });
        if (!inset || !inset.geometry || !inset.geometry.coordinates) {
          console.warn('Inset road failed to generate geometry');
          return;
        }
        
        let insetCoords = [];
        if (inset.geometry.type === 'Polygon') {
          insetCoords = inset.geometry.coordinates[0];
        } else if (inset.geometry.type === 'MultiPolygon') {
          insetCoords = inset.geometry.coordinates[0][0];
        }

        const coords = geojson.geometry.coordinates[0];
        const pts = coords.map(c => ({ lat: c[1], lng: c[0] }));
        const lats = pts.map(p => p.lat);
        const lngs = pts.map(p => p.lng);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const centerLat = (minLat + maxLat) / 2;

        const insetPtsM = insetCoords.map(c => {
          const lng = c[0], lat = c[1];
          const x = (lng - minLng) * 111320 * Math.cos(centerLat * Math.PI / 180);
          const y = (maxLat - lat) * 111320;
          return [x, y];
        });

        const insetPtsPx = insetPtsM.map(p => [
          (p[0] + (meta.land_offset_x_m || 0)) * scale,
          (p[1] + (meta.land_offset_y_m || 0)) * scale
        ]);

        addRoad({
          id: `road_${Date.now()}`,
          type: 'ring_secondary',
          label: 'Boundary Road',
          width_m: 4,
          closed: true,
          points_px: insetPtsPx,
          points_m: insetPtsM,
          color: ROAD_COLORS['ring_secondary'] || '#6366f1'
        });

      } catch(err) {
        console.error(err);
      }
    };

    window.addEventListener('generateBoundaryRoad', genRoad);
    return () => window.removeEventListener('generateBoundaryRoad', genRoad);
  }, [currentProject, scale, meta.land_offset_x_m, meta.land_offset_y_m, addRoad]);

  // Listen for boundary path generation
  useEffect(() => {
    const genPath = () => {
      if (!currentProject || !currentProject.boundary_geojson) return;
      try {
        const geojson = JSON.parse(currentProject.boundary_geojson);
        if (!geojson || !geojson.geometry || !geojson.geometry.coordinates) return;
        const poly = turf.polygon(geojson.geometry.coordinates);
        
        // 16 meters inset (inside the boundary road)
        const inset = turf.buffer(poly, -0.016, { units: 'kilometers' });
        if (!inset || !inset.geometry || !inset.geometry.coordinates) return;
        
        let insetCoords = [];
        if (inset.geometry.type === 'Polygon') insetCoords = inset.geometry.coordinates[0];
        else if (inset.geometry.type === 'MultiPolygon') insetCoords = inset.geometry.coordinates[0][0];

        const coords = geojson.geometry.coordinates[0];
        const pts = coords.map(c => ({ lat: c[1], lng: c[0] }));
        const lats = pts.map(p => p.lat);
        const lngs = pts.map(p => p.lng);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const centerLat = (minLat + maxLat) / 2;

        const insetPtsM = insetCoords.map(c => {
          const lng = c[0], lat = c[1];
          const x = (lng - minLng) * 111320 * Math.cos(centerLat * Math.PI / 180);
          const y = (maxLat - lat) * 111320;
          return [x, y];
        });

        const insetPtsPx = insetPtsM.map(p => [
          (p[0] + (meta.land_offset_x_m || 0)) * scale,
          (p[1] + (meta.land_offset_y_m || 0)) * scale
        ]);

        addRoad({
          id: `road_${Date.now()}_path`,
          type: 'pedestrian',
          label: 'Jogging Path',
          width_m: 2,
          closed: true,
          points_px: insetPtsPx,
          points_m: insetPtsM,
          color: ROAD_COLORS['pedestrian'] || '#e7e5e4'
        });
      } catch(err) {
        console.error(err);
      }
    };

    window.addEventListener('generateBoundaryPath', genPath);
    return () => window.removeEventListener('generateBoundaryPath', genPath);
  }, [currentProject, scale, meta.land_offset_x_m, meta.land_offset_y_m, addRoad]);

  const [contextMenu, setContextMenu] = useState(null);
  // Dimension tooltip: { x, y, wM, hM } — shown while drawing or resizing
  const [dimTooltip, setDimTooltip] = useState(null);

  // Stage Pan and Zoom state
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

  // Grid snap helper
  const snapValue = (val) => {
    if (!gridSnapped) return val;
    return Math.round(val / gridUnit) * gridUnit;
  };

  // Vertex snapping helper that checks other masterplan roads and background OSM roads within 18px
  const getSnappedPosition = (x, y, roadIdToExclude = null) => {
    let finalX = snapValue(x);
    let finalY = snapValue(y);
    let minDistance = 18;

    roads.forEach(r => {
      if (roadIdToExclude && r.id === roadIdToExclude) return;
      if (r.points_px) {
        r.points_px.forEach(p => {
          const dist = Math.sqrt((x - p[0]) ** 2 + (y - p[1]) ** 2);
          if (dist < minDistance) {
            minDistance = dist;
            finalX = p[0];
            finalY = p[1];
          }
        });
      }
    });

    if (meta.showPublicRoads !== false) {
      const deletedIds = meta.deleted_osm_road_ids || [];
      const offsetX = (meta.land_offset_x_m || 0) * scale;
      const offsetY = (meta.land_offset_y_m || 0) * scale;

      osmRoads.forEach(r => {
        if (deletedIds.includes(r.id)) return;
        if (r.points) {
          r.points.forEach(p => {
            const px = p[0] + offsetX;
            const py = p[1] + offsetY;
            const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
            if (dist < minDistance) {
              minDistance = dist;
              finalX = px;
              finalY = py;
            }
          });
        }
      });
    }

    return [finalX, finalY];
  };

  const makeRingRoadPoints = (centerX, centerY, radiusPx, roadType, segments = 16) => {
    const pointsPx = [];
    for (let i = 0; i < segments; i++) {
      const angle = (Math.PI * 2 * i) / segments;
      pointsPx.push([
        snapValue(centerX + Math.cos(angle) * radiusPx),
        snapValue(centerY + Math.sin(angle) * radiusPx)
      ]);
    }
    pointsPx.push(pointsPx[0]);
    return pointsPx;
  };

  const buildRingRoad = (centerX, centerY, roadType) => {
    const widthMap = { primary: 10, secondary: 6, tertiary: 4, pedestrian: 2, ring_primary: 10, ring_secondary: 6 };
    const roadLabels = {
      primary: 'Primary Boulevard',
      secondary: 'Secondary Avenue',
      tertiary: 'Local Street',
      pedestrian: 'Pedestrian Walkway',
      ring_primary: 'Outer Ring Road',
      ring_secondary: 'Inner Ring Road'
    };

    const roadWidthM = widthMap[roadType] || 6;
    const roadWidthPx = roadWidthM * scale;
    const maxRadiusPx = Math.max(gridUnit * 6, Math.min(
      centerX,
      centerY,
      width - centerX,
      height - centerY
    ) - roadWidthPx * 2);
    const desiredRadiusM = roadType === 'ring_primary'
      ? Math.min(meta.site_width_m, meta.site_height_m) * 0.22
      : Math.min(meta.site_width_m, meta.site_height_m) * 0.16;
    const radiusPx = Math.max(roadWidthPx * 3, Math.min(desiredRadiusM * scale, maxRadiusPx));
    const pointsPx = makeRingRoadPoints(centerX, centerY, radiusPx, roadType);

    return {
      id: `road_${Date.now()}`,
      type: roadType,
      label: `${roadLabels[roadType] || 'Ring Road'} ${roads.length + 1}`,
      points_px: pointsPx,
      points_m: pointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]),
      width_px: roadWidthPx,
      width_m: roadWidthM,
      color: ROAD_COLORS[roadType] || '#7F8C8D',
      has_median: roadType === 'primary' || roadType === 'ring_primary',
      median_width_m: roadType === 'ring_primary' ? 2 : 0,
      tension: 0,
      radius_m: pxToM(radiusPx, scale)
    };
  };

  const closeContextMenu = () => setContextMenu(null);

  const makeCopyId = (prefix) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const offsetPoints = (points, dx, dy) => points.map((p) => [p[0] + dx, p[1] + dy]);

  const duplicateRoad = (road) => {
    const dx = Math.max(gridUnit * 2, 18);
    const dy = Math.max(gridUnit * 2, 18);
    const nextId = makeCopyId('road');
    const nextPointsPx = offsetPoints(road.points_px || [], dx, dy);
    const nextPointsM = nextPointsPx.map((p) => [pxToM(p[0], scale), pxToM(p[1], scale)]);
    addRoad({
      ...road,
      id: nextId,
      label: `${road.label || 'Road'} Copy`,
      points_px: nextPointsPx,
      points_m: nextPointsM
    });
    setSelectedElementId(nextId);
    closeContextMenu();
  };

  const duplicateZone = (zone) => {
    const dx = Math.max(gridUnit * 2, 18);
    const dy = Math.max(gridUnit * 2, 18);
    const nextId = makeCopyId('zone');
    const hasPoints = zone.points_px && zone.points_px.length > 0;
    const nextPointsPx = hasPoints ? offsetPoints(zone.points_px, dx, dy) : null;
    const nextPointsM = nextPointsPx ? nextPointsPx.map((p) => [pxToM(p[0], scale), pxToM(p[1], scale)]) : null;
    addZone({
      ...zone,
      id: nextId,
      label: `${zone.label || 'Zone'} Copy`,
      x_px: zone.x_px + dx,
      y_px: zone.y_px + dy,
      x_m: pxToM(zone.x_px + dx, scale),
      y_m: pxToM(zone.y_px + dy, scale),
      points_px: nextPointsPx || zone.points_px,
      points_m: nextPointsM || zone.points_m
    });
    setSelectedElementId(nextId);
    closeContextMenu();
  };

  const duplicateAmenity = (amenity) => {
    const dx = Math.max(gridUnit * 2, 18);
    const dy = Math.max(gridUnit * 2, 18);
    const nextId = makeCopyId('amenity');
    const hasPoints = amenity.points_px && amenity.points_px.length > 0;
    const nextPointsPx = hasPoints ? offsetPoints(amenity.points_px, dx, dy) : null;
    const nextPointsM = nextPointsPx ? nextPointsPx.map((p) => [pxToM(p[0], scale), pxToM(p[1], scale)]) : null;
    addAmenity({
      ...amenity,
      id: nextId,
      label: `${amenity.label || 'Amenity'} Copy`,
      x_px: amenity.x_px + dx,
      y_px: amenity.y_px + dy,
      x_m: pxToM(amenity.x_px + dx, scale),
      y_m: pxToM(amenity.y_px + dy, scale),
      points_px: nextPointsPx || amenity.points_px,
      points_m: nextPointsM || amenity.points_m
    });
    setSelectedElementId(nextId);
    closeContextMenu();
  };

  const duplicateLabel = (lbl) => {
    const dx = Math.max(gridUnit * 2, 18);
    const dy = Math.max(gridUnit * 2, 18);
    const nextId = makeCopyId('label');
    addLabel({
      ...lbl,
      id: nextId,
      text: lbl.text,
      x_px: lbl.x_px + dx,
      y_px: lbl.y_px + dy
    });
    setSelectedElementId(nextId);
    closeContextMenu();
  };

  const handleOsmContextMenu = (e, osmRoad) => {
    e.evt.preventDefault();
    e.cancelBubble = true;
    const rect = canvasRef.current?.getBoundingClientRect();
    const clientX = e.evt.clientX;
    const clientY = e.evt.clientY;
    const x = rect ? clientX - rect.left : clientX;
    const y = rect ? clientY - rect.top : clientY;
    setContextMenu({ x, y, itemType: 'osmRoad', item: osmRoad });
  };

  const handleContextMenu = (e, itemType, item) => {
    e.evt.preventDefault();
    e.cancelBubble = true;
    setSelectedElementId(item.id);
    const rect = canvasRef.current?.getBoundingClientRect();
    const clientX = e.evt.clientX;
    const clientY = e.evt.clientY;
    const x = rect ? clientX - rect.left : clientX;
    const y = rect ? clientY - rect.top : clientY;
    setContextMenu({ x, y, itemType, item });
  };

  useEffect(() => {
    const onPointerDown = (event) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
        closeContextMenu();
      }
    };

    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, []);

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    
    const scaleBy = 1.05;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    
    // Zoom in on scroll up, zoom out on scroll down
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    // Limit scale (e.g., between 0.1 and 10)
    if (newScale < 0.1 || newScale > 10) return;

    const newX = pointer.x - mousePointTo.x * newScale;
    const newY = pointer.y - mousePointTo.y * newScale;

    setStageScale(newScale);
    setStagePos({ x: newX, y: newY });

    if (mapWrapperRef.current) {
      mapWrapperRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${newScale})`;
    }
  };

  // Drag & drop road handler
  const handleDrop = (e) => {
    e.preventDefault();
    const dragType = e.dataTransfer.getData('application/react-flow');
    if (!dragType) return;

    const stage = stageRef.current;
    stage.setPointersPositions(e);
    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Handle Tree drop
    if (dragType === 'tree_single' || dragType === 'tree_cluster' || dragType === 'tree_row') {
      const sizeM = dragType === 'tree_row' ? 2.2 : dragType === 'tree_cluster' ? 2.0 : 1.6;
      const sizePx = sizeM * scale;
      const snappedX = snapValue(pos.x);
      const snappedY = snapValue(pos.y);
      const newAmenity = {
        id: `amenity_${Date.now()}`,
        type: 'tree',
        label: dragType === 'tree_row' ? 'Tree Row' : dragType === 'tree_cluster' ? 'Tree Cluster' : 'Tree',
        x_px: snappedX - sizePx / 2,
        y_px: snappedY - sizePx / 2,
        width_px: sizePx,
        height_px: sizePx,
        x_m: pxToM(snappedX - sizePx / 2, scale),
        y_m: pxToM(snappedY - sizePx / 2, scale),
        width_m: sizeM,
        height_m: sizeM,
        tree_variant: dragType
      };
      addAmenity(newAmenity);
      
      if (meta.treeBrushActive) {
        setMeta({ activePlacementCategory: 'tree', activePlacementVariant: dragType });
        setSelectedElementId(null);
      } else {
        setSelectedElementId(newAmenity.id);
        setActiveTool('SELECT');
      }
      return;
    }

    // Handle Entry/Exit drop
    if (accessPlacementMap[dragType]) {
      const access = accessPlacementMap[dragType];
      const widthM = access.widthM;
      const heightM = access.heightM;
      const sizePxW = widthM * scale;
      const sizePxH = heightM * scale;
      const snappedX = snapValue(pos.x);
      const snappedY = snapValue(pos.y);
      const newAmenity = {
        id: `amenity_${Date.now()}`,
        type: 'entry_exit',
        label: access.label,
        x_px: snappedX - sizePxW / 2,
        y_px: snappedY - sizePxH / 2,
        width_px: sizePxW,
        height_px: sizePxH,
        x_m: pxToM(snappedX - sizePxW / 2, scale),
        y_m: pxToM(snappedY - sizePxH / 2, scale),
        width_m: widthM,
        height_m: heightM,
        access_variant: dragType
      };
      addAmenity(newAmenity);
      setSelectedElementId(newAmenity.id);
      setActiveTool('SELECT');
      return;
    }

    if (dragType?.startsWith('ring')) {
      addRoad(buildRingRoad(pos.x, pos.y, dragType));
      setActiveTool('SELECT');
      return;
    }

    if (buildingPlacementMap[dragType]) {
      const building = buildingPlacementMap[dragType];
      const widthPx = building.widthM * scale;
      const heightPx = building.heightM * scale;
      const snappedX = snapValue(pos.x);
      const snappedY = snapValue(pos.y);
      const pointsPx = [
        [snappedX - widthPx / 2, snappedY - heightPx / 2],
        [snappedX + widthPx / 2, snappedY - heightPx / 2],
        [snappedX + widthPx / 2, snappedY + heightPx / 2],
        [snappedX - widthPx / 2, snappedY + heightPx / 2]
      ];
      const newZone = {
        id: `zone_${Date.now()}`,
        type: building.type,
        label: building.label,
        x_px: snappedX - widthPx / 2,
        y_px: snappedY - heightPx / 2,
        width_px: widthPx,
        height_px: heightPx,
        x_m: pxToM(snappedX - widthPx / 2, scale),
        y_m: pxToM(snappedY - heightPx / 2, scale),
        width_m: building.widthM,
        height_m: building.heightM,
        points_px: pointsPx,
        points_m: pointsPx.map((p) => [pxToM(p[0], scale), pxToM(p[1], scale)]),
        color: building.type === 'commercial' ? '#F5A623' : building.type === 'residential' ? '#4A90D9' : building.type === 'industrial' ? '#95A5A6' : '#9B59B6',
        opacity: 0.88,
        floors: building.floors,
        building_variant: building.variant
      };
      addZone(newZone);
      setSelectedElementId(newZone.id);
      setActiveTool('SELECT');
      return;
    }

    const roadType = dragType;
    const widthM = roadWidthMap[roadType] || 6;
    
    // Create horizontal segment centered on drop point
    const lengthPx = 50 * scale;
    const startX = snapValue(pos.x - lengthPx / 2);
    const startY = snapValue(pos.y);
    const endX = snapValue(pos.x + lengthPx / 2);
    const endY = snapValue(pos.y);

    const labelText = `${roadLabels[roadType] || 'Road'} ${roads.length + 1}`;

    const newRoad = {
      id: `road_${Date.now()}`,
      type: roadType,
      label: labelText,
      points_px: [[startX, startY], [endX, endY]],
      points_m: [[pxToM(startX, scale), pxToM(startY, scale)], [pxToM(endX, scale), pxToM(endY, scale)]],
      width_px: widthM * scale,
      width_m: widthM,
      color: ROAD_COLORS[roadType] || '#7F8C8D',
      has_median: roadType === 'primary',
      median_width_m: 2,
      tension: 0
    };

    addRoad(newRoad);
    setSelectedElementId(newRoad.id);
    setActiveTool('SELECT');
  };

  // Seeded Random Tree Scatter Generator
  const renderTreesInArea = (pointsPx, id) => {
    const bbox = getPolygonBoundingBox(pointsPx);
    let seed = parseInt(id.replace(/[^0-9]/g, '')) || 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0xffffffff;
    };

    const area = bbox.width * bbox.height;
    const treeCount = Math.min(40, Math.floor(area / 800)); // Dynamic density
    const treeList = [];

    // Simple point-in-polygon check
    const isPointInPolygon = (pt, poly) => {
      let isInside = false;
      const n = poly.length;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        const intersect = ((yi > pt[1]) !== (yj > pt[1]))
            && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
      }
      return isInside;
    };

    for (let i = 0; i < treeCount * 2.5 && treeList.length < treeCount; i++) {
      const tx = bbox.minX + 8 + rng() * (bbox.width - 16);
      const ty = bbox.minY + 8 + rng() * (bbox.height - 16);
      if (isPointInPolygon([tx, ty], pointsPx)) {
        const size = rng() > 0.65 ? 'lg' : rng() > 0.3 ? 'md' : 'sm';
        const variant = Math.floor(rng() * 3) + 1;
        treeList.push({ x: tx, y: ty, size, variant, id: `${id}_tree_${treeList.length}` });
      }
    }

    return treeList.map(tree => {
      const sizePxMap = { lg: 26, md: 18, sm: 12 };
      const px = sizePxMap[tree.size] || 18;
      const img = assets ? (tree.variant % 2 === 0 ? assets.treePlan2 : assets.treePlan1) : null;

      if (img) {
        // Use image sprite when assets are loaded
        return (
          <Shape
            key={tree.id}
            listening={false}
            sceneFunc={(context) => {
              context.save();
              context.fillStyle = 'rgba(0,0,0,0.18)';
              context.beginPath();
              context.ellipse(tree.x + px * 0.1, tree.y + px * 0.12, px * 0.4, px * 0.2, 0, 0, Math.PI * 2);
              context.fill();
              drawImageContain(context, img, tree.x - px / 2, tree.y - px / 2, px, px);
              context.restore();
            }}
          />
        );
      }

      // Circle fallback when assets not yet loaded
      const r = px / 2;
      return (
        <Group key={tree.id} listening={false}>
          {/* Shadow */}
          <Circle x={tree.x + 2} y={tree.y + 3} radius={r * 0.85} fill="rgba(0,0,0,0.18)" />
          {/* Outer canopy */}
          <Circle x={tree.x} y={tree.y} radius={r} fill="#22863a" />
          {/* Inner highlight */}
          <Circle x={tree.x - r * 0.2} y={tree.y - r * 0.2} radius={r * 0.55} fill="#34a853" />
        </Group>
      );
    });
  };

  const [isPaintingTrees, setIsPaintingTrees] = useState(false);
  const lastPaintedTreePosRef = useRef({ x: 0, y: 0 });

  const paintTreeAt = (x, y) => {
    const snappedX = snapValue(x);
    const snappedY = snapValue(y);
    const variant = meta.activePlacementVariant || 'tree_single';
    const sizeM = variant === 'tree_row' ? 2.2 : variant === 'tree_cluster' ? 2.0 : 1.6;
    const sizePx = sizeM * scale;
    
    const newAmenity = {
      id: `amenity_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'tree',
      label: variant === 'tree_row' ? 'Tree Row' : variant === 'tree_cluster' ? 'Tree Cluster' : 'Tree',
      x_px: snappedX - sizePx / 2,
      y_px: snappedY - sizePx / 2,
      width_px: sizePx,
      height_px: sizePx,
      x_m: pxToM(snappedX - sizePx / 2, scale),
      y_m: pxToM(snappedY - sizePx / 2, scale),
      width_m: sizeM,
      height_m: sizeM,
      tree_variant: variant
    };

    addAmenity(newAmenity);
    lastPaintedTreePosRef.current = { x, y };
  };

  // Handle click on canvas background for deselection
  const handleStageMouseDown = (e) => {
    closeContextMenu();
    const clickedOnEmpty = e.target === e.target.getStage();
    
    // Start tree painting on mousedown (drag-and-drop style)
    if (meta.activePlacementCategory === 'tree' && meta.treeBrushActive) {
      const pos = stageRef.current.getPointerPosition();
      if (pos) {
        lastPaintedTreePosRef.current = { x: 0, y: 0 };
        setIsPaintingTrees(true);
        paintTreeAt(pos.x, pos.y);
      }
      return;
    }

    if (clickedOnEmpty) {
      setSelectedElementId(null);
      if (activeTool === 'SQUARE') {
        // Start drawing zone
        const pos = stageRef.current.getPointerPosition();
        const snappedX = snapValue(pos.x);
        const snappedY = snapValue(pos.y);
        setDrawingRect({
          startX: snappedX,
          startY: snappedY,
          x: snappedX,
          y: snappedY,
          width: 0,
          height: 0
        });
      }
    }
  };

  const handleStageMouseMove = () => {
    const pos = stageRef.current.getPointerPosition();
    if (!pos) return;
    
    let snappedX = snapValue(pos.x);
    let snappedY = snapValue(pos.y);
    if (activeTool === 'LINE' || activeTool === 'CONNECTOR') {
      const [sx, sy] = getSnappedPosition(pos.x, pos.y);
      snappedX = sx;
      snappedY = sy;
    }
    
    setMousePos({ x: snappedX, y: snappedY });
    
    // Handle tree painting if we are painting
    if (isPaintingTrees && meta.activePlacementCategory === 'tree') {
      const dx = pos.x - lastPaintedTreePosRef.current.x;
      const dy = pos.y - lastPaintedTreePosRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Paint tree if drag distance is more than 35px, or if it is the first tree in the sequence
      if (lastPaintedTreePosRef.current.x === 0 || dist > 35) {
        paintTreeAt(pos.x, pos.y);
      }
      return;
    }
    
    if (drawingRect) {
      const startX = drawingRect.startX;
      const startY = drawingRect.startY;
      const newW = Math.abs(snappedX - startX);
      const newH = Math.abs(snappedY - startY);
      setDrawingRect({
        startX,
        startY,
        x: Math.min(snappedX, startX),
        y: Math.min(snappedY, startY),
        width: newW,
        height: newH
      });
      // Show dimension tooltip near cursor
      if (newW > 0 && newH > 0) {
        setDimTooltip({
          x: Math.min(snappedX, startX) + newW / 2,
          y: Math.min(snappedY, startY) - 28,
          wM: parseFloat(pxToM(newW, scale).toFixed(1)),
          hM: parseFloat(pxToM(newH, scale).toFixed(1))
        });
      }
    }
  };

  const handleStageMouseUp = () => {
    if (isPaintingTrees) {
      setIsPaintingTrees(false);
      // Don't clear placement category — user can start painting again
      return;
    }

    if (drawingRect) {
      // Finalize zone
      const snappedX = snapValue(drawingRect.x);
      const snappedY = snapValue(drawingRect.y);
      const snappedW = Math.max(gridUnit * 5, snapValue(drawingRect.width)); // Enforce min 5m
      const snappedH = Math.max(gridUnit * 5, snapValue(drawingRect.height));

      const type = 'residential';
      const labelText = `Residential Zone ${zones.filter(z => z.type === type).length + 1}`;

      const newZone = {
        id: `zone_${Date.now()}`,
        type,
        label: labelText,
        x_px: snappedX,
        y_px: snappedY,
        width_px: snappedW,
        height_px: snappedH,
        x_m: pxToM(snappedX, scale),
        y_m: pxToM(snappedY, scale),
        width_m: pxToM(snappedW, scale),
        height_m: pxToM(snappedH, scale),
        floors: 4,
        color: ZONE_COLORS[type] || '#7F8C8D',
        opacity: 0.8,
        rotation_deg: 0,
        properties: {
          plot_size_sqm: pxToM(snappedW, scale) * pxToM(snappedH, scale),
          setback_front_m: 3.0,
          setback_side_m: 1.5,
          ground_coverage_pct: 60,
          fsi: 1.5
        }
      };

      addZone(newZone);
      setDrawingRect(null);
      setDimTooltip(null);
      setActiveTool('SELECT');
    }
  };

  const handleStageClick = (e) => {
    const pos = stageRef.current.getPointerPosition();
    if (!pos) return;
    
    let snappedX = snapValue(pos.x);
    let snappedY = snapValue(pos.y);
    if (activeTool === 'LINE' || activeTool === 'CONNECTOR') {
      const [sx, sy] = getSnappedPosition(pos.x, pos.y);
      snappedX = sx;
      snappedY = sy;
    }

    if (meta.activePlacementCategory === 'tree') {
      // If brush mode is active, the mousedown/move/up handlers handle painting.
      // Only do single-click placement when brush mode is OFF.
      if (meta.treeBrushActive) return;

      const variant = meta.activePlacementVariant || 'tree_single';
      const sizeM = variant === 'tree_row' ? 2.2 : variant === 'tree_cluster' ? 2.0 : 1.6;
      const sizePx = sizeM * scale;
      const newAmenity = {
        id: `amenity_${Date.now()}`,
        type: 'tree',
        label: variant === 'tree_row' ? 'Tree Row' : variant === 'tree_cluster' ? 'Tree Cluster' : 'Tree',
        x_px: snappedX - sizePx / 2,
        y_px: snappedY - sizePx / 2,
        width_px: sizePx,
        height_px: sizePx,
        x_m: pxToM(snappedX - sizePx / 2, scale),
        y_m: pxToM(snappedY - sizePx / 2, scale),
        width_m: sizeM,
        height_m: sizeM,
        tree_variant: variant
      };
      addAmenity(newAmenity);
      setSelectedElementId(newAmenity.id);
      setMeta({ activePlacementCategory: null, activePlacementVariant: null });
      return;
    }

    if (meta.activePlacementCategory === 'access') {
      const preset = accessPlacementMap[meta.activePlacementVariant] || accessPlacementMap.access_single;
      const widthM = preset.widthM;
      const heightM = preset.heightM;
      const sizePxW = widthM * scale;
      const sizePxH = heightM * scale;
      const newAmenity = {
        id: `amenity_${Date.now()}`,
        type: 'entry_exit',
        label: preset.label,
        x_px: snappedX - sizePxW / 2,
        y_px: snappedY - sizePxH / 2,
        width_px: sizePxW,
        height_px: sizePxH,
        x_m: pxToM(snappedX - sizePxW / 2, scale),
        y_m: pxToM(snappedY - sizePxH / 2, scale),
        width_m: widthM,
        height_m: heightM,
        access_variant: meta.activePlacementVariant || 'access_single'
      };
      addAmenity(newAmenity);
      setSelectedElementId(newAmenity.id);
      setMeta({ activePlacementCategory: null, activePlacementVariant: null });
      return;
    }

    if (meta.activePlacementCategory === 'building') {
      const preset = buildingPlacementMap[meta.activePlacementVariant] || buildingPlacementMap.building_residential;
      const widthPx = preset.widthM * scale;
      const heightPx = preset.heightM * scale;
      const pointsPx = [
        [snappedX - widthPx / 2, snappedY - heightPx / 2],
        [snappedX + widthPx / 2, snappedY - heightPx / 2],
        [snappedX + widthPx / 2, snappedY + heightPx / 2],
        [snappedX - widthPx / 2, snappedY + heightPx / 2]
      ];
      const newZone = {
        id: `zone_${Date.now()}`,
        type: preset.type,
        label: preset.label,
        x_px: snappedX - widthPx / 2,
        y_px: snappedY - heightPx / 2,
        width_px: widthPx,
        height_px: heightPx,
        x_m: pxToM(snappedX - widthPx / 2, scale),
        y_m: pxToM(snappedY - heightPx / 2, scale),
        width_m: preset.widthM,
        height_m: preset.heightM,
        points_px: pointsPx,
        points_m: pointsPx.map((p) => [pxToM(p[0], scale), pxToM(p[1], scale)]),
        color: preset.type === 'commercial' ? '#F5A623' : preset.type === 'residential' ? '#4A90D9' : preset.type === 'industrial' ? '#95A5A6' : '#9B59B6',
        opacity: 0.88,
        floors: preset.floors,
        building_variant: preset.variant
      };
      addZone(newZone);
      setSelectedElementId(newZone.id);
      setMeta({ activePlacementCategory: null, activePlacementVariant: null });
      return;
    }

    if (activeTool === 'RING') {
      const roadType = meta.activeRoadType || 'ring_primary';
      addRoad(buildRingRoad(snappedX, snappedY, roadType));
      setActiveTool('SELECT');
      return;
    }

    if (activeTool === 'LINE') {
      const newPoints = [...roadPoints, [snappedX, snappedY]];
      if (newPoints.length === 1) {
        setRoadPoints(newPoints);
      } else if (newPoints.length === 2) {
        // Finalize LINE road segment
        const roadType = meta.activeRoadType || 'secondary';
        const roadWidthM = roadWidthMap[roadType] || 6;
        const labelText = `${roadLabels[roadType] || 'Road'} ${roads.length + 1}`;

        const newRoad = {
          id: `road_${Date.now()}`,
          type: roadType,
          label: labelText,
          points_px: newPoints,
          points_m: newPoints.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]),
          width_px: roadWidthM * scale,
          width_m: roadWidthM,
          color: ROAD_COLORS[roadType] || '#7F8C8D',
          has_median: roadType === 'primary',
          median_width_m: 2,
          tension: 0
        };

        addRoad(newRoad);
        setRoadPoints([]);
        setActiveTool('SELECT');
      }
    } else if (activeTool === 'CONNECTOR') {
      if (roadPoints.length > 0) {
        const firstPoint = roadPoints[0];
        const distToFirst = Math.sqrt(Math.pow(snappedX - firstPoint[0], 2) + Math.pow(snappedY - firstPoint[1], 2));
        if (distToFirst < 20 / scale) {
          const finalPoints = [...roadPoints, firstPoint];
          const roadType = meta.activeRoadType || 'secondary';
          const roadWidthM = roadWidthMap[roadType] || 6;
          const labelText = `${roadLabels[roadType] || 'Road'} ${roads.length + 1}`;
          
          const newRoad = {
            id: `road_${Date.now()}`,
            type: roadType,
            label: labelText,
            points_px: finalPoints,
            points_m: finalPoints.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]),
            width_px: roadWidthM * scale,
            width_m: roadWidthM,
            color: ROAD_COLORS[roadType] || '#7F8C8D',
            has_median: roadType === 'primary',
            median_width_m: 2,
            tension: 0,
            closed: true
          };
          addRoad(newRoad);
          setRoadPoints([]);
          setActiveTool('SELECT');
          return;
        }
      }
      setRoadPoints([...roadPoints, [snappedX, snappedY]]);
    } else if (activeTool === 'LABEL') {
      const text = prompt("Enter label text:", "New Area");
      if (text) {
        addLabel({
          id: `label_${Date.now()}`,
          text,
          x_px: pos.x,
          y_px: pos.y,
          font_size: 14,
          color: '#0f172a'
        });
      }
      setActiveTool('SELECT');
    }
  };

  const handleStageDblClick = () => {
    if (activeTool === 'CONNECTOR' && roadPoints.length > 1) {
      // Filter out duplicate consecutive points (which are created due to double click clicks)
      const uniquePoints = [];
      for (const p of roadPoints) {
        if (uniquePoints.length === 0) {
          uniquePoints.push(p);
        } else {
          const last = uniquePoints[uniquePoints.length - 1];
          if (last[0] !== p[0] || last[1] !== p[1]) {
            uniquePoints.push(p);
          }
        }
      }

      if (uniquePoints.length > 1) {
        const roadType = meta.activeRoadType || 'secondary';
        const roadWidthM = roadWidthMap[roadType] || 6;
        const labelText = `${roadLabels[roadType] || 'Road'} ${roads.length + 1}`;

        const newRoad = {
          id: `road_${Date.now()}`,
          type: roadType,
          label: labelText,
          points_px: uniquePoints,
          points_m: uniquePoints.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]),
          width_px: roadWidthM * scale,
          width_m: roadWidthM,
          color: ROAD_COLORS[roadType] || '#7F8C8D',
          has_median: roadType === 'primary',
          median_width_m: 2,
          tension: 0
        };

        addRoad(newRoad);
      }

      setRoadPoints([]);
      setActiveTool('SELECT');
    }
  };

  // Node selection & drag updates
  const handleDragEnd = (e, item, isZone = true) => {
    const newX = snapValue(e.target.x());
    const newY = snapValue(e.target.y());
    
    e.target.x(newX);
    e.target.y(newY);

    if (isZone) {
      updateZone(item.id, {
        x_px: newX,
        y_px: newY,
        x_m: pxToM(newX, scale),
        y_m: pxToM(newY, scale)
      });
    } else {
      updateLabel(item.id, {
        x_px: newX,
        y_px: newY
      });
    }
  };

  const handleTransform = (e) => {
    const node = e.target;
    const newW = node.width() * node.scaleX();
    const newH = node.height() * node.scaleY();
    const wM = parseFloat(pxToM(newW, scale).toFixed(1));
    const hM = parseFloat(pxToM(newH, scale).toFixed(1));
    setDimTooltip({
      x: node.x() + newW / 2,
      y: node.y() - 28,
      wM,
      hM
    });
  };

  const handleTransformEnd = (e, zone) => {
    const node = e.target;
    const dx = node.x();
    const dy = node.y();
    const sx = node.scaleX();
    const sy = node.scaleY();
    const rotRad = (node.rotation() * Math.PI) / 180;

    // Reset scales/translation to 1 / 0 so updates apply directly to points
    node.scaleX(1);
    node.scaleY(1);
    node.x(0);
    node.y(0);
    node.rotation(0);
    setDimTooltip(null);

    // Map original points with transformation matrix math
    const originalPts = getZonePoints(zone);
    const updatedPointsPx = originalPts.map(([px, py]) => {
      const xs = px * sx;
      const ys = py * sy;
      const xr = xs * Math.cos(rotRad) - ys * Math.sin(rotRad);
      const yr = xs * Math.sin(rotRad) + ys * Math.cos(rotRad);
      return [snapValue(xr + dx), snapValue(yr + dy)];
    });

    const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
    const areaSqm = calculatePolygonArea(updatedPointsM);
    const bbox = getPolygonBoundingBox(updatedPointsPx);

    updateZone(zone.id, {
      points_px: updatedPointsPx,
      points_m: updatedPointsM,
      x_px: bbox.minX,
      y_px: bbox.minY,
      width_px: bbox.width,
      height_px: bbox.height,
      x_m: pxToM(bbox.minX, scale),
      y_m: pxToM(bbox.minY, scale),
      width_m: pxToM(bbox.width, scale),
      height_m: pxToM(bbox.height, scale),
      'properties.plot_size_sqm': areaSqm
    });
  };

  const handleAmenityTransformEnd = (e, amenity) => {
    const node = e.target;
    const dx = node.x();
    const dy = node.y();
    const sx = node.scaleX();
    const sy = node.scaleY();
    const rotRad = (node.rotation() * Math.PI) / 180;

    node.scaleX(1);
    node.scaleY(1);
    node.x(0);
    node.y(0);
    node.rotation(0);
    setDimTooltip(null);

    const originalPts = getAmenityPoints(amenity);
    const updatedPointsPx = originalPts.map(([px, py]) => {
      const xs = px * sx;
      const ys = py * sy;
      const xr = xs * Math.cos(rotRad) - ys * Math.sin(rotRad);
      const yr = xs * Math.sin(rotRad) + ys * Math.cos(rotRad);
      return [snapValue(xr + dx), snapValue(yr + dy)];
    });

    const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
    const bbox = getPolygonBoundingBox(updatedPointsPx);

    updateAmenity(amenity.id, {
      points_px: updatedPointsPx,
      points_m: updatedPointsM,
      x_px: bbox.minX,
      y_px: bbox.minY,
      width_px: bbox.width,
      height_px: bbox.height,
      x_m: pxToM(bbox.minX, scale),
      y_m: pxToM(bbox.minY, scale),
      width_m: pxToM(bbox.width, scale),
      height_m: pxToM(bbox.height, scale)
    });
  };

  const handleRoadTransformEnd = (e, road) => {
    const node = e.target;
    const dx = node.x();
    const dy = node.y();
    const sx = node.scaleX();
    const sy = node.scaleY();
    const rotRad = (node.rotation() * Math.PI) / 180;

    node.scaleX(1);
    node.scaleY(1);
    node.x(0);
    node.y(0);
    node.rotation(0);
    setDimTooltip(null);

    const originalPts = road.points_px;
    const updatedPointsPx = originalPts.map(([px, py]) => {
      const xs = px * sx;
      const ys = py * sy;
      const xr = xs * Math.cos(rotRad) - ys * Math.sin(rotRad);
      const yr = xs * Math.sin(rotRad) + ys * Math.cos(rotRad);
      return [snapValue(xr + dx), snapValue(yr + dy)];
    });

    const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);

    updateRoad(road.id, {
      points_px: updatedPointsPx,
      points_m: updatedPointsM
    });
  };

  // Setup transformer attachment
  useEffect(() => {
    if (selectedElementId && transformerRef.current) {
      const selectedNode = stageRef.current.findOne('#' + selectedElementId);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer().batchDraw();
      } else {
        transformerRef.current.nodes([]);
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
    }
  }, [selectedElementId, zones, roads, amenities]);

  // Render Dot Grid Layer
  const renderGrid = () => {
    const lines = [];
    const subStep = gridUnit; // Light dots every 1 meter
    
    // Draw horizontal grid lines (expanded bounds to simulate infinite grid)
    for (let i = -4000; i < 4000; i += subStep) {
      const isMajor = Math.round(i / subStep) % 10 === 0;
      if (isMajor) {
        lines.push(
          <Line
            key={`h-line-${i}`}
            points={[-4000, i, 4000, i]}
            stroke="#e2e8f0"
            strokeWidth={1}
            listening={false}
          />
        );
      }
    }
    
    // Draw vertical grid lines
    for (let j = -4000; j < 4000; j += subStep) {
      const isMajor = Math.round(j / subStep) % 10 === 0;
      if (isMajor) {
        lines.push(
          <Line
            key={`v-line-${j}`}
            points={[j, -4000, j, 4000]}
            stroke="#e2e8f0"
            strokeWidth={1}
            listening={false}
          />
        );
      }
    }

    return lines;
  };

  return (
    <div 
      ref={canvasRef}
      className="relative border border-slate-200 rounded-lg overflow-hidden bg-slate-100 flex justify-center items-center shadow-sm"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Scale Bar */}
      <div className="absolute bottom-6 left-6 bg-white/90 border border-slate-200 px-3 py-1.5 rounded text-xs text-slate-700 z-30 shadow-md">
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-[10px] tracking-wide text-indigo-600">SCALE BAR</span>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-[120px] h-[4px] bg-slate-700 border-l border-r border-slate-700 relative">
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1px] bg-slate-350" />
            </div>
            <span>50m</span>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', width, height }}>
        {/* Leaflet background map */}
        {(viewMode === 'satellite' || viewMode === 'street') && (
          <div
            ref={mapWrapperRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width,
              height,
              zIndex: 0,
              transform: `translate(${stagePos.x}px, ${stagePos.y}px) scale(${stageScale})`,
              transformOrigin: '0 0',
              willChange: 'transform'
            }}
          >
            <div
              ref={mapContainerRef}
              style={{
                width,
                height,
              }}
            />
          </div>
        )}
        <div style={{ position: 'absolute', top: 0, left: 0, width, height, zIndex: 1 }}>
          <Stage
            ref={stageRef}
            width={width}
            height={height}
            x={stagePos.x}
            y={stagePos.y}
            scaleX={stageScale}
            scaleY={stageScale}
            draggable={activeTool === 'SELECT'}
            onContextMenu={(e) => {
              e.evt.preventDefault();
              if (activeTool === 'CONNECTOR' || activeTool === 'LINE') {
                setRoadPoints([]);
                setActiveTool('SELECT');
              }
            }}
            onDragStart={(e) => {
              if (e.target === stageRef.current) {
                // Starting stage pan
              }
            }}
            onDragMove={(e) => {
              if (e.target === stageRef.current) {
                // Imperative update for zero latency
                if (mapWrapperRef.current) {
                  mapWrapperRef.current.style.transform = `translate(${e.target.x()}px, ${e.target.y()}px) scale(${stageScale})`;
                }
              }
            }}
            onDragEnd={(e) => {
              if (e.target === stageRef.current) {
                setStagePos({ x: e.target.x(), y: e.target.y() });
              }
            }}
            onWheel={handleWheel}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onMouseLeave={() => setIsPaintingTrees(false)}
            onClick={handleStageClick}
            onDblClick={handleStageDblClick}
            className={`shadow-2xl ${meta.treeBrushActive && meta.activePlacementCategory === 'tree' ? 'cursor-cell' : 'cursor-crosshair'}`}
          >
            {/* Land Boundary Layer */}
            <Layer>
              {viewMode !== 'satellite' && viewMode !== 'street' && (
                <Rect x={-4000} y={-4000} width={8000} height={8000} fill="#f1f5f9" listening={false} />
              )}
              {renderGrid()}
    
              {/* Site Land (No longer draggable independently to stay stuck to map) */}
              <Group
                draggable={false}
                x={0}
                y={0}
                scaleX={1}
                scaleY={1}
                rotation={0}
                onMouseDown={(e) => {
                  // Clicking the background site land deselects active block
                  setSelectedElementId(null);
                }}
                onMouseEnter={(e) => {
                  if (activeTool === 'SELECT') {
                    const stage = e.target.getStage();
                    if (stage) stage.container().style.cursor = 'move';
                  }
                }}
                onMouseLeave={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = 'default';
                }}
              >
                {(() => {
                  const landFill =
                    viewMode === 'grass'     ? '#8bc34a' :
                    viewMode === 'concrete'  ? '#e5e7eb' :
                    viewMode === 'satellite' ? 'rgba(0,0,0,0)' :
                    viewMode === 'street'    ? 'rgba(0,0,0,0)' :
                                               '#f1f5f9'; // plain
                  const landStroke =
                    viewMode === 'satellite' ? '#fbbf24' :
                    viewMode === 'street'    ? '#4f46e5' :
                                               '#374151';
                  if (boundaryPoints.length > 0) {
                    return (
                      <Line
                        points={boundaryPoints}
                        fill={landFill}
                        stroke={landStroke}
                        strokeWidth={2}
                        closed={true}
                        shadowColor="rgba(0,0,0,0.4)"
                        shadowBlur={16}
                        shadowOffset={{ x: 4, y: 8 }}
                        shadowOpacity={0.7}
                        listening={true}
                      />
                    );
                  }
                  return (
                    <Rect
                      x={0} y={0}
                      width={width} height={height}
                      fill={landFill}
                      stroke={landStroke}
                      strokeWidth={2}
                      listening={true}
                    />
                  );
                })()}
              </Group>

            {/* OSM Public Roads Background Guides */}
            {meta.showPublicRoads !== false && osmRoads
              .filter(osmRoad => !(meta.deleted_osm_road_ids || []).includes(osmRoad.id))
              .map((osmRoad) => {
                const offsetX = (meta.land_offset_x_m || 0) * scale;
                const offsetY = (meta.land_offset_y_m || 0) * scale;
                const shiftedPoints = osmRoad.points.map(p => [p[0] + offsetX, p[1] + offsetY]);
                const flatPoints = shiftedPoints.flat();
                return (
                  <Group
                    key={`osm-${osmRoad.id}`}
                    listening={activeTool === 'SELECT'}
                    onContextMenu={(e) => handleOsmContextMenu(e, osmRoad)}
                    onMouseEnter={(e) => {
                      if (activeTool === 'SELECT') {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'pointer';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }}
                  >
                    <Line
                      points={flatPoints}
                      stroke="#475569"
                      strokeWidth={6}
                      opacity={0.3}
                      lineCap="round"
                      lineJoin="round"
                    />
                    <Line
                      points={flatPoints}
                      stroke="#94a3b8"
                      strokeWidth={4}
                      dash={[8, 6]}
                      opacity={0.6}
                      lineCap="round"
                      lineJoin="round"
                    />
                    {osmRoad.name && (() => {
                      const midIdx = Math.floor((shiftedPoints.length - 1) / 2);
                      const pt1 = shiftedPoints[midIdx];
                      const pt2 = shiftedPoints[midIdx + 1];
                      const lx = (pt1[0] + pt2[0]) / 2;
                      const ly = (pt1[1] + pt2[1]) / 2;
                      const ldx = pt2[0] - pt1[0];
                      const ldy = pt2[1] - pt1[1];
                      const langleDeg = Math.atan2(ldy, ldx) * 180 / Math.PI;
                      let lAngleNorm = langleDeg;
                      if (lAngleNorm > 90) lAngleNorm -= 180;
                      if (lAngleNorm < -90) lAngleNorm += 180;
                      
                      return (
                        <Text
                          x={lx}
                          y={ly - 10}
                          text={osmRoad.name}
                          fontSize={8}
                          fontStyle="bold"
                          fill="#475569"
                          stroke="#ffffff"
                          strokeWidth={2}
                          fillAfterStrokeEnabled={true}
                          align="center"
                          rotation={lAngleNorm}
                          offsetX={50}
                        />
                      );
                    })()}
                  </Group>
                );
              })}
          </Layer>

        {/* Roads Layer (Realistic Textured) */}
        <Layer>
          {roads.map((road) => {
            const pts = road.points_px;
            if (pts.length < 2) return null;

            const flatPoints = pts.flat();
            const isRingRoad = road.type?.startsWith('ring');

            return (
              <Group
                key={road.id}
                id={road.id}
                x={0}
                y={0}
                scaleX={1}
                scaleY={1}
                rotation={0}
                draggable={activeTool === 'SELECT'}
                onContextMenu={(e) => handleContextMenu(e, 'road', road)}
                onDragStart={(e) => {
                  e.cancelBubble = true;
                }}
                onMouseEnter={(e) => {
                  if (activeTool === 'SELECT') {
                    const stage = e.target.getStage();
                    if (stage) stage.container().style.cursor = 'move';
                  }
                }}
                onMouseLeave={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = 'default';
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  const dx = e.currentTarget.x();
                  const dy = e.currentTarget.y();
                  e.currentTarget.x(0);
                  e.currentTarget.y(0);

                  const updatedPointsPx = pts.map(p => [p[0] + dx, p[1] + dy]);
                  const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);

                  updateRoad(road.id, {
                    points_px: updatedPointsPx,
                    points_m: updatedPointsM
                  });
                }}
                onTransform={handleTransform}
                onTransformEnd={(e) => handleRoadTransformEnd(e, road)}
                onMouseDown={(e) => {
                  if (activeTool === 'SELECT') {
                    setSelectedElementId(road.id);
                    e.cancelBubble = true;
                  }
                }}
                onClick={(e) => {
                  if (activeTool === 'ERASER') deleteRoad(road.id);
                  else setSelectedElementId(road.id);
                  e.cancelBubble = true;
                }}
                onDblClick={(e) => {
                  setActiveTool('SELECT');
                  setSelectedElementId(road.id);
                  e.cancelBubble = true;
                }}
              >
                {/* Selection highlight ring */}
                {selectedElementId === road.id && (
                  <Line
                    points={flatPoints}
                    stroke="rgba(79,70,229,0.35)"
                    strokeWidth={road.width_px + 8}
                    lineCap="butt"
                    lineJoin="round"
                    tension={road.tension || 0}
                    listening={false}
                  />
                )}
                {/* Kerb */}
                <Line
                  points={flatPoints}
                  stroke={road.type === 'pedestrian' || road.type === 'cycle_track' ? '#9ca3af' : '#1c1f23'}
                  strokeWidth={road.width_px + 4}
                  lineCap="butt"
                  lineJoin="round"
                  tension={road.tension || 0}
                  listening={true}
                />
                {/* Asphalt */}
                <Line
                  points={flatPoints}
                  stroke={road.type === 'pedestrian' || road.type === 'cycle_track' ? '#d1d5db' : '#374151'}
                  strokeWidth={road.width_px}
                  lineCap="butt"
                  lineJoin="round"
                  tension={road.tension || 0}
                  listening={false}
                />
                {/* Markings */}
                <Line
                  points={flatPoints}
                  stroke={road.type === 'primary' || road.type === 'ring_primary' ? '#facc15' : road.type === 'secondary' || road.type === 'ring_secondary' ? 'rgba(255,255,255,0.7)' : road.type === 'pedestrian' || road.type === 'cycle_track' ? 'rgba(75,85,99,0.5)' : 'rgba(255,255,255,0.4)'}
                  strokeWidth={road.type === 'primary' || road.type === 'ring_primary' ? 2 : road.type === 'secondary' || road.type === 'ring_secondary' ? 1.5 : 1}
                  dash={road.type === 'primary' || road.type === 'ring_primary' ? [18, 10] : road.type === 'secondary' || road.type === 'ring_secondary' ? [12, 8] : road.type === 'pedestrian' || road.type === 'cycle_track' ? [6, 6] : [8, 8]}
                  lineCap="butt"
                  lineJoin="round"
                  tension={road.tension || 0}
                  listening={false}
                />

                {/* Length & Breadth Dimension Labels (Shown when selected) */}
                {selectedElementId === road.id && (() => {
                  let totalLengthPx = 0;
                  for (let i = 0; i < pts.length - 1; i++) {
                    const dx = pts[i+1][0] - pts[i][0];
                    const dy = pts[i+1][1] - pts[i][1];
                    totalLengthPx += Math.sqrt(dx * dx + dy * dy);
                  }
                  const totalLengthM = pxToM(totalLengthPx, scale);

                  const midSegIdx = Math.floor((pts.length - 1) / 2);
                  const p1 = pts[midSegIdx];
                  const p2 = pts[midSegIdx + 1];
                  const mx = (p1[0] + p2[0]) / 2;
                  const my = (p1[1] + p2[1]) / 2;
                  const dx = p2[0] - p1[0];
                  const dy = p2[1] - p1[1];
                  const segLen = Math.sqrt(dx * dx + dy * dy) || 1;
                  const angleRad = Math.atan2(dy, dx);
                  const angleDeg = angleRad * 180 / Math.PI;

                  let normAngle = angleDeg;
                  if (normAngle > 90) normAngle -= 180;
                  if (normAngle < -90) normAngle += 180;

                  const pxVecX = -dy / segLen;
                  const pxVecY = dx / segLen;
                  const offsetDist = road.width_px / 2 + 15;
                  const bx = mx + pxVecX * offsetDist;
                  const by = my + pxVecY * offsetDist;

                  return (
                    <Group listening={false}>
                      {/* Length Label (Inside road path) */}
                      <Text
                        x={mx}
                        y={my}
                        text={`${totalLengthM.toFixed(1)} m`}
                        fontSize={10}
                        fontStyle="bold"
                        fill="#ffffff"
                        stroke="#1e293b"
                        strokeWidth={2.5}
                        fillAfterStrokeEnabled={true}
                        align="center"
                        rotation={normAngle}
                        offsetX={40}
                        offsetY={5}
                      />
                      {/* Breadth Label (Outside road path) */}
                      <Text
                        x={bx}
                        y={by}
                        text={`${road.width_m.toFixed(1)} m`}
                        fontSize={9}
                        fontStyle="bold"
                        fill="#1e293b"
                        stroke="#ffffff"
                        strokeWidth={2.5}
                        fillAfterStrokeEnabled={true}
                        align="center"
                        rotation={normAngle}
                        offsetX={30}
                        offsetY={5}
                      />
                    </Group>
                  );
                })()}

                {/* Draggable Anchors */}
                {selectedElementId === road.id && pts.map((pt, idx) => (
                  <Circle
                    key={`anchor-${road.id}-${idx}`}
                    x={pt[0]}
                    y={pt[1]}
                    radius={8}
                    fill="#4f46e5"
                    stroke="#ffffff"
                    strokeWidth={2}
                    draggable={activeTool === 'SELECT'}
                    onDragStart={(e) => {
                      e.cancelBubble = true;
                    }}
                    onDragMove={(e) => {
                      e.cancelBubble = true;
                      const stage = e.target.getStage();
                      const pos = stage ? stage.getPointerPosition() : null;
                      const dragX = pos ? pos.x : e.target.x();
                      const dragY = pos ? pos.y : e.target.y();

                      const [finalX, finalY] = getSnappedPosition(dragX, dragY, road.id);
                      e.target.x(finalX);
                      e.target.y(finalY);

                      const updatedPointsPx = [...road.points_px];
                      updatedPointsPx[idx] = [finalX, finalY];
                      const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
                      
                      updateRoadPoints(road.id, updatedPointsPx, updatedPointsM);
                    }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true;
                      const stage = e.target.getStage();
                      const pos = stage ? stage.getPointerPosition() : null;
                      const dragX = pos ? pos.x : e.target.x();
                      const dragY = pos ? pos.y : e.target.y();

                      const [finalX, finalY] = getSnappedPosition(dragX, dragY, road.id);
                      e.target.x(finalX);
                      e.target.y(finalY);
                      
                      const updatedPointsPx = [...road.points_px];
                      updatedPointsPx[idx] = [finalX, finalY];
                      const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);

                      updateRoad(road.id, {
                        points_px: updatedPointsPx,
                        points_m: updatedPointsM
                      });
                    }}
                  />
                ))}

              </Group>
            );
          })}

          {/* Active Road Drawing Draft */}
          {roadPoints.length > 0 && (
            <Group>
              <Line
                points={[...roadPoints.flat(), mousePos.x, mousePos.y]}
                stroke="#F5A623"
                strokeWidth={6}
                dash={[5, 5]}
                lineCap="round"
              />
              {roadPoints.map((pt, idx) => (
                <Circle
                  key={`draft-pt-${idx}`}
                  x={pt[0]}
                  y={pt[1]}
                  radius={6}
                  fill="#4f46e5"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              ))}
            </Group>
          )}
        </Layer>

        {/* Zones Layer (Architectural Blueprint Style as Polygons) */}
        <Layer>
          {zones.map((zone) => {
            const pts = getZonePoints(zone);
            const flatPts = pts.flat();
            const bbox = getPolygonBoundingBox(pts);
            const isSelected = selectedElementId === zone.id;
            const isBuilding = ['residential', 'commercial', 'mixed_use', 'industrial', 'institutional', 'amenity'].includes(zone.type);

            return (
              <Group
                key={zone.id}
                id={zone.id}
                x={0}
                y={0}
                scaleX={1}
                scaleY={1}
                rotation={0}
                width={bbox.width}
                height={bbox.height}
                draggable={activeTool === 'SELECT'}
                onContextMenu={(e) => handleContextMenu(e, 'zone', zone)}
                onDragStart={(e) => {
                  e.cancelBubble = true;
                }}
                onMouseEnter={(e) => {
                  if (activeTool === 'SELECT') {
                    const stage = e.target.getStage();
                    if (stage) stage.container().style.cursor = 'move';
                  }
                }}
                onMouseLeave={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = 'default';
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  const dx = e.currentTarget.x();
                  const dy = e.currentTarget.y();
                  e.currentTarget.x(0);
                  e.currentTarget.y(0);
                  
                  const updatedPointsPx = pts.map(p => [p[0] + dx, p[1] + dy]);
                  const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
                  const areaSqm = calculatePolygonArea(updatedPointsM);
                  
                  updateZone(zone.id, {
                    points_px: updatedPointsPx,
                    points_m: updatedPointsM,
                    x_px: zone.x_px + dx,
                    y_px: zone.y_px + dy,
                    'properties.plot_size_sqm': areaSqm
                  });
                }}
                onTransformEnd={(e) => handleTransformEnd(e, zone)}
                onMouseDown={(e) => {
                  if (activeTool === 'SELECT') {
                    setSelectedElementId(zone.id);
                    e.cancelBubble = true;
                  }
                }}
                onClick={(e) => {
                  if (activeTool === 'ERASER') deleteZone(zone.id);
                  else setSelectedElementId(zone.id);
                  e.cancelBubble = true;
                }}
                onDblClick={(e) => {
                  setActiveTool('SELECT');
                  setSelectedElementId(zone.id);
                  e.cancelBubble = true;
                }}
              >
                {/* Drop shadow for depth */}
                {isBuilding && (
                  <Line
                    points={flatPts}
                    closed={true}
                    x={3}
                    y={5}
                    fill="rgba(0,0,0,0.18)"
                    listening={false}
                  />
                )}

                {/* Arrival Plaza */}
                {zone.has_arrival_plaza && (
                  <Arc
                    x={bbox.cx}
                    y={bbox.minY - 5}
                    innerRadius={0}
                    outerRadius={12}
                    angle={180}
                    rotation={180}
                    fill="#E67E22"
                    listening={false}
                  />
                )}

                {/* Plain coloured polygon / footprint */}
                {zone.footprint === 'cruciform' ? (
                  <Shape
                    sceneFunc={(ctx, shape) => {
                      const w = bbox.width, h = bbox.height;
                      const tW = w / 3, tH = h / 3;
                      ctx.beginPath();
                      ctx.moveTo(tW, 0); ctx.lineTo(2*tW, 0); ctx.lineTo(2*tW, tH);
                      ctx.lineTo(w, tH); ctx.lineTo(w, 2*tH); ctx.lineTo(2*tW, 2*tH);
                      ctx.lineTo(2*tW, h); ctx.lineTo(tW, h); ctx.lineTo(tW, 2*tH);
                      ctx.lineTo(0, 2*tH); ctx.lineTo(0, tH); ctx.lineTo(tW, tH);
                      ctx.closePath();
                      ctx.fillStrokeShape(shape);
                    }}
                    x={bbox.minX} y={bbox.minY}
                    fill={zone.color} opacity={zone.opacity || 0.85}
                    stroke={isSelected ? '#4f46e5' : isBuilding ? '#0f172a' : '#374151'} strokeWidth={isSelected ? 2.5 : 1.2}
                    listening={activeTool === 'SELECT'}
                  />
                ) : zone.footprint === 'h_shaped' ? (
                  <Shape
                    sceneFunc={(ctx, shape) => {
                      const w = bbox.width, h = bbox.height;
                      const tW = w / 3, tH = h / 3;
                      ctx.beginPath();
                      ctx.moveTo(0, 0); ctx.lineTo(tW, 0); ctx.lineTo(tW, tH); ctx.lineTo(2*tW, tH);
                      ctx.lineTo(2*tW, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(2*tW, h);
                      ctx.lineTo(2*tW, 2*tH); ctx.lineTo(tW, 2*tH); ctx.lineTo(tW, h); ctx.lineTo(0, h);
                      ctx.closePath();
                      ctx.fillStrokeShape(shape);
                    }}
                    x={bbox.minX} y={bbox.minY}
                    fill={zone.color} opacity={zone.opacity || 0.85}
                    stroke={isSelected ? '#4f46e5' : isBuilding ? '#0f172a' : '#374151'} strokeWidth={isSelected ? 2.5 : 1.2}
                    listening={activeTool === 'SELECT'}
                  />
                ) : zone.footprint === 'u_shaped' ? (
                  <Shape
                    sceneFunc={(ctx, shape) => {
                      const w = bbox.width, h = bbox.height;
                      const tW = w / 3, tH = h / 3;
                      ctx.beginPath();
                      ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(2*tW, h);
                      ctx.lineTo(2*tW, tH); ctx.lineTo(tW, tH); ctx.lineTo(tW, h); ctx.lineTo(0, h);
                      ctx.closePath();
                      ctx.fillStrokeShape(shape);
                    }}
                    x={bbox.minX} y={bbox.minY}
                    fill={zone.color} opacity={zone.opacity || 0.85}
                    stroke={isSelected ? '#4f46e5' : isBuilding ? '#0f172a' : '#374151'} strokeWidth={isSelected ? 2.5 : 1.2}
                    listening={activeTool === 'SELECT'}
                  />
                ) : zone.footprint === 'courtyard' ? (
                  <Shape
                    sceneFunc={(ctx, shape) => {
                      const w = bbox.width, h = bbox.height;
                      const tW = w / 4, tH = h / 4;
                      ctx.beginPath();
                      ctx.rect(0, 0, w, h);
                      ctx.rect(w - tW, tH, -(w - 2*tW), h - 2*tH);
                      ctx.fillStrokeShape(shape);
                    }}
                    fillRule="evenodd"
                    x={bbox.minX} y={bbox.minY}
                    fill={zone.color} opacity={zone.opacity || 0.85}
                    stroke={isSelected ? '#4f46e5' : isBuilding ? '#0f172a' : '#374151'} strokeWidth={isSelected ? 2.5 : 1.2}
                    listening={activeTool === 'SELECT'}
                  />
                ) : (
                  <Line
                    points={flatPts}
                    closed={true}
                    fill={zone.color}
                    opacity={zone.opacity || 0.85}
                    stroke={isSelected ? '#4f46e5' : isBuilding ? '#0f172a' : '#374151'}
                    strokeWidth={isSelected ? 2.5 : 1.2}
                    listening={activeTool === 'SELECT'}
                  />
                )}

                {/* Inside Block Size Label */}
                {(() => {
                  const areaSqm = zone.properties?.plot_size_sqm || (zone.width_m * zone.height_m);
                  const labelText = `${zone.label || 'Zone'}\n(${zone.type.toUpperCase()})\n${zone.floors ? zone.floors + ' Floors' : ''}\n${Math.round(areaSqm).toLocaleString()} m²`;
                  return (
                    <Text
                      x={bbox.minX}
                      y={bbox.minY}
                      width={bbox.width}
                      height={bbox.height}
                      text={labelText}
                      fontSize={9}
                      fontStyle="bold"
                      fill="#0f172a"
                      align="center"
                      verticalAlign="middle"
                      listening={false}
                    />
                  );
                })()}

                {/* Draggable Anchors for Reshaping */}
                {isSelected && pts.map((pt, idx) => (
                  <Circle
                    key={`zone-anchor-${zone.id}-${idx}`}
                    x={pt[0]}
                    y={pt[1]}
                    radius={8}
                    fill="#4f46e5"
                    stroke="#ffffff"
                    strokeWidth={2}
                    draggable={activeTool === 'SELECT'}
                    onDragStart={(e) => {
                      e.cancelBubble = true;
                    }}
                    onDragMove={(e) => {
                      e.cancelBubble = true;
                      const newX = snapValue(e.target.x());
                      const newY = snapValue(e.target.y());
                      e.target.x(newX);
                      e.target.y(newY);

                      const updatedPointsPx = [...pts];
                      updatedPointsPx[idx] = [newX, newY];
                      const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
                      const areaSqm = calculatePolygonArea(updatedPointsM);

                      updateZone(zone.id, {
                        points_px: updatedPointsPx,
                        points_m: updatedPointsM,
                        'properties.plot_size_sqm': areaSqm
                      });
                    }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true;
                    }}
                  />
                ))}

                {/* Custom Rotator Handle on Top of selected block */}
                {isSelected && (() => {
                  const handleX = bbox.cx;
                  const handleY = bbox.minY - 25;
                  return (
                    <Group key={`rotator-group-${zone.id}`}>
                      <Line
                        points={[bbox.cx, bbox.minY, handleX, handleY]}
                        stroke="#4f46e5"
                        strokeWidth={1.5}
                        dash={[4, 2]}
                      />
                      <Group
                        x={handleX}
                        y={handleY}
                        draggable={true}
                        onDragStart={(e) => {
                          e.cancelBubble = true;
                          rotationStartPointsRef.current = [...pts];
                          rotationCenterRef.current = { x: bbox.cx, y: bbox.cy };
                          const pos = stageRef.current.getPointerPosition();
                          rotationStartAngleRef.current = Math.atan2(
                            pos.y - bbox.cy,
                            pos.x - bbox.cx
                          );
                        }}
                        onDragMove={(e) => {
                          e.cancelBubble = true;
                          const pos = stageRef.current.getPointerPosition();
                          const currentAngle = Math.atan2(
                            pos.y - rotationCenterRef.current.y,
                            pos.x - rotationCenterRef.current.x
                          );
                          const deltaRad = currentAngle - rotationStartAngleRef.current;
                          
                          const updatedPointsPx = rotationStartPointsRef.current.map(p => 
                            rotatePoint(p[0], p[1], rotationCenterRef.current.x, rotationCenterRef.current.y, deltaRad)
                          );
                          const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
                          const areaSqm = calculatePolygonArea(updatedPointsM);
                          
                          updateZone(zone.id, {
                            points_px: updatedPointsPx,
                            points_m: updatedPointsM,
                            'properties.plot_size_sqm': areaSqm
                          });
                        }}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                        }}
                        onMouseEnter={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'crosshair';
                        }}
                        onMouseLeave={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'default';
                        }}
                      >
                        <Circle
                          x={0}
                          y={0}
                          radius={10}
                          fill="#ffffff"
                          stroke="#4f46e5"
                          strokeWidth={1.5}
                          shadowColor="rgba(0,0,0,0.3)"
                          shadowBlur={4}
                          shadowOffset={{ x: 0, y: 2 }}
                          shadowOpacity={0.5}
                        />
                        <Path
                          data="M9 0a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L9-4 M9-9v5H4"
                          x={0}
                          y={0}
                          stroke="#4f46e5"
                          strokeWidth={1.5}
                          lineCap="round"
                          lineJoin="round"
                          scale={{ x: 0.55, y: 0.55 }}
                        />
                      </Group>
                    </Group>
                  );
                })()}
              </Group>
            );
          })}

          {/* Amenities Layer as Polygons */}
          {amenities && amenities.map((amenity) => {
            const pts = getAmenityPoints(amenity);
            const flatPts = pts.flat();
            const bbox = getPolygonBoundingBox(pts);
            const isSelected = selectedElementId === amenity.id;
            const isBuilding = ['amenity', 'institutional'].includes(amenity.type);
            const isWater = amenity.type === 'water_body';
            const isSpecialPoint = amenity.type === 'tree' || amenity.type === 'entry_exit';
            const accessTexture = assets ? assets[getAccessTextureKey(amenity.access_variant)] : null;
            const accessLabel = amenity.access_variant === 'access_large'
              ? 'GRAND GATE'
              : amenity.access_variant === 'access_modern'
              ? 'MODERN GATE'
              : amenity.access_variant === 'access_minimal'
              ? 'MINIMAL GATE'
              : amenity.access_variant === 'access_multi'
              ? 'MULTI ENTRY / EXIT'
              : 'ENTRY / EXIT';

            return (
              <Group
                key={amenity.id}
                id={amenity.id}
                x={0}
                y={0}
                scaleX={1}
                scaleY={1}
                rotation={0}
                width={bbox.width}
                height={bbox.height}
                draggable={activeTool === 'SELECT'}
                onContextMenu={(e) => handleContextMenu(e, 'amenity', amenity)}
                onDragStart={(e) => {
                  e.cancelBubble = true;
                }}
                onMouseEnter={(e) => {
                  if (activeTool === 'SELECT') {
                    const stage = e.target.getStage();
                    if (stage) stage.container().style.cursor = 'move';
                  }
                }}
                onMouseLeave={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = 'default';
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  const dx = e.currentTarget.x();
                  const dy = e.currentTarget.y();
                  e.currentTarget.x(0);
                  e.currentTarget.y(0);
                  
                  const updatedPointsPx = pts.map(p => [p[0] + dx, p[1] + dy]);
                  const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
                  
                  updateAmenity(amenity.id, {
                    points_px: updatedPointsPx,
                    points_m: updatedPointsM,
                    x_px: amenity.x_px + dx,
                    y_px: amenity.y_px + dy
                  });
                }}
                onTransformEnd={(e) => handleAmenityTransformEnd(e, amenity)}
                onMouseDown={(e) => {
                  if (activeTool === 'SELECT') {
                    setSelectedElementId(amenity.id);
                    e.cancelBubble = true;
                  }
                }}
                onClick={(e) => {
                  if (activeTool === 'ERASER') deleteAmenity(amenity.id);
                  else setSelectedElementId(amenity.id);
                  e.cancelBubble = true;
                }}
                onDblClick={(e) => {
                  setActiveTool('SELECT');
                  setSelectedElementId(amenity.id);
                  e.cancelBubble = true;
                }}
              >
                {/* Shadow */}
                {!isSpecialPoint && ['amenity', 'institutional', 'parking'].includes(amenity.type) && (
                  <Line
                    points={flatPts}
                    closed={true}
                    x={4}
                    y={6}
                    fill="rgba(40, 25, 10, 0.22)"
                    listening={false}
                  />
                )}

                {assets && getAmenityTextureKey(amenity) && assets[getAmenityTextureKey(amenity)] ? (
                  <Shape
                    sceneFunc={(context) => {
                      context.beginPath();
                      if (amenity.shape === 'ellipse') {
                        context.ellipse(bbox.cx, bbox.cy, bbox.width / 2, bbox.height / 2, 0, 0, Math.PI * 2);
                      } else {
                        context.moveTo(flatPts[0], flatPts[1]);
                        for (let i = 2; i < flatPts.length; i += 2) {
                          context.lineTo(flatPts[i], flatPts[i + 1]);
                        }
                        context.closePath();
                      }
                      context.save();
                      context.clip();
                      drawImageCover(context, assets[getAmenityTextureKey(amenity)], bbox.minX, bbox.minY, bbox.width, bbox.height);
                      context.restore();
                      context.strokeStyle = isSelected ? '#4f46e5' : '#b8a888';
                      context.lineWidth = isSelected ? 2 : 1.2;
                      context.stroke();
                    }}
                    visible={!isSpecialPoint}
                    listening={activeTool === 'SELECT'}
                  />
                ) : assets && isWater ? (
                  <Line
                    points={flatPts}
                    closed={true}
                    fill="#5dade2"
                    stroke="#2980b9"
                    strokeWidth={1.5}
                    visible={!isSpecialPoint}
                    listening={activeTool === 'SELECT'}
                  />
                ) : false && isBuilding && assets?.[getBuildingTextureKey(amenity)] ? (
                  <Shape
                    sceneFunc={(context) => {
                      context.beginPath();
                      context.moveTo(flatPts[0], flatPts[1]);
                      for (let i = 2; i < flatPts.length; i += 2) {
                        context.lineTo(flatPts[i], flatPts[i + 1]);
                      }
                      context.closePath();
                      context.save();
                      context.clip();
                      drawImageCover(context, assets[getBuildingTextureKey(amenity)], bbox.minX, bbox.minY, bbox.width, bbox.height);
                      context.restore();
                      context.strokeStyle = isSelected ? '#4f46e5' : '#b8a888';
                      context.lineWidth = isSelected ? 2 : 1.2;
                      context.stroke();
                    }}
                    visible={!isSpecialPoint}
                    listening={activeTool === 'SELECT'}
                  />
                ) : amenity.shape === 'ellipse' ? (
                  <Ellipse
                    x={bbox.cx}
                    y={bbox.cy}
                    radiusX={bbox.width / 2}
                    radiusY={bbox.height / 2}
                    fill={ZONE_COLORS[amenity.type] || '#2ECC71'}
                    opacity={amenity.type === 'park' ? 0.35 : 0.75}
                    stroke={isSelected ? "#4f46e5" : "#0f172a"}
                    strokeWidth={isSelected ? 2 : 1}
                    visible={!isSpecialPoint}
                    listening={activeTool === 'SELECT'}
                  />
                ) : (
                  <Line
                    points={flatPts}
                    closed={true}
                    fill={ZONE_COLORS[amenity.type] || '#2ECC71'}
                    opacity={amenity.type === 'park' ? 0.35 : 0.75}
                    stroke={isSelected ? "#4f46e5" : "#0f172a"}
                    strokeWidth={isSelected ? 2 : 1}
                    visible={!isSpecialPoint}
                    listening={activeTool === 'SELECT'}
                  />
                )}

                {isSpecialPoint && (
                  <>
                    {/* Transparent hit area so parent Group receives drag/click events */}
                    <Rect
                      x={bbox.minX}
                      y={bbox.minY}
                      width={Math.max(bbox.width, 20)}
                      height={Math.max(bbox.height, 20)}
                      fill="transparent"
                      listening={true}
                    />
                    <Group listening={false}>
                    {amenity.type === 'tree' ? (
                      <Shape
                        sceneFunc={(context) => {
                          const texKey = getAmenityTextureKey(amenity);
                          const img = texKey && assets?.[texKey] ? assets[texKey] : (amenity.tree_variant === 'tree_row' ? assets?.treePlan2 : assets?.treePlan1);
                          if (!img) return;
                          drawImageContain(context, img, bbox.minX, bbox.minY, Math.max(bbox.width, 20), Math.max(bbox.height, 20));
                        }}
                      />
                    ) : (
                      <>
                        <Shape
                          sceneFunc={(context) => {
                            context.beginPath();
                            context.rect(bbox.minX, bbox.minY, bbox.width, bbox.height);
                            context.save();
                            context.clip();
                            if (accessTexture) {
                              drawImageContain(context, accessTexture, bbox.minX, bbox.minY, bbox.width, bbox.height);
                            } else {
                              context.fillStyle = 'rgba(255,255,255,0.92)';
                              context.fillRect(bbox.minX, bbox.minY, bbox.width, bbox.height);
                            }
                            context.restore();
                            context.strokeStyle = '#4f46e5';
                            context.lineWidth = 1.2;
                            context.stroke();
                          }}
                        />
                        {/* Rubicon Red Triangle Logo at Main Entrance */}
                        <Line
                          points={[
                            bbox.cx, bbox.minY - 10,
                            bbox.cx - 6, bbox.minY - 2,
                            bbox.cx + 6, bbox.minY - 2
                          ]}
                          fill="#b91c1c"
                          stroke="#ffffff"
                          strokeWidth={1}
                          closed={true}
                          shadowColor="rgba(0,0,0,0.3)"
                          shadowBlur={2.5}
                          shadowOffset={{ x: 0, y: 1 }}
                        />
                        <Rect
                          x={bbox.minX + 6}
                          y={bbox.minY + 6}
                          width={Math.max(10, bbox.width - 12)}
                          height={3}
                          fill="rgba(30,41,59,0.45)"
                          cornerRadius={2}
                        />
                        <Text
                          x={bbox.minX}
                          y={bbox.minY + 4}
                          width={bbox.width}
                          height={bbox.height}
                          text={accessLabel}
                          fontSize={8}
                          fontStyle="bold"
                          fill="#1e293b"
                          align="center"
                          verticalAlign="middle"
                          listening={false}
                        />
                      </>
                    )}
                  </Group>
                  </>
                )}

                {/* Label with size */}
                {amenity.type !== 'tree' && (() => {
                  const areaSqm = amenity.width_m * amenity.height_m;
                  const labelText = `${amenity.label || 'Amenity'}\n(${amenity.type.toUpperCase()})\n${Math.round(areaSqm).toLocaleString()} m²`;
                  return (
                    <Text
                      x={bbox.minX}
                      y={bbox.minY}
                      width={bbox.width}
                      height={bbox.height}
                      text={labelText}
                      fontSize={9}
                      fontStyle="bold"
                      fill="#0f172a"
                      align="center"
                      verticalAlign="middle"
                      listening={false}
                    />
                  );
                })()}

                {/* Draggable Anchors for Reshaping */}
                {isSelected && pts.map((pt, idx) => (
                  <Circle
                    key={`amenity-anchor-${amenity.id}-${idx}`}
                    x={pt[0]}
                    y={pt[1]}
                    radius={8}
                    fill="#4f46e5"
                    stroke="#ffffff"
                    strokeWidth={2}
                    draggable={activeTool === 'SELECT'}
                    onDragStart={(e) => {
                      e.cancelBubble = true;
                    }}
                    onDragMove={(e) => {
                      e.cancelBubble = true;
                      const newX = snapValue(e.target.x());
                      const newY = snapValue(e.target.y());
                      e.target.x(newX);
                      e.target.y(newY);

                      const updatedPointsPx = [...pts];
                      updatedPointsPx[idx] = [newX, newY];
                      const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
                      
                      const xs = updatedPointsPx.map(p => p[0]);
                      const ys = updatedPointsPx.map(p => p[1]);
                      const widthPx = Math.max(...xs) - Math.min(...xs);
                      const heightPx = Math.max(...ys) - Math.min(...ys);

                      updateAmenity(amenity.id, {
                        points_px: updatedPointsPx,
                        points_m: updatedPointsM,
                        width_px: widthPx,
                        height_px: heightPx,
                        width_m: pxToM(widthPx, scale),
                        height_m: pxToM(heightPx, scale)
                      });
                    }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true;
                    }}
                  />
                ))}

                {/* Custom Rotator Handle */}
                {isSelected && (() => {
                  const handleX = bbox.cx;
                  const handleY = bbox.minY - 25;
                  return (
                    <Group key={`rotator-group-amenity-${amenity.id}`}>
                      <Line
                        points={[bbox.cx, bbox.minY, handleX, handleY]}
                        stroke="#4f46e5"
                        strokeWidth={1.5}
                        dash={[4, 2]}
                      />
                      <Group
                        x={handleX}
                        y={handleY}
                        draggable={true}
                        onDragStart={(e) => {
                          e.cancelBubble = true;
                          rotationStartPointsRef.current = [...pts];
                          rotationCenterRef.current = { x: bbox.cx, y: bbox.cy };
                          const pos = stageRef.current.getPointerPosition();
                          rotationStartAngleRef.current = Math.atan2(
                            pos.y - bbox.cy,
                            pos.x - bbox.cx
                          );
                        }}
                        onDragMove={(e) => {
                          e.cancelBubble = true;
                          const pos = stageRef.current.getPointerPosition();
                          const currentAngle = Math.atan2(
                            pos.y - rotationCenterRef.current.y,
                            pos.x - rotationCenterRef.current.x
                          );
                          const deltaRad = currentAngle - rotationStartAngleRef.current;
                          
                          const updatedPointsPx = rotationStartPointsRef.current.map(p => 
                            rotatePoint(p[0], p[1], rotationCenterRef.current.x, rotationCenterRef.current.y, deltaRad)
                          );
                          const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
                          
                          const xs = updatedPointsPx.map(p => p[0]);
                          const ys = updatedPointsPx.map(p => p[1]);
                          const widthPx = Math.max(...xs) - Math.min(...xs);
                          const heightPx = Math.max(...ys) - Math.min(...ys);

                          updateAmenity(amenity.id, {
                            points_px: updatedPointsPx,
                            points_m: updatedPointsM,
                            width_px: widthPx,
                            height_px: heightPx,
                            width_m: pxToM(widthPx, scale),
                            height_m: pxToM(heightPx, scale)
                          });
                        }}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                        }}
                        onMouseEnter={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'crosshair';
                        }}
                        onMouseLeave={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'default';
                        }}
                      >
                        <Circle
                          x={0}
                          y={0}
                          radius={10}
                          fill="#ffffff"
                          stroke="#4f46e5"
                          strokeWidth={1.5}
                          shadowColor="rgba(0,0,0,0.3)"
                          shadowBlur={4}
                          shadowOffset={{ x: 0, y: 2 }}
                          shadowOpacity={0.5}
                        />
                        <Path
                          data="M9 0a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L9-4 M9-9v5H4"
                          x={0}
                          y={0}
                          stroke="#4f46e5"
                          strokeWidth={1.5}
                          lineCap="round"
                          lineJoin="round"
                          scale={{ x: 0.55, y: 0.55 }}
                        />
                      </Group>
                    </Group>
                  );
                })()}
              </Group>
            );
          })}

          {/* Rectangle Drawing Preview */}
          {drawingRect && (
            <Rect
              x={drawingRect.x}
              y={drawingRect.y}
              width={drawingRect.width}
              height={drawingRect.height}
              fill={ZONE_COLORS['residential'] || '#cbd5e1'}
              opacity={0.4}
              stroke="#0f172a"
              strokeWidth={1.5}
              dash={[6, 3]}
            />
          )}
        </Layer>

        {/* Scattered Trees Layer — always rendered (image if loaded, circle fallback otherwise) */}
        <Layer>
          {zones.map(zone => {
            if (['green_belt', 'park', 'open_space'].includes(zone.type)) {
              return renderTreesInArea(getZonePoints(zone), zone.id);
            }
            return null;
          })}
          {amenities && amenities.map(amenity => {
            if (['park', 'green_belt', 'open_space'].includes(amenity.type)) {
              return renderTreesInArea(getAmenityPoints(amenity), amenity.id);
            }
            if (amenity.type === 'tree_cluster') {
              const count = amenity.density === 'high' ? 40 : amenity.density === 'medium' ? 20 : 10;
              const trees = [];
              const seed = amenity.id.split('').reduce((a,b)=>a+b.charCodeAt(0),0);
              for (let i = 0; i < count; i++) {
                // simple pseudo-random based on index and seed
                const angle = (seed * i * 13.1) % (Math.PI * 2);
                const r = ((seed * i * 7.9) % 1) * (amenity.width_px / 2);
                trees.push(
                  <Circle
                    key={`${amenity.id}-tree-${i}`}
                    x={amenity.x_px + amenity.width_px / 2 + Math.cos(angle) * r}
                    y={amenity.y_px + amenity.height_px / 2 + Math.sin(angle) * r}
                    radius={3 + ((seed * i * 3.1) % 2)}
                    fill="#27AE60"
                    opacity={0.8}
                  />
                );
              }
              return <Group key={`cluster-${amenity.id}`}>{trees}</Group>;
            }
            return null;
          })}
        </Layer>

        {/* Labels Layer */}
        <Layer>
          {labels.map((lbl) => (
              <Text
              key={lbl.id}
              id={lbl.id}
              x={lbl.x_px}
              y={lbl.y_px}
              text={lbl.text}
              fontSize={lbl.font_size}
              fill={lbl.color && (lbl.color.toLowerCase() === '#ffffff' || lbl.color.toLowerCase() === '#fff') ? '#0f172a' : lbl.color}
              align="center"
              draggable={activeTool === 'SELECT'}
              onContextMenu={(e) => handleContextMenu(e, 'label', lbl)}
              onMouseEnter={(e) => {
                if (activeTool === 'SELECT') {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = 'move';
                }
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'default';
              }}
              onMouseDown={(e) => {
                if (activeTool === 'SELECT') {
                  setSelectedElementId(lbl.id);
                  e.cancelBubble = true;
                }
              }}
              onClick={(e) => {
                if (activeTool === 'ERASER') deleteLabel(lbl.id);
                else {
                  setSelectedElementId(lbl.id);
                }
                e.cancelBubble = true;
              }}
              onDblClick={(e) => {
                setActiveTool('SELECT');
                setSelectedElementId(lbl.id);
                e.cancelBubble = true;
              }}
              onDragEnd={(e) => handleDragEnd(e, lbl, false)}
            />
          ))}

          {/* Dimension Tooltip — shown when drawing or resizing */}
          {dimTooltip && dimTooltip.wM > 0 && dimTooltip.hM > 0 && (() => {
            const areaSqM = (dimTooltip.wM * dimTooltip.hM).toFixed(0);
            const txt = `${dimTooltip.wM}m × ${dimTooltip.hM}m  (${Number(areaSqM).toLocaleString()} m²)`;
            const padX = 10, padY = 5, fs = 11;
            const approxW = txt.length * 6.5 + padX * 2;
            return (
              <Group x={dimTooltip.x - approxW / 2} y={dimTooltip.y} listening={false}>
                <Rect
                  x={0} y={0}
                  width={approxW} height={fs + padY * 2 + 2}
                  fill="rgba(15,23,42,0.85)"
                  cornerRadius={5}
                  shadowColor="rgba(0,0,0,0.4)"
                  shadowBlur={6}
                  shadowOffset={{ x: 1, y: 2 }}
                />
                <Text
                  x={padX} y={padY}
                  text={txt}
                  fontSize={fs}
                  fontStyle="bold"
                  fill="#ffffff"
                  fontFamily="'Inter', sans-serif"
                />
              </Group>
            );
          })()}

          {/* Selection Transformer Handles */}
          <Transformer
            ref={transformerRef}
            borderStroke="#4f46e5"
            borderStrokeWidth={1.5}
            anchorStroke="#4f46e5"
            anchorFill="#ffffff"
            anchorSize={8}
            anchorCornerRadius={2}
            onTransform={handleTransform}
            keepRatio={selectedElementId && roads.some(r => r.id === selectedElementId && r.type?.startsWith('ring'))}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < gridUnit * 5 || newBox.height < gridUnit * 5) {
                return oldBox;
              }
              return newBox;
            }}
          />
        </Layer>
          </Stage>
        </div>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="absolute z-50 min-w-36 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.itemType !== 'osmRoad' ? (
            <>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-100"
                onClick={() => {
                  if (contextMenu.itemType === 'road') duplicateRoad(contextMenu.item);
                  else if (contextMenu.itemType === 'zone') duplicateZone(contextMenu.item);
                  else if (contextMenu.itemType === 'amenity') duplicateAmenity(contextMenu.item);
                  else if (contextMenu.itemType === 'label') duplicateLabel(contextMenu.item);
                }}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50"
                onClick={() => {
                  if (contextMenu.itemType === 'road') deleteRoad(contextMenu.item.id);
                  else if (contextMenu.itemType === 'zone') deleteZone(contextMenu.item.id);
                  else if (contextMenu.itemType === 'amenity') deleteAmenity(contextMenu.item.id);
                  else if (contextMenu.itemType === 'label') deleteLabel(contextMenu.item.id);
                  closeContextMenu();
                }}
              >
                Delete
              </button>
            </>
          ) : (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50"
              onClick={() => {
                const deletedIds = meta.deleted_osm_road_ids || [];
                setMeta({
                  deleted_osm_road_ids: [...deletedIds, contextMenu.item.id]
                });
                closeContextMenu();
              }}
            >
              Remove Road
            </button>
          )}
        </div>
      )}
    </div>
  );
}
