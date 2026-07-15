const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/editor/Canvas2D.jsx', 'utf8');

// For Zone and Amenity, we define uBbox right after unrotatedPts
c = c.replace(
  /const flatUnrotatedPts = unrotatedPts\.flat\(\);/g,
  `const flatUnrotatedPts = unrotatedPts.flat();
            const uBbox = getPolygonBoundingBox(unrotatedPts);`
);

// We need to carefully replace bbox with uBbox inside the Zone footprint and Amenity rendering
// Let's replace width={bbox.width} and height={bbox.height} on the Groups first
c = c.replace(
  /rotation=\{zone\.rotation_deg \|\| 0\}\s+width=\{bbox\.width\}\s+height=\{bbox\.height\}/g,
  'rotation={zone.rotation_deg || 0}'
);

c = c.replace(
  /rotation=\{amenity\.rotation_deg \|\| 0\}\s+width=\{bbox\.width\}\s+height=\{bbox\.height\}/g,
  'rotation={amenity.rotation_deg || 0}'
);

// In Zone, replace bbox.width/height with uBbox.width/height for Shape rendering
c = c.replace(/const w = bbox\.width, h = bbox\.height;/g, 'const w = uBbox.width, h = uBbox.height;');
c = c.replace(/x=\{bbox\.minX\} y=\{bbox\.minY\}/g, 'x={uBbox.minX} y={uBbox.minY}');

// In Amenity, replace bbox with uBbox for shapes
c = c.replace(/x=\{bbox\.minX \+ 4\}\s+y=\{bbox\.minY \+ 6\}\s+points=\{pts\.map\(p => \[p\[0\] - bbox\.minX, p\[1\] - bbox\.minY\]\)\.flat\(\)\}/g, 
  `x={uBbox.minX + 4}
   y={uBbox.minY + 6}
   points={unrotatedPts.map(p => [p[0] - uBbox.minX, p[1] - uBbox.minY]).flat()}`
);

// Replace bbox.cx and bbox.cy inside Amenity rendering with uBbox
c = c.replace(/x=\{bbox\.cx\}\s+y=\{bbox\.cy\}/g, 'x={uBbox.cx}\n                        y={uBbox.cy}');
// Replace bbox.width and bbox.height inside Amenity rendering with uBbox
c = c.replace(/radiusX=\{bbox\.width/g, 'radiusX={uBbox.width');
c = c.replace(/radiusY=\{bbox\.height/g, 'radiusY={uBbox.height');
c = c.replace(/Math\.min\(bbox\.width, bbox\.height\)/g, 'Math.min(uBbox.width, uBbox.height)');
c = c.replace(/width=\{bbox\.width/g, 'width={uBbox.width');
c = c.replace(/height=\{bbox\.height/g, 'height={uBbox.height');

fs.writeFileSync('frontend/src/components/editor/Canvas2D.jsx', c);
