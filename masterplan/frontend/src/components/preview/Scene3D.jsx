import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useLayoutStore } from '../../store/useLayoutStore';
import { ZONE_COLORS } from '../../utils/colorMap';

// ─── Sky gradient environment map ─────────────────────────────────────────────
function createSkyEnv(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();

  const skyGeo = new THREE.SphereGeometry(500, 32, 32);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor:    { value: new THREE.Color(0x6db3f2) },
      bottomColor: { value: new THREE.Color(0xe8eef5) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(skyGeo, skyMat));

  // Sundisc
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(18, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff8d6 })
  );
  sun.position.set(200, 350, 150);
  envScene.add(sun);

  const envMap = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();
  return envMap;
}

// ─── Tree builder ─────────────────────────────────────────────────────────────
const _treeCrownMats = [0x8fa489, 0x9fb499, 0xa5b89e, 0x7e9078].map(c =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, envMapIntensity: 0.08 })
);

function createRoundedRectShape(width, height, radius) {
  const shape = new THREE.Shape();
  const w = width / 2;
  const h = height / 2;
  const r = Math.max(0.25, Math.min(radius, Math.min(w, h) - 0.25));

  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  return shape;
}

function createLakeShape(width, height) {
  const shape = new THREE.Shape();
  const w = width / 2;
  const h = height / 2;

  shape.moveTo(0, -h);
  shape.bezierCurveTo(w * 0.9, -h, w, -h * 0.4, w * 0.85, 0);
  shape.bezierCurveTo(w, h * 0.55, w * 0.55, h, 0, h * 0.9);
  shape.bezierCurveTo(-w * 0.6, h, -w, h * 0.5, -w * 0.9, 0);
  shape.bezierCurveTo(-w, -h * 0.45, -w * 0.7, -h, 0, -h);
  return shape;
}

function makeTree(x, z, scene, scale = 1) {
  const g = new THREE.Group();

  const crownMat = _treeCrownMats[Math.floor(Math.random() * _treeCrownMats.length)];
  const crown = new THREE.Mesh(new THREE.CircleGeometry(2.6 * scale, 20), crownMat);
  crown.rotation.x = -Math.PI / 2;
  crown.position.y = 0.08;
  crown.castShadow = true;
  crown.receiveShadow = true;
  g.add(crown);

  const crownInner = new THREE.Mesh(
    new THREE.CircleGeometry(1.1 * scale, 18),
    new THREE.MeshBasicMaterial({ color: 0x667a60 })
  );
  crownInner.rotation.x = -Math.PI / 2;
  crownInner.position.y = 0.09;
  g.add(crownInner);

  const trunkDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.32 * scale, 12),
    new THREE.MeshBasicMaterial({ color: 0x4a3325 })
  );
  trunkDot.rotation.x = -Math.PI / 2;
  trunkDot.position.y = 0.1;
  g.add(trunkDot);

  g.position.set(x, 0, z);
  scene.add(g);
}

export default function Scene3D({ cameraPreset = 'aerial' }) {
  const containerRef = useRef(null);
  const { zones, roads, meta } = useLayoutStore();

  const siteW = meta.site_width_m  || 500;
  const siteH = meta.site_height_m || 300;
  const cx = siteW / 2;
  const cz = siteH / 2;

  const cameraRef   = useRef(null);
  const controlsRef = useRef(null);
  const targetPosRef    = useRef(new THREE.Vector3());
  const targetLookAtRef = useRef(new THREE.Vector3());

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const W = container.clientWidth  || 800;
    const H = container.clientHeight || 500;

    // ── Scene ──────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f4f0);
    scene.fog = new THREE.Fog(0xf5f4f0, siteW * 3, siteW * 8);

    // ── Camera ─────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(40, W / H, 1, 20000);
    camera.position.set(cx + 0.01, Math.max(siteW, siteH) * 1.9, cz + 0.01);
    camera.lookAt(cx, 0, cz);
    cameraRef.current = camera;

    // ── Renderer ───────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // ── Environment map ────────────────────────────────────────────────────
    const envMap = createSkyEnv(renderer);
    scene.environment = envMap;

    // ── Premium OrbitControls ──────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.12;          // smooth, not sluggish
    controls.rotateSpeed    = 0.85;
    controls.zoomSpeed      = 1.0;
    controls.panSpeed       = 0.8;
    controls.enableRotate    = false;
    controls.screenSpacePanning = true;
    controls.minDistance    = 20;
    controls.maxDistance    = Math.max(siteW, siteH) * 5;
    controls.target.set(cx, 0, cz);
    controls.update();
    controlsRef.current = controls;

    // ── Lighting ───────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xd4c8b8, 0.65));

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.4);
    sun.position.set(cx + siteW * 0.4, siteW * 1.2, cz - siteH * 0.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sd = Math.max(siteW, siteH) * 0.8;
    sun.shadow.camera.left   = -sd;
    sun.shadow.camera.right  =  sd;
    sun.shadow.camera.top    =  sd;
    sun.shadow.camera.bottom = -sd;
    sun.shadow.camera.near   = 10;
    sun.shadow.camera.far    = siteW * 4;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    // Cool fill from opposite side
    const fill = new THREE.DirectionalLight(0xc8d8e8, 0.3);
    fill.position.set(cx - siteW * 0.4, siteH * 0.5, cz + siteH * 0.4);
    scene.add(fill);

    // ── Ground ─────────────────────────────────────────────────────────────
    // Outer terrain
    const outerGround = new THREE.Mesh(
      new THREE.PlaneGeometry(siteW * 3, siteH * 3),
      new THREE.MeshStandardMaterial({ color: 0xeae6e0, roughness: 0.98, envMapIntensity: 0.05 })
    );
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.position.set(cx, -1.5, cz);
    outerGround.receiveShadow = true;
    scene.add(outerGround);

    // Site lawn
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(siteW, siteH),
      new THREE.MeshStandardMaterial({ color: 0xb8c9b0, roughness: 0.92, envMapIntensity: 0.1 })
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(cx, -0.2, cz);
    lawn.receiveShadow = true;
    scene.add(lawn);

    // Site boundary marker
    const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(siteW, 0.5, siteH));
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x4f46e5, linewidth: 1 });
    const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
    edgeMesh.position.set(cx, 0, cz);
    scene.add(edgeMesh);

    // ── Materials ──────────────────────────────────────────────────────────
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x2d2f31, roughness: 0.95, envMapIntensity: 0.02 });
    const lineWhiteMat = new THREE.MeshStandardMaterial({ color: 0xd5dbdb, roughness: 0.8 });

    // ── Zones ──────────────────────────────────────────────────────────────
    const buildingZoneTypes = ['residential', 'commercial', 'mixed_use', 'industrial', 'institutional', 'amenity'];

    zones.forEach((zone) => {
      const zw = zone.width_m;
      const zh = zone.height_m;
      const zx = zone.x_m + zw / 2;
      const zy = zone.y_m + zh / 2;
      const color = new THREE.Color(zone.color || ZONE_COLORS[zone.type] || '#7F8C8D');
      const isBuilding = buildingZoneTypes.includes(zone.type);

      if (isBuilding) {
        const footprintShape = createRoundedRectShape(
          Math.max(2, zw - 1.5),
          Math.max(2, zh - 1.5),
          Math.min(zw, zh) * 0.18
        );
        const footprint = new THREE.Mesh(
          new THREE.ShapeGeometry(footprintShape),
          new THREE.MeshStandardMaterial({
            color: color.clone().offsetHSL(0, 0, -0.08),
            roughness: 0.78,
            metalness: 0.04
          })
        );
        footprint.rotation.x = -Math.PI / 2;
        footprint.position.set(zx, 0.08, zy);
        footprint.castShadow = true;
        footprint.receiveShadow = true;
        scene.add(footprint);

        const roofInsetShape = createRoundedRectShape(
          Math.max(1.4, zw - 6),
          Math.max(1.4, zh - 6),
          Math.min(zw, zh) * 0.12
        );
        const roofInset = new THREE.Mesh(
          new THREE.ShapeGeometry(roofInsetShape),
          new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.08
          })
        );
        roofInset.rotation.x = -Math.PI / 2;
        roofInset.position.set(zx, 0.09, zy);
        scene.add(roofInset);

      } else {
        // Flat zone (parks, water, parking, etc.)
        if (zone.type === 'water_body') {
          const lake = new THREE.Mesh(
            new THREE.ShapeGeometry(createLakeShape(zw, zh)),
            new THREE.MeshStandardMaterial({
              color,
              roughness: 0.55,
              metalness: 0.06,
              transparent: true,
              opacity: 0.78
            })
          );
          lake.rotation.x = -Math.PI / 2;
          lake.position.set(zx, 0.04, zy);
          lake.receiveShadow = true;
          scene.add(lake);
        } else {
          const flat = new THREE.Mesh(
            new THREE.ShapeGeometry(createRoundedRectShape(zw, zh, Math.min(zw, zh) * 0.12)),
            new THREE.MeshStandardMaterial({
              color,
              roughness: 0.92,
              envMapIntensity: 0.05
            })
          );
          flat.rotation.x = -Math.PI / 2;
          flat.position.set(zx, 0.03, zy);
          flat.receiveShadow = true;
          scene.add(flat);
        }

        // Scatter trees in green areas
        if (['green_belt', 'park', 'open_space'].includes(zone.type)) {
          const treeCount = Math.min(25, Math.floor((zw * zh) / 400));
          for (let t = 0; t < treeCount; t++) {
            const tx = zx - zw / 2 + 5 + Math.random() * (zw - 10);
            const tz = zy - zh / 2 + 5 + Math.random() * (zh - 10);
            makeTree(tx, tz, scene, 1);
          }
        }
      }
    });

    // ── Roads ──────────────────────────────────────────────────────────────
    roads.forEach((road) => {
      const pts = road.points_m;
      const roadW = road.width_m;
      if (pts.length < 2) return;

      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const dx = p2[0] - p1[0];
        const dz = p2[1] - p1[1];
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.5) continue;
        const angle = Math.atan2(dx, dz);
        const midX = (p1[0] + p2[0]) / 2;
        const midZ = (p1[1] + p2[1]) / 2;

        // Asphalt surface
        const rm = new THREE.Mesh(new THREE.BoxGeometry(roadW, 0.4, len), asphaltMat);
        rm.position.set(midX, 0.2, midZ);
        rm.rotation.y = angle;
        rm.receiveShadow = true;
        scene.add(rm);

        // Center lane dash
        const dashLen = 3, gapLen = 4;
        const dashCount = Math.floor(len / (dashLen + gapLen));
        for (let d = 0; d < dashCount; d++) {
          const t = (d * (dashLen + gapLen) + dashLen / 2) / len;
          if (t > 1) break;
          const dm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, dashLen), lineWhiteMat);
          dm.position.set(p1[0] + dx * t, 0.42, p1[1] + dz * t);
          dm.rotation.y = angle;
          scene.add(dm);
        }

        // Edge white lines
        [-roadW / 2 + 0.4, roadW / 2 - 0.4].forEach(offset => {
          const perpX = dz / len, perpZ = -dx / len;
          const em = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.42, len), lineWhiteMat);
          em.position.set(midX + perpX * offset, 0.42, midZ + perpZ * offset);
          em.rotation.y = angle;
          scene.add(em);
        });
      }
    });

    // ── Animation loop ─────────────────────────────────────────────────────
    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);

      // Smooth preset lerp (only when target is set)
      if (targetPosRef.current.lengthSq() > 0) {
        camera.position.lerp(targetPosRef.current, 0.06);
      }
      if (targetLookAtRef.current.lengthSq() > 0) {
        controls.target.lerp(targetLookAtRef.current, 0.06);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ── Resize handler ─────────────────────────────────────────────────────
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(raf);
      controls.dispose();
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      envMap.dispose();
      renderer.dispose();
    };
  }, [zones, roads, siteW, siteH]);

  // ── Camera preset handler ────────────────────────────────────────────────
  useEffect(() => {
    const maxDim = Math.max(siteW, siteH);

    const PRESETS = {
      aerial: {
        pos:    [cx + 0.01, maxDim * 1.9, cz + 0.01],
        lookAt: [cx, 0, cz]
      },
      isometric: {
        pos:    [cx + 0.01, maxDim * 1.45, cz + 0.01],
        lookAt: [cx, 0, cz]
      },
      street: {
        pos:    [cx + 0.01, maxDim * 0.95, cz + 0.01],
        lookAt: [cx, 0, cz]
      },
      cinematic: {
        pos:    [cx + 0.01, maxDim * 1.25, cz + 0.01],
        lookAt: [cx, 0, cz]
      }
    };

    const cfg = PRESETS[cameraPreset] || PRESETS.aerial;
    targetPosRef.current.set(...cfg.pos);
    targetLookAtRef.current.set(...cfg.lookAt);

    // Snap on first mount if camera hasn't moved
    if (cameraRef.current && controlsRef.current &&
        cameraRef.current.position.lengthSq() === 0) {
      cameraRef.current.position.set(...cfg.pos);
      controlsRef.current.target.set(...cfg.lookAt);
      controlsRef.current.update();
    }
  }, [cameraPreset, siteW, siteH]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[500px]"
      style={{ background: '#f5f4f0' }}
    />
  );
}
