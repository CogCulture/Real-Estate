const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/editor/Canvas2D.jsx', 'utf8');

// 1. Add stageRotation state
c = c.replace(
  'const [stageScale, setStageScale] = useState(1);',
  'const [stageScale, setStageScale] = useState(1);\n  const [stageRotation, setStageRotation] = useState(0);'
);

// 2. Add event listeners for rotateCanvas
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

// 3. Update zoomStage math
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

// 4. Update handleWheel math
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

// 5. Apply rotation to Stage
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
// We must store the true stage x/y minus offset so that it restores correctly on render.
c = c.replace(/setStagePos\(\{ x: newX, y: newY \}\);/g, 'setStagePos({ x: newX - width / 2, y: newY - height / 2 });');
c = c.replace(/mapWrapperRef\.current\.style\.transform = `translate\(\$\{newX\}px, \$\{newY\}px\)/g, 'mapWrapperRef.current.style.transform = `translate(${newX - width / 2}px, ${newY - height / 2}px)');


fs.writeFileSync('frontend/src/components/editor/Canvas2D.jsx', c);
