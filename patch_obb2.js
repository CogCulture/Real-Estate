const fs = require('fs');
let code = fs.readFileSync('masterplan/frontend/src/components/editor/Canvas2D.jsx', 'utf8');

// Patch Zones pts local mapping
code = code.replace(
  /const originalPts = getZonePoints\(zone\);\s+const pts = clippedZonesPoints\[zone\.id\] \|\| originalPts;\s+const flatPts = pts\.flat\(\);/,
  `const originalPts = getZonePoints(zone);
            const ptsWorld = clippedZonesPoints[zone.id] || originalPts;
            const rRad = -(zone.rotation_deg || 0) * Math.PI / 180;
            const pts = ptsWorld.map(p => [
              p[0] * Math.cos(rRad) - p[1] * Math.sin(rRad),
              p[0] * Math.sin(rRad) + p[1] * Math.cos(rRad)
            ]);
            const flatPts = pts.flat();`
);

fs.writeFileSync('masterplan/frontend/src/components/editor/Canvas2D.jsx', code);
