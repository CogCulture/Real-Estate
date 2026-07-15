const fs = require('fs');
const file = 'frontend/src/components/editor/Canvas2D.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = '} = useLayoutStore();';
const insertStr = '\n\n  const [stageRotation, setStageRotation] = useState(0);\n';

const idx = content.indexOf(targetStr);
if (idx !== -1) {
    content = content.slice(0, idx + targetStr.length) + insertStr + content.slice(idx + targetStr.length);
    fs.writeFileSync(file, content);
    console.log('Successfully injected stageRotation');
} else {
    console.log('Target string not found!');
}
