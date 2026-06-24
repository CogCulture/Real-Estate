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

const getDistancePtToSeg = (x, y, x1, y1, x2, y2) => {
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

const doSegmentsIntersect = (p1, p2, q1, q2) => {
  const det = (p2[0] - p1[0]) * (q2[1] - q1[1]) - (p2[1] - p1[1]) * (q2[0] - q1[0]);
  if (det === 0) return false;
  const lambda = ((q2[1] - q1[1]) * (q2[0] - p1[0]) + (q1[0] - q2[0]) * (q2[1] - p1[1])) / det;
  const gamma = ((p1[1] - p2[1]) * (q2[0] - p1[0]) + (p2[0] - p1[0]) * (q2[1] - p1[1])) / det;
  return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
};

const getSharpInset = (pts, offsetM) => {
  if (pts.length < 3) return pts;
  let workPts = [...pts];
  const isClosed = Math.abs(pts[0].x - pts[pts.length-1].x) < 0.1 && Math.abs(pts[0].y - pts[pts.length-1].y) < 0.1;
  if (isClosed) workPts.pop();

  let area = 0;
  for (let i = 0; i < workPts.length; i++) {
    const p1 = workPts[i];
    const p2 = workPts[(i + 1) % workPts.length];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  const isCW = area > 0;

  const insetPts = [];
  for (let i = 0; i < workPts.length; i++) {
    const prev = workPts[(i - 1 + workPts.length) % workPts.length];
    const curr = workPts[i];
    const next = workPts[(i + 1) % workPts.length];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.hypot(dx1, dy1);
    const nx1 = isCW ? dy1/len1 : -dy1/len1;
    const ny1 = isCW ? -dx1/len1 : dx1/len1;

    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.hypot(dx2, dy2);
    const nx2 = isCW ? dy2/len2 : -dy2/len2;
    const ny2 = isCW ? -dx2/len2 : dx2/len2;

    let bx = nx1 + nx2;
    let by = ny1 + ny2;
    const blen = Math.hypot(bx, by);

    if (blen < 0.001) {
      insetPts.push({ x: curr.x + nx1 * offsetM, y: curr.y + ny1 * offsetM });
      continue;
    }

    bx /= blen;
    by /= blen;

    const dot = bx * nx1 + by * ny1;
    let length = offsetM / dot;
    const maxLen = Math.abs(offsetM) * 10;
    if (Math.abs(length) > maxLen) {
       length = maxLen * Math.sign(length);
    }

    insetPts.push({ x: curr.x + bx * length, y: curr.y + by * length });
  }

  insetPts.push(insetPts[0]);
  return insetPts;
};

const isPointInPolygonPx = (pt, poly) => {
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

const getClippedZonePolygons = (zone, roads, scale) => {
  const DEG_TO_M = 111320; // 1 degree ≈ 111320 meters
  
  let zonePts = zone.points_m;
  if (!zonePts || zonePts.length < 3) {
    const x = zone.x_m;
    const y = zone.y_m;
    const w = zone.width_m;
    const h = zone.height_m;
    const pts = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h]
    ];
    if (zone.rotation_deg) {
      const rad = (zone.rotation_deg * Math.PI) / 180;
      const cx = x + w / 2;
      const cy = y + h / 2;
      zonePts = pts.map(p => {
        const dx = p[0] - cx;
        const dy = p[1] - cy;
        return [
          dx * Math.cos(rad) - dy * Math.sin(rad) + cx,
          dx * Math.sin(rad) + dy * Math.cos(rad) + cy
        ];
      });
    } else {
      zonePts = pts;
    }
  }

  // Ensure it's closed and converted to degrees
  const closedPts = zonePts.map(p => [p[0] / DEG_TO_M, p[1] / DEG_TO_M]);
  if (
    closedPts[0][0] !== closedPts[closedPts.length - 1][0] ||
    closedPts[0][1] !== closedPts[closedPts.length - 1][1]
  ) {
    closedPts.push([closedPts[0][0], closedPts[0][1]]);
  }

  try {
    let zonePoly = turf.polygon([closedPts]);

    roads.forEach(road => {
      if (!road.points_m || road.points_m.length < 2) return;
      
      try {
        const roadPtsNorm = road.points_m.map(p => [p[0] / DEG_TO_M, p[1] / DEG_TO_M]);
        const roadLine = turf.lineString(roadPtsNorm);
        
        // Buffer by half-width of the road in degrees
        const bufferDist = (road.width_m / 2) / DEG_TO_M;
        const roadPoly = turf.buffer(roadLine, bufferDist, { units: 'degrees' });
        
        if (roadPoly) {
          const diff = turf.difference(turf.featureCollection([zonePoly, roadPoly]));
          if (diff) {
            zonePoly = diff;
          }
        }
      } catch (err) {
        console.warn("Error clipping zone against road:", err);
      }
    });

    const polys = [];
    if (zonePoly.geometry.type === 'Polygon') {
      polys.push(zonePoly.geometry.coordinates);
    } else if (zonePoly.geometry.type === 'MultiPolygon') {
      zonePoly.geometry.coordinates.forEach(coords => {
        polys.push(coords);
      });
    }
    
    // Convert back to pixels
    return polys.map(polyCoords => {
      return polyCoords.map(ring => {
        return ring.map(pt => [pt[0] * DEG_TO_M * scale, pt[1] * DEG_TO_M * scale]);
      });
    });
  } catch (err) {
    console.warn("Failed to calculate turf difference:", err);
    // Return original zone points mapped to pixels
    const originalPx = zonePts.map(p => [p[0] * scale, p[1] * scale]);
    return [[originalPx]];
  }
};

const clipZoneGeometryAgainstRoads = (zonePointsM, roads) => {
  const DEG_TO_M = 111320;
  if (!zonePointsM || zonePointsM.length < 3) return zonePointsM;

  // Make sure it is closed and converted to degrees
  const closedPts = zonePointsM.map(p => [p[0] / DEG_TO_M, p[1] / DEG_TO_M]);
  if (
    closedPts[0][0] !== closedPts[closedPts.length - 1][0] ||
    closedPts[0][1] !== closedPts[closedPts.length - 1][1]
  ) {
    closedPts.push([closedPts[0][0], closedPts[0][1]]);
  }

  try {
    let zonePoly = turf.polygon([closedPts]);
    // Clean and rewind the polygon to ensure proper winding
    zonePoly = turf.rewind(zonePoly, { mutate: true });
    
    // Clean self-intersections
    const cleaned = turf.buffer(zonePoly, 0);
    if (cleaned) zonePoly = cleaned;

    roads.forEach(road => {
      if (!road.points_m || road.points_m.length < 2) return;
      
      try {
        const roadPtsNorm = road.points_m.map(p => [p[0] / DEG_TO_M, p[1] / DEG_TO_M]);
        const roadLine = turf.lineString(roadPtsNorm);
        
        // Buffer by half-width of the road + sidewalk in meters, converted to degrees
        const isMajor = road.type === 'primary' || road.type === 'ring_primary' || road.type === 'ring_secondary';
        const sidewalkM = isMajor ? 2.0 : 1.0;
        const totalBufferM = (road.width_m / 2) + sidewalkM;
        const bufferDist = totalBufferM / DEG_TO_M;
        
        let roadPoly = turf.buffer(roadLine, bufferDist, { units: 'degrees' });
        
        if (roadPoly) {
          roadPoly = turf.rewind(roadPoly, { mutate: true });
          const cleanedRoad = turf.buffer(roadPoly, 0);
          if (cleanedRoad) roadPoly = cleanedRoad;

          const diff = turf.difference(turf.featureCollection([zonePoly, roadPoly]));
          if (diff) {
            zonePoly = diff;
          }
        }
      } catch (err) {
        console.warn("Error clipping zone against road:", err);
      }
    });

    // Extract the largest polygon if it split into MultiPolygon
    let bestCoords = null;
    if (zonePoly.geometry.type === 'Polygon') {
      bestCoords = zonePoly.geometry.coordinates;
    } else if (zonePoly.geometry.type === 'MultiPolygon') {
      let maxArea = -1;
      zonePoly.geometry.coordinates.forEach(coords => {
        try {
          const area = turf.area(turf.polygon(coords));
          if (area > maxArea) {
            maxArea = area;
            bestCoords = coords;
          }
        } catch (e) {
          // ignore
        }
      });
    }

    if (!bestCoords || bestCoords.length === 0 || bestCoords[0].length < 3) {
      return zonePointsM;
    }

    // Convert outer ring back to meters and remove the duplicated closing point
    const outerRing = bestCoords[0];
    const resultM = outerRing.map(pt => [pt[0] * DEG_TO_M, pt[1] * DEG_TO_M]);
    if (resultM.length > 1) {
      const first = resultM[0];
      const last = resultM[resultM.length - 1];
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.0001) {
        resultM.pop();
      }
    }
    return resultM;
  } catch (err) {
    console.warn("Failed to calculate turf difference for physical cut:", err);
    return zonePointsM;
  }
};

const getClippedZonePoints = (zone, roads, scale) => {
  let zonePtsM = zone.points_m;
  if (!zonePtsM || zonePtsM.length < 3) {
    const x = zone.x_m;
    const y = zone.y_m;
    const w = zone.width_m;
    const h = zone.height_m;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const pts = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h]
    ];
    if (zone.rotation_deg) {
      const rad = (zone.rotation_deg * Math.PI) / 180;
      zonePtsM = pts.map(p => {
        const dx = p[0] - cx;
        const dy = p[1] - cy;
        return [
          dx * Math.cos(rad) - dy * Math.sin(rad) + cx,
          dx * Math.sin(rad) + dy * Math.cos(rad) + cy
        ];
      });
    } else {
      zonePtsM = pts;
    }
  }

  const clippedPtsM = clipZoneGeometryAgainstRoads(zonePtsM, roads);
  return clippedPtsM.map(p => [p[0] * scale, p[1] * scale]);
};


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
    shiftAllElements,
    selectedCluster,
    setSelectedCluster
  } = useLayoutStore();

  const { currentProject } = useProjectStore();

  const filteredRoads = useMemo(() => {
    if (!roads) return [];
    const entryGates = amenities ? amenities.filter(a => a.type === 'entry_exit') : [];
    const nonBoundaryRoads = roads.filter(r => !r.label || !r.label.toLowerCase().includes('boundary'));

    return roads.filter(road => {
      const isBoundary = road.label && road.label.toLowerCase().includes('boundary');
      if (!isBoundary) return true;

      // 1. Check if near any entry gate
      for (const gate of entryGates) {
        const gateCx = gate.x_px + gate.width_px / 2;
        const gateCy = gate.y_px + gate.height_px / 2;
        const gateSize = Math.max(gate.width_px, gate.height_px);
        
        const pts = road.points_px || [];
        if (pts.length >= 2) {
          const d = getDistancePtToSeg(gateCx, gateCy, pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
          if (d < gateSize * 1.1) {
            return false;
          }
        }
      }

      // 2. Check if boundary pedestrian path is crossed by a non-boundary road
      const isPath = road.label && road.label.toLowerCase().includes('path');
      if (isPath) {
        const pts = road.points_px || [];
        if (pts.length >= 2) {
          for (const nbRoad of nonBoundaryRoads) {
            const nbPts = nbRoad.points_px || [];
            for (let i = 0; i < nbPts.length - 1; i++) {
              if (doSegmentsIntersect(pts[0], pts[1], nbPts[i], nbPts[i+1])) {
                return false;
              }
              const d1 = getDistancePtToSeg(nbPts[i][0], nbPts[i][1], pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
              const d2 = getDistancePtToSeg(nbPts[i+1][0], nbPts[i+1][1], pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
              const threshold = (nbRoad.width_px || 20) / 2 + 5;
              if (d1 < threshold || d2 < threshold) {
                return false;
              }
            }
          }
        }
      }

      return true;
    });
  }, [roads, amenities]);

  const filteredAmenities = useMemo(() => {
    if (!amenities) return [];
    const entryGates = amenities.filter(a => a.type === 'entry_exit');
    const nonBoundaryRoads = roads ? roads.filter(r => !r.label || !r.label.toLowerCase().includes('boundary')) : [];

    return amenities.filter(amenity => {
      const isBoundaryTree = amenity.id && (amenity.id.startsWith('tree_') || amenity.type === 'tree_cluster') && 
                             (amenity.id.includes('tree_') && amenity.id.split('_').length > 2);

      if (!isBoundaryTree) return true;

      const treeCx = amenity.x_px + amenity.width_px / 2;
      const treeCy = amenity.y_px + amenity.height_px / 2;

      // 1. Check if near any entry gate
      for (const gate of entryGates) {
        const gateCx = gate.x_px + gate.width_px / 2;
        const gateCy = gate.y_px + gate.height_px / 2;
        const gateSize = Math.max(gate.width_px, gate.height_px);
        const dist = Math.hypot(treeCx - gateCx, treeCy - gateCy);
        if (dist < gateSize * 1.3) {
          return false;
        }
      }

      // 2. Check if near any non-boundary road
      for (const nbRoad of nonBoundaryRoads) {
        const nbPts = nbRoad.points_px || [];
        const roadWidth = nbRoad.width_px || 20;
        const threshold = roadWidth / 2 + 18;
        for (let i = 0; i < nbPts.length - 1; i++) {
          const d = getDistancePtToSeg(treeCx, treeCy, nbPts[i][0], nbPts[i][1], nbPts[i+1][0], nbPts[i+1][1]);
          if (d < threshold) {
            return false;
          }
        }
      }

      return true;
    });
  }, [amenities, roads]);


  const scale = meta.scale_px_per_m || 2.4;
  const gridUnit = scale; // 1 meter = scale pixels
  const transformerRef = useRef(null);
  const stageRef = useRef(null);
  const draggedClusterNodesRef = useRef(null);
  const canvasRef = useRef(null);
  const contextMenuRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapWrapperRef = useRef(null);

  const rotationStartPointsRef = useRef([]);
  const rotationCenterRef = useRef({ x: 0, y: 0 });
  const rotationStartAngleRef = useRef(0);
  const clipboardRef = useRef(null); // { itemType, item }

  const legendMapping = useMemo(() => {
    if (!meta.showNumberLegend) return [];
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
  }, [zones, amenities, meta.showNumberLegend]);

  const getLegendNumber = (label) => {
    if (!label) return null;
    const match = legendMapping.find(l => l.label === label.toUpperCase());
    return match ? match.number : null;
  };

  const clippedZonesPoints = useMemo(() => {
    const map = {};
    zones.forEach(zone => {
      map[zone.id] = getClippedZonePoints(zone, roads, scale);
    });
    return map;
  }, [zones, roads, scale]);

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

  const generateShapePoints = (shape, cx, cy, w, h) => {
    const pts = [];
    const isCurved = ['organic', 'fluid_organic', 'serpentine_wave', 'crescent', 'bowtie_geometric', 'circular', 'oval'].includes(shape);
    const steps = isCurved ? 80 : 36;
    if (shape === 'triangular') {
      return [
        [cx, cy - h / 2],
        [cx + w / 2, cy + h / 2],
        [cx - w / 2, cy + h / 2]
      ];
    } else if (shape === 'circular') {
      const radius = w / 2;
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        pts.push([
          cx + Math.cos(angle) * radius,
          cy + Math.sin(angle) * radius
        ]);
      }
      return pts;
    } else if (shape === 'oval') {
      const rx = w / 2;
      const ry = h / 2;
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        pts.push([
          cx + Math.cos(angle) * rx,
          cy + Math.sin(angle) * ry
        ]);
      }
      return pts;
    } else if (shape === 'organic') {
      // High-quality fluid organic curve
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const r = 0.45 * (1 + 0.16 * Math.sin(2 * angle) + 0.08 * Math.cos(3 * angle));
        pts.push([
          cx + Math.cos(angle) * r * w,
          cy + Math.sin(angle) * r * h
        ]);
      }
      return pts;
    } else if (shape === 'fluid_organic') {
      // High-quality flowing fluid curves
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const r = 0.45 * (1 + 0.22 * Math.sin(2 * angle) + 0.14 * Math.sin(3 * angle) + 0.06 * Math.cos(5 * angle));
        pts.push([
          cx + Math.cos(angle) * r * w,
          cy + Math.sin(angle) * r * h
        ]);
      }
      return pts;
    } else if (shape === 'serpentine_wave') {
      // Elegant serpentine path / s-curve
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const r = 0.42 * (1 + 0.24 * Math.sin(2 * angle) + 0.16 * Math.sin(angle));
        pts.push([
          cx + Math.cos(angle) * r * w,
          cy + Math.sin(angle) * r * h * 0.75
        ]);
      }
      return pts;
    } else if (shape === 'crescent') {
      // Crescent moon shape
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const r = 0.45 * (1 + 0.3 * Math.cos(angle) * (Math.sin(angle) > 0 ? 0.95 : -0.2));
        pts.push([
          cx + Math.cos(angle) * r * w,
          cy + Math.sin(angle) * r * h
        ]);
      }
      return pts;
    } else if (shape === 'bowtie_geometric') {
      // Hourglass/bowtie design
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const r = 0.45 * (0.8 + 0.35 * Math.abs(Math.cos(angle)));
        pts.push([
          cx + Math.cos(angle) * r * w,
          cy + Math.sin(angle) * r * h
        ]);
      }
      return pts;
    } else if (shape === 'rounded_parallelogram') {
      // Modern angled parallelogram with interpolation
      const skew = 0.28;
      const halfW = w / 2;
      const halfH = h / 2;
      const basePts = [
        [cx - halfW + halfH * skew, cy - halfH],
        [cx + halfW + halfH * skew, cy - halfH],
        [cx + halfW - halfH * skew, cy + halfH],
        [cx - halfW - halfH * skew, cy + halfH],
      ];
      const roundedPts = [];
      const numPts = 12;
      for (let side = 0; side < 4; side++) {
        const p1 = basePts[side];
        const p2 = basePts[(side + 1) % 4];
        for (let j = 0; j < numPts; j++) {
          const t = j / numPts;
          const xt = p1[0] + (p2[0] - p1[0]) * t;
          const yt = p1[1] + (p2[1] - p1[1]) * t;
          roundedPts.push([xt, yt]);
        }
      }
      return roundedPts;
    } else if (shape === 'pebble') {
      // Smooth pebble shape
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const r = 0.45 * (1 + 0.08 * Math.sin(3 * angle) + 0.05 * Math.cos(2 * angle));
        pts.push([
          cx + Math.cos(angle) * r * w,
          cy + Math.sin(angle) * r * h
        ]);
      }
      return pts;
    } else if (shape === 'kidney') {
      // Smooth kidney bean shape
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const r = 0.45 * (1 - 0.22 * Math.sin(angle) * (Math.cos(angle) > 0 ? 1 : 0));
        pts.push([
          cx + Math.cos(angle) * r * w,
          cy + Math.sin(angle) * r * h
        ]);
      }
      return pts;
    } else if (shape === 'teardrop') {
      // Smooth teardrop shape
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const r = 0.42 * (1 - Math.sin(angle / 2));
        pts.push([
          cx + Math.cos(angle) * r * w,
          cy + Math.sin(angle) * r * h * 0.8
        ]);
      }
      return pts;
    } else if (shape === 'courtyard_curved') {
      // Curved wave/C-shape
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const r = 0.48 * (1 - 0.35 * Math.cos(angle) * Math.cos(angle) * (Math.sin(angle) > 0 ? 1 : 0.2));
        pts.push([
          cx + Math.cos(angle) * r * w,
          cy + Math.sin(angle) * r * h
        ]);
      }
      return pts;
    } else if (shape === 'rectangular') {
      return [
        [cx - w / 2, cy - h / 2],
        [cx + w / 2, cy - h / 2],
        [cx + w / 2, cy + h / 2],
        [cx - w / 2, cy + h / 2]
      ];
    } else if (shape === 'l_shape') {
      return [
        [cx - w / 2, cy - h / 2],
        [cx, cy - h / 2],
        [cx, cy + h / 6],
        [cx + w / 2, cy + h / 6],
        [cx + w / 2, cy + h / 2],
        [cx - w / 2, cy + h / 2]
      ];
    }
    return [];
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
      variant: 'warm',
      footprint: 'cruciform',
      color: '#4A90D9'
    },
    building_commercial: {
      type: 'commercial',
      label: 'Commercial Block',
      widthM: 26,
      heightM: 16,
      floors: 9,
      variant: 'glass',
      footprint: 'h_shaped',
      color: '#F5A623'
    },
    building_mixed_use: {
      type: 'mixed_use',
      label: 'Mixed Use Block',
      widthM: 24,
      heightM: 18,
      floors: 8,
      variant: 'modern',
      footprint: 'u_shaped',
      color: '#9B59B6'
    },
    building_institutional: {
      type: 'institutional',
      label: 'Institutional Block',
      widthM: 22,
      heightM: 16,
      floors: 4,
      variant: 'modern',
      footprint: 'courtyard',
      color: '#F39C12'
    },
    building_industrial: {
      type: 'industrial',
      label: 'Industrial Block',
      widthM: 30,
      heightM: 20,
      floors: 3,
      variant: 'warm',
      footprint: 'rectangular',
      color: '#95A5A6'
    },
    building_minimal: {
      type: 'amenity',
      label: 'Minimal Block',
      widthM: 20,
      heightM: 14,
      floors: 2,
      variant: 'modern',
      footprint: 'rectangular',
      color: '#E74C3C'
    },
    building_clubhouse: {
      type: 'amenity',
      label: 'Clubhouse',
      widthM: 25,
      heightM: 18,
      floors: 2,
      variant: 'modern',
      footprint: 'courtyard',
      color: '#E74C3C'
    },
    building_school: {
      type: 'institutional',
      label: 'School Block',
      widthM: 32,
      heightM: 20,
      floors: 3,
      variant: 'modern',
      footprint: 'h_shaped',
      color: '#F39C12'
    },
    building_hospital: {
      type: 'institutional',
      label: 'Healthcare Block',
      widthM: 28,
      heightM: 18,
      floors: 4,
      variant: 'modern',
      footprint: 'cruciform',
      color: '#F39C12'
    },
    building_retail: {
      type: 'commercial',
      label: 'Retail Block',
      widthM: 24,
      heightM: 15,
      floors: 2,
      variant: 'modern',
      footprint: 'u_shaped',
      color: '#F5A623'
    },
    building_parking_structure: {
      type: 'parking',
      label: 'Parking Structure',
      widthM: 30,
      heightM: 22,
      floors: 4,
      variant: 'minimal',
      footprint: 'rectangular',
      color: '#BDC3C7'
    },
    building_hotel: {
      type: 'commercial',
      label: 'Hotel & Resort',
      widthM: 30,
      heightM: 20,
      floors: 6,
      variant: 'glass',
      footprint: 'u_shaped',
      color: '#F5A623'
    },
    building_sports_arena: {
      type: 'amenity',
      label: 'Sports Arena',
      widthM: 40,
      heightM: 30,
      floors: 3,
      variant: 'modern',
      footprint: 'oval',
      color: '#E74C3C'
    },
    building_cultural: {
      type: 'institutional',
      label: 'Cultural Center',
      widthM: 35,
      heightM: 25,
      floors: 3,
      variant: 'modern',
      footprint: 'circular',
      color: '#F39C12'
    },
    building_civic: {
      type: 'institutional',
      label: 'Civic Center',
      widthM: 25,
      heightM: 20,
      floors: 4,
      variant: 'modern',
      footprint: 'l_shaped',
      color: '#F39C12'
    },
    building_warehouse: {
      type: 'industrial',
      label: 'Logistics / Warehouse',
      widthM: 45,
      heightM: 25,
      floors: 1,
      variant: 'warm',
      footprint: 'rectangular',
      color: '#95A5A6'
    },
    building_transport_hub: {
      type: 'institutional',
      label: 'Transit Hub',
      widthM: 30,
      heightM: 25,
      floors: 2,
      variant: 'glass',
      footprint: 'rectangular',
      color: '#9B59B6'
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

    if (!amenity) return null;
    if (amenity.type === 'pool' || amenity.label?.toLowerCase().includes('pool')) {
      return null; // Force pool to use vector shapes instead of an image
    }
    if (amenity.type === 'sports' || amenity.label?.toLowerCase().includes('tennis')) return 'tennisCourtTopdown';
    if (amenity.type === 'kids' || amenity.type === 'playground') return 'kidsPlaygroundTopdown';
    if (amenity.type === 'central_lawn' || amenity.type === 'event_lawn') return 'centralLawnTopdown';
    // Parks, lawns, and gardens bypass cutout drawing to render custom patterns
    if (
      amenity.type === 'garden' ||
      amenity.type === 'park' ||
      amenity.type === 'lawn' ||
      amenity.type === 'green' ||
      amenity.label?.toLowerCase().includes('flower') ||
      amenity.label?.toLowerCase().includes('park') ||
      amenity.label?.toLowerCase().includes('garden')
    ) return null;
    if (amenity.type === 'clubhouse') return 'clubhouseTopdown';
    return null;
  };

  const getAccessTextureKey = (variant) => {
    if (variant === 'access_large' || variant === 'access_multi') return 'gateGrand';
    if (variant === 'access_modern') return 'gateModern';
    return 'gateMinimal';
  };

  const resetCursor = (stage) => {
    if (!stage) return;
    const container = stage.container();
    if (!container) return;
    if (meta.treeBrushActive) {
      container.style.cursor = 'url("data:image/svg+xml;utf8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23064e3b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M14 2h-4v2h8V4a2 2 0 0 0-2-2z\'/%3E%3Cpath d=\'M7 6v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6z\'/%3E%3Cpath d=\'M9 12h.01M15 12h.01M12 15h.01M12 9h.01\'/%3E%3C/svg>") 12 12, crosshair';
    } else if (activeTool === 'CLUSTER_SELECT') {
      container.style.cursor = 'crosshair';
    } else if (activeTool === 'HAND') {
      container.style.cursor = 'grab';
    } else if (['LINE', 'CONNECTOR', 'RING', 'SQUARE'].includes(activeTool)) {
      container.style.cursor = 'crosshair';
    } else {
      container.style.cursor = 'default';
    }
  };

  useEffect(() => {
    if (stageRef.current) {
      resetCursor(stageRef.current);
    }
  }, [activeTool, meta.treeBrushActive]);

  // Asset/Texture Cache State
  const [assets, setAssets] = useState(null);
  const [stonePattern, setStonePattern] = useState(null);
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

  useEffect(() => {
    if (assets?.stoneTile) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const createPattern = () => {
        try {
          const pattern = ctx.createPattern(assets.stoneTile, 'repeat');
          setStonePattern(pattern);
        } catch (e) {
          console.error("Failed to create stone pattern:", e);
        }
      };

      if (assets.stoneTile.complete) {
        createPattern();
      } else {
        assets.stoneTile.onload = createPattern;
      }
    }
  }, [assets]);

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
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedElementId) return;
        // Delete the currently selected item
        if (zones.some(z => z.id === selectedElementId)) {
          useLayoutStore.getState().deleteZone(selectedElementId);
        } else if (roads.some(r => r.id === selectedElementId)) {
          useLayoutStore.getState().deleteRoad(selectedElementId);
        } else if (amenities.some(a => a.id === selectedElementId)) {
          useLayoutStore.getState().deleteAmenity(selectedElementId);
        } else {
          // might be a label or something else, but we don't have deleteLabel exposed from store directly here unless we use getState
          const state = useLayoutStore.getState();
          if (state.labels && state.labels.some(l => l.id === selectedElementId)) {
            if (state.deleteLabel) state.deleteLabel(selectedElementId);
          }
        }
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

          const padX = width * 2;
          const padY = height * 2;
          const containerWidth = width * 5;
          const containerHeight = height * 5;

          const mapMinLng = minLng - padX / (111320 * Math.cos(centerLat * Math.PI / 180) * scale);
          const mapMaxLat = maxLat + padY / (111320 * scale);
          
          const mapLngMax = mapMinLng + containerWidth / (111320 * Math.cos(centerLat * Math.PI / 180) * scale);
          const mapLatMin = mapMaxLat - containerHeight / (111320 * scale);

          bounds = [
            [mapLatMin, mapMinLng],
            [mapMaxLat, mapLngMax]
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
  const [boundaryPreviews, setBoundaryPreviews] = useState([]);

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

  // Unified Boundary Layer Generation (Preview and Reserve)
  useEffect(() => {
    const isPointInPolygon = (p, polygon) => {
      const x = p.x, y = p.y;
      let inside = false;
      const n = polygon.length;
      const isClosed = Math.abs(polygon[0].x - polygon[n-1].x) < 0.1 && Math.abs(polygon[0].y - polygon[n-1].y) < 0.1;
      const len = isClosed ? n - 1 : n;
      for (let i = 0, j = len - 1; i < len; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };

    const calculateBoundaryLayers = (layersArr) => {
      if (!currentProject || !currentProject.boundary_geojson) return [];
      try {
        const geojson = JSON.parse(currentProject.boundary_geojson);
        if (!geojson || !geojson.geometry || !geojson.geometry.coordinates) return [];
        
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

        const results = [];
        let accumulatedOffsetM = 0; // Start flush with boundary

        for (const type of layersArr) {
          let widthM = 0;
          if (type === 'road') widthM = 6; // Standard primary road
          else if (type === 'trees') widthM = 4.2;
          else if (type === 'path') widthM = 2; // Standard pedestrian path

          const centerOffsetM = accumulatedOffsetM + (widthM / 2);
          
          let insetM = getSharpInset(ptsM, -centerOffsetM); // Negative to push inwards
          
          // Verify if the inset points actually lie inside the original polygon.
          // If not, it means the offset pushed them outwards due to winding order.
          // Flip the offset sign to force it inwards.
          if (insetM.length > 0 && !isPointInPolygon(insetM[0], ptsM)) {
            insetM = getSharpInset(ptsM, centerOffsetM);
          }

          // Apply land offsets directly to ptsM so coordinates in meters include the offset
          const insetPtsM = insetM.map(p => [
            p.x + (meta.land_offset_x_m || 0),
            p.y + (meta.land_offset_y_m || 0)
          ]);
          
          // Calculate px points for rendering by scaling the offsetted meter coordinates
          const insetPtsPx = insetPtsM.map(p => [
            p[0] * scale,
            p[1] * scale
          ]);

          results.push({ type, widthM, centerOffsetM, insetPtsM, insetPtsPx });
          accumulatedOffsetM += widthM;
        }
        return results;
      } catch(err) {
        console.error(err);
        return [];
      }
    };

    const handlePreview = (e) => {
      const { layers } = e.detail;
      if (!layers || layers.length === 0) {
        setBoundaryPreviews([]);
        return;
      }
      setBoundaryPreviews(calculateBoundaryLayers(layers));
    };

    const handleReserve = (e) => {
      const { layers } = e.detail;
      const geometries = calculateBoundaryLayers(layers);
      
      const newRoads = [];
      const newAmenities = [];
      
      geometries.forEach(geom => {
        if (geom.type === 'road' || geom.type === 'path') {
          const isRoad = geom.type === 'road';
          const roadType = isRoad ? 'primary' : 'pedestrian';
          const roadColor = ROAD_COLORS[roadType] || (isRoad ? '#34495E' : '#e7e5e4');
          
          const ptsPx = geom.insetPtsPx;
          const ptsM = geom.insetPtsM;
          
          // Break the boundary road into small individual selectable segments
          for (let i = 0; i < ptsPx.length - 1; i++) {
            const segmentPx = [ptsPx[i], ptsPx[i + 1]];
            const segmentM = [ptsM[i], ptsM[i + 1]];
            
            const distPx = Math.hypot(segmentPx[1][0] - segmentPx[0][0], segmentPx[1][1] - segmentPx[0][1]);
            if (distPx < 1) continue;

            newRoads.push({
              id: `road_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
              type: roadType,
              label: isRoad ? `Boundary Road Segment` : `Boundary Path Segment`,
              width_m: geom.widthM,
              width_px: geom.widthM * scale,
              closed: false,
              points_px: segmentPx,
              points_m: segmentM,
              color: roadColor,
              sharp_corners: true,
              tension: 0,
              has_median: isRoad,
              median_width_m: isRoad ? 2 : 0
            });
          }
        } else if (geom.type === 'trees') {
          const intervalPx = 15 * scale;
          let leftOver = 0;
          const pts = geom.insetPtsPx;
          const loopPts = [...pts, pts[0]]; // close the loop
          
          for (let i = 0; i < loopPts.length - 1; i++) {
            const p1 = loopPts[i];
            const p2 = loopPts[i + 1];
            const dx = p2[0] - p1[0];
            const dy = p2[1] - p1[1];
            const segLen = Math.sqrt(dx * dx + dy * dy);
            let dist = intervalPx - leftOver;

            while (dist <= segLen) {
              const ratio = dist / segLen;
              const x = p1[0] + dx * ratio;
              const y = p1[1] + dy * ratio;
              
              const sizeM = 4.2;
              const sizePx = sizeM * scale;
              newAmenities.push({
                id: `tree_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
                type: 'tree_cluster',
                x_px: x - sizePx / 2,
                y_px: y - sizePx / 2,
                width_px: sizePx,
                height_px: sizePx,
                x_m: pxToM(x - sizePx / 2, scale),
                y_m: pxToM(y - sizePx / 2, scale),
                width_m: sizeM,
                height_m: sizeM,
                rotation: Math.random() * 360,
                density: 'high'
              });
              dist += intervalPx;
            }
            leftOver = segLen - (dist - intervalPx);
          }
        }
      });
      
      useLayoutStore.getState().reserveBoundaries(newRoads, newAmenities, layers);
      setBoundaryPreviews([]);
    };

    const handleClearPrior = () => {
      setBoundaryPreviews([]); // Force clear any stuck previews
      useLayoutStore.getState().clearBoundaries();
    };

    window.addEventListener('previewBoundaryLayers', handlePreview);
    window.addEventListener('reserveBoundaryLayers', handleReserve);
    window.addEventListener('clearOldBoundaries', handleClearPrior);
    return () => {
      window.removeEventListener('previewBoundaryLayers', handlePreview);
      window.removeEventListener('reserveBoundaryLayers', handleReserve);
      window.removeEventListener('clearOldBoundaries', handleClearPrior);
    };
  }, [currentProject, scale, meta.land_offset_x_m, meta.land_offset_y_m, addRoad, addAmenity]);

  // Handle clearing public road map connections that fall inside the selected site map boundary
  useEffect(() => {
    const checkPointInPolygon = (pt, poly) => {
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

    const handleClearMapConnections = () => {
      if (osmRoads && osmRoads.length > 0 && boundaryPoints && boundaryPoints.length >= 6) {
        const poly = [];
        for (let i = 0; i < boundaryPoints.length; i += 2) {
          poly.push([boundaryPoints[i], boundaryPoints[i + 1]]);
        }

        const offsetX = (meta.land_offset_x_m || 0) * scale;
        const offsetY = (meta.land_offset_y_m || 0) * scale;

        const roadsToClear = osmRoads.filter(osmRoad => {
          if (!osmRoad.points) return false;
          return osmRoad.points.some(p => {
            const px = p[0] + offsetX;
            const py = p[1] + offsetY;
            return isPointInPolygonPx([px, py], poly);
          });
        });

        if (roadsToClear.length > 0) {
          const idsToClear = roadsToClear.map(r => r.id);
          const deletedIds = meta.deleted_osm_road_ids || [];
          const uniqueDeletedIds = Array.from(new Set([...deletedIds, ...idsToClear]));
          setMeta({
            deleted_osm_road_ids: uniqueDeletedIds
          });
        }
      }
    };

    window.addEventListener('clearMapConnections', handleClearMapConnections);
    return () => {
      window.removeEventListener('clearMapConnections', handleClearMapConnections);
    };
  }, [osmRoads, boundaryPoints, meta.deleted_osm_road_ids, meta.land_offset_x_m, meta.land_offset_y_m, scale, setMeta]);

  // Helper to handle canvas zoom relative to the cursor's last position
  const zoomStage = React.useCallback((zoomIn) => {
    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.15;
    const oldScale = stage.scaleX();
    
    // Get pointer position (falls back to stage center if cursor is not over the stage)
    let pointer = stage.getPointerPosition();
    if (!pointer) {
      pointer = { x: width / 2, y: height / 2 };
    }

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = zoomIn ? oldScale * scaleBy : oldScale / scaleBy;

    if (newScale < 0.1 || newScale > 10) return;

    const newX = pointer.x - mousePointTo.x * newScale;
    const newY = pointer.y - mousePointTo.y * newScale;

    setStageScale(newScale);
    setStagePos({ x: newX, y: newY });

    if (mapWrapperRef.current) {
      mapWrapperRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${newScale})`;
    }
  }, [width, height]);

  // Handle zoom in / zoom out events from viewport buttons
  useEffect(() => {
    const handleZoomIn = () => zoomStage(true);
    const handleZoomOut = () => zoomStage(false);

    window.addEventListener('zoomCanvasIn', handleZoomIn);
    window.addEventListener('zoomCanvasOut', handleZoomOut);
    return () => {
      window.removeEventListener('zoomCanvasIn', handleZoomIn);
      window.removeEventListener('zoomCanvasOut', handleZoomOut);
    };
  }, [zoomStage]);

  const [contextMenu, setContextMenu] = useState(null);
  // Dimension tooltip: { x, y, wM, hM } — shown while drawing or resizing
  const [dimTooltip, setDimTooltip] = useState(null);

  // Stage Pan and Zoom state
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const prevWidthRef = useRef(null);
  const dragCasingNodeRef = useRef(null);
  const transformCasingNodeRef = useRef(null);

  // Re-center canvas content horizontally when viewport width changes (sidebar open/close)
  useEffect(() => {
    if (prevWidthRef.current !== null && prevWidthRef.current !== width && width > 0) {
      const delta = (width - prevWidthRef.current) / 2;
      setStagePos(prev => ({ ...prev, x: prev.x + delta }));
    }
    prevWidthRef.current = width;
  }, [width]);

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
    let nextPointsPx = hasPoints ? offsetPoints(zone.points_px, dx, dy) : null;
    if (!nextPointsPx) {
      const x = zone.x_px + dx;
      const y = zone.y_px + dy;
      const w = zone.width_px;
      const h = zone.height_px;
      nextPointsPx = [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h]
      ];
    }
    const nextPointsM = nextPointsPx.map((p) => [pxToM(p[0], scale), pxToM(p[1], scale)]);
    const bbox = getPolygonBoundingBox(nextPointsPx);
    const clippedPointsM = clipZoneGeometryAgainstRoads(nextPointsM, roads);
    const areaSqm = calculatePolygonArea(clippedPointsM);

    addZone({
      ...zone,
      id: nextId,
      label: `${zone.label || 'Zone'} Copy`,
      x_px: bbox.minX,
      y_px: bbox.minY,
      width_px: bbox.width,
      height_px: bbox.height,
      x_m: pxToM(bbox.minX, scale),
      y_m: pxToM(bbox.minY, scale),
      width_m: pxToM(bbox.width, scale),
      height_m: pxToM(bbox.height, scale),
      points_px: nextPointsPx,
      points_m: nextPointsM,
      properties: {
        ...zone.properties,
        plot_size_sqm: areaSqm
      }
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
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;

    // Handle decoration drop
    if (dragType?.startsWith('decoration_')) {
      const variant = dragType.split('_')[1];
      const widthM = variant === 'roundabout' ? 24 : 16;
      const heightM = variant === 'roundabout' ? 24 : 16;
      const widthPx = widthM * scale;
      const heightPx = heightM * scale;
      const snappedX = snapValue(pos.x);
      const snappedYVal = snapValue(pos.y);
      
      const newAmenity = {
        id: `amenity_${Date.now()}`,
        type: 'decoration',
        label: variant === 'roundabout' ? 'Grand Roundabout' : 'Fountain Plaza',
        x_px: snappedX - widthPx / 2,
        y_px: snappedYVal - heightPx / 2,
        width_px: widthPx,
        height_px: heightPx,
        x_m: pxToM(snappedX - widthPx / 2, scale),
        y_m: pxToM(snappedYVal - heightPx / 2, scale),
        width_m: widthM,
        height_m: heightM,
        shape: 'ellipse',
        properties: {
          variant: variant
        }
      };
      
      addAmenity(newAmenity);
      setSelectedElementId(newAmenity.id);
      setActiveTool('SELECT');
      return;
    }

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
      
      setMeta({ activePlacementCategory: 'tree', activePlacementVariant: dragType, treeBrushActive: true });
      lastPaintedTreePosRef.current = { x: snappedX, y: snappedY };
      setSelectedElementId(null);
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

    if (dragType?.startsWith('lawn_') || dragType?.startsWith('pool_')) {
      const isPool = dragType.startsWith('pool_');
      const shapeType = dragType.split('_')[1];
      const typeStr = isPool ? 'pool' : 'lawn';
      
      const widthM = 15;
      const heightM = 10;
      const widthPx = widthM * scale;
      const heightPx = heightM * scale;
      const snappedX = snapValue(pos.x);
      const snappedY = snapValue(pos.y);
      
      const ptsPx = generateShapePoints(shapeType, snappedX, snappedY, widthPx, heightPx);
      const newAmenity = {
        id: `amenity_${Date.now()}`,
        type: typeStr,
        label: isPool ? 'Swimming Pool' : 'Lawn / Park',
        x_px: snappedX - widthPx / 2,
        y_px: snappedY - heightPx / 2,
        width_px: widthPx,
        height_px: heightPx,
        x_m: pxToM(snappedX - widthPx / 2, scale),
        y_m: pxToM(snappedY - heightPx / 2, scale),
        width_m: widthM,
        height_m: heightM,
        points_px: ptsPx,
        points_m: ptsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]),
        shape: shapeType
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
      const initialPointsM = pointsPx.map((p) => [pxToM(p[0], scale), pxToM(p[1], scale)]);
      const clippedPointsM = clipZoneGeometryAgainstRoads(initialPointsM, roads);
      const areaSqm = calculatePolygonArea(clippedPointsM);

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
        points_px: null,
        points_m: null,
        color: building.color || ZONE_COLORS[building.type] || '#9B59B6',
        opacity: 0.88,
        floors: building.floors,
        building_variant: building.variant,
        footprint: meta.activePlacementFootprint || building.footprint || 'rectangular',
        rotation_deg: 0,
        properties: {
          plot_size_sqm: areaSqm
        }
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
      const sizePxMap = { lg: 22, md: 15, sm: 10 };
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
              context.ellipse(tree.x + px * 0.1, tree.y + px * 0.12, px * 0.3, px * 0.15, 0, 0, Math.PI * 2);
              context.fill();
              context.restore();

              context.save();
              context.beginPath();
              context.arc(tree.x, tree.y, px * 0.28, 0, Math.PI * 2);
              context.clip();
              drawImageContain(context, img, tree.x - px / 2, tree.y - px / 2, px, px);
              context.restore();
            }}
          />
        );
      }

      // Circle fallback when assets not yet loaded
      const r = px * 0.3;
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
  const [paintedTreePaths, setPaintedTreePaths] = useState([]);
  const lastPaintedTreePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handlePlacePaintedTrees = () => {
      const variant = useLayoutStore.getState().meta.activePlacementVariant || 'tree_single';
      const sizeM = variant === 'tree_row' ? 2.2 : variant === 'tree_cluster' ? 2.0 : 1.6;
      const threshold = sizeM * scale * 2.5; 
      const sizePx = sizeM * scale;

      paintedTreePaths.forEach(path => {
        if (path.length === 0) return;
        
        let lastPlaced = path[0];
        useLayoutStore.getState().addAmenity({
          id: `amenity_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          type: 'tree',
          label: variant === 'tree_row' ? 'Tree Row' : variant === 'tree_cluster' ? 'Tree Cluster' : 'Tree',
          x_px: snapValue(lastPlaced.x) - sizePx / 2,
          y_px: snapValue(lastPlaced.y) - sizePx / 2,
          width_px: sizePx,
          height_px: sizePx,
          x_m: pxToM(snapValue(lastPlaced.x) - sizePx / 2, scale),
          y_m: pxToM(snapValue(lastPlaced.y) - sizePx / 2, scale),
          width_m: sizeM,
          height_m: sizeM,
          tree_variant: variant
        });

        for (let i = 1; i < path.length; i++) {
          const pt = path[i];
          const dist = Math.sqrt((pt.x - lastPlaced.x)**2 + (pt.y - lastPlaced.y)**2);
          if (dist >= threshold) {
            useLayoutStore.getState().addAmenity({
              id: `amenity_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              type: 'tree',
              label: variant === 'tree_row' ? 'Tree Row' : variant === 'tree_cluster' ? 'Tree Cluster' : 'Tree',
              x_px: snapValue(pt.x) - sizePx / 2,
              y_px: snapValue(pt.y) - sizePx / 2,
              width_px: sizePx,
              height_px: sizePx,
              x_m: pxToM(snapValue(pt.x) - sizePx / 2, scale),
              y_m: pxToM(snapValue(pt.y) - sizePx / 2, scale),
              width_m: sizeM,
              height_m: sizeM,
              tree_variant: variant
            });
            lastPlaced = pt;
          }
        }
      });
      
      setPaintedTreePaths([]);
    };

    window.addEventListener('place-painted-trees', handlePlacePaintedTrees);
    return () => window.removeEventListener('place-painted-trees', handlePlacePaintedTrees);
  }, [paintedTreePaths, scale, snapValue, pxToM]);

  const paintTreeAt = (x, y) => {
    // legacy, replaced by batch placement
  };

  const handleClusterDragStart = (e, elementId) => {
    if (!selectedCluster) return;
    const isPart = 
      (selectedCluster.zoneIds && selectedCluster.zoneIds.includes(elementId)) ||
      (selectedCluster.roadIds && selectedCluster.roadIds.includes(elementId)) ||
      (selectedCluster.amenityIds && selectedCluster.amenityIds.includes(elementId)) ||
      (selectedCluster.labelIds && selectedCluster.labelIds.includes(elementId));

    if (!isPart) {
      setSelectedCluster(null);
      return;
    }

    e.cancelBubble = true;

    const stage = e.currentTarget.getStage();
    const otherNodes = [];
    const allClusterIds = [
      ...(selectedCluster.zoneIds || []),
      ...(selectedCluster.roadIds || []),
      ...(selectedCluster.amenityIds || []),
      ...(selectedCluster.labelIds || [])
    ];

    allClusterIds.forEach(id => {
      if (id !== elementId) {
        const node = stage.findOne('#' + id);
        if (node) {
          otherNodes.push(node);
        }
      }
    });

    draggedClusterNodesRef.current = otherNodes;
  };

  const handleClusterDragMove = (e, elementId) => {
    if (!selectedCluster || !draggedClusterNodesRef.current) return;
    e.cancelBubble = true;

    const dx = e.currentTarget.x();
    const dy = e.currentTarget.y();

    draggedClusterNodesRef.current.forEach(node => {
      node.x(dx);
      node.y(dy);
    });
  };

  const handleClusterDragEnd = (e, elementId) => {
    if (!selectedCluster) return;
    e.cancelBubble = true;

    const dx = e.currentTarget.x();
    const dy = e.currentTarget.y();

    e.currentTarget.x(0);
    e.currentTarget.y(0);

    if (draggedClusterNodesRef.current) {
      draggedClusterNodesRef.current.forEach(node => {
        node.x(0);
        node.y(0);
      });
    }
    draggedClusterNodesRef.current = null;

    if (dx !== 0 || dy !== 0) {
      useLayoutStore.getState().moveClusterElements(selectedCluster, dx, dy);
    }
  };

  // Handle click on canvas background for deselection
  const handleStageMouseDown = (e) => {
    closeContextMenu();
    const clickedOnEmpty = e.target === e.target.getStage();
    
    // Start tree painting on mousedown (drag-and-drop style)
    if (meta.activePlacementCategory === 'tree' && meta.treeBrushActive) {
      const pos = stageRef.current.getRelativePointerPosition();
      if (pos) {
        setIsPaintingTrees(true);
        setPaintedTreePaths(prev => [...prev, [{ x: pos.x, y: pos.y }]]);
      }
      return;
    }

    if (clickedOnEmpty || activeTool === 'CLUSTER_SELECT') {
      setSelectedElementId(null);
      if (activeTool === 'SQUARE') {
        // Start drawing zone
        const pos = stageRef.current.getRelativePointerPosition();
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
      } else if (activeTool === 'CLUSTER_SELECT') {
        // Start drawing selection box
        const pos = stageRef.current.getRelativePointerPosition();
        if (pos) {
          setDrawingRect({
            startX: pos.x,
            startY: pos.y,
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0
          });
        }
      }
    }
  };

  const handleStageMouseMove = () => {
    const pos = stageRef.current.getRelativePointerPosition();
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
      setPaintedTreePaths(prev => {
        const newPaths = [...prev];
        if (newPaths.length > 0) {
          const lastPath = newPaths[newPaths.length - 1];
          const lastPoint = lastPath[lastPath.length - 1];
          const dist = Math.sqrt((pos.x - lastPoint.x)**2 + (pos.y - lastPoint.y)**2);
          if (dist > 5) {
             lastPath.push({ x: pos.x, y: pos.y });
          }
        }
        return newPaths;
      });
      return;
    }
    
    if (drawingRect) {
      if (activeTool === 'CLUSTER_SELECT') {
        const startX = drawingRect.startX;
        const startY = drawingRect.startY;
        const newW = pos.x - startX;
        const newH = pos.y - startY;
        setDrawingRect({
          startX,
          startY,
          x: Math.min(pos.x, startX),
          y: Math.min(pos.y, startY),
          width: newW,
          height: newH
        });
      } else {
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
    }
  };

  const handleStageMouseUp = () => {
    if (isPaintingTrees) {
      setIsPaintingTrees(false);
      // Don't clear placement category — user can start painting again
      return;
    }

    if (drawingRect) {
      if (activeTool === 'CLUSTER_SELECT') {
        const normX = drawingRect.width < 0 ? drawingRect.x + drawingRect.width : drawingRect.x;
        const normY = drawingRect.height < 0 ? drawingRect.y + drawingRect.height : drawingRect.y;
        const normW = Math.abs(drawingRect.width);
        const normH = Math.abs(drawingRect.height);

        // Find elements inside the bounding box
        const selectedZoneIds = [];
        const selectedRoadIds = [];
        const selectedAmenityIds = [];
        const selectedLabelIds = [];

        // 1. Zones
        zones.forEach(z => {
          const originalPts = getZonePoints(z);
          const pts = clippedZonesPoints[z.id] || originalPts;
          if (pts && pts.length > 0) {
            const inside = pts.some(p => p[0] >= normX && p[0] <= normX + normW && p[1] >= normY && p[1] <= normY + normH);
            if (inside) selectedZoneIds.push(z.id);
          } else {
            const zcx = z.x_px + z.width_px / 2;
            const zcy = z.y_px + z.height_px / 2;
            if (zcx >= normX && zcx <= normX + normW && zcy >= normY && zcy <= normY + normH) {
              selectedZoneIds.push(z.id);
            }
          }
        });

        // 2. Roads
        roads.forEach(r => {
          const pts = r.points_px || [];
          if (pts.length > 0) {
            const inside = pts.some(p => p[0] >= normX && p[0] <= normX + normW && p[1] >= normY && p[1] <= normY + normH);
            if (inside) selectedRoadIds.push(r.id);
          }
        });

        // 3. Amenities
        amenities.forEach(a => {
          const ax = a.x_px;
          const ay = a.y_px;
          if (ax >= normX && ax <= normX + normW && ay >= normY && ay <= normY + normH) {
            selectedAmenityIds.push(a.id);
          }
        });

        // 4. Labels
        labels.forEach(l => {
          const lx = l.x_px;
          const ly = l.y_px;
          if (lx >= normX && lx <= normX + normW && ly >= normY && ly <= normY + normH) {
            selectedLabelIds.push(l.id);
          }
        });

        if (selectedZoneIds.length > 0 || selectedRoadIds.length > 0 || selectedAmenityIds.length > 0 || selectedLabelIds.length > 0) {
          setSelectedCluster({
            zoneIds: selectedZoneIds,
            roadIds: selectedRoadIds,
            amenityIds: selectedAmenityIds,
            labelIds: selectedLabelIds
          });
        } else {
          setSelectedCluster(null);
        }

        setDrawingRect(null);
        setActiveTool('SELECT');
        return;
      }

      // Finalize zone
      const snappedX = snapValue(drawingRect.x);
      const snappedY = snapValue(drawingRect.y);
      const snappedW = Math.max(gridUnit * 5, snapValue(drawingRect.width)); // Enforce min 5m
      const snappedH = Math.max(gridUnit * 5, snapValue(drawingRect.height));

      const type = 'residential';
      const labelText = `Residential Zone ${zones.filter(z => z.type === type).length + 1}`;

      const pointsPx = [
        [snappedX, snappedY],
        [snappedX + snappedW, snappedY],
        [snappedX + snappedW, snappedY + snappedH],
        [snappedX, snappedY + snappedH]
      ];
      const initialPointsM = pointsPx.map((p) => [pxToM(p[0], scale), pxToM(p[1], scale)]);
      const clippedPointsM = clipZoneGeometryAgainstRoads(initialPointsM, roads);
      const areaSqm = calculatePolygonArea(clippedPointsM);

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
        points_px: null,
        points_m: null,
        floors: 4,
        color: ZONE_COLORS[type] || '#7F8C8D',
        opacity: 0.8,
        rotation_deg: 0,
        properties: {
          plot_size_sqm: areaSqm,
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
    const pos = stageRef.current.getRelativePointerPosition();
    if (!pos) return;
    
    let snappedX = snapValue(pos.x);
    let snappedY = snapValue(pos.y);
    if (activeTool === 'LINE' || activeTool === 'CONNECTOR') {
      const [sx, sy] = getSnappedPosition(pos.x, pos.y);
      snappedX = sx;
      snappedY = sy;
    }

    if (meta.activePlacementCategory === 'tree') {
      // Tree placement moved to handleStageDblClick per user request
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

    if (meta.activePlacementCategory === 'decoration') {
      const variant = meta.activePlacementVariant || 'roundabout';
      const widthM = variant === 'roundabout' ? 24 : 16;
      const heightM = variant === 'roundabout' ? 24 : 16;
      const widthPx = widthM * scale;
      const heightPx = heightM * scale;
      
      const newAmenity = {
        id: `amenity_${Date.now()}`,
        type: 'decoration',
        label: variant === 'roundabout' ? 'Grand Roundabout' : 'Fountain Plaza',
        x_px: snappedX - widthPx / 2,
        y_px: snappedY - heightPx / 2,
        width_px: widthPx,
        height_px: heightPx,
        x_m: pxToM(snappedX - widthPx / 2, scale),
        y_m: pxToM(snappedY - heightPx / 2, scale),
        width_m: widthM,
        height_m: heightM,
        shape: 'ellipse',
        properties: {
          variant: variant
        }
      };
      
      addAmenity(newAmenity);
      setSelectedElementId(newAmenity.id);
      setMeta({ activePlacementCategory: null, activePlacementVariant: null });
      return;
    }

    if (meta.activePlacementCategory === 'lawn' || meta.activePlacementCategory === 'pool') {
      const isPool = meta.activePlacementCategory === 'pool';
      const shapeType = meta.activePlacementVariant || 'organic';
      const typeStr = isPool ? 'pool' : 'lawn';
      
      const widthM = 15;
      const heightM = 10;
      const widthPx = widthM * scale;
      const heightPx = heightM * scale;
      
      const ptsPx = generateShapePoints(shapeType, snappedX, snappedY, widthPx, heightPx);
      const newAmenity = {
        id: `amenity_${Date.now()}`,
        type: typeStr,
        label: isPool ? 'Swimming Pool' : 'Lawn / Park',
        x_px: snappedX - widthPx / 2,
        y_px: snappedY - heightPx / 2,
        width_px: widthPx,
        height_px: heightPx,
        x_m: pxToM(snappedX - widthPx / 2, scale),
        y_m: pxToM(snappedY - heightPx / 2, scale),
        width_m: widthM,
        height_m: heightM,
        points_px: ptsPx,
        points_m: ptsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]),
        shape: shapeType
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
      const initialPointsM = pointsPx.map((p) => [pxToM(p[0], scale), pxToM(p[1], scale)]);
      const clippedPointsM = clipZoneGeometryAgainstRoads(initialPointsM, roads);
      const areaSqm = calculatePolygonArea(clippedPointsM);

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
        points_px: null,
        points_m: null,
        color: preset.color || '#4A90D9',
        opacity: 0.88,
        floors: preset.floors,
        building_variant: preset.variant,
        footprint: meta.activePlacementFootprint || preset.footprint || 'rectangular',
        rotation_deg: 0,
        properties: {
          plot_size_sqm: areaSqm
        }
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
    const pos = stageRef.current.getRelativePointerPosition();
    if (!pos) return;

    if (meta.activePlacementCategory === 'tree') {
      const snappedX = snapValue(pos.x);
      const snappedY = snapValue(pos.y);
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
    const bbox = getPolygonBoundingBox(updatedPointsPx);
    const clippedPointsM = clipZoneGeometryAgainstRoads(updatedPointsM, roads);
    const areaSqm = calculatePolygonArea(clippedPointsM);
    const newRotation = ((zone.rotation_deg || 0) + (rotRad * 180 / Math.PI)) % 360;

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
      rotation_deg: newRotation,
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
      x_m: pxToM(bbox.minX, scale),
      y_m: pxToM(bbox.minY, scale),
      rotation_deg: (amenity.rotation_deg || 0) + node.rotation()
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

    const casingNode = node.getStage().findOne(`#casing-${road.id}`);
    if (casingNode) {
      casingNode.scaleX(1);
      casingNode.scaleY(1);
      casingNode.x(0);
      casingNode.y(0);
      casingNode.rotation(0);
    }

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


      <div style={{ position: 'relative', width, height }}>
        {/* Leaflet background map */}
        {(viewMode === 'satellite' || viewMode === 'street') && (
          <div
            ref={mapWrapperRef}
            style={{
              position: 'absolute',
              top: -height * 2,
              left: -width * 2,
              width: width * 5,
              height: height * 5,
              zIndex: 0,
              transform: `translate(${stagePos.x}px, ${stagePos.y}px) scale(${stageScale})`,
              transformOrigin: `${width * 2}px ${height * 2}px`,
              willChange: 'transform'
            }}
          >
            <div
              ref={mapContainerRef}
              style={{
                width: width * 5,
                height: height * 5,
              }}
            />
          </div>
        )}
        <div style={{ position: 'absolute', top: 0, left: 0, width, height, zIndex: 1, cursor: meta.treeBrushActive ? 'url("data:image/svg+xml;utf8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23064e3b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M14 2h-4v2h8V4a2 2 0 0 0-2-2z\'/%3E%3Cpath d=\'M7 6v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6z\'/%3E%3Cpath d=\'M9 12h.01M15 12h.01M12 15h.01M12 9h.01\'/%3E%3C/svg>") 12 12, crosshair' : activeTool === 'CLUSTER_SELECT' ? 'crosshair' : undefined }}>
          <Stage
            ref={stageRef}
            width={width}
            height={height}
            x={stagePos.x}
            y={stagePos.y}
            scaleX={stageScale}
            scaleY={stageScale}
            draggable={(activeTool === 'SELECT' || activeTool === 'HAND') && !meta.treeBrushActive}
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
          >
            {/* Land Boundary Layer */}
            <Layer>
              {viewMode !== 'satellite' && viewMode !== 'street' && (
                <Rect x={-4000} y={-4000} width={8000} height={8000} fill="#f1f5f9" listening={false} />
              )}
              {viewMode !== 'satellite' && viewMode !== 'street' && renderGrid()}
    
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
                  if (stage) resetCursor(stage);
                }}
              >
                {(() => {
                  const landFill =
                    viewMode === 'grass'     ? '#8bc34a' :
                    viewMode === 'concrete'  ? '#e5e7eb' :
                    viewMode === 'satellite' ? 'rgba(0,0,0,0)' :
                    viewMode === 'street'    ? 'rgba(0,0,0,0)' :
                                               '#f1f5f9';
                  if (boundaryPoints.length > 0) {
                    return (
                      <>
                        {/* Land fill — no stroke here */}
                        <Line
                          points={boundaryPoints}
                          fill={landFill}
                          stroke={null}
                          strokeWidth={0}
                          closed={true}
                          shadowColor="rgba(0,0,0,0.35)"
                          shadowBlur={14}
                          shadowOffset={{ x: 3, y: 6 }}
                          shadowOpacity={0.55}
                          listening={true}
                        />
                        {/* Site boundary — slim red dotted outline */}
                        <Line
                          points={boundaryPoints}
                          fill={null}
                          stroke="#ef4444"
                          strokeWidth={1.5}
                          dash={[8, 5]}
                          closed={true}
                          listening={false}
                        />
                      </>
                    );
                  }
                  return (
                    <>
                      <Rect
                        x={0} y={0}
                        width={width} height={height}
                        fill={landFill}
                        strokeWidth={0}
                        listening={true}
                      />
                      {/* Boundary outline for rect fallback */}
                      <Rect
                        x={0} y={0}
                        width={width} height={height}
                        fill={null}
                        stroke="#ef4444"
                        strokeWidth={1.5}
                        dash={[8, 5]}
                        listening={false}
                      />
                    </>
                  );
                })()}
              </Group>

            {/* OSM Public Roads Background Guides */}
            {viewMode !== 'satellite' && viewMode !== 'street' && meta.showPublicRoads !== false && osmRoads
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
                      if (stage) resetCursor(stage);
                    }}
                   >
                    {/* OSM: highway-type-sized road lines to match real-world widths */}
                    <Line
                      points={flatPoints}
                      stroke="#475569"
                      strokeWidth={
                        osmRoad.highway === 'motorway' || osmRoad.highway === 'trunk' ? 14 * scale :
                        osmRoad.highway === 'primary' ? 12 * scale :
                        osmRoad.highway === 'secondary' ? 10 * scale :
                        osmRoad.highway === 'tertiary' ? 8 * scale :
                        osmRoad.highway === 'residential' || osmRoad.highway === 'unclassified' ? 6 * scale :
                        osmRoad.highway === 'service' ? 4 * scale :
                        osmRoad.highway === 'footway' || osmRoad.highway === 'path' || osmRoad.highway === 'cycleway' ? 2 * scale :
                        6 * scale
                      }
                      opacity={0.5}
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
          {/* Pass 1: Draw all road casings (underneath) */}
          {filteredRoads.map((road) => {
            const pts = road.points_px;
            if (pts.length < 2) return null;

            const flatPoints = pts.flat();
            if (flatPoints.length === 0 || flatPoints.some(v => typeof v !== 'number' || !Number.isFinite(v))) return null;
            const isSelected = selectedElementId === road.id;
            const isClusterSelected = selectedCluster && selectedCluster.roadIds && selectedCluster.roadIds.includes(road.id);
            const isMajor = road.type === 'primary' || road.type === 'ring_primary' || road.type === 'ring_secondary';
            const sidewalkW = isMajor ? (2 * scale) : (1 * scale);
            const roadWidthPx = road.width_px;

            return (
              <Group
                key={`casing-${road.id}`}
                id={`casing-${road.id}`}
                x={0}
                y={0}
                scaleX={1}
                scaleY={1}
                rotation={0}
              >
                {/* Shadow Layer */}
                {(isSelected || isClusterSelected) && (
                  <Line
                    name="road-path"
                    points={flatPoints}
                    stroke="rgba(79,70,229,0.35)"
                    strokeWidth={roadWidthPx + (sidewalkW * 2) + 4}
                    lineCap={road.sharp_corners ? "square" : "round"}
                    lineJoin={road.sharp_corners ? "miter" : "round"}
                    tension={road.sharp_corners ? 0 : 0.4}
                    listening={false}
                    closed={road.closed}
                    dash={(isClusterSelected && !isSelected) ? [6, 4] : []}
                  />
                )}
                {/* Outer casing / Sidewalks */}
                {road.type !== 'pedestrian' && road.type !== 'cycle_track' && (
                  <Line
                    name="road-path"
                    points={flatPoints}
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth={roadWidthPx}
                    lineCap={road.sharp_corners ? "square" : "round"}
                    lineJoin={road.sharp_corners ? "miter" : "round"}
                    tension={road.sharp_corners ? 0 : 0.4}
                    listening={false}
                    closed={road.closed}
                  />
                )}
              </Group>
            );
          })}

          {/* Pass 2: Draw all road surfaces, markings, zebra crossings, dimension labels, handles (on top) */}
          {filteredRoads.map((road) => {
            const pts = road.points_px;
            if (pts.length < 2) return null;

            const flatPoints = pts.flat();
            if (flatPoints.length === 0 || flatPoints.some(v => typeof v !== 'number' || !Number.isFinite(v))) return null;
            const isSelected = selectedElementId === road.id;
            const isMajor = road.type === 'primary' || road.type === 'ring_primary' || road.type === 'ring_secondary';
            const sidewalkW = isMajor ? (2 * scale) : (1 * scale);
            const isClosed = road.closed || road.type.includes('ring');
            const roadWidthPx = road.width_px;

            const renderZebra = (px, py, angleDeg) => {
              return (
                <Group x={px} y={py} rotation={angleDeg} key={`zebra-${px}-${py}`}>
                  <Line
                    points={[0, -road.width_px / 2 + 2, 0, road.width_px / 2 - 2]}
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth={4}
                    dash={[2, 2]}
                    lineCap="butt"
                    listening={false}
                  />
                </Group>
              );
            };

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
                  if (selectedCluster && selectedCluster.roadIds && selectedCluster.roadIds.includes(road.id)) {
                    handleClusterDragStart(e, road.id);
                    return;
                  }
                  dragCasingNodeRef.current = e.currentTarget.getStage().findOne(`#casing-${road.id}`);
                  if (dragCasingNodeRef.current) {
                    dragCasingNodeRef.current.x(e.currentTarget.x());
                    dragCasingNodeRef.current.y(e.currentTarget.y());
                  }
                }}
                onDragMove={(e) => {
                  e.cancelBubble = true;
                  if (selectedCluster && selectedCluster.roadIds && selectedCluster.roadIds.includes(road.id)) {
                    handleClusterDragMove(e, road.id);
                    return;
                  }
                  if (dragCasingNodeRef.current) {
                    dragCasingNodeRef.current.x(e.currentTarget.x());
                    dragCasingNodeRef.current.y(e.currentTarget.y());
                  }
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  if (selectedCluster && selectedCluster.roadIds && selectedCluster.roadIds.includes(road.id)) {
                    handleClusterDragEnd(e, road.id);
                    return;
                  }
                  if (dragCasingNodeRef.current) {
                    dragCasingNodeRef.current.x(0);
                    dragCasingNodeRef.current.y(0);
                  }
                  dragCasingNodeRef.current = null;
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
                onTransformStart={(e) => {
                  transformCasingNodeRef.current = e.currentTarget.getStage().findOne(`#casing-${road.id}`);
                }}
                onTransform={(e) => {
                  handleTransform(e);
                  const node = e.currentTarget;
                  if (transformCasingNodeRef.current) {
                    transformCasingNodeRef.current.x(node.x());
                    transformCasingNodeRef.current.y(node.y());
                    transformCasingNodeRef.current.scaleX(node.scaleX());
                    transformCasingNodeRef.current.scaleY(node.scaleY());
                    transformCasingNodeRef.current.rotation(node.rotation());
                  }
                }}
                onTransformEnd={(e) => {
                  transformCasingNodeRef.current = null;
                  handleRoadTransformEnd(e, road);
                }}
                onMouseDown={(e) => {
                  if (activeTool === 'SELECT') {
                    setSelectedElementId(road.id);
                    e.cancelBubble = true;
                  }
                }}
                onClick={(e) => {
                  if (activeTool === 'ERASER') {
                    deleteRoad(road.id);
                    e.cancelBubble = true;
                  } else if (activeTool === 'SELECT') {
                    setSelectedElementId(road.id);
                    e.cancelBubble = true;
                  }
                }}
                onDblClick={(e) => {
                  if (activeTool === 'SELECT') {
                    setSelectedElementId(road.id);
                    e.cancelBubble = true;
                  }
                }}
                onMouseEnter={(e) => {
                  if (activeTool === 'SELECT') {
                    const stage = e.target.getStage();
                    if (stage) stage.container().style.cursor = 'pointer';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTool === 'SELECT') {
                    const stage = e.target.getStage();
                    if (stage) resetCursor(stage);
                  }
                }}
              >
                {/* Outer casing / Sidewalks */}
                <Line
                  name="road-path"
                  points={flatPoints}
                  stroke="rgba(0,0,0,0.01)"
                  strokeWidth={roadWidthPx + (sidewalkW * 2)}
                  lineCap={road.sharp_corners ? "square" : "round"}
                  lineJoin={road.sharp_corners ? "miter" : "round"}
                  tension={road.sharp_corners ? 0 : 0.4}
                  listening={true}
                  closed={road.closed}
                />
                {/* Asphalt Surface & Edge Markings */}
                {road.type !== 'pedestrian' && road.type !== 'cycle_track' ? (
                  <Line
                    name="road-path"
                    points={flatPoints}
                    stroke="#5C6670"
                    strokeWidth={Math.max(1, roadWidthPx - 3)}
                    lineCap={road.sharp_corners ? "square" : "round"}
                    lineJoin={road.sharp_corners ? "miter" : "round"}
                    tension={road.sharp_corners ? 0 : 0.4}
                    listening={false}
                    closed={road.closed}
                  />
                ) : (
                  <>
                    {/* Pedestrian path darker stone curb/border */}
                    {road.type === 'pedestrian' && (
                      <Line
                        points={flatPoints}
                        stroke="#6e543c"
                        strokeWidth={roadWidthPx + 2}
                        lineCap={road.sharp_corners ? "square" : "round"}
                        lineJoin={road.sharp_corners ? "miter" : "round"}
                        tension={road.sharp_corners ? 0 : 0.4}
                        listening={false}
                        closed={road.closed}
                      />
                    )}
                    <Line
                      name="road-path"
                      points={flatPoints}
                      stroke={road.type === 'pedestrian' ? (stonePattern || '#e2c99f') : '#e5e7eb'}
                      strokeWidth={roadWidthPx}
                      lineCap={road.sharp_corners ? "square" : "round"}
                      lineJoin={road.sharp_corners ? "miter" : "round"}
                      tension={road.sharp_corners ? 0 : 0.4}
                      listening={false}
                      closed={road.closed}
                    />
                  </>
                )}
                {/* Center / Edge Markings */}
                {road.type !== 'pedestrian' && road.type !== 'cycle_track' && (
                  <Line
                    name="road-path"
                    points={flatPoints}
                    stroke={isMajor ? '#ffffff' : 'rgba(255,255,255,0.7)'}
                    strokeWidth={1.5}
                    dash={[6, 8]}
                    lineCap="butt"
                    lineJoin="round"
                    tension={road.sharp_corners ? 0 : 0.4}
                    listening={false}
                    closed={road.closed}
                  />
                )}

                {/* Draggable Bounding Box Edge Handle */}
                {isSelected && (() => {
                  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                  pts.forEach(p => {
                    minX = Math.min(minX, p[0]);
                    minY = Math.min(minY, p[1]);
                    maxX = Math.max(maxX, p[0]);
                    maxY = Math.max(maxY, p[1]);
                  });
                  const pad = roadWidthPx / 2 + 10;
                  return (
                    <Rect
                      x={minX - pad} y={minY - pad}
                      width={(maxX - minX) + pad*2} height={(maxY - minY) + pad*2}
                      stroke="rgba(0,0,0,0.01)" strokeWidth={15} fill="transparent"
                      listening={true}
                      onMouseEnter={(e) => {
                        if (activeTool === 'SELECT') {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'move';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeTool === 'SELECT') {
                          const stage = e.target.getStage();
                          if (stage) resetCursor(stage);
                        }
                      }}
                    />
                  );
                })()}

                {/* Zebra Crossings for open roads */}
                {!isClosed && pts.length >= 2 && road.type !== 'pedestrian' && road.type !== 'cycle_track' && (
                  <>
                    {(() => {
                      const p0 = pts[0];
                      const p1 = pts[1];
                      const ang0 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180 / Math.PI;
                      
                      const pn = pts[pts.length - 1];
                      const pn1 = pts[pts.length - 2];
                      const angN = Math.atan2(pn[1] - pn1[1], pn[0] - pn1[0]) * 180 / Math.PI;

                      return (
                        <>
                          {renderZebra(p0[0], p0[1], ang0, 'start')}
                          {renderZebra(pn[0], pn[1], angN, 'end')}
                        </>
                      );
                    })()}
                  </>
                )}

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
                  const offsetDist = roadWidthPx / 2 + 15;
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
                    radius={4.5}
                    fill="#4f46e5"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    draggable={activeTool === 'SELECT'}
                    onDragStart={(e) => {
                      e.cancelBubble = true;
                    }}
                    onDragMove={(e) => {
                      e.cancelBubble = true;
                      const stage = e.target.getStage();
                      const pos = stage ? stage.getRelativePointerPosition() : null;
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
                      const pos = stage ? stage.getRelativePointerPosition() : null;
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

                {/* Midpoint Curve Anchors (MS Paint Line Bender style) */}
                {selectedElementId === road.id && pts.slice(0, -1).map((pt, idx) => {
                  const nextPt = pts[idx + 1];
                  const mx = (pt[0] + nextPt[0]) / 2;
                  const my = (pt[1] + nextPt[1]) / 2;
                  return (
                    <Circle
                      key={`midpoint-${road.id}-${idx}`}
                      x={mx}
                      y={my}
                      radius={6}
                      fill="#ffffff"
                      stroke="#4f46e5"
                      strokeWidth={1.5}
                      opacity={0.6}
                      draggable={activeTool === 'SELECT'}
                      onMouseEnter={(e) => {
                        if (activeTool === 'SELECT') {
                          e.target.opacity(1);
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'move';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeTool === 'SELECT') {
                          e.target.opacity(0.6);
                          const stage = e.target.getStage();
                          if (stage) resetCursor(stage);
                        }
                      }}
                      onDragStart={(e) => {
                        e.cancelBubble = true;
                        dragCasingNodeRef.current = e.target.getStage().findOne(`#casing-${road.id}`);
                      }}
                      onDragMove={(e) => {
                        e.cancelBubble = true;
                        const group = e.target.getParent();
                        const newX = e.target.x();
                        const newY = e.target.y();
                        const newPts = [...flatPoints];
                        newPts.splice((idx + 1) * 2, 0, newX, newY);
                        group.getChildren((node) => node.name() === 'road-path').forEach(line => {
                           line.points(newPts);
                        });

                        if (dragCasingNodeRef.current) {
                          dragCasingNodeRef.current.getChildren((node) => node.name() === 'road-path').forEach(line => {
                            line.points(newPts);
                          });
                        }
                      }}
                      onDragEnd={(e) => {
                        e.cancelBubble = true;
                        dragCasingNodeRef.current = null;
                        const newX = e.target.x();
                        const newY = e.target.y();
                        const updatedPointsPx = [...pts];
                        updatedPointsPx.splice(idx + 1, 0, [newX, newY]);
                        const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
                        updateRoad(road.id, {
                          points_px: updatedPointsPx,
                          points_m: updatedPointsM
                        });
                      }}
                    />
                  );
                })}

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
            const originalPts = getZonePoints(zone);
            const pts = clippedZonesPoints[zone.id] || originalPts;
            const flatPts = pts.flat();
            if (flatPts.length === 0 || flatPts.some(v => typeof v !== 'number' || !Number.isFinite(v))) return null;
            const bbox = getPolygonBoundingBox(pts);
            const originalBbox = getPolygonBoundingBox(originalPts);
            const isSelected = selectedElementId === zone.id;
            const isClusterSelected = selectedCluster && selectedCluster.zoneIds && selectedCluster.zoneIds.includes(zone.id);
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
                  if (selectedCluster && selectedCluster.zoneIds && selectedCluster.zoneIds.includes(zone.id)) {
                    handleClusterDragStart(e, zone.id);
                  }
                }}
                onDragMove={(e) => {
                  if (selectedCluster && selectedCluster.zoneIds && selectedCluster.zoneIds.includes(zone.id)) {
                    handleClusterDragMove(e, zone.id);
                  }
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  if (selectedCluster && selectedCluster.zoneIds && selectedCluster.zoneIds.includes(zone.id)) {
                    handleClusterDragEnd(e, zone.id);
                    return;
                  }
                  const dx = e.currentTarget.x();
                  const dy = e.currentTarget.y();
                  e.currentTarget.x(0);
                  e.currentTarget.y(0);
                  
                  const updates = {};
                  if (zone.points_px && zone.points_px.length > 0) {
                    const updatedPointsPx = zone.points_px.map(p => [p[0] + dx, p[1] + dy]);
                    const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
                    const bbox = getPolygonBoundingBox(updatedPointsPx);
                    
                    updates.points_px = updatedPointsPx;
                    updates.points_m = updatedPointsM;
                    updates.x_px = bbox.minX;
                    updates.y_px = bbox.minY;
                    updates.width_px = bbox.width;
                    updates.height_px = bbox.height;
                    updates.x_m = pxToM(bbox.minX, scale);
                    updates.y_m = pxToM(bbox.minY, scale);
                    updates.width_m = pxToM(bbox.width, scale);
                    updates.height_m = pxToM(bbox.height, scale);
                  } else {
                    const newX = zone.x_px + dx;
                    const newY = zone.y_px + dy;
                    updates.x_px = newX;
                    updates.y_px = newY;
                    updates.x_m = pxToM(newX, scale);
                    updates.y_m = pxToM(newY, scale);
                  }

                  let zonePtsM = zone.points_m;
                  if (!zonePtsM || zonePtsM.length < 3) {
                    const x = updates.x_m !== undefined ? updates.x_m : zone.x_m;
                    const y = updates.y_m !== undefined ? updates.y_m : zone.y_m;
                    const w = zone.width_m;
                    const h = zone.height_m;
                    const cx = x + w / 2;
                    const cy = y + h / 2;
                    const pts = [
                      [x, y],
                      [x + w, y],
                      [x + w, y + h],
                      [x, y + h]
                    ];
                    if (zone.rotation_deg) {
                      const rad = (zone.rotation_deg * Math.PI) / 180;
                      zonePtsM = pts.map(p => {
                        const dx = p[0] - cx;
                        const dy = p[1] - cy;
                        return [
                          dx * Math.cos(rad) - dy * Math.sin(rad) + cx,
                          dx * Math.sin(rad) + dy * Math.cos(rad) + cy
                        ];
                      });
                    } else {
                      zonePtsM = pts;
                    }
                  } else {
                    zonePtsM = updates.points_m;
                  }

                  const clippedPointsM = clipZoneGeometryAgainstRoads(zonePtsM, roads);
                  const areaSqm = calculatePolygonArea(clippedPointsM);
                  updates['properties.plot_size_sqm'] = areaSqm;
                  
                  updateZone(zone.id, updates);
                }}
                onTransformEnd={(e) => handleTransformEnd(e, zone)}
                onMouseDown={(e) => {
                  if (activeTool === 'SELECT') {
                    setSelectedElementId(zone.id);
                    e.cancelBubble = true;
                  }
                }}
                onClick={(e) => {
                  if (activeTool === 'ERASER') {
                    deleteZone(zone.id);
                    e.cancelBubble = true;
                  } else if (activeTool === 'SELECT') {
                    setSelectedElementId(zone.id);
                    e.cancelBubble = true;
                  }
                }}
                onDblClick={(e) => {
                  if (activeTool === 'SELECT') {
                    setSelectedElementId(zone.id);
                    e.cancelBubble = true;
                  }
                }}
              >
                {/* Visuals Group (Clipped by clipFunc to keep outside roads) */}
                <Group
                  clipFunc={(ctx) => {
                    const clippedPolys = getClippedZonePolygons(zone, roads, scale);
                    ctx.beginPath();
                    clippedPolys.forEach(([outerRing, ...holes]) => {
                      if (outerRing && outerRing.length > 0) {
                        ctx.moveTo(outerRing[0][0], outerRing[0][1]);
                        for (let i = 1; i < outerRing.length; i++) {
                          ctx.lineTo(outerRing[i][0], outerRing[i][1]);
                        }
                        ctx.closePath();
                        
                        holes.forEach(hole => {
                          if (hole && hole.length > 0) {
                            ctx.moveTo(hole[0][0], hole[0][1]);
                            for (let i = 1; i < hole.length; i++) {
                              ctx.lineTo(hole[i][0], hole[i][1]);
                            }
                            ctx.closePath();
                          }
                        });
                      }
                    });
                  }}
                  clipRule="evenodd"
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
                      stroke={(isSelected || isClusterSelected) ? '#4f46e5' : isBuilding ? '#0f172a' : '#374151'} strokeWidth={(isSelected || isClusterSelected) ? 2.5 : 1.2}
                      dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
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
                      stroke={(isSelected || isClusterSelected) ? '#4f46e5' : isBuilding ? '#0f172a' : '#374151'} strokeWidth={(isSelected || isClusterSelected) ? 2.5 : 1.2}
                      dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
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
                      stroke={(isSelected || isClusterSelected) ? '#4f46e5' : isBuilding ? '#0f172a' : '#374151'} strokeWidth={(isSelected || isClusterSelected) ? 2.5 : 1.2}
                      dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
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
                      stroke={(isSelected || isClusterSelected) ? '#4f46e5' : isBuilding ? '#0f172a' : '#374151'} strokeWidth={(isSelected || isClusterSelected) ? 2.5 : 1.2}
                      dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
                      listening={activeTool === 'SELECT'}
                    />
                  ) : (
                    <Line
                      points={flatPts}
                      closed={true}
                      fill={zone.color}
                      opacity={zone.opacity || 0.85}
                      stroke={(isSelected || isClusterSelected) ? '#4f46e5' : isBuilding ? '#0f172a' : '#374151'}
                      strokeWidth={(isSelected || isClusterSelected) ? 2.5 : 1.2}
                      dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
                      listening={activeTool === 'SELECT'}
                    />
                  )}

                  {/* Inside Block Size Label */}
                  {(() => {
                    if (meta.showNumberLegend) {
                      const legendNum = !meta.hideNumbersOnBlocks ? getLegendNumber(zone.label) : null;
                      if (legendNum) {
                        return (
                          <Group x={bbox.cx} y={bbox.cy} listening={false}>
                            <Circle radius={13} fill="#ffffff" shadowColor="rgba(0,0,0,0.3)" shadowBlur={4} shadowOffset={{x:0, y:2}} />
                            <Text text={legendNum.toString()} fontSize={14} fontStyle="bold" fill="#0f172a" align="center" verticalAlign="middle" x={-13} y={-13} width={26} height={26} />
                          </Group>
                        );
                      }
                      return null;
                    }

                    const clippedPtsM = (clippedZonesPoints[zone.id] || originalPts).map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
                    const areaSqm = calculatePolygonArea(clippedPtsM);
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
                </Group>


                {/* Draggable Anchors for Reshaping */}
                {isSelected && originalPts.map((pt, idx) => (
                  <Circle
                    key={`zone-anchor-${zone.id}-${idx}`}
                    x={pt[0]}
                    y={pt[1]}
                    radius={4.5}
                    fill="#4f46e5"
                    stroke="#ffffff"
                    strokeWidth={1.5}
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

                      const updatedPointsPx = [...originalPts];
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
                      const bbox = getPolygonBoundingBox(zone.points_px || originalPts);
                      const currentPointsM = (zone.points_px || originalPts).map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
                      const clippedPointsM = clipZoneGeometryAgainstRoads(currentPointsM, roads);
                      const areaSqm = calculatePolygonArea(clippedPointsM);
                      
                      updateZone(zone.id, {
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
                    }}
                  />
                ))}

                {/* Custom Rotator Handle on Top of selected block */}
                {isSelected && (() => {
                  const handleX = originalBbox.cx;
                  const handleY = originalBbox.minY - 25;
                  return (
                    <Group key={`rotator-group-${zone.id}`}>
                      <Line
                        points={[originalBbox.cx, originalBbox.minY, handleX, handleY]}
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
                          rotationStartPointsRef.current = [...originalPts];
                          rotationCenterRef.current = { x: originalBbox.cx, y: originalBbox.cy };
                          const pos = stageRef.current.getRelativePointerPosition();
                          rotationStartAngleRef.current = Math.atan2(
                            pos.y - originalBbox.cy,
                            pos.x - originalBbox.cx
                          );
                        }}
                        onDragMove={(e) => {
                          e.cancelBubble = true;
                          const pos = stageRef.current.getRelativePointerPosition();
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
                          
                          const newRotation = ((zone.rotation_deg || 0) + (deltaRad * 180 / Math.PI)) % 360;

                          updateZone(zone.id, {
                            points_px: updatedPointsPx,
                            points_m: updatedPointsM,
                            rotation_deg: newRotation,
                            'properties.plot_size_sqm': areaSqm
                          });
                        }}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                          const clippedPointsM = clipZoneGeometryAgainstRoads(zone.points_m, roads);
                          const areaSqm = calculatePolygonArea(clippedPointsM);
                          
                          updateZone(zone.id, {
                            'properties.plot_size_sqm': areaSqm
                          });
                        }}
                        onMouseEnter={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'crosshair';
                        }}
                        onMouseLeave={(e) => {
                          const stage = e.target.getStage();
                          if (stage) resetCursor(stage);
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
          {filteredAmenities && filteredAmenities.map((amenity) => {
            const pts = getAmenityPoints(amenity);
            const flatPts = pts.flat();
            if (flatPts.length === 0 || flatPts.some(v => typeof v !== 'number' || !Number.isFinite(v))) return null;
            const bbox = getPolygonBoundingBox(pts);
            const isSelected = selectedElementId === amenity.id;
            const isClusterSelected = selectedCluster && selectedCluster.amenityIds && selectedCluster.amenityIds.includes(amenity.id);
            const isBuilding = ['amenity', 'institutional'].includes(amenity.type);
            const isWater = amenity.type === 'water_body' || amenity.type === 'pool';
            const isLawnOrPark = ['lawn', 'park', 'garden', 'green'].includes(amenity.type);
            const isDecoration = amenity.type === 'decoration';
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
                  if (selectedCluster && selectedCluster.amenityIds && selectedCluster.amenityIds.includes(amenity.id)) {
                    handleClusterDragStart(e, amenity.id);
                  }
                }}
                onDragMove={(e) => {
                  if (selectedCluster && selectedCluster.amenityIds && selectedCluster.amenityIds.includes(amenity.id)) {
                    handleClusterDragMove(e, amenity.id);
                  }
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  if (selectedCluster && selectedCluster.amenityIds && selectedCluster.amenityIds.includes(amenity.id)) {
                    handleClusterDragEnd(e, amenity.id);
                    return;
                  }
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
                  if (activeTool === 'ERASER') {
                    deleteAmenity(amenity.id);
                    e.cancelBubble = true;
                  } else if (activeTool === 'SELECT') {
                    setSelectedElementId(amenity.id);
                    e.cancelBubble = true;
                  }
                }}
                onDblClick={(e) => {
                  if (activeTool === 'SELECT') {
                    setSelectedElementId(amenity.id);
                    e.cancelBubble = true;
                  }
                }}
              >
                {/* Shadow */}
                {!isSpecialPoint && ['amenity', 'institutional', 'parking'].includes(amenity.type) && (
                  <Line
                    x={bbox.minX + 4}
                    y={bbox.minY + 6}
                    points={pts.map(p => [p[0] - bbox.minX, p[1] - bbox.minY]).flat()}
                    closed={true}
                    fill="rgba(40, 25, 10, 0.22)"
                    listening={false}
                  />
                )}

                 {isLawnOrPark ? (
                  amenity.shape === 'ellipse' ? (
                    <>
                      {/* Light soil-colored walking path */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width / 2}
                        radiusY={bbox.height / 2}
                        stroke="#f5eedc"
                        strokeWidth={Math.min(bbox.width, bbox.height) * 0.2}
                        listening={false}
                      />
                      {/* Textured Grass lawn */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width / 2}
                        radiusY={bbox.height / 2}
                        fillPatternImage={assets?.grassTile || undefined}
                        fillPatternScale={{ x: 0.2, y: 0.2 }}
                        fill={assets?.grassTile ? undefined : '#578a34'}
                        stroke="#3a4f2e"
                        strokeWidth={1.2}
                        dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
                        visible={!isSpecialPoint}
                        listening={activeTool === 'SELECT'}
                      />
                    </>
                  ) : (
                    <>
                      {/* Light soil-colored walking path */}
                      <Line
                        x={bbox.minX}
                        y={bbox.minY}
                        points={pts.map(p => [p[0] - bbox.minX, p[1] - bbox.minY]).flat()}
                        closed={true}
                        stroke="#f5eedc"
                        strokeWidth={Math.min(bbox.width, bbox.height) * 0.2}
                        lineJoin="round"
                        lineCap="round"
                        listening={false}
                        tension={['organic', 'fluid_organic', 'serpentine_wave', 'crescent', 'bowtie_geometric', 'circular', 'oval'].includes(amenity.shape) ? 0.35 : 0}
                      />
                      {/* Textured Grass lawn */}
                      <Line
                        x={bbox.minX}
                        y={bbox.minY}
                        points={pts.map(p => [p[0] - bbox.minX, p[1] - bbox.minY]).flat()}
                        closed={true}
                        fillPatternImage={assets?.grassTile || undefined}
                        fillPatternScale={{ x: 0.2, y: 0.2 }}
                        fill={assets?.grassTile ? undefined : '#578a34'}
                        stroke="#3a4f2e"
                        strokeWidth={1.2}
                        lineJoin="round"
                        lineCap="round"
                        dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
                        visible={!isSpecialPoint}
                        listening={activeTool === 'SELECT'}
                        tension={['organic', 'fluid_organic', 'serpentine_wave', 'crescent', 'bowtie_geometric', 'circular', 'oval'].includes(amenity.shape) ? 0.35 : 0}
                      />
                    </>
                  )
                ) : isDecoration ? (
                  amenity.properties?.variant === 'fountain_plaza' ? (
                    <>
                      {/* Base plaza */}
                      <Rect
                        x={bbox.minX}
                        y={bbox.minY}
                        width={bbox.width}
                        height={bbox.height}
                        fill="#cfd8dc"
                        stroke="#90a4ae"
                        strokeWidth={3}
                        listening={activeTool === 'SELECT'}
                      />
                      {/* Paving lines */}
                      <Line
                        points={[bbox.minX, bbox.minY, bbox.maxX, bbox.maxY]}
                        stroke="#b0bec5"
                        strokeWidth={1.5}
                        listening={false}
                      />
                      <Line
                        points={[bbox.maxX, bbox.minY, bbox.minX, bbox.maxY]}
                        stroke="#b0bec5"
                        strokeWidth={1.5}
                        listening={false}
                      />
                      {/* Corner flower beds */}
                      <Circle
                        x={bbox.minX + bbox.width * 0.15}
                        y={bbox.minY + bbox.height * 0.15}
                        radius={Math.min(bbox.width, bbox.height) * 0.08}
                        fill="#e91e63"
                        stroke="#880e4f"
                        strokeWidth={1}
                        listening={false}
                      />
                      <Circle
                        x={bbox.maxX - bbox.width * 0.15}
                        y={bbox.minY + bbox.height * 0.15}
                        radius={Math.min(bbox.width, bbox.height) * 0.08}
                        fill="#ffeb3b"
                        stroke="#f57f17"
                        strokeWidth={1}
                        listening={false}
                      />
                      <Circle
                        x={bbox.minX + bbox.width * 0.15}
                        y={bbox.maxY - bbox.height * 0.15}
                        radius={Math.min(bbox.width, bbox.height) * 0.08}
                        fill="#ffeb3b"
                        stroke="#f57f17"
                        strokeWidth={1}
                        listening={false}
                      />
                      <Circle
                        x={bbox.maxX - bbox.width * 0.15}
                        y={bbox.maxY - bbox.height * 0.15}
                        radius={Math.min(bbox.width, bbox.height) * 0.08}
                        fill="#e91e63"
                        stroke="#880e4f"
                        strokeWidth={1}
                        listening={false}
                      />
                      {/* Central fountain pool */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.28}
                        radiusY={bbox.height * 0.28}
                        fill="#29b6f6"
                        stroke="#0288d1"
                        strokeWidth={2.5}
                        listening={false}
                      />
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.14}
                        radiusY={bbox.height * 0.14}
                        fill="rgba(255,255,255,0.8)"
                        stroke="none"
                        listening={false}
                      />
                    </>
                  ) : (
                    <>
                      {/* Grand Roundabout */}
                      {/* Outer paved ring */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.46}
                        radiusY={bbox.height * 0.46}
                        fill="#eae4d8"
                        stroke="#a19786"
                        strokeWidth={2}
                        listening={activeTool === 'SELECT'}
                      />
                      {/* Inner asphalt ring */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.38}
                        radiusY={bbox.height * 0.38}
                        fill="#546e7a"
                        stroke="#cfc3a9"
                        strokeWidth={Math.min(bbox.width, bbox.height) * 0.1}
                        listening={false}
                      />
                      {/* Green hedge ring */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.28}
                        radiusY={bbox.height * 0.28}
                        fillPatternImage={assets?.grassTile || undefined}
                        fillPatternScale={{ x: 0.2, y: 0.2 }}
                        fill={assets?.grassTile ? undefined : '#2e7d32'}
                        stroke="#1b5e20"
                        strokeWidth={Math.min(bbox.width, bbox.height) * 0.08}
                        listening={false}
                      />
                      {/* Paved walk */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.18}
                        radiusY={bbox.height * 0.18}
                        fill="#eae4d8"
                        stroke="#a19786"
                        strokeWidth={1}
                        listening={false}
                      />
                      {/* Central fountain */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.13}
                        radiusY={bbox.height * 0.13}
                        fill="#29b6f6"
                        stroke="#0288d1"
                        strokeWidth={2}
                        listening={false}
                      />
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.07}
                        radiusY={bbox.height * 0.07}
                        fill="rgba(255,255,255,0.75)"
                        stroke="none"
                        listening={false}
                      />
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.03}
                        radiusY={bbox.height * 0.03}
                        fill="#ffffff"
                        stroke="none"
                        listening={false}
                      />
                    </>
                  )
                ) : assets && getAmenityTextureKey(amenity) && assets[getAmenityTextureKey(amenity)] ? (
                  <Shape
                    sceneFunc={(context, shape) => {
                      context.beginPath();
                      if (amenity.shape === 'ellipse') {
                        context.ellipse(bbox.width / 2, bbox.height / 2, bbox.width / 2, bbox.height / 2, 0, 0, Math.PI * 2);
                      } else {
                        const relPts = pts.map(p => [p[0] - bbox.minX, p[1] - bbox.minY]);
                        context.moveTo(relPts[0][0], relPts[0][1]);
                        for (let i = 1; i < relPts.length; i++) {
                          context.lineTo(relPts[i][0], relPts[i][1]);
                        }
                        context.closePath();
                      }
                      context.save();
                      context.clip();
                      drawImageCover(context, assets[getAmenityTextureKey(amenity)], 0, 0, bbox.width, bbox.height);
                      context.restore();
                      context.fillStrokeShape(shape);
                    }}
                    x={bbox.minX}
                    y={bbox.minY}
                    fill="transparent"
                    stroke={(isSelected || isClusterSelected) ? '#4f46e5' : '#b8a888'}
                    strokeWidth={(isSelected || isClusterSelected) ? 2 : 1.2}
                    dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
                    visible={!isSpecialPoint}
                    listening={activeTool === 'SELECT'}
                  />
                ) : assets && isWater ? (
                  amenity.shape === 'ellipse' ? (
                    <Ellipse
                      x={bbox.cx}
                      y={bbox.cy}
                      radiusX={bbox.width / 2}
                      radiusY={bbox.height / 2}
                      fill="#81d4fa"
                      stroke="#29b6f6"
                      strokeWidth={1.5}
                      visible={!isSpecialPoint}
                      listening={activeTool === 'SELECT'}
                    />
                  ) : (
                    <Line
                      x={bbox.minX}
                      y={bbox.minY}
                      points={pts.map(p => [p[0] - bbox.minX, p[1] - bbox.minY]).flat()}
                      closed={true}
                      fill="#81d4fa"
                      stroke="#29b6f6"
                      strokeWidth={1.5}
                      lineJoin="round"
                      lineCap="round"
                      tension={['organic', 'fluid_organic', 'serpentine_wave', 'crescent', 'bowtie_geometric', 'circular', 'oval'].includes(amenity.shape) ? 0.35 : 0}
                      visible={!isSpecialPoint}
                      listening={activeTool === 'SELECT'}
                    />
                  )
                ) : false && isBuilding && assets?.[getBuildingTextureKey(amenity)] ? (
                  <Shape
                    sceneFunc={(context, shape) => {
                      context.beginPath();
                      const relPts = pts.map(p => [p[0] - bbox.minX, p[1] - bbox.minY]);
                      context.moveTo(relPts[0][0], relPts[0][1]);
                      for (let i = 1; i < relPts.length; i++) {
                        context.lineTo(relPts[i][0], relPts[i][1]);
                      }
                      context.closePath();
                      context.save();
                      context.clip();
                      drawImageCover(context, assets[getBuildingTextureKey(amenity)], 0, 0, bbox.width, bbox.height);
                      context.restore();
                      context.fillStrokeShape(shape);
                    }}
                    x={bbox.minX}
                    y={bbox.minY}
                    fill="transparent"
                    stroke={(isSelected || isClusterSelected) ? '#4f46e5' : '#b8a888'}
                    strokeWidth={(isSelected || isClusterSelected) ? 2 : 1.2}
                    dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
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
                    stroke={(isSelected || isClusterSelected) ? "#4f46e5" : "#0f172a"}
                    strokeWidth={(isSelected || isClusterSelected) ? 2 : 1}
                    dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
                    visible={!isSpecialPoint}
                    listening={activeTool === 'SELECT'}
                  />
                ) : (
                  <Line
                    x={bbox.minX}
                    y={bbox.minY}
                    points={pts.map(p => [p[0] - bbox.minX, p[1] - bbox.minY]).flat()}
                    closed={true}
                    fill={ZONE_COLORS[amenity.type] || '#2ECC71'}
                    opacity={amenity.type === 'park' ? 0.35 : 0.75}
                    stroke={(isSelected || isClusterSelected) ? "#4f46e5" : "#0f172a"}
                    strokeWidth={(isSelected || isClusterSelected) ? 2 : 1}
                    dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
                    visible={!isSpecialPoint}
                    listening={activeTool === 'SELECT'}
                  />
                )}

                {isSpecialPoint && (() => {
                  const w = amenity.width_px || bbox.width;
                  const h = amenity.height_px || bbox.height;
                  const tw = Math.max(w, 20);
                  const th = Math.max(h, 20);
                  let angleDeg = 0;
                  if (flatPts.length >= 4) {
                    angleDeg = Math.atan2(flatPts[3] - flatPts[1], flatPts[2] - flatPts[0]) * 180 / Math.PI;
                  }

                  return (
                  <>
                    <Rect
                      x={bbox.cx}
                      y={bbox.cy}
                      offsetX={tw/2}
                      offsetY={th/2}
                      width={tw}
                      height={th}
                      rotation={angleDeg}
                      fill="rgba(0,0,0,0.01)"
                      listening={true}
                    />
                    {(isSelected || isClusterSelected) && (
                      <Circle
                        x={bbox.cx}
                        y={bbox.cy}
                        radius={Math.max(tw, th) * 0.55}
                        stroke="#4f46e5"
                        strokeWidth={1.5}
                        dash={(isClusterSelected && !isSelected) ? [3, 2] : []}
                        listening={false}
                      />
                    )}
                    <Group listening={false} x={bbox.cx} y={bbox.cy} rotation={angleDeg}>
                    {amenity.type === 'tree' ? (
                      <Shape
                        sceneFunc={(context) => {
                          const texKey = getAmenityTextureKey(amenity);
                          const img = texKey && assets?.[texKey] ? assets[texKey] : (amenity.tree_variant === 'tree_row' ? assets?.treePlan2 : assets?.treePlan1);
                          if (!img) return;
                          
                          context.save();
                          context.fillStyle = 'rgba(0,0,0,0.18)';
                          context.beginPath();
                          context.ellipse(tw * 0.05, th * 0.08, tw * 0.3, th * 0.15, 0, 0, Math.PI * 2);
                          context.fill();
                          context.restore();

                          context.save();
                          context.beginPath();
                          context.arc(0, 0, Math.min(tw, th) * 0.28, 0, Math.PI * 2);
                          context.clip();
                          drawImageContain(context, img, -tw/2, -th/2, tw, th);
                          context.restore();
                        }}
                      />
                    ) : (
                      <>
                        <Shape
                          sceneFunc={(context) => {
                            context.beginPath();
                            context.rect(-w/2, -h/2, w, h);
                            context.fillStyle = '#ffffff';
                            context.fill();
                            context.lineWidth = 1.5;
                            context.strokeStyle = '#475569';
                            context.stroke();
                            
                            // Draw architectural gate lines depending on variant
                            context.beginPath();
                            if (amenity.access_variant === 'access_large' || amenity.access_variant === 'access_multi') {
                              // Grand gate: dual lanes with central pillar
                              context.moveTo(-w/6, -h/2); context.lineTo(-w/6, h/2);
                              context.moveTo(w/6, -h/2); context.lineTo(w/6, h/2);
                              context.rect(-w/12, -h/2, w/6, h);
                              context.fillStyle = '#94a3b8';
                              context.fill();
                            } else if (amenity.access_variant === 'access_modern') {
                              // Modern gate: sleek lines
                              context.moveTo(-w/2.5, -h/2); context.lineTo(-w/2.5, h/2);
                              context.moveTo(w/2.5, -h/2); context.lineTo(w/2.5, h/2);
                            } else {
                              // Minimal gate: simple divider
                              context.moveTo(0, -h/2); context.lineTo(0, h/2);
                            }
                            context.stroke();
                          }}
                        />
                        {/* Rubicon Red Triangle Logo at Main Entrance */}
                        <Line
                          points={[
                            0, -h/2 - 10,
                            -6, -h/2 - 2,
                            6, -h/2 - 2
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
                          x={-w/2 + 6}
                          y={-h/2 + 6}
                          width={Math.max(10, w - 12)}
                          height={3}
                          fill="rgba(30,41,59,0.45)"
                          cornerRadius={2}
                        />
                        {!meta.showNumberLegend && (
                          <Text
                            x={-w/2}
                            y={-h/2 + 4}
                            width={w}
                            height={h}
                            text={accessLabel}
                            fontSize={8}
                            fontStyle="bold"
                            fill="#1e293b"
                            align="center"
                            verticalAlign="middle"
                            listening={false}
                          />
                        )}
                      </>
                    )}
                    </Group>
                  </>
                  );
                })()}

                {/* Label with size */}
                {amenity.type !== 'tree' && (() => {
                  if (meta.showNumberLegend) {
                    const legendNum = !meta.hideNumbersOnBlocks ? getLegendNumber(amenity.label) : null;
                    if (legendNum) {
                      return (
                        <Group x={bbox.cx} y={bbox.cy} listening={false}>
                          <Circle radius={11} fill="#ffffff" shadowColor="rgba(0,0,0,0.3)" shadowBlur={4} shadowOffset={{x:0, y:2}} />
                          <Text text={legendNum.toString()} fontSize={12} fontStyle="bold" fill="#0f172a" align="center" verticalAlign="middle" x={-11} y={-11} width={22} height={22} />
                        </Group>
                      );
                    }
                    return null;
                  }

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
              fill={activeTool === 'CLUSTER_SELECT' ? 'rgba(79, 70, 229, 0.15)' : (ZONE_COLORS['residential'] || '#cbd5e1')}
              opacity={activeTool === 'CLUSTER_SELECT' ? 1 : 0.4}
              stroke={activeTool === 'CLUSTER_SELECT' ? '#4f46e5' : '#0f172a'}
              strokeWidth={activeTool === 'CLUSTER_SELECT' ? 1 : 1.5}
              dash={activeTool === 'CLUSTER_SELECT' ? [4, 3] : [6, 3]}
            />
          )}

          {/* Boundary Layer Previews */}
          {boundaryPreviews.map((preview, idx) => {
            if (preview.type === 'trees') {
               return (
                 <Line
                   key={`preview-${idx}`}
                   points={preview.insetPtsPx.flatMap(p => [p[0], p[1]])}
                   stroke="#059669"
                   strokeWidth={preview.widthM * scale}
                   lineCap="round"
                   lineJoin="round"
                   opacity={0.8}
                   dash={[15, 10]}
                   closed={true}
                 />
               );
            }
            if (preview.type === 'road') {
               return (
                 <Line
                   key={`preview-${idx}`}
                   points={preview.insetPtsPx.flatMap(p => [p[0], p[1]])}
                   stroke="#4f46e5"
                   strokeWidth={preview.widthM * scale}
                   lineCap="round"
                   lineJoin="round"
                   opacity={0.8}
                   closed={true}
                 />
               );
            }
            if (preview.type === 'path') {
               return (
                 <Line
                   key={`preview-${idx}`}
                   points={preview.insetPtsPx.flatMap(p => [p[0], p[1]])}
                   stroke="#f59e0b"
                   strokeWidth={preview.widthM * scale}
                   lineCap="round"
                   lineJoin="round"
                   opacity={0.9}
                   closed={true}
                 />
               );
            }
            return null;
          })}
        </Layer>

        {/* Scattered Trees Layer — always rendered (image if loaded, circle fallback otherwise) */}
        <Layer>
          {zones.map(zone => {
            if (['green_belt', 'park', 'open_space'].includes(zone.type)) {
              const pts = getZonePoints(zone);
              if (pts.flat().some(v => typeof v !== 'number' || !Number.isFinite(v))) return null;
              return renderTreesInArea(pts, zone.id);
            }
            return null;
          })}
          {filteredAmenities && filteredAmenities.map(amenity => {
            if (['park', 'green_belt', 'open_space'].includes(amenity.type)) {
              const pts = getAmenityPoints(amenity);
              if (pts.flat().some(v => typeof v !== 'number' || !Number.isFinite(v))) return null;
              return renderTreesInArea(pts, amenity.id);
            }
            if (amenity.type === 'tree_cluster') {
              const count = amenity.density === 'high' ? 40 : amenity.density === 'medium' ? 20 : 10;
              const trees = [];
              const seed = amenity.id.split('').reduce((a,b)=>a+b.charCodeAt(0),0);
              const img1 = assets?.treePlan1;
              const img2 = assets?.treePlan2;

              for (let i = 0; i < count; i++) {
                // simple pseudo-random based on index and seed
                const angle = (seed * i * 13.1) % (Math.PI * 2);
                const r = ((seed * i * 7.9) % 1) * (amenity.width_px / 2);
                const tx = amenity.x_px + amenity.width_px / 2 + Math.cos(angle) * r;
                const ty = amenity.y_px + amenity.height_px / 2 + Math.sin(angle) * r;
                const sizePx = 14 + ((seed * i * 3.7) % 8); // Size between 14px and 22px
                const img = (i % 2 === 0) ? img2 : img1;

                if (img) {
                  trees.push(
                    <Shape
                      key={`${amenity.id}-tree-${i}`}
                      listening={false}
                      sceneFunc={(context) => {
                        context.save();
                        context.fillStyle = 'rgba(0,0,0,0.18)';
                        context.beginPath();
                        context.ellipse(tx + sizePx * 0.1, ty + sizePx * 0.12, sizePx * 0.3, sizePx * 0.15, 0, 0, Math.PI * 2);
                        context.fill();
                        context.restore();

                        context.save();
                        context.beginPath();
                        context.arc(tx, ty, sizePx * 0.28, 0, Math.PI * 2);
                        context.clip();
                        drawImageContain(context, img, tx - sizePx / 2, ty - sizePx / 2, sizePx, sizePx);
                        context.restore();
                      }}
                    />
                  );
                } else {
                  const radius = sizePx * 0.3;
                  trees.push(
                    <Group key={`${amenity.id}-tree-${i}`} x={tx} y={ty} listening={false}>
                      <Circle x={2} y={3} radius={radius * 0.85} fill="rgba(0,0,0,0.18)" />
                      <Circle x={0} y={0} radius={radius} fill="#22863a" />
                      <Circle x={-radius * 0.2} y={-radius * 0.2} radius={radius * 0.55} fill="#34a853" />
                    </Group>
                  );
                }
              }
              return <Group key={`cluster-${amenity.id}`}>{trees}</Group>;
            }
            return null;
          })}

          {/* Painted Tree Paths Overlay */}
          {paintedTreePaths.map((path, idx) => (
            <Group key={`painted-tree-path-${idx}`} listening={false}>
              <Line
                points={path.flatMap(p => [p.x, p.y])}
                stroke="#064e3b"
                strokeWidth={8}
                lineCap="round"
                lineJoin="round"
                opacity={0.8}
              />
              {path.map((pt, pIdx) => (
                <Circle
                  key={`dot-${idx}-${pIdx}`}
                  x={pt.x}
                  y={pt.y}
                  radius={4}
                  fill="#ffffff"
                  stroke="#064e3b"
                  strokeWidth={2}
                />
              ))}
            </Group>
          ))}
        </Layer>

        {/* Labels Layer */}
        <Layer>
          {labels.map((lbl) => {
            const isLabelSelected = selectedElementId === lbl.id;
            const isLabelClusterSelected = selectedCluster && selectedCluster.labelIds && selectedCluster.labelIds.includes(lbl.id);
            const labelWidth = Math.max(60, lbl.text.length * lbl.font_size * 0.6 + 8);
            const labelHeight = lbl.font_size + 4;
            return (
              <Group
                key={lbl.id}
                id={lbl.id}
                x={0}
                y={0}
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
                  if (stage) resetCursor(stage);
                }}
                onMouseDown={(e) => {
                  if (activeTool === 'SELECT') {
                    setSelectedElementId(lbl.id);
                    e.cancelBubble = true;
                  }
                }}
                onClick={(e) => {
                  if (activeTool === 'ERASER') {
                    deleteLabel(lbl.id);
                    e.cancelBubble = true;
                  } else if (activeTool === 'SELECT') {
                    setSelectedElementId(lbl.id);
                    e.cancelBubble = true;
                  }
                }}
                onDblClick={(e) => {
                  if (activeTool === 'SELECT') {
                    setSelectedElementId(lbl.id);
                    e.cancelBubble = true;
                  }
                }}
                onDragStart={(e) => {
                  if (selectedCluster && selectedCluster.labelIds && selectedCluster.labelIds.includes(lbl.id)) {
                    handleClusterDragStart(e, lbl.id);
                  }
                }}
                onDragMove={(e) => {
                  if (selectedCluster && selectedCluster.labelIds && selectedCluster.labelIds.includes(lbl.id)) {
                    handleClusterDragMove(e, lbl.id);
                  }
                }}
                onDragEnd={(e) => {
                  if (selectedCluster && selectedCluster.labelIds && selectedCluster.labelIds.includes(lbl.id)) {
                    handleClusterDragEnd(e, lbl.id);
                    return;
                  }
                  handleDragEnd(e, lbl, false);
                }}
              >
                <Text
                  x={lbl.x_px}
                  y={lbl.y_px}
                  text={lbl.text}
                  fontSize={lbl.font_size}
                  fill={lbl.color && (lbl.color.toLowerCase() === '#ffffff' || lbl.color.toLowerCase() === '#fff') ? '#0f172a' : lbl.color}
                  align="center"
                  listening={false}
                />
                {(isLabelSelected || isLabelClusterSelected) && (
                  <Rect
                    x={lbl.x_px}
                    y={lbl.y_px - 2}
                    width={labelWidth}
                    height={labelHeight}
                    stroke="#4f46e5"
                    strokeWidth={1}
                    dash={(isLabelClusterSelected && !isLabelSelected) ? [3, 2] : []}
                    listening={false}
                  />
                )}
              </Group>
            );
          })}

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
            anchorSize={5}
            anchorCornerRadius={2}
            rotateAnchorOffset={15}
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

        {/* Legend Overlay */}
        {meta.showNumberLegend && legendMapping.length > 0 && (
          <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-slate-200 pointer-events-none z-10 min-w-[220px]">
            <h3 className="text-[11px] font-black text-slate-800 mb-3 uppercase tracking-widest border-b border-slate-100 pb-2">Master Plan (2D)</h3>
            <div className="space-y-2.5">
              {legendMapping.map(item => (
                <div key={item.number} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border border-slate-300 bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-800 shadow-sm shrink-0">
                    {item.number}
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 leading-tight">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
