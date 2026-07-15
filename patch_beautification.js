const fs = require('fs');
const file = 'd:/RE 2.0/masterplan/frontend/src/components/editor/Canvas2D.jsx';
let code = fs.readFileSync(file, 'utf8');

const targetStr = "{/* Drop shadow for depth */}\n                  {isBuilding && (";

const beautificationBlock = `                  {/* Beautification Layer (Marble Floor & Trees) */}
                  {(() => {
                    if (!isBuilding && zone.type !== 'parking') return null;
                    const decors = [];
                    const isPark = zone.type === 'parking';
                    
                    let seed = parseInt(zone.id.replace(/\\D/g, '') || 123);
                    const sRand = () => { let x = Math.sin(seed++) * 10000; return x - Math.floor(x); };
                    
                    const tRadius = Math.max(4, Math.min(w, h) * 0.04);
                    
                    if (isBuilding) {
                      if (hasFootprint) {
                        decors.push(
                          <Shape
                            key={\`marble-\${zone.id}\`}
                            sceneFunc={sceneFunc}
                            fillRule={zone.footprint === 'courtyard' ? 'evenodd' : undefined}
                            x={w / 2}
                            y={h / 2}
                            offsetX={w / 2}
                            offsetY={h / 2}
                            scaleX={1.06}
                            scaleY={1.06}
                            fill="#EBE8E0"
                            stroke="#D6CFC1"
                            strokeWidth={3}
                            listening={false}
                          />
                        );
                      } else {
                        decors.push(
                          <Line hitStrokeWidth={0}
                            key={\`marble-\${zone.id}\`}
                            points={flatPts}
                            closed={true}
                            lineJoin="round"
                            fill="#EBE8E0"
                            stroke="#D6CFC1"
                            strokeWidth={Math.max(8, w * 0.05)}
                            listening={false}
                          />
                        );
                      }
                    }

                    const numTrees = Math.floor(sRand() * 4) + (isPark ? 5 : 3);
                    for (let i = 0; i < numTrees; i++) {
                       let ptX, ptY;
                       if (hasFootprint) {
                           const side = Math.floor(sRand() * 4);
                           const dist = sRand();
                           if (side===0) { ptX = dist * w; ptY = -tRadius; }
                           else if (side===1) { ptX = w + tRadius; ptY = dist * h; }
                           else if (side===2) { ptX = dist * w; ptY = h + tRadius; }
                           else { ptX = -tRadius; ptY = dist * h; }
                       } else {
                           if (flatPts.length >= 4) {
                               const ptIdx = Math.floor(sRand() * (flatPts.length/2)) * 2;
                               ptX = flatPts[ptIdx];
                               ptY = flatPts[ptIdx+1];
                               ptX += (sRand() - 0.5) * tRadius * 4;
                               ptY += (sRand() - 0.5) * tRadius * 4;
                           } else {
                               ptX = 0; ptY = 0;
                           }
                       }
                       
                       decors.push(
                          <Group key={\`decor-tree-\${zone.id}-\${i}\`} x={ptX} y={ptY} listening={false}>
                              <Circle x={2} y={3} radius={tRadius * 0.85} fill="rgba(0,0,0,0.18)" listening={false} />
                              <Circle x={0} y={0} radius={tRadius} fill="#22863a" listening={false} />
                              <Circle x={-tRadius*0.2} y={-tRadius*0.2} radius={tRadius*0.55} fill="#34a853" listening={false} />
                          </Group>
                       );
                    }
                    
                    return decors;
                  })()}

                  `;

if (!code.includes("Beautification Layer (Marble Floor & Trees)")) {
    code = code.replace(targetStr, beautificationBlock + targetStr);
    fs.writeFileSync(file, code);
    console.log('Successfully added beautification layer.');
} else {
    console.log('Beautification layer already exists.');
}
