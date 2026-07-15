const fs = require('fs');
const file = 'd:/RE 2.0/masterplan/frontend/src/components/editor/Canvas2D.jsx';
let code = fs.readFileSync(file, 'utf8');

const regexLegendMapping = /const legendMapping = useMemo\(\(\) => \{([\s\S]*?)return Array\.from\(uniqueLabels\)\.map/m;
const matchLegendMapping = code.match(regexLegendMapping);

if (matchLegendMapping) {
  let newBlock = matchLegendMapping[1];
  newBlock = newBlock.replace(/z\.label\.toUpperCase\(\)/g, "z.label.toUpperCase().replace(/\\s+COPY.*$/i, '').trim()");
  newBlock = newBlock.replace(/a\.label\.toUpperCase\(\)/g, "a.label.toUpperCase().replace(/\\s+COPY.*$/i, '').trim()");
  
  code = code.replace(matchLegendMapping[1], newBlock);
}

const regexGetLegendNumber = /const getLegendNumber = \(label\) => \{([\s\S]*?)return match \? match\.number : null;\s*\};/m;
const matchGetLegendNumber = code.match(regexGetLegendNumber);

if (matchGetLegendNumber) {
  let newBlock = matchGetLegendNumber[1];
  newBlock = newBlock.replace(/l\.label === label\.toUpperCase\(\)/g, "l.label === label.toUpperCase().replace(/\\s+COPY.*$/i, '').trim()");
  
  code = code.replace(matchGetLegendNumber[1], newBlock);
}

fs.writeFileSync(file, code);
console.log('Fixed Legend Mapping');
