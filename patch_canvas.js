const fs = require('fs');
const path = 'masterplan/frontend/src/components/editor/Canvas2D.jsx';
let code = fs.readFileSync(path, 'utf8');

const s1 = `              transform: \`translate(\${stagePos.x}px, \${stagePos.y}px) scale(\${stageScale})\`,
              transformOrigin: \`\${width * 2}px \${height * 2}px\`,`;
const r1 = `              transform: \`translate(\${stagePos.x}px, \${stagePos.y}px) scale(\${stageScale}) rotate(\${meta.north_angle_deg || 0}deg)\`,
              transformOrigin: \`\${width * 2 + (meta.site_width_m * scale) / 2}px \${height * 2 + (meta.site_height_m * scale) / 2}px\`,`;

code = code.replace(s1, r1);

const s2 = `          <Stage
            ref={stageRef}
            width={width}
            height={height}
            x={stagePos.x}
            y={stagePos.y}
            scaleX={stageScale}
            scaleY={stageScale}`;
const r2 = `          <Stage
            ref={stageRef}
            width={width}
            height={height}
            offsetX={(meta.site_width_m * scale) / 2}
            offsetY={(meta.site_height_m * scale) / 2}
            x={stagePos.x + (meta.site_width_m * scale) / 2}
            y={stagePos.y + (meta.site_height_m * scale) / 2}
            rotation={meta.north_angle_deg || 0}
            scaleX={stageScale}
            scaleY={stageScale}`;

code = code.replace(s2, r2);
fs.writeFileSync(path, code);
