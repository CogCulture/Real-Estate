const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/editor/Canvas2D.jsx', 'utf8');

c = c.replace(
  /let snappedX = snapValue\(pos\.x\);\s*let snappedY = snapValue\(pos\.y\);\s*if \(activeTool === 'LINE' \|\| activeTool === 'CONNECTOR'\) \{\s*const \[sx, sy\] = getSnappedPosition\(pos\.x, pos\.y\);\s*snappedX = sx;\s*snappedY = sy;\s*\}\s*setMousePos\(\{ x: snappedX, y: snappedY \}\);/g,
  `let snappedX = snapValue(pos.x);
    let snappedY = snapValue(pos.y);
    if (activeTool === 'LINE' || activeTool === 'CONNECTOR') {
      const [sx, sy] = getSnappedPosition(pos.x, pos.y);
      snappedX = sx;
      snappedY = sy;
      setMousePos({ x: snappedX, y: snappedY });
    }`
);

fs.writeFileSync('frontend/src/components/editor/Canvas2D.jsx', c);
