const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/editor/Canvas2D.jsx', 'utf8');

// 1. Debounce handleWheel
c = c.replace(
  /stage\.scale\(\{ x: oldScale, y: oldScale \}\);\s*setStageScale\(newScale\);\s*setStagePos\(\{ x: newX - width \/ 2, y: newY - height \/ 2 \}\);\s*if \(mapWrapperRef\.current\) \{\s*mapWrapperRef\.current\.style\.transform = `translate\(\$\{newX - width \/ 2\}px, \$\{newY - height \/ 2\}px\) scale\(\$\{newScale\}\)`;\s*\}/g,
  `// Imperative update for zero latency
    stage.scale({ x: newScale, y: newScale });
    stage.position({ x: newX, y: newY });
    stage.batchDraw();

    if (mapWrapperRef.current) {
      mapWrapperRef.current.style.transform = \`translate(\${newX - width / 2}px, \${newY - height / 2}px) scale(\${newScale})\`;
    }

    if (window.wheelTimeout) clearTimeout(window.wheelTimeout);
    window.wheelTimeout = setTimeout(() => {
      setStageScale(newScale);
      setStagePos({ x: newX - width / 2, y: newY - height / 2 });
    }, 150);`
);

// 2. Fix onDragMove
c = c.replace(
  /mapWrapperRef\.current\.style\.transform = `translate\(\$\{e\.target\.x\(\)\}px, \$\{e\.target\.y\(\)\}px\) scale\(\$\{stageScale\}\)`;/g,
  `mapWrapperRef.current.style.transform = \`translate(\${e.target.x() - width/2}px, \${e.target.y() - height/2}px) scale(\${stageScale})\`;`
);

// 3. Center canvas on load
const centerEffect = `
  useEffect(() => {
    if (width > 0 && height > 0 && stagePos.x === 0 && stagePos.y === 0 && meta.site_width_m) {
      const cx = (meta.site_width_m * scale) / 2;
      const cy = (meta.site_height_m * scale) / 2;
      setStagePos({ x: -cx, y: -cy });
      
      if (stageRef.current) {
        stageRef.current.position({ x: -cx + width/2, y: -cy + height/2 });
        stageRef.current.batchDraw();
      }
      if (mapWrapperRef.current) {
        mapWrapperRef.current.style.transform = \`translate(\${-cx}px, \${-cy}px) scale(\${stageScale})\`;
      }
    }
  }, [width, height, meta.site_width_m, meta.site_height_m, scale]);
`;

c = c.replace(
  /prevWidthRef\.current = width;\s*\}, \[width\]\);/g,
  `prevWidthRef.current = width;
  }, [width]);
${centerEffect}`
);

// Fix internal rotation icon in shape (user said: "remove the internal rotation icon from the shape like remove the shape resize and rotation from internal")
// This implies they don't want the Rotation/Resize anchors on the individual shapes because they rotate the whole canvas now?
// Let's remove rotationEnabled from Transformer if we can find it.
c = c.replace(
  /<Transformer\s+ref=\{transformerRef\}/g,
  `<Transformer\n            ref={transformerRef}\n            rotateEnabled={false}\n            resizeEnabled={true}`
);


fs.writeFileSync('frontend/src/components/editor/Canvas2D.jsx', c);
