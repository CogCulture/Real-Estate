const fs = require('fs');
const file = 'd:/RE 2.0/masterplan/frontend/src/components/editor/Canvas2D.jsx';
let code = fs.readFileSync(file, 'utf8');

// Replace selection checks
code = code.replace(/if \(activeTool === 'SELECT'\) \{/g, "if (activeTool !== 'ERASER') { setActiveTool('SELECT');");
code = code.replace(/\} else if \(activeTool === 'SELECT'\) \{/g, "} else if (activeTool !== 'ERASER') { setActiveTool('SELECT');");
code = code.replace(/listening=\{activeTool === 'SELECT'\}/g, "listening={activeTool !== 'ERASER'}");

const keydownCode = `
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selectedElementId) {
          e.preventDefault();
          const moveStep = 20;
          let dx = 0, dy = 0;
          if (e.key === 'ArrowUp') dy = -moveStep;
          if (e.key === 'ArrowDown') dy = moveStep;
          if (e.key === 'ArrowLeft') dx = -moveStep;
          if (e.key === 'ArrowRight') dx = moveStep;
          
          const state = useLayoutStore.getState();
          const selectedZone = state.zones.find(z => z.id === selectedElementId);
          if (selectedZone) {
            state.updateZone(selectedElementId, { x_px: selectedZone.x_px + dx, y_px: selectedZone.y_px + dy });
          } else {
            const selectedAmenity = state.amenities.find(a => a.id === selectedElementId);
            if (selectedAmenity) {
              state.updateAmenity(selectedElementId, { x_px: selectedAmenity.x_px + dx, y_px: selectedAmenity.y_px + dy });
            } else {
               const selectedRoad = state.roads.find(r => r.id === selectedElementId);
               if (selectedRoad && selectedRoad.points_px) {
                  const newPts = selectedRoad.points_px.map(p => [p[0] + dx, p[1] + dy]);
                  state.updateRoad(selectedElementId, { points_px: newPts });
               }
            }
          }
        }
      }
`;

code = code.replace(/(if \(e\.key === 'Delete' \|\| e\.key === 'Backspace'\) \{)/, keydownCode + "      $1");

// const legendCode = `
//       {legendMapping.length > 0 && (
//         <div className="absolute bottom-4 right-4 z-50 bg-white p-3 rounded-md shadow-md border border-gray-300 min-w-[150px] text-sm pointer-events-auto">
//           <details open>
//             <summary className="font-semibold cursor-pointer mb-2">Legend Info</summary>
//             <ul className="space-y-1 mt-1 max-h-60 overflow-y-auto">
//               {legendMapping.map(item => (
//                 <li key={item.number} className="flex items-center gap-2">
//                   <span className="w-5 h-5 flex items-center justify-center bg-gray-200 rounded-full text-xs font-bold">{item.number}</span>
//                   <span>{item.label}</span>
//                 </li>
//               ))}
//             </ul>
//           </details>
//         </div>
//       )}
// `;
// 
// code = code.replace(/(<div style={{ position: 'relative', width, height }}>)/, legendCode + "\n      $1");

fs.writeFileSync(file, code);
console.log('Fixed Canvas2D issues');
