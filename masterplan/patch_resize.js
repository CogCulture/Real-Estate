const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/editor/Canvas2D.jsx', 'utf8');

c = c.replace(
  /<Transformer\n\s+ref=\{transformerRef\}\n\s+rotateEnabled=\{false\}\n\s+resizeEnabled=\{true\}/g,
  `<Transformer\n            ref={transformerRef}\n            rotateEnabled={false}\n            resizeEnabled={false}`
);

// Fallback if the previous didn't match
c = c.replace(
  /<Transformer\n\s+ref=\{transformerRef\}\n\s+rotateEnabled=\{false\}/g,
  `<Transformer\n            ref={transformerRef}\n            rotateEnabled={false}\n            resizeEnabled={false}`
);

fs.writeFileSync('frontend/src/components/editor/Canvas2D.jsx', c);
