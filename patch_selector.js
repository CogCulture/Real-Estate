const fs = require('fs');
const path = 'masterplan/frontend/src/components/map/MapSelector.jsx';
let code = fs.readFileSync(path, 'utf8');

const searchStr = `    // Apply rotation if set
    let activePoints = points;
    if (rotationAngle !== 0) {
      activePoints = rotateLatLngs(points, rotationAngle);
    }`;

const replaceStr = `    // Apply rotation if set
    let activePoints = points;`;

code = code.replace(searchStr, replaceStr);
fs.writeFileSync(path, code);
console.log('patched map selector');
