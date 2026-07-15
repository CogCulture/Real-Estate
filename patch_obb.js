const fs = require('fs');
let code = fs.readFileSync('masterplan/frontend/src/components/editor/Canvas2D.jsx', 'utf8');

// Patch handleTransformEnd
code = code.replace(
  /const rotRad = \(node\.rotation\(\) \* Math\.PI\) \/ 180;[\s\S]*?node\.rotation\(0\);[\s\S]*?const originalPts = getZonePoints\(zone\);[\s\S]*?const updatedPointsPx = originalPts\.map\(\(\[px, py\]\) => \{[\s\S]*?return \[snapValue\(xr \+ dx\), snapValue\(yr \+ dy\)\];[\s\S]*?\}\);/,
  `const rotRad = (node.rotation() * Math.PI) / 180;

    node.scaleX(1);
    node.scaleY(1);
    node.x(0);
    node.y(0);
    
    setDimTooltip(null);

    const originalPts = getZonePoints(zone);
    const oldRotRad = (zone.rotation_deg || 0) * Math.PI / 180;
    const localPts = originalPts.map(([px, py]) => [
      px * Math.cos(-oldRotRad) - py * Math.sin(-oldRotRad),
      px * Math.sin(-oldRotRad) + py * Math.cos(-oldRotRad)
    ]);

    const updatedPointsPx = localPts.map(([px, py]) => {
      const xs = px * sx;
      const ys = py * sy;
      const xr = xs * Math.cos(rotRad) - ys * Math.sin(rotRad);
      const yr = xs * Math.sin(rotRad) + ys * Math.cos(rotRad);
      return [snapValue(xr + dx), snapValue(yr + dy)];
    });`
);

// Patch handleTransformEnd newRotation
code = code.replace(
  /const newRotation = \(\(zone\.rotation_deg \|\| 0\) \+ \(rotRad \* 180 \/ Math\.PI\)\) % 360;/,
  `const newRotation = node.rotation() % 360;`
);

// Patch handleAmenityTransformEnd
code = code.replace(
  /const rotRad = \(node\.rotation\(\) \* Math\.PI\) \/ 180;[\s\S]*?node\.rotation\(0\);[\s\S]*?const originalPts = getAmenityPoints\(amenity\);[\s\S]*?const updatedPointsPx = originalPts\.map\(\(\[px, py\]\) => \{[\s\S]*?return \[snapValue\(xr \+ dx\), snapValue\(yr \+ dy\)\];[\s\S]*?\}\);/,
  `const rotRad = (node.rotation() * Math.PI) / 180;

    node.scaleX(1);
    node.scaleY(1);
    node.x(0);
    node.y(0);
    
    setDimTooltip(null);

    const originalPts = getAmenityPoints(amenity);
    const oldRotRad = (amenity.rotation_deg || 0) * Math.PI / 180;
    const localPts = originalPts.map(([px, py]) => [
      px * Math.cos(-oldRotRad) - py * Math.sin(-oldRotRad),
      px * Math.sin(-oldRotRad) + py * Math.cos(-oldRotRad)
    ]);

    const updatedPointsPx = localPts.map(([px, py]) => {
      const xs = px * sx;
      const ys = py * sy;
      const xr = xs * Math.cos(rotRad) - ys * Math.sin(rotRad);
      const yr = xs * Math.sin(rotRad) + ys * Math.cos(rotRad);
      return [snapValue(xr + dx), snapValue(yr + dy)];
    });`
);

// Patch handleAmenityTransformEnd newRotation
code = code.replace(
  /rotation_deg: \(amenity\.rotation_deg \|\| 0\) \+ node\.rotation\(\)/,
  `rotation_deg: node.rotation() % 360`
);

// Patch Zones Group rotation
code = code.replace(
  /<Group\s+key=\{zone\.id\}\s+id=\{zone\.id\}\s+x=\{0\}\s+y=\{0\}\s+scaleX=\{1\}\s+scaleY=\{1\}\s+rotation=\{0\}/,
  `<Group
                key={zone.id}
                id={zone.id}
                x={0}
                y={0}
                scaleX={1}
                scaleY={1}
                rotation={zone.rotation_deg || 0}`
);

// Patch Zones pts local mapping
code = code.replace(
  /const pts = getZonePoints\(zone\);\s+const flatPts = pts\.flat\(\);/,
  `const ptsWorld = getZonePoints(zone);
            const rRad = -(zone.rotation_deg || 0) * Math.PI / 180;
            const pts = ptsWorld.map(p => [
              p[0] * Math.cos(rRad) - p[1] * Math.sin(rRad),
              p[0] * Math.sin(rRad) + p[1] * Math.cos(rRad)
            ]);
            const flatPts = pts.flat();`
);

// Patch Amenities Group rotation
code = code.replace(
  /<Group\s+key=\{amenity\.id\}\s+id=\{amenity\.id\}\s+x=\{0\}\s+y=\{0\}\s+scaleX=\{1\}\s+scaleY=\{1\}\s+rotation=\{0\}/,
  `<Group
                key={amenity.id}
                id={amenity.id}
                x={0}
                y={0}
                scaleX={1}
                scaleY={1}
                rotation={amenity.rotation_deg || 0}`
);

// Patch Amenities pts local mapping
code = code.replace(
  /const pts = getAmenityPoints\(amenity\);\s+const flatPts = pts\.flat\(\);/,
  `const ptsWorld = getAmenityPoints(amenity);
            const rRad = -(amenity.rotation_deg || 0) * Math.PI / 180;
            const pts = ptsWorld.map(p => [
              p[0] * Math.cos(rRad) - p[1] * Math.sin(rRad),
              p[0] * Math.sin(rRad) + p[1] * Math.cos(rRad)
            ]);
            const flatPts = pts.flat();`
);

fs.writeFileSync('masterplan/frontend/src/components/editor/Canvas2D.jsx', code);
