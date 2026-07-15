const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/editor/Canvas2D.jsx', 'utf8');

// 1. Fix the syntax errors with 'http://www.w3.org/2000/svg'
c = c.replace(/xmlns='http:\/\/www\.w3\.org\/2000\/svg'/g, "xmlns=\\'http://www.w3.org/2000/svg\\'");
c = c.replace(/width='24'/g, "width=\\'24\\'");
c = c.replace(/height='24'/g, "height=\\'24\\'");
c = c.replace(/viewBox='0 0 24 24'/g, "viewBox=\\'0 0 24 24\\'");
c = c.replace(/fill='none'/g, "fill=\\'none\\'");
c = c.replace(/stroke='%23064e3b'/g, "stroke=\\'%23064e3b\\'");
c = c.replace(/stroke-width='2'/g, "stroke-width=\\'2\\'");
c = c.replace(/stroke-linecap='round'/g, "stroke-linecap=\\'round\\'");
c = c.replace(/stroke-linejoin='round'/g, "stroke-linejoin=\\'round\\'");
c = c.replace(/d='M14 2h-4v2h8V4a2 2 0 0 0-2-2z'/g, "d=\\'M14 2h-4v2h8V4a2 2 0 0 0-2-2z\\'");
c = c.replace(/d='M7 6v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6z'/g, "d=\\'M7 6v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6z\\'");
c = c.replace(/d='M9 12h\.01M15 12h\.01M12 15h\.01M12 9h\.01'/g, "d=\\'M9 12h.01M15 12h.01M12 15h.01M12 9h.01\\'");

// 2. Add stageRotation state
c = c.replace(
  'export default function Canvas2D({ width, height, viewMode = \\\'grass\\\' }) {',
  'export default function Canvas2D({ width, height, viewMode = \\\'grass\\\' }) {\\n  const [stageRotation, setStageRotation] = useState(0);'
);

// 3. Add rotateCanvas listener
c = c.replace(
  /window\.addEventListener\('zoomCanvasOut', handleZoomOut\);\s+return \(\) => \{\s+window\.removeEventListener\('zoomCanvasIn', handleZoomIn\);\s+window\.removeEventListener\('zoomCanvasOut', handleZoomOut\);\s+\};\s+\}, \[zoomStage\]\);/g,
  `window.addEventListener('zoomCanvasOut', handleZoomOut);
    const handleRotateCanvas = (e) => {
      if (e.detail && typeof e.detail.angle === 'number') {
        setStageRotation(prev => (prev + e.detail.angle) % 360);
      }
    };
    window.addEventListener('rotateCanvas', handleRotateCanvas);
    return () => {
      window.removeEventListener('zoomCanvasIn', handleZoomIn);
      window.removeEventListener('zoomCanvasOut', handleZoomOut);
      window.removeEventListener('rotateCanvas', handleRotateCanvas);
    };
  }, [zoomStage, stageRotation]);`
);

// 4. Fix zoomStage and handleWheel to handle rotation
c = c.replace(
  /const mousePointTo = \{\s*x: \(pointer\.x - stage\.x\(\)\) \/ oldScale,\s*y: \(pointer\.y - stage\.y\(\)\) \/ oldScale,\s*\};\s*const newScale = zoomIn \? oldScale \* scaleBy : oldScale \/ scaleBy;\s*if \(newScale < 0\.1 \|\| newScale > 10\) return;\s*const newX = pointer\.x - mousePointTo\.x \* newScale;\s*const newY = pointer\.y - mousePointTo\.y \* newScale;/g,
  `const newScale = zoomIn ? oldScale * scaleBy : oldScale / scaleBy;
    if (newScale < 0.1 || newScale > 10) return;

    const oldPos = stage.getRelativePointerPosition() || { x: width / 2, y: height / 2 };
    stage.scale({ x: newScale, y: newScale });
    const newAbsolutePos = stage.getAbsoluteTransform().point(oldPos);
    const dx = pointer.x - newAbsolutePos.x;
    const dy = pointer.y - newAbsolutePos.y;
    const newX = stage.x() + dx;
    const newY = stage.y() + dy;
    stage.scale({ x: oldScale, y: oldScale });`
);

c = c.replace(
  /const mousePointTo = \{\s*x: \(pointer\.x - stage\.x\(\)\) \/ oldScale,\s*y: \(pointer\.y - stage\.y\(\)\) \/ oldScale,\s*\};\s*\/\/ Zoom in on scroll up, zoom out on scroll down\s*const direction = e\.evt\.deltaY > 0 \? -1 : 1;\s*const newScale = direction > 0 \? oldScale \* scaleBy : oldScale \/ scaleBy;\s*\/\/ Limit scale \(e\.g\., between 0\.1 and 10\)\s*if \(newScale < 0\.1 \|\| newScale > 10\) return;\s*const newX = pointer\.x - mousePointTo\.x \* newScale;\s*const newY = pointer\.y - mousePointTo\.y \* newScale;/g,
  `const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    if (newScale < 0.1 || newScale > 10) return;

    const oldPos = stage.getRelativePointerPosition() || { x: width / 2, y: height / 2 };
    stage.scale({ x: newScale, y: newScale });
    const newAbsolutePos = stage.getAbsoluteTransform().point(oldPos);
    const dx = pointer.x - newAbsolutePos.x;
    const dy = pointer.y - newAbsolutePos.y;
    const newX = stage.x() + dx;
    const newY = stage.y() + dy;
    stage.scale({ x: oldScale, y: oldScale });`
);

// 5. Update stage properties
c = c.replace(
  /<Stage\s+ref=\{stageRef\}\s+width=\{width\}\s+height=\{height\}\s+x=\{stagePos\.x\}\s+y=\{stagePos\.y\}\s+scaleX=\{stageScale\}\s+scaleY=\{stageScale\}/g,
  `<Stage
            ref={stageRef}
            width={width}
            height={height}
            x={stagePos.x + width / 2}
            y={stagePos.y + height / 2}
            offsetX={width / 2}
            offsetY={height / 2}
            rotation={stageRotation}
            scaleX={stageScale}
            scaleY={stageScale}`
);

// 6. Fix translate in setStagePos & mapWrapperRef
c = c.replace(/setStagePos\(\{ x: newX, y: newY \}\);/g, 'setStagePos({ x: newX - width / 2, y: newY - height / 2 });');
c = c.replace(/mapWrapperRef\.current\.style\.transform = `translate\(\$\{newX\}px, \$\{newY\}px\)/g, 'mapWrapperRef.current.style.transform = `translate(${newX - width / 2}px, ${newY - height / 2}px)');


// 7. Fix Zones
c = c.replace(
  /const flatUnrotatedPts = unrotatedPts\.flat\(\);/g,
  `const flatUnrotatedPts = unrotatedPts.flat();
            const uBbox = getPolygonBoundingBox(unrotatedPts);`
);

// Remove width/height from Zone Group
c = c.replace(
  /rotation=\{zone\.rotation_deg \|\| 0\}\s+width=\{bbox\.width\}\s+height=\{bbox\.height\}/g,
  'rotation={zone.rotation_deg || 0}'
);

// Remove width/height from Amenity Group
c = c.replace(
  /rotation=\{amenity\.rotation_deg \|\| 0\}\s+width=\{bbox\.width\}\s+height=\{bbox\.height\}/g,
  'rotation={amenity.rotation_deg || 0}'
);

// Fix Shape x/y
c = c.replace(/const w = bbox\.width, h = bbox\.height;/g, 'const w = uBbox.width, h = uBbox.height;');
c = c.replace(/x=\{bbox\.minX\} y=\{bbox\.minY\}/g, 'x={uBbox.minX} y={uBbox.minY}');

// Fix Amenity rendering
c = c.replace(/x=\{bbox\.minX \+ 4\}\s+y=\{bbox\.minY \+ 6\}\s+points=\{pts\.map\(p => \[p\[0\] - bbox\.minX, p\[1\] - bbox\.minY\]\)\.flat\(\)\}/g, 
  `x={uBbox.minX + 4}
                     y={uBbox.minY + 6}
                     points={unrotatedPts.map(p => [p[0] - uBbox.minX, p[1] - uBbox.minY]).flat()}`
);
c = c.replace(/x=\{bbox\.cx\}\s+y=\{bbox\.cy\}/g, 'x={uBbox.cx}\n                        y={uBbox.cy}');
c = c.replace(/radiusX=\{bbox\.width/g, 'radiusX={uBbox.width');
c = c.replace(/radiusY=\{bbox\.height/g, 'radiusY={uBbox.height');
c = c.replace(/Math\.min\(bbox\.width, bbox\.height\)/g, 'Math.min(uBbox.width, uBbox.height)');
c = c.replace(/width=\{bbox\.width/g, 'width={uBbox.width');
c = c.replace(/height=\{bbox\.height/g, 'height={uBbox.height');

fs.writeFileSync('frontend/src/components/editor/Canvas2D.jsx', c);
