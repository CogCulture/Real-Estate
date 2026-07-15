const fs = require('fs');
const filePath = 'masterplan/frontend/src/components/map/MapSelector.jsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Remove mathematical rotation of LatLngs
const searchRotateStr = `    let activePoints = points;
    if (rotationAngle !== 0) {
      activePoints = rotateLatLngs(points, rotationAngle);
    }`;
const replaceRotateStr = `    let activePoints = points;`;
code = code.replace(searchRotateStr, replaceRotateStr);

// 2. Add visual CSS rotation to the Leaflet map container
const searchMapDiv = `<div ref={mapRef} className="absolute inset-0 w-full h-full z-10" />`;
const replaceMapDiv = `<div ref={mapRef} className="absolute inset-0 w-full h-full z-10" style={{ transform: \`rotate(\${rotationAngle}deg)\`, transformOrigin: 'center center', transition: 'transform 0.3s ease-out' }} />`;
code = code.replace(searchMapDiv, replaceMapDiv);

fs.writeFileSync(filePath, code);
console.log('Patched MapSelector.jsx');
