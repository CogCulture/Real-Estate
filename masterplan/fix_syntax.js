const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/editor/Canvas2D.jsx', 'utf8');
c = c.replace(/\\"/g, '"');
c = c.replace(/\\'/g, "'");
fs.writeFileSync('frontend/src/components/editor/Canvas2D.jsx', c);
