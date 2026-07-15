const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/editor/Canvas2D.jsx', 'utf8');
const search = `cursor: meta.treeBrushActive ? 'url("data:image/svg+xml;utf8,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'24\\' height=\\'24\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'%23064e3b\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'%3E%3Cpath d=\\'M14 2h-4v2h8V4a2 2 0 0 0-2-2z\\'/%3E%3Cpath d=\\'M7 6v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6z\\'/%3E%3Cpath d=\\'M9 12h.01M15 12h.01M12 15h.01M12 9h.01\\'/%3E%3C/svg>") 12 12, crosshair'`;
const replace = `cursor: meta.treeBrushActive ? "url('data:image/svg+xml;utf8,%3Csvg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"24\\" height=\\"24\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"%23064e3b\\" stroke-width=\\"2\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"%3E%3Cpath d=\\"M14 2h-4v2h8V4a2 2 0 0 0-2-2z\\"/%3E%3Cpath d=\\"M7 6v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6z\\"/%3E%3Cpath d=\\"M9 12h.01M15 12h.01M12 15h.01M12 9h.01\\"/%3E%3C/svg>') 12 12, crosshair"`;
c = c.split(search).join(replace);
fs.writeFileSync('frontend/src/components/editor/Canvas2D.jsx', c);
