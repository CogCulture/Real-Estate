// textureGenerator.js
// Generates realistic textures and tree canopy sprites dynamically on offscreen canvases.

export function createGrassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  // Base grass color
  ctx.fillStyle = '#3f7a24';
  ctx.fillRect(0, 0, 256, 256);
  
  // Add noise and organic details
  const colors = ['#498c2d', '#579e37', '#346b1c', '#60a340', '#3b7421'];
  for (let i = 0; i < 40000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const w = 1 + Math.random() * 2;
    const h = 1 + Math.random() * 4; // slight vertical stretch for grass blades
    
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.fillRect(x, y, w, h);
  }
  
  // Add some soft lighting variations
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 150);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

export function createAsphaltTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  
  // Asphalt dark gray
  ctx.fillStyle = '#34383c';
  ctx.fillRect(0, 0, 64, 64);
  
  // Small aggregate stones
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 64;
    const y = Math.random() * 64;
    const size = Math.random() < 0.2 ? 2 : 1;
    const val = 40 + Math.floor(Math.random() * 30);
    ctx.fillStyle = `rgb(${val}, ${val}, ${val})`;
    ctx.fillRect(x, y, size, size);
  }

  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

export function createConcreteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  
  // Concrete light grey/beige
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 128, 128);
  
  // Fine grain
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const val = 210 + Math.floor(Math.random() * 25);
    ctx.fillStyle = `rgb(${val}, ${val}, ${val})`;
    ctx.fillRect(x, y, 1, 1);
  }
  
  // Grid slab lines for pathways
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 128, 128);
  ctx.strokeRect(0, 0, 64, 128);
  ctx.strokeRect(0, 0, 128, 64);

  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

function createCanvasImage(width, height, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, width, height);
  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

function loadImageAsset(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawFacadeGrid(ctx, width, height, options) {
  const {
    baseA,
    baseB,
    frameColor,
    windowColor,
    accentColor,
    windowRows,
    windowCols
  } = options;

  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, baseA);
  grad.addColorStop(1, baseB);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const shadow = ctx.createLinearGradient(0, 0, width, 0);
  shadow.addColorStop(0, 'rgba(255,255,255,0.18)');
  shadow.addColorStop(0.3, 'rgba(255,255,255,0.02)');
  shadow.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = frameColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, width - 4, height - 4);

  const padX = width * 0.08;
  const padY = height * 0.08;
  const cellW = (width - padX * 2) / windowCols;
  const cellH = (height - padY * 2) / windowRows;

  for (let r = 0; r < windowRows; r++) {
    for (let c = 0; c < windowCols; c++) {
      const x = padX + c * cellW + cellW * 0.12;
      const y = padY + r * cellH + cellH * 0.12;
      const w = cellW * 0.76;
      const h = cellH * 0.62;

      const lit = (r + c) % 5 !== 0;
      ctx.fillStyle = lit ? windowColor : 'rgba(255,255,255,0.14)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = lit ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(x, y, w, h * 0.28);
    }
  }

  ctx.fillStyle = accentColor;
  ctx.fillRect(width * 0.08, height * 0.84, width * 0.84, height * 0.06);
}

export function createModernBuildingTexture() {
  return createCanvasImage(256, 256, (ctx, width, height) => {
    drawFacadeGrid(ctx, width, height, {
      baseA: '#dbe4ea',
      baseB: '#9aa7b2',
      frameColor: '#6b7280',
      windowColor: 'rgba(52, 68, 88, 0.72)',
      accentColor: '#bcc7d1',
      windowRows: 6,
      windowCols: 5
    });
  });
}

export function createGlassBuildingTexture() {
  return createCanvasImage(256, 256, (ctx, width, height) => {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#7aa4c8');
    grad.addColorStop(0.45, '#466f94');
    grad.addColorStop(1, '#2d3f57');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const sheen = ctx.createLinearGradient(0, 0, width, 0);
    sheen.addColorStop(0, 'rgba(255,255,255,0.35)');
    sheen.addColorStop(0.18, 'rgba(255,255,255,0.08)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.7, 'rgba(255,255,255,0.2)');
    sheen.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, width, height);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 4; c++) {
        const x = 18 + c * 55;
        const y = 18 + r * 28;
        ctx.fillStyle = (r + c) % 4 === 0 ? 'rgba(255,255,255,0.42)' : 'rgba(18, 30, 44, 0.68)';
        ctx.fillRect(x, y, 34, 14);
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(18, 228, 220, 10);
  });
}

export function createWarmBuildingTexture() {
  return createCanvasImage(256, 256, (ctx, width, height) => {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#e9dcc8');
    grad.addColorStop(0.5, '#c6b49a');
    grad.addColorStop(1, '#8f7b63');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 0, width, 50);

    for (let y = 24; y < height - 34; y += 42) {
      for (let x = 18; x < width - 18; x += 38) {
        ctx.fillStyle = (x + y) % 76 === 0 ? 'rgba(88, 69, 47, 0.75)' : 'rgba(58, 45, 30, 0.7)';
        ctx.fillRect(x, y, 20, 20);
      }
    }

    ctx.fillStyle = 'rgba(88, 67, 43, 0.9)';
    ctx.fillRect(width * 0.08, height * 0.84, width * 0.84, height * 0.07);
  });
}

function drawGateTexture(ctx, width, height, variant) {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, variant === 'grand' ? '#f2efe8' : '#eef2f7');
  bg.addColorStop(1, variant === 'grand' ? '#c9d0da' : '#d8dee6');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const baseY = height * 0.68;
  const postColor = variant === 'minimal' ? '#3d4858' : variant === 'grand' ? '#6b5b4b' : '#445064';
  const beamColor = variant === 'grand' ? '#8d7764' : '#55657b';
  const roadAccent = variant === 'minimal' ? '#cfd7e2' : '#b8c4d3';

  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(width * 0.12, baseY + 10, width * 0.76, 10);

  ctx.fillStyle = postColor;
  ctx.fillRect(width * 0.14, height * 0.18, width * 0.08, baseY - height * 0.18);
  ctx.fillRect(width * 0.78, height * 0.18, width * 0.08, baseY - height * 0.18);
  ctx.fillRect(width * 0.2, height * 0.26, width * 0.6, variant === 'grand' ? 0.1 * height : 0.08 * height);

  ctx.fillStyle = beamColor;
  ctx.fillRect(width * 0.18, height * 0.24, width * 0.64, height * 0.08);

  ctx.fillStyle = roadAccent;
  ctx.fillRect(width * 0.18, height * 0.48, width * 0.64, height * 0.12);

  ctx.strokeStyle = variant === 'grand' ? '#7a6653' : '#607087';
  ctx.lineWidth = 2;
  ctx.strokeRect(width * 0.18, height * 0.48, width * 0.64, height * 0.12);

  if (variant !== 'minimal') {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(width * 0.22, height * 0.52, width * 0.12, height * 0.03);
    ctx.fillRect(width * 0.66, height * 0.52, width * 0.12, height * 0.03);
  }
}

export function createModernGateTexture() {
  return createCanvasImage(240, 120, (ctx, width, height) => drawGateTexture(ctx, width, height, 'modern'));
}

export function createMinimalGateTexture() {
  return createCanvasImage(240, 120, (ctx, width, height) => drawGateTexture(ctx, width, height, 'minimal'));
}

export function createGrandGateTexture() {
  return createCanvasImage(240, 120, (ctx, width, height) => drawGateTexture(ctx, width, height, 'grand'));
}

export function createTreeSprite(size, variant = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const center = size / 2;
  const radius = size * 0.4;
  
  // Set random seed or color based on variant
  let colors;
  if (variant === 1) {
    // Lush green
    colors = ['#1b4332', '#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'];
  } else if (variant === 2) {
    // Forest deep green
    colors = ['#132a13', '#31572c', '#4f772d', '#90a955', '#ecf39e'];
  } else {
    // Olive/Warm landscape green
    colors = ['#283618', '#606c38', '#dda15e', '#bc6c25'];
  }
  
  // Draw base shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetX = size * 0.08;
  ctx.shadowOffsetY = size * 0.1;
  
  // Outer foliage boundary (clumpy circle)
  ctx.fillStyle = colors[0];
  ctx.beginPath();
  const numClumps = 14;
  for (let i = 0; i < numClumps; i++) {
    const angle = (i / numClumps) * Math.PI * 2;
    const dist = radius * (0.82 + Math.random() * 0.18);
    const cx = center + Math.cos(angle) * dist;
    const cy = center + Math.sin(angle) * dist;
    const r = radius * (0.28 + Math.random() * 0.18);
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.fill();
  
  // Reset shadow for inner overlapping foliage
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Render layered smaller clumps to build 3D depth
  for (let layer = 1; layer < colors.length; layer++) {
    ctx.fillStyle = colors[layer];
    ctx.beginPath();
    const count = 12 - layer * 2;
    const inset = layer * (radius * 0.14);
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      // Shift highlight center toward top-left (-x, -y) to match top-left light source
      const dist = (radius - inset) * Math.random();
      const cx = center + Math.cos(angle) * dist - (layer * (size * 0.02));
      const cy = center + Math.sin(angle) * dist - (layer * (size * 0.02));
      const r = radius * (0.22 - layer * 0.01 + Math.random() * 0.12);
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.closePath();
    ctx.fill();
  }
  
  // Subtle center branch highlights
  ctx.fillStyle = 'rgba(40, 20, 5, 0.2)';
  ctx.beginPath();
  ctx.arc(center - size * 0.04, center - size * 0.04, radius * 0.15, 0, Math.PI * 2);
  ctx.fill();

  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

function processImageTransparency(img) {
  return new Promise((resolve) => {
    if (!img) {
      resolve(null);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Heal/Clone stamp to cover the "T1" label in tree_plan_1.png
    if (img.src && img.src.includes('tree_plan_1.png')) {
      const w = img.width;
      const h = img.height;
      const cx = w / 2;
      const cy = h / 2;
      
      const srcX = cx - w * 0.15;
      const srcY = cy - h * 0.08;
      const copyW = w * 0.12;
      const copyH = h * 0.16;
      const destX = cx + w * 0.03;
      const destY = cy - h * 0.08;
      
      ctx.drawImage(canvas, srcX, srcY, copyW, copyH, destX, destY, copyW, copyH);
    }

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    
    // Replace white background (R, G, B > 240) with transparency
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      if (r > 240 && g > 240 && b > 240) {
        data[i+3] = 0; // Set alpha to 0
      }
    }
    ctx.putImageData(imgData, 0, 0);
    
    const cleanImg = new Image();
    cleanImg.onload = () => resolve(cleanImg);
    cleanImg.onerror = () => resolve(img);
    cleanImg.src = canvas.toDataURL();
  });
}

export async function loadGeneratedAssets() {
  const [
    roadTopdown,
    treePlan1Raw,
    treePlan2Raw,
    buildingResidential,
    buildingCommercial,
    buildingMixedUse,
    buildingMinimal,
    gateMinimal,
    gateModern,
    gateGrand,
    treeClusterTopdown,
    swimmingPoolTopdown1,
    swimmingPoolTopdown2,
    swimmingPoolTopdown3,
    tennisCourtTopdown,
    flowerGardenTopdown,
    kidsPlaygroundTopdown,
    centralLawnTopdown
  ] = await Promise.all([
    loadImageAsset('/free-assets/road_topdown.png'),
    loadImageAsset('/free-assets/tree_plan_1.png'),
    loadImageAsset('/free-assets/tree_plan_2.png'),
    loadImageAsset('/free-assets/building_residential.png'),
    loadImageAsset('/free-assets/building_commercial.png'),
    loadImageAsset('/free-assets/building_mixed_use.png'),
    loadImageAsset('/free-assets/building_minimal.png'),
    loadImageAsset('/free-assets/gate_minimal.png'),
    loadImageAsset('/free-assets/gate_modern.png'),
    loadImageAsset('/free-assets/gate_open.png'),
    loadImageAsset('/free-assets/tree_cluster_topdown.png'),
    loadImageAsset('/free-assets/pool_1.png'),
    loadImageAsset('/free-assets/pool_2.png'),
    loadImageAsset('/free-assets/pool_3.png'),
    loadImageAsset('/free-assets/tennis_court_cutout.png'),
    loadImageAsset('/free-assets/flower_garden_topdown.png'),
    loadImageAsset('/free-assets/kids_playground_topdown.png'),
    loadImageAsset('/free-assets/central_lawn_topdown.png')
  ]);

  const [treePlan1, treePlan2] = await Promise.all([
    processImageTransparency(treePlan1Raw),
    processImageTransparency(treePlan2Raw)
  ]);

  const treeFallback1 = createTreeSprite(120, 1);
  const treeFallback2 = createTreeSprite(120, 2);
  const treeFallback3 = createTreeSprite(120, 3);

  return {
    grassTile: createGrassTexture(),
    asphaltTile: createAsphaltTexture(),
    concreteTile: createConcreteTexture(),
    roadTopdown: roadTopdown || createAsphaltTexture(),
    buildingResidential: buildingResidential || createWarmBuildingTexture(),
    buildingCommercial: buildingCommercial || createGlassBuildingTexture(),
    buildingMixedUse: buildingMixedUse || createModernBuildingTexture(),
    buildingInstitutional: buildingMixedUse || createModernBuildingTexture(),
    buildingIndustrial: buildingResidential || createWarmBuildingTexture(),
    buildingMinimal: buildingMinimal || createModernBuildingTexture(),
    buildingModern: buildingMixedUse || createModernBuildingTexture(),
    buildingGlass: buildingCommercial || createGlassBuildingTexture(),
    buildingWarm: buildingResidential || createWarmBuildingTexture(),
    gateMinimal: gateMinimal || createMinimalGateTexture(),
    gateModern: gateModern || createModernGateTexture(),
    gateGrand: gateGrand || createGrandGateTexture(),
    treePlan1: treePlan1 || treeFallback1,
    treePlan2: treePlan2 || treeFallback2,
    treeLg1: treePlan1 || treeFallback1,
    treeLg2: treePlan2 || treeFallback2,
    treeLg3: treeFallback3,
    treeMd1: treePlan1 || treeFallback1,
    treeMd2: treePlan2 || treeFallback2,
    treeSm1: treePlan1 || treeFallback1,
    treeSm2: treePlan2 || treeFallback2,
    // Bird's eye view amenity textures
    treeClusterTopdown: treeClusterTopdown || null,
    swimmingPoolTopdown1: swimmingPoolTopdown1 || null,
    swimmingPoolTopdown2: swimmingPoolTopdown2 || null,
    swimmingPoolTopdown3: swimmingPoolTopdown3 || null,
    tennisCourtTopdown: tennisCourtTopdown || null,
    flowerGardenTopdown: flowerGardenTopdown || null,
    kidsPlaygroundTopdown: kidsPlaygroundTopdown || null,
    centralLawnTopdown: centralLawnTopdown || null,
  };
}
