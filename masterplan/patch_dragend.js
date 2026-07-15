const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/editor/Canvas2D.jsx', 'utf8');

c = c.replace(
  /onDragEnd=\{\(e\) => \{\s*if \(e\.target === stageRef\.current\) \{\s*setStagePos\(\{ x: e\.target\.x\(\), y: e\.target\.y\(\) \}\);\s*\}\s*\}\}/g,
  `onDragEnd={(e) => {
              if (e.target === stageRef.current) {
                setStagePos({ x: e.target.x() - width / 2, y: e.target.y() - height / 2 });
              }
            }}`
);

// Also restore uBbox inside amenities map
c = c.replace(
  /const bbox = getPolygonBoundingBox\(pts\);\s*const isSelected = selectedElementId === amenity\.id;/g,
  `const bbox = getPolygonBoundingBox(pts);\n            const uBbox = bbox;\n            const unrotatedPts = pts;\n            const isSelected = selectedElementId === amenity.id;`
);

fs.writeFileSync('frontend/src/components/editor/Canvas2D.jsx', c);
