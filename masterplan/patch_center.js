const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/editor/Canvas2D.jsx', 'utf8');

c = c.replace(
  /const \[stagePos, setStagePos\] = useState\(\{ x: 0, y: 0 \}\);/g,
  `const [stagePos, setStagePos] = useState({ x: 0, y: 0 });\n  const [hasCentered, setHasCentered] = useState(false);`
);

c = c.replace(
  /useEffect\(\(\) => \{\s*if \(width > 0 && height > 0 && stagePos\.x === 0 && stagePos\.y === 0 && meta\.site_width_m\) \{[\s\S]*?\}, \[width, height, meta\.site_width_m, meta\.site_height_m, scale\]\);/g,
  `useEffect(() => {
    if (!hasCentered && width > 0 && height > 0 && meta.site_width_m && meta.site_height_m) {
      const siteW_px = meta.site_width_m * scale;
      const siteH_px = meta.site_height_m * scale;
      
      const scaleX = (width * 0.8) / siteW_px;
      const scaleY = (height * 0.8) / siteH_px;
      let newScale = Math.min(scaleX, scaleY);
      if (newScale < 0.1) newScale = 0.1;
      if (newScale > 10) newScale = 10;
      
      const cx = siteW_px / 2;
      const cy = siteH_px / 2;
      
      setStageScale(newScale);
      setStagePos({ x: -cx * newScale, y: -cy * newScale });
      
      if (stageRef.current) {
        stageRef.current.scale({ x: newScale, y: newScale });
        stageRef.current.position({ x: -cx * newScale + width/2, y: -cy * newScale + height/2 });
        stageRef.current.batchDraw();
      }
      if (mapWrapperRef.current) {
        mapWrapperRef.current.style.transform = \`translate(\${-cx * newScale}px, \${-cy * newScale}px) scale(\${newScale})\`;
      }
      setHasCentered(true);
    }
  }, [width, height, meta.site_width_m, meta.site_height_m, scale, hasCentered]);`
);

fs.writeFileSync('frontend/src/components/editor/Canvas2D.jsx', c);
