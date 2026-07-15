const fs = require('fs');
const file = 'd:/RE 2.0/masterplan/frontend/src/components/editor/Canvas2D.jsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace("parseInt(zone.id.replace(/\\D/g, '') || 123)", "parseInt(String(zone.id).replace(/\\D/g, '') || 123)");
code = code.replace("if (flatPts.length >= 4)", "if (flatPts && flatPts.length >= 4)");

fs.writeFileSync(file, code);
console.log('Fixed potential exceptions');
