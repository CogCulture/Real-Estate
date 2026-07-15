const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/editor/Canvas2D.jsx', 'utf8');

c = c.replace(
  /} = useLayoutStore();\s+const { currentProject } = useProjectStore();/g,
  `} = useLayoutStore();

  const [stageRotation, setStageRotation] = useState(0);

  const { currentProject } = useProjectStore();`
);

fs.writeFileSync('frontend/src/components/editor/Canvas2D.jsx', c);
