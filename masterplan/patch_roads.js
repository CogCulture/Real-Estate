const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/editor/Canvas2D.jsx', 'utf8');

c = c.replace(
  /stroke=\{road\.type === 'pedestrian' \? \(stonePattern \|\| '#e2c99f'\) : '#e5e7eb'\}/g,
  `stroke={road.type === 'pedestrian' ? '#e2c99f' : '#e5e7eb'}`
);

// Optional: clean up stonePattern state and logic
c = c.replace(
  /const \[stonePattern, setStonePattern\] = useState\(null\);\s*useEffect\(\(\) => \{[\s\S]*?\}\}, \[assets\]\);/g,
  ``
);

fs.writeFileSync('frontend/src/components/editor/Canvas2D.jsx', c);
