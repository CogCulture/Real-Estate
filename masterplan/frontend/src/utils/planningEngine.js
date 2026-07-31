import { pxToM } from './scaleUtils';
import * as turf from '@turf/turf';

export async function generateSuggestedLayout(siteWidthM, siteHeightM, projectId, features = null) {
  const canvasWidth = 960;
  const scale = features?.scale || parseFloat((canvasWidth / siteWidthM).toFixed(4));
  const canvasHeight = Math.round(siteHeightM * scale);
  const land_offset_x_m = features?.land_offset_x_m || 0;
  const land_offset_y_m = features?.land_offset_y_m || 0;

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
    // Dynamically generate a randomized, high-quality luxury masterplan layout fallbacks
    const tw = Math.min(30 / siteWidthM, 0.10);   // ~30m tower width
    const th = Math.min(22 / siteHeightM, 0.08);   // ~22m tower depth

    const names = ["Elysian Heights", "Pinecrest Groves", "Vanderbilt Meadows", "Amberwood Reserve", "Orchard Ridge", "Windermere Oasis"];
    const themes = ["Modern Wellness Sanctuary", "European Heritage Estates", "Classic Contemporary Garden Living", "Neo-Classical Township Retreat"];
    const name = names[Math.floor(Math.random() * names.length)];
    const theme = themes[Math.floor(Math.random() * themes.length)];

    const entryX = 0.45 + Math.random() * 0.1;
    const entryPoints = [
      { "id": "main_entry", "side": "south", "x_pct": entryX, "y_pct": 0.93, "type": "main", "label": "Main Entry / Exit" },
      { "id": "secondary_entry", "side": "north", "x_pct": entryX + (Math.random() * 0.08 - 0.04), "y_pct": 0.07, "type": "secondary", "label": "Secondary Entry / Exit" }
    ];

    // Centering with random offset
    const cx = 0.5 + (Math.random() * 0.06 - 0.03);
    const cy = 0.52 + (Math.random() * 0.06 - 0.03);

    // Towers distribution
    const numTowers = 6 + Math.floor(Math.random() * 3); // 6, 7 or 8 towers
    const towers = [];
    const footprints = ["cruciform", "h_shaped", "u_shaped", "courtyard"];
    const rotations = [0, 45, 90, 135];
    const towerRadius = 0.32 + Math.random() * 0.04;

    for (let i = 0; i < numTowers; i++) {
      const angle = (i * 2 * Math.PI) / numTowers + (Math.random() * 0.15 - 0.075);
      const tx = cx + Math.cos(angle) * towerRadius;
      const ty = cy + Math.sin(angle) * towerRadius;
      const letter = String.fromCharCode(65 + i);

      towers.push({
        "id": `tower_${letter.toLowerCase()}`,
        "label": `Tower ${letter}`,
        "footprint": footprints[Math.floor(Math.random() * footprints.length)],
        "x_pct": tx - tw / 2,
        "y_pct": ty - th / 2,
        "width_pct": tw,
        "height_pct": th,
        "rotation_deg": rotations[Math.floor(Math.random() * rotations.length)],
        "floors": 18 + Math.floor(Math.random() * 19), // 18 to 36 floors
        "units": 80 + Math.floor(Math.random() * 80),
        "unit_type": Math.random() > 0.5 ? "3BHK" : "4BHK",
        "has_arrival_plaza": true,
        "has_drop_off_loop": true,
        "has_landscape_buffer": true
      });
    }

    // Roads
    // Main boulevard going south to north
    const mainBoulevardPts = [
      [entryPoints[0].x_pct, entryPoints[0].y_pct],
      [entryX + (Math.random() * 0.06 - 0.03), 0.72],
      [cx + (Math.random() * 0.04 - 0.02), cy],
      [entryX + (Math.random() * 0.06 - 0.03), 0.28],
      [entryPoints[1].x_pct, entryPoints[1].y_pct]
    ];

    // Inner loop road following towers but inset
    const innerLoopPts = [];
    const loopRadius = towerRadius - 0.10;
    for (let i = 0; i < numTowers; i++) {
      const angle = (i * 2 * Math.PI) / numTowers;
      const lx = cx + Math.cos(angle) * loopRadius;
      const ly = cy + Math.sin(angle) * loopRadius;
      innerLoopPts.push([lx, ly]);
    }
    // Close the loop
    innerLoopPts.push([innerLoopPts[0][0], innerLoopPts[0][1]]);

    const roads = [
      { "id": "main_boulevard", "type": "boulevard", "width_meters": 12, "points": mainBoulevardPts, "tension": 0.4, "has_median": true, "has_sidewalks": true, "has_trees": true },
      { "id": "inner_loop", "type": "loop", "width_meters": 9, "points": innerLoopPts, "tension": 0.4, "has_sidewalks": true, "has_trees": true }
    ];

    // Amenities
    const clubhouseW = Math.min(40 / siteWidthM, 0.12);
    const clubhouseH = Math.min(25 / siteHeightM, 0.08);
    const clubhouseX = cx - clubhouseW / 2 + (Math.random() * 0.04 - 0.02);
    const clubhouseY = cy - 0.08 + (Math.random() * 0.04 - 0.02);

    const poolW = Math.min(25 / siteWidthM, 0.08);
    const poolH = Math.min(12 / siteHeightM, 0.04);
    const poolX = clubhouseX + (Math.random() > 0.5 ? clubhouseW + 0.02 : -poolW - 0.02);
    const poolY = clubhouseY + (clubhouseH - poolH) / 2;

    const lawnRx = 0.06 + Math.random() * 0.03;
    const lawnRy = 0.05 + Math.random() * 0.02;
    const lawnCx = cx;
    const lawnCy = cy + 0.08 + (Math.random() * 0.04 - 0.02);

    const tennisW = Math.min(24 / siteWidthM, 0.07);
    const tennisH = Math.min(11 / siteHeightM, 0.04);
    const tennisX = cx + (Math.random() > 0.5 ? 0.15 : -0.15 - tennisW);
    const tennisY = cy + (Math.random() * 0.08 - 0.04);

    const kidsW = Math.min(15 / siteWidthM, 0.05);
    const kidsH = Math.min(15 / siteHeightM, 0.05);
    const kidsX = cx + (Math.random() > 0.5 ? -0.12 : 0.12 - kidsW);
    const kidsY = cy + 0.18 + (Math.random() * 0.04 - 0.02);

    const amenities = [
      { "id": "clubhouse", "type": "clubhouse", "label": "Grand Clubhouse", "shape": "rect", "x_pct": clubhouseX, "y_pct": clubhouseY, "width_pct": clubhouseW, "height_pct": clubhouseH },
      { "id": "swimming_pool", "type": "pool", "label": "Luxury Pool", "shape": "rect", "x_pct": poolX, "y_pct": poolY, "width_pct": poolW, "height_pct": poolH },
      { "id": "central_lawn", "type": "central_lawn", "label": "Central Green", "shape": "ellipse", "cx_pct": lawnCx, "cy_pct": lawnCy, "rx_pct": lawnRx, "ry_pct": lawnRy },
      { "id": "tennis_court", "type": "sports", "label": "Tennis Court", "shape": "rect", "x_pct": tennisX, "y_pct": tennisY, "width_pct": tennisW, "height_pct": tennisH },
      { "id": "kids_play", "type": "kids", "label": "Kids Play Zone", "shape": "rect", "x_pct": kidsX, "y_pct": kidsY, "width_pct": kidsW, "height_pct": kidsH }
    ];

    // Pedestrian jogging track running outer perimeter
    const jogPts = [];
    const jogRadius = towerRadius + 0.06;
    for (let i = 0; i < numTowers; i++) {
      const angle = (i * 2 * Math.PI) / numTowers;
      const jx = cx + Math.cos(angle) * jogRadius;
      const jy = cy + Math.sin(angle) * jogRadius;
      jogPts.push([jx, jy]);
    }
    jogPts.push([jogPts[0][0], jogPts[0][1]]);

    const pedestrian_paths = [
      { "id": "jogging_track", "type": "jogging", "points": jogPts, "tension": 0.4, "width_meters": 2 }
    ];

    // Tree clusters outer perimeter
    const tree_clusters = [];
    for (let i = 0; i < numTowers; i++) {
      const angle = ((i + 0.5) * 2 * Math.PI) / numTowers + (Math.random() * 0.1 - 0.05);
      const tx = cx + Math.cos(angle) * (towerRadius + 0.08);
      const ty = cy + Math.sin(angle) * (towerRadius + 0.08);
      tree_clusters.push({
        "id": `tc_${i}`,
        "cx_pct": tx,
        "cy_pct": ty,
        "radius_pct": 0.02 + Math.random() * 0.015,
        "density": Math.random() > 0.4 ? "medium" : "high"
      });
    }

    aiLayout = {
      "project": {
        "name": name,
        "location": "Developer Design Workspace",
        "total_area_acres": Math.round((siteWidthM * siteHeightM) / 4047),
        "total_towers": numTowers,
        "theme": theme
      },
      "land_use": {
        "residential_pct": 20, "roads_pct": 12, "amenities_pct": 8, "clubhouse_pct": 4,
        "open_spaces_pct": 26, "parks_pct": 18, "utilities_pct": 2, "parking_pct": 6, "commercial_pct": 4
      },
      entry_points: entryPoints,
      roads: roads,
      towers: towers,
      amenities: amenities,
      pedestrian_paths: pedestrian_paths,
      "landscape": {
        "tree_clusters": tree_clusters,
        "water_features": [
          { "id": "wf1", "type": "fountain", "cx_pct": cx, "cy_pct": cy, "radius_pct": 0.015 }
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
  let boundsPolyPct = null;

  let minX = 0.05, maxX = 0.95, minY = 0.05, maxY = 0.95;
  let centroidPct = [0.5, 0.5];
  let polyPtsPct = [];

  if (features && features.boundary_geojson) {
    try {
      const geojson = typeof features.boundary_geojson === 'string'
        ? JSON.parse(features.boundary_geojson)
        : features.boundary_geojson;
      if (geojson && geojson.geometry && geojson.geometry.coordinates) {
        const coords = geojson.geometry.coordinates[0];
        const lats = coords.map(c => c[1]);
        const lngs = coords.map(c => c[0]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const centerLat = (minLat + maxLat) / 2;

        polyPtsPct = coords.map(c => {
          const x = (c[0] - minLng) * 111320 * Math.cos(centerLat * Math.PI / 180);
          const y = (maxLat - c[1]) * 111320;
          return [
            Math.max(0.01, Math.min(0.99, x / siteWidthM)),
            Math.max(0.01, Math.min(0.99, y / siteHeightM))
          ];
        });
        boundsPolyPct = turf.polygon([polyPtsPct]);

        const xVals = polyPtsPct.map(p => p[0]);
        const yVals = polyPtsPct.map(p => p[1]);
        minX = Math.min(...xVals);
        maxX = Math.max(...xVals);
        minY = Math.min(...yVals);
        maxY = Math.max(...yVals);

        const sumX = xVals.reduce((a, b) => a + b, 0);
        const sumY = yVals.reduce((a, b) => a + b, 0);
        centroidPct = [sumX / xVals.length, sumY / yVals.length];
      }
    } catch (e) {
      console.warn("Could not parse boundary for collision", e);
    }
  }

  const marginInset = 0.04;
  const targetMinX = Math.max(0.02, minX + marginInset);
  const targetMaxX = Math.min(0.98, maxX - marginInset);
  const targetMinY = Math.max(0.02, minY + marginInset);
  const targetMaxY = Math.min(0.98, maxY - marginInset);

  // Proportional size scaling factor based on sitemap width and height
  const sizeScaleFactor = boundsPolyPct ? Math.max(0.4, Math.min(targetMaxX - targetMinX, targetMaxY - targetMinY)) : 1.0;

  const mapCoordinate = (x, y) => {
    const newX = targetMinX + x * (targetMaxX - targetMinX);
    const newY = targetMinY + y * (targetMaxY - targetMinY);
    return [newX, newY];
  };

  const constrainToPolygon = (x, y) => {
    let px = x;
    let py = y;
    if (!boundsPolyPct) {
      const MARGIN = 0.06;
      return [
        Math.max(MARGIN, Math.min(1 - MARGIN, px)),
        Math.max(MARGIN, Math.min(1 - MARGIN, py))
      ];
    }

    const pt = turf.point([px, py]);
    if (turf.booleanPointInPolygon(pt, boundsPolyPct)) {
      return [px, py];
    }

    // Contraction mapping toward sitemap centroid coordinates
    const cx = centroidPct[0];
    const cy = centroidPct[1];
    for (let i = 0; i < 25; i++) {
      px = px + 0.15 * (cx - px);
      py = py + 0.15 * (cy - py);
      if (turf.booleanPointInPolygon(turf.point([px, py]), boundsPolyPct)) {
        break;
      }
    }
    return [px, py];
  };

  // 1. Process Towers (zones)
  if (aiLayout.towers) {
    aiLayout.towers.forEach(t => {
      // Scale footprint dimensions proportionally to sitemap size
      t.width_pct = t.width_pct * sizeScaleFactor;
      t.height_pct = t.height_pct * sizeScaleFactor;

      // Project and constrain coordinates inside the sitemap boundaries
      const oldCx = t.x_pct + t.width_pct / 2;
      const oldCy = t.y_pct + t.height_pct / 2;
      const [mappedCx, mappedCy] = mapCoordinate(oldCx, oldCy);
      const [finalCx, finalCy] = constrainToPolygon(mappedCx, mappedCy);

      t.x_pct = finalCx - t.width_pct / 2;
      t.y_pct = finalCy - t.height_pct / 2;

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
      if (a.shape === 'ellipse') {
        a.rx_pct = a.rx_pct * sizeScaleFactor;
        a.ry_pct = a.ry_pct * sizeScaleFactor;

        const [mappedCx, mappedCy] = mapCoordinate(a.cx_pct, a.cy_pct);
        const [finalCx, finalCy] = constrainToPolygon(mappedCx, mappedCy);

        a.cx_pct = finalCx;
        a.cy_pct = finalCy;
      } else {
        a.width_pct = a.width_pct * sizeScaleFactor;
        a.height_pct = a.height_pct * sizeScaleFactor;

        const oldCx = a.x_pct + a.width_pct / 2;
        const oldCy = a.y_pct + a.height_pct / 2;
        const [mappedCx, mappedCy] = mapCoordinate(oldCx, oldCy);
        const [finalCx, finalCy] = constrainToPolygon(mappedCx, mappedCy);

        a.x_pct = finalCx - a.width_pct / 2;
        a.y_pct = finalCy - a.height_pct / 2;
      }

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
      const [mappedX, mappedY] = mapCoordinate(e.x_pct, e.y_pct);
      const [finalX, finalY] = constrainToPolygon(mappedX, mappedY);

      e.x_pct = finalX;
      e.y_pct = finalY;

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
      const clampedPoints = r.points.map(pt => {
        const [mx, my] = mapCoordinate(pt[0], pt[1]);
        return constrainToPolygon(mx, my);
      });
      roads.push({
        id: r.id,
        type: "primary",
        label: r.id.replace('_', ' '),
        points_px: clampedPoints.map(p => [p[0] * canvasWidth, p[1] * canvasHeight]),
        points_m: clampedPoints.map(p => [p[0] * siteWidthM, p[1] * siteHeightM]),
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
      const clampedPoints = p.points.map(pt => {
        const [mx, my] = mapCoordinate(pt[0], pt[1]);
        return constrainToPolygon(mx, my);
      });
      roads.push({
        id: p.id,
        type: "pedestrian",
        label: p.id.replace('_', ' '),
        points_px: clampedPoints.map(pt => [pt[0] * canvasWidth, pt[1] * canvasHeight]),
        points_m: clampedPoints.map(pt => [pt[0] * siteWidthM, pt[1] * siteHeightM]),
        width_px: (p.width_meters || 2) * scale,
        width_m: p.width_meters || 2,
        color: "#95A5A6",
        tension: p.tension || 0,
        has_median: false,
        median_width_m: 0
      });
    });
  }

  // Connect entry points to nearest road endpoint
  // For each entry, snap the closest road start/end point to the entry position
  if (aiLayout.entry_points && roads.length > 0) {
    aiLayout.entry_points.forEach(entry => {
      const ex = entry.x_pct * canvasWidth;
      const ey = entry.y_pct * canvasHeight;

      let bestRoad = null;
      let bestEndIdx = null; // 0 = first point, -1 = last point
      let bestDist = Infinity;

      roads.forEach(road => {
        if (!road.points_px || road.points_px.length < 2) return;
        // Check first point
        const fp = road.points_px[0];
        const distFirst = Math.sqrt((fp[0] - ex) ** 2 + (fp[1] - ey) ** 2);
        if (distFirst < bestDist) {
          bestDist = distFirst;
          bestRoad = road;
          bestEndIdx = 0;
        }
        // Check last point
        const lp = road.points_px[road.points_px.length - 1];
        const distLast = Math.sqrt((lp[0] - ex) ** 2 + (lp[1] - ey) ** 2);
        if (distLast < bestDist) {
          bestDist = distLast;
          bestRoad = road;
          bestEndIdx = road.points_px.length - 1;
        }
      });

      // Snap the nearest road endpoint to the entry gate position
      if (bestRoad && bestDist < canvasWidth * 0.5) {
        bestRoad.points_px[bestEndIdx] = [ex, ey];
        bestRoad.points_m[bestEndIdx] = [entry.x_pct * siteWidthM, entry.y_pct * siteHeightM];
      }
    });
  }

  // Add tree clusters to amenities/landscape
  if (aiLayout.landscape && aiLayout.landscape.tree_clusters) {
    aiLayout.landscape.tree_clusters.forEach(tc => {
      tc.radius_pct = tc.radius_pct * sizeScaleFactor;

      const [mappedCx, mappedCy] = mapCoordinate(tc.cx_pct, tc.cy_pct);
      const [finalCx, finalCy] = constrainToPolygon(mappedCx, mappedCy);

      tc.cx_pct = finalCx;
      tc.cy_pct = finalCy;

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

  // --- OVERLAP RESOLUTION RELAXATION SOLVER ---
  if (boundsPolyPct && (zones.length > 0 || amenities.length > 0)) {
    let particles = [];

    zones.forEach(z => {
      particles.push({
        type: 'zone',
        ref: z,
        x: z.x_m,
        y: z.y_m,
        w: z.width_m,
        h: z.height_m,
        r: Math.max(z.width_m, z.height_m) / 1.7,
        shape: 'rect',
        isStatic: false
      });
    });

    amenities.forEach(a => {
      if (a.type === 'tree_cluster' || a.type === 'entry_exit') return;
      particles.push({
        type: 'amenity',
        ref: a,
        x: a.x_m,
        y: a.y_m,
        w: a.width_m,
        h: a.height_m,
        r: Math.max(a.width_m, a.height_m) / 1.7,
        shape: a.shape || 'rect',
        isStatic: false
      });
    });

    // Add road points as static repellers so amenities & zones avoid roads
    roads.forEach(r => {
      if (!r.points_m) return;
      r.points_m.forEach(p => {
        particles.push({
          type: 'road',
          x: p[0],
          y: p[1],
          r: r.width_m / 1.4, // Road impact radius
          isStatic: true
        });
      });
    });

    // 32 relaxation iterations
    for (let iter = 0; iter < 32; iter++) {
      // A. Push overlapping particles apart
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];

          // If both are static (e.g. roads), they don't interact
          if (p1.isStatic && p2.isStatic) continue;

          const c1x = p1.shape === 'ellipse' ? p1.x : p1.x + (p1.w || 0) / 2;
          const c1y = p1.shape === 'ellipse' ? p1.y : p1.y + (p1.h || 0) / 2;
          const c2x = p2.shape === 'ellipse' ? p2.x : p2.x + (p2.w || 0) / 2;
          const c2y = p2.shape === 'ellipse' ? p2.y : p2.y + (p2.h || 0) / 2;

          const dx = c1x - c2x;
          const dy = c1y - c2y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const minDist = p1.r + p2.r + 5.0; // 5.0m buffer spacing

          if (dist < minDist) {
            const overlap = minDist - dist;
            const pushX = (dx / dist) * overlap * 0.5;
            const pushY = (dy / dist) * overlap * 0.5;

            if (!p1.isStatic) {
              p1.x += pushX * (p2.isStatic ? 2.0 : 1.0);
              p1.y += pushY * (p2.isStatic ? 2.0 : 1.0);
            }
            if (!p2.isStatic) {
              p2.x -= pushX * (p1.isStatic ? 2.0 : 1.0);
              p2.y -= pushY * (p1.isStatic ? 2.0 : 1.0);
            }
          }
        }
      }

      // B. Re-constrain shifted particles to sitemap boundary
      particles.forEach(p => {
        if (p.isStatic) return;

        const cx = p.shape === 'ellipse' ? p.x : p.x + p.w / 2;
        const cy = p.shape === 'ellipse' ? p.y : p.y + p.h / 2;

        let pctCx = cx / siteWidthM;
        let pctCy = cy / siteHeightM;

        const [finalCx, finalCy] = constrainToPolygon(pctCx, pctCy);

        if (p.shape === 'ellipse') {
          p.x = finalCx * siteWidthM;
          p.y = finalCy * siteHeightM;
        } else {
          p.x = finalCx * siteWidthM - p.w / 2;
          p.y = finalCy * siteHeightM - p.h / 2;
        }
      });
    }

    // Write back final relaxed coordinates to elements
    particles.forEach(p => {
      if (p.isStatic) return;

      const item = p.ref;
      item.x_m = p.x;
      item.y_m = p.y;
      
      const pctX = p.x / siteWidthM;
      const pctY = p.y / siteHeightM;

      if (p.shape === 'ellipse') {
        item.cx_pct = pctX;
        item.cy_pct = pctY;
        item.x_px = pctX * canvasWidth;
        item.y_px = pctY * canvasHeight;
      } else {
        item.x_pct = pctX;
        item.y_pct = pctY;
        item.x_px = pctX * canvasWidth;
        item.y_px = pctY * canvasHeight;
      }
    });
  }

  // Shift all generated items by land offset in both meters and pixels to stay inside sitemap boundary
  if (land_offset_x_m !== 0 || land_offset_y_m !== 0) {
    zones.forEach(z => {
      z.x_m += land_offset_x_m;
      z.x_px = z.x_m * scale;
      z.y_m += land_offset_y_m;
      z.y_px = z.y_m * scale;
    });

    amenities.forEach(a => {
      a.x_m += land_offset_x_m;
      a.x_px = a.x_m * scale;
      a.y_m += land_offset_y_m;
      a.y_px = a.y_m * scale;
    });

    roads.forEach(r => {
      if (r.points_m) {
        r.points_m = r.points_m.map(pt => [pt[0] + land_offset_x_m, pt[1] + land_offset_y_m]);
      }
      if (r.points_px) {
        r.points_px = r.points_m.map(pt => [pt[0] * scale, pt[1] * scale]);
      }
    });
  }

  return {
    version: "1.0",
    project_id: projectId,
    meta: {
      site_width_m: siteWidthM,
      site_height_m: siteHeightM,
      canvas_width_px: siteWidthM * scale,
      canvas_height_px: siteHeightM * scale,
      scale_px_per_m: scale,
      north_angle_deg: features?.north_angle_deg || 0,
      showNumberLegend: features?.showNumberLegend !== false,
      showSetback: features?.showSetback !== false,
      total_area_sqm: siteWidthM * siteHeightM,
      masterplan_ai: aiLayout
    },
    zones,
    roads,
    amenities,
    labels: []
  };
}
