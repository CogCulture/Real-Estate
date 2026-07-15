const fs = require('fs');
let code = fs.readFileSync('masterplan/frontend/src/components/editor/Canvas2D.jsx', 'utf8');

const regex = /if \(e\.key === 'Delete' \|\| e\.key === 'Backspace'\) \{/;

const replacement = `      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!selectedElementId) return;
        
        // Prevent default scrolling
        e.preventDefault();

        const moveStep = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -moveStep : e.key === 'ArrowRight' ? moveStep : 0;
        const dy = e.key === 'ArrowUp' ? -moveStep : e.key === 'ArrowDown' ? moveStep : 0;
        
        const zone = zones.find(z => z.id === selectedElementId);
        if (zone && zone.points_px && zone.points_px.length > 0) {
          const updatedPointsPx = zone.points_px.map(p => [p[0] + dx, p[1] + dy]);
          const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
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
          });
          return;
        }

        const amenity = amenities.find(a => a.id === selectedElementId);
        if (amenity && amenity.points_px && amenity.points_px.length > 0) {
          const updatedPointsPx = amenity.points_px.map(p => [p[0] + dx, p[1] + dy]);
          const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
          const bbox = getPolygonBoundingBox(updatedPointsPx);
          updateAmenity(amenity.id, {
            points_px: updatedPointsPx,
            points_m: updatedPointsM,
            x_px: bbox.minX,
            y_px: bbox.minY,
            x_m: pxToM(bbox.minX, scale),
            y_m: pxToM(bbox.minY, scale)
          });
          return;
        }
        
        const road = roads.find(r => r.id === selectedElementId);
        if (road && road.points_px && road.points_px.length > 0) {
          const updatedPointsPx = road.points_px.map(p => [p[0] + dx, p[1] + dy]);
          const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
          updateRoad(road.id, {
            points_px: updatedPointsPx,
            points_m: updatedPointsM
          });
          return;
        }
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {`;

code = code.replace(regex, replacement);
fs.writeFileSync('masterplan/frontend/src/components/editor/Canvas2D.jsx', code);
