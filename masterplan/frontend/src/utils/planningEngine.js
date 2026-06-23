import { pxToM } from './scaleUtils';
import * as turf from '@turf/turf';

export async function generateSuggestedLayout(siteWidthM, siteHeightM, projectId, features = null) {
  const canvasWidth = 960;
  const scale = parseFloat((canvasWidth / siteWidthM).toFixed(4));
  const canvasHeight = Math.round(siteHeightM * scale);

  const systemPrompt = `You are a masterplan layout engine for a luxury residential township tool.

Your ONLY job is to output a single valid JSON object. No explanation. No markdown. No preamble. Just raw JSON.

The JSON will be consumed directly by a React-Konva renderer.

All positions are expressed as percentages (0.0 to 1.0) of the canvas width and height.`;

  const userPrompt = `Generate a complete luxury residential township masterplan layout for a 25-acre site.

OUTPUT RULES:
- Return only a valid JSON object
- All coordinates are percentages of canvas (0.0 to 1.0)
- No coordinates outside 0.05 to 0.95 range
- Minimum 6 towers, maximum 8 towers
- Roads must use bezier tension curves, not straight lines

REQUIRED JSON STRUCTURE:

{
  "project": { ... },
  "land_use": { ... },
  "entry_points": [ ... ],
  "roads": [ ... ],
  "towers": [ ... ],
  "amenities": [ ... ],
  "pedestrian_paths": [ ... ],
  "landscape": {
    "tree_clusters": [ ... ],
    "water_features": [ ... ],
    "green_buffers": [ ... ]
  },
  "legend": [ ... ]
}

CRITICAL RULES:
- Output ONLY the JSON. Zero other text.
- Generate ALL 8 towers with unique positions that don't overlap
- Towers should surround the central amenity zone, not cluster together
- Roads must curve organically — no straight lines
- Central lawn must be an ellipse centered around 0.5, 0.55
- Clubhouse must be near the center
- Entry points on north and south edges
- Tree clusters must fill the perimeter and gaps between towers
- Every tower must have has_arrival_plaza: true

Then fill in the towers array completely.
Generate exactly 8 towers with footprint type from: cruciform, h_shaped, u_shaped, courtyard.
Distribute them around the central amenity zone at these approximate positions:
- Tower A: top-left (0.2, 0.18)
- Tower B: top-center (0.42, 0.15)
- Tower C: top-right (0.65, 0.18)
- Tower D: far-right (0.78, 0.35)
- Tower E: bottom-right (0.72, 0.72)
- Tower F: bottom-center (0.55, 0.8)
- Tower G: bottom-left (0.35, 0.78)
- Tower H: left (0.18, 0.55)`;

  let aiLayout = null;

  try {
    const response = await fetch('/api/ai/suggest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        project_id: projectId,
        site_width_m: siteWidthM,
        site_height_m: siteHeightM,
        features: features
      })
    });
    
    if (response.ok) {
      aiLayout = await response.json();
    } else {
      console.error("Backend AI generation failed, using fallback");
    }
  } catch (err) {
    console.error("Failed to connect to backend for AI layout, using fallback:", err);
  }

  if (!aiLayout) {
    // Fallback JSON if API fails or no key
    // Compute realistic sizes based on actual site dimensions
    const tw = Math.min(30 / siteWidthM, 0.10);   // ~30m tower
    const th = Math.min(22 / siteHeightM, 0.08);   // ~22m tower depth
    aiLayout = {
      "project": {
        "name": "Green Valley",
        "location": "Sector 79, Gurgaon",
        "total_area_acres": Math.round((siteWidthM * siteHeightM) / 4047),
        "total_towers": 8,
        "theme": "European Luxury Wellness Community"
      },
      "land_use": {
        "residential_pct": 22, "roads_pct": 14, "amenities_pct": 8, "clubhouse_pct": 4,
        "open_spaces_pct": 24, "parks_pct": 19, "utilities_pct": 2, "parking_pct": 5, "commercial_pct": 2
      },
      "entry_points": [
        { "id": "main_entry", "side": "south", "x_pct": 0.5, "y_pct": 0.93, "type": "main", "label": "Main Entry / Exit" },
        { "id": "secondary_entry", "side": "north", "x_pct": 0.5, "y_pct": 0.07, "type": "secondary", "label": "Secondary Entry / Exit" }
      ],
      "roads": [
        { "id": "main_boulevard", "type": "boulevard", "width_meters": 12, "points": [[0.5, 0.93], [0.48, 0.75], [0.5, 0.50], [0.52, 0.30], [0.5, 0.07]], "tension": 0.4, "has_median": true, "has_sidewalks": true, "has_trees": true },
        { "id": "inner_loop", "type": "loop", "width_meters": 9, "points": [[0.30, 0.30], [0.50, 0.20], [0.70, 0.30], [0.75, 0.50], [0.70, 0.70], [0.50, 0.80], [0.30, 0.70], [0.25, 0.50], [0.30, 0.30]], "tension": 0.4, "has_sidewalks": true, "has_trees": true }
      ],
      "towers": [
        { "id": "tower_a", "label": "Tower A", "footprint": "cruciform",  "x_pct": 0.15, "y_pct": 0.18, "width_pct": tw, "height_pct": th, "rotation_deg": 0, "floors": 28, "units": 120, "unit_type": "3BHK", "has_arrival_plaza": true, "has_drop_off_loop": true, "has_landscape_buffer": true },
        { "id": "tower_b", "label": "Tower B", "footprint": "h_shaped",   "x_pct": 0.42, "y_pct": 0.12, "width_pct": tw, "height_pct": th, "rotation_deg": 0, "floors": 28, "units": 120, "unit_type": "3BHK", "has_arrival_plaza": true, "has_drop_off_loop": true, "has_landscape_buffer": true },
        { "id": "tower_c", "label": "Tower C", "footprint": "u_shaped",   "x_pct": 0.70, "y_pct": 0.18, "width_pct": tw, "height_pct": th, "rotation_deg": 0, "floors": 28, "units": 120, "unit_type": "3BHK", "has_arrival_plaza": true, "has_drop_off_loop": true, "has_landscape_buffer": true },
        { "id": "tower_d", "label": "Tower D", "footprint": "courtyard",  "x_pct": 0.82, "y_pct": 0.42, "width_pct": tw, "height_pct": th, "rotation_deg": 0, "floors": 28, "units": 120, "unit_type": "3BHK", "has_arrival_plaza": true, "has_drop_off_loop": true, "has_landscape_buffer": true },
        { "id": "tower_e", "label": "Tower E", "footprint": "cruciform",  "x_pct": 0.75, "y_pct": 0.72, "width_pct": tw, "height_pct": th, "rotation_deg": 0, "floors": 28, "units": 120, "unit_type": "3BHK", "has_arrival_plaza": true, "has_drop_off_loop": true, "has_landscape_buffer": true },
        { "id": "tower_f", "label": "Tower F", "footprint": "h_shaped",   "x_pct": 0.50, "y_pct": 0.82, "width_pct": tw, "height_pct": th, "rotation_deg": 0, "floors": 28, "units": 120, "unit_type": "3BHK", "has_arrival_plaza": true, "has_drop_off_loop": true, "has_landscape_buffer": true },
        { "id": "tower_g", "label": "Tower G", "footprint": "u_shaped",   "x_pct": 0.25, "y_pct": 0.78, "width_pct": tw, "height_pct": th, "rotation_deg": 0, "floors": 28, "units": 120, "unit_type": "3BHK", "has_arrival_plaza": true, "has_drop_off_loop": true, "has_landscape_buffer": true },
        { "id": "tower_h", "label": "Tower H", "footprint": "courtyard",  "x_pct": 0.12, "y_pct": 0.50, "width_pct": tw, "height_pct": th, "rotation_deg": 0, "floors": 28, "units": 120, "unit_type": "3BHK", "has_arrival_plaza": true, "has_drop_off_loop": true, "has_landscape_buffer": true }
      ],
      "amenities": [
        { "id": "clubhouse", "type": "clubhouse", "label": "Clubhouse", "shape": "rect", "x_pct": 0.43, "y_pct": 0.43, "width_pct": Math.min(40/siteWidthM, 0.12), "height_pct": Math.min(25/siteHeightM, 0.08) },
        { "id": "swimming_pool", "type": "pool", "label": "Swimming Pool", "shape": "rect", "x_pct": 0.40, "y_pct": 0.36, "width_pct": Math.min(25/siteWidthM, 0.08), "height_pct": Math.min(12/siteHeightM, 0.04) },
        { "id": "central_lawn", "type": "central_lawn", "label": "Central Lawn", "shape": "ellipse", "cx_pct": 0.50, "cy_pct": 0.55, "rx_pct": 0.08, "ry_pct": 0.06 },
        { "id": "tennis_court", "type": "sports", "label": "Tennis Court", "shape": "rect", "x_pct": 0.56, "y_pct": 0.38, "width_pct": Math.min(24/siteWidthM, 0.07), "height_pct": Math.min(11/siteHeightM, 0.04) },
        { "id": "kids_play", "type": "kids", "label": "Kids Play Area", "shape": "rect", "x_pct": 0.44, "y_pct": 0.62, "width_pct": Math.min(15/siteWidthM, 0.05), "height_pct": Math.min(15/siteHeightM, 0.05) }
      ],
      "pedestrian_paths": [
        { "id": "jogging_track", "type": "jogging", "points": [[0.28, 0.28], [0.50, 0.18], [0.72, 0.28], [0.77, 0.50], [0.72, 0.72], [0.50, 0.80], [0.28, 0.72], [0.23, 0.50], [0.28, 0.28]], "tension": 0.4, "width_meters": 2 }
      ],
      "landscape": {
        "tree_clusters": [
          { "id": "tc1", "cx_pct": 0.10, "cy_pct": 0.35, "radius_pct": 0.03, "density": "high" },
          { "id": "tc2", "cx_pct": 0.88, "cy_pct": 0.55, "radius_pct": 0.03, "density": "high" },
          { "id": "tc3", "cx_pct": 0.50, "cy_pct": 0.10, "radius_pct": 0.025, "density": "medium" },
          { "id": "tc4", "cx_pct": 0.50, "cy_pct": 0.90, "radius_pct": 0.025, "density": "medium" }
        ],
        "water_features": [
          { "id": "wf1", "type": "fountain", "cx_pct": 0.50, "cy_pct": 0.50, "radius_pct": 0.015 }
        ],
        "green_buffers": [
          { "id": "gb1", "type": "boundary_green", "inset_pct": 0.03 }
        ]
      }
    };
  }

  // Convert AI layout to application layout format
  let zones = [];
  let amenities = [];
  let roads = [];

  // Helper to create boundary polygon in percentage coordinates
  let boundsPolyPct = null;
  if (features && features.boundary_geojson) {
    try {
      const geojson = JSON.parse(features.boundary_geojson);
      if (geojson && geojson.geometry && geojson.geometry.coordinates) {
        const coords = geojson.geometry.coordinates[0];
        const lats = coords.map(c => c[1]);
        const lngs = coords.map(c => c[0]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const centerLat = (minLat + maxLat) / 2;

        const polyPtsPct = coords.map(c => {
          const x = (c[0] - minLng) * 111320 * Math.cos(centerLat * Math.PI / 180);
          const y = (maxLat - c[1]) * 111320;
          return [
            Math.max(0, Math.min(1, x / siteWidthM)),
            Math.max(0, Math.min(1, y / siteHeightM))
          ];
        });
        boundsPolyPct = turf.polygon([polyPtsPct]);
      }
    } catch (e) {
      console.warn("Could not parse boundary for collision", e);
    }
  }

  const enforceBounds = (item) => {
    if (!boundsPolyPct || item.shape === 'ellipse') return true;
    const pt = turf.point([item.x_pct || item.cx_pct || 0.5, item.y_pct || item.cy_pct || 0.5]);
    if (!turf.booleanPointInPolygon(pt, boundsPolyPct)) {
      // Snap to nearest point on the polygon line
      const nearest = turf.nearestPointOnLine(turf.polygonToLine(boundsPolyPct), pt);
      if (nearest && nearest.geometry && nearest.geometry.coordinates) {
        if (item.x_pct !== undefined) item.x_pct = nearest.geometry.coordinates[0];
        if (item.cx_pct !== undefined) item.cx_pct = nearest.geometry.coordinates[0];
        if (item.y_pct !== undefined) item.y_pct = nearest.geometry.coordinates[1];
        if (item.cy_pct !== undefined) item.cy_pct = nearest.geometry.coordinates[1];
        // Move inwards slightly
        if (item.x_pct) item.x_pct += (0.5 - item.x_pct) * 0.05;
        if (item.cx_pct) item.cx_pct += (0.5 - item.cx_pct) * 0.05;
        if (item.y_pct) item.y_pct += (0.5 - item.y_pct) * 0.05;
        if (item.cy_pct) item.cy_pct += (0.5 - item.cy_pct) * 0.05;
      }
    }
    return true;
  };

  // 1. Process Towers (zones)
  if (aiLayout.towers) {
    aiLayout.towers.forEach(t => {
      enforceBounds(t);
      zones.push({
        id: t.id,
        type: "residential",
        label: t.label,
        x_px: t.x_pct * canvasWidth,
        y_px: t.y_pct * canvasHeight,
        width_px: t.width_pct * canvasWidth,
        height_px: t.height_pct * canvasHeight,
        x_m: t.x_pct * siteWidthM,
        y_m: t.y_pct * siteHeightM,
        width_m: t.width_pct * siteWidthM,
        height_m: t.height_pct * siteHeightM,
        floors: t.floors,
        color: "#3B82F6",
        opacity: 0.85,
        rotation_deg: t.rotation_deg || 0,
        footprint: t.footprint,
        has_arrival_plaza: t.has_arrival_plaza,
        properties: {
          units: t.units,
          unit_type: t.unit_type
        }
      });
    });
  }

  // 2. Process Amenities & Entry Points
  if (aiLayout.amenities) {
    aiLayout.amenities.forEach(a => {
      enforceBounds(a);
      amenities.push({
        id: a.id,
        type: a.type,
        label: a.label,
        shape: a.shape,
        x_px: a.shape === 'ellipse' ? a.cx_pct * canvasWidth : a.x_pct * canvasWidth,
        y_px: a.shape === 'ellipse' ? a.cy_pct * canvasHeight : a.y_pct * canvasHeight,
        width_px: a.shape === 'ellipse' ? a.rx_pct * 2 * canvasWidth : a.width_pct * canvasWidth,
        height_px: a.shape === 'ellipse' ? a.ry_pct * 2 * canvasHeight : a.height_pct * canvasHeight,
        x_m: a.shape === 'ellipse' ? a.cx_pct * siteWidthM : a.x_pct * siteWidthM,
        y_m: a.shape === 'ellipse' ? a.cy_pct * siteHeightM : a.y_pct * siteHeightM,
        width_m: a.shape === 'ellipse' ? a.rx_pct * 2 * siteWidthM : a.width_pct * siteWidthM,
        height_m: a.shape === 'ellipse' ? a.ry_pct * 2 * siteHeightM : a.height_pct * siteHeightM,
      });
    });
  }
  
  if (aiLayout.entry_points) {
    aiLayout.entry_points.forEach(e => {
      enforceBounds(e);
      amenities.push({
        id: e.id,
        type: "entry_exit",
        label: e.label,
        x_px: e.x_pct * canvasWidth - 10,
        y_px: e.y_pct * canvasHeight - 10,
        width_px: 20,
        height_px: 20,
        x_m: e.x_pct * siteWidthM - 2.5,
        y_m: e.y_pct * siteHeightM - 2.5,
        width_m: 5,
        height_m: 5,
      });
    });
  }

  // 3. Process Roads & Paths
  if (aiLayout.roads) {
    aiLayout.roads.forEach(r => {
      roads.push({
        id: r.id,
        type: "primary",
        label: r.id.replace('_', ' '),
        points_px: r.points.map(p => [p[0] * canvasWidth, p[1] * canvasHeight]),
        points_m: r.points.map(p => [p[0] * siteWidthM, p[1] * siteHeightM]),
        width_px: r.width_meters * scale,
        width_m: r.width_meters,
        color: "#64748B",
        tension: r.tension || 0,
        has_median: r.has_median || false,
        median_width_m: r.has_median ? 2 : 0
      });
    });
  }
  
  if (aiLayout.pedestrian_paths) {
    aiLayout.pedestrian_paths.forEach(p => {
      roads.push({
        id: p.id,
        type: "pedestrian",
        label: p.id.replace('_', ' '),
        points_px: p.points.map(pt => [pt[0] * canvasWidth, pt[1] * canvasHeight]),
        points_m: p.points.map(pt => [pt[0] * siteWidthM, pt[1] * siteHeightM]),
        width_px: (p.width_meters || 2) * scale,
        width_m: p.width_meters || 2,
        color: "#95A5A6",
        tension: p.tension || 0,
        has_median: false,
        median_width_m: 0
      });
    });
  }
  
  // Add tree clusters to amenities/landscape
  if (aiLayout.landscape && aiLayout.landscape.tree_clusters) {
    aiLayout.landscape.tree_clusters.forEach(tc => {
      enforceBounds(tc);
      amenities.push({
        id: tc.id,
        type: "tree_cluster",
        label: "Tree Cluster",
        shape: "circle",
        x_px: tc.cx_pct * canvasWidth,
        y_px: tc.cy_pct * canvasHeight,
        width_px: tc.radius_pct * 2 * canvasWidth,
        height_px: tc.radius_pct * 2 * canvasHeight,
        x_m: tc.cx_pct * siteWidthM,
        y_m: tc.cy_pct * siteHeightM,
        width_m: tc.radius_pct * 2 * siteWidthM,
        height_m: tc.radius_pct * 2 * siteHeightM,
        density: tc.density
      });
    });
  }

  return {
    version: "1.0",
    project_id: projectId,
    meta: {
      site_width_m: siteWidthM,
      site_height_m: siteHeightM,
      canvas_width_px: canvasWidth,
      canvas_height_px: canvasHeight,
      scale_px_per_m: scale,
      north_angle_deg: 0,
      total_area_sqm: siteWidthM * siteHeightM,
      masterplan_ai: aiLayout
    },
    zones,
    roads,
    amenities,
    labels: []
  };
}
