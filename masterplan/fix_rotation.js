const fs = require('fs');
const file = 'frontend/src/components/editor/Canvas2D.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add stageRotation state
content = content.replace(
  "  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });\n  const [stageScale, setStageScale] = useState(1);",
  "  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });\n  const [stageScale, setStageScale] = useState(1);\n  const [stageRotation, setStageRotation] = useState(0);"
);

// 2. Add rotateCanvas listener
content = content.replace(
  "    window.addEventListener('zoomCanvasIn', handleZoomIn);\n    window.addEventListener('zoomCanvasOut', handleZoomOut);\n    return () => {\n      window.removeEventListener('zoomCanvasIn', handleZoomIn);\n      window.removeEventListener('zoomCanvasOut', handleZoomOut);\n    };\n  }, [zoomStage]);",
  "    const handleRotateCanvas = (e) => {\n      if (e.detail && typeof e.detail.angle === 'number') {\n        setStageRotation(prev => (prev + e.detail.angle) % 360);\n      }\n    };\n    window.addEventListener('zoomCanvasIn', handleZoomIn);\n    window.addEventListener('zoomCanvasOut', handleZoomOut);\n    window.addEventListener('rotateCanvas', handleRotateCanvas);\n    return () => {\n      window.removeEventListener('zoomCanvasIn', handleZoomIn);\n      window.removeEventListener('zoomCanvasOut', handleZoomOut);\n      window.removeEventListener('rotateCanvas', handleRotateCanvas);\n    };\n  }, [zoomStage]);"
);

// 3. Fix zoomStage math and mapWrapperRef rotate
content = content.replace(
  "    const mousePointTo = {\n      x: (pointer.x - stage.x()) / oldScale,\n      y: (pointer.y - stage.y()) / oldScale,\n    };\n\n    const newScale = zoomIn ? oldScale * scaleBy : oldScale / scaleBy;\n\n    if (newScale < 0.1 || newScale > 10) return;\n\n    const newX = pointer.x - mousePointTo.x * newScale;\n    const newY = pointer.y - mousePointTo.y * newScale;\n\n    setStageScale(newScale);\n    setStagePos({ x: newX, y: newY });\n\n    if (mapWrapperRef.current) {\n      mapWrapperRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${newScale})`;\n    }\n  }, [width, height]);",
  "    const oldPos = stage.getRelativePointerPosition() || { x: width / 2, y: height / 2 };\n    const newScale = zoomIn ? oldScale * scaleBy : oldScale / scaleBy;\n\n    if (newScale < 0.1 || newScale > 10) return;\n\n    stage.scale({ x: newScale, y: newScale });\n    const newAbsolutePos = stage.getAbsoluteTransform().point(oldPos);\n    const dx = pointer.x - newAbsolutePos.x;\n    const dy = pointer.y - newAbsolutePos.y;\n    const newX = stage.x() + dx;\n    const newY = stage.y() + dy;\n    stage.scale({ x: oldScale, y: oldScale });\n\n    setStageScale(newScale);\n    setStagePos({ x: newX - width / 2, y: newY - height / 2 });\n\n    if (mapWrapperRef.current) {\n      mapWrapperRef.current.style.transform = `translate(${newX - width / 2}px, ${newY - height / 2}px) scale(${newScale}) rotate(${stage.rotation()}deg)`;\n    }\n  }, [width, height]);"
);

// 4. Fix handleWheel math and mapWrapperRef rotate
content = content.replace(
  "    const mousePointTo = {\n      x: (pointer.x - stage.x()) / oldScale,\n      y: (pointer.y - stage.y()) / oldScale,\n    };\n    \n    // Zoom in on scroll up, zoom out on scroll down\n    const direction = e.evt.deltaY > 0 ? -1 : 1;\n    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;\n    \n    // Limit scale (e.g., between 0.1 and 10)\n    if (newScale < 0.1 || newScale > 10) return;\n\n    const newX = pointer.x - mousePointTo.x * newScale;\n    const newY = pointer.y - mousePointTo.y * newScale;\n\n    setStageScale(newScale);\n    setStagePos({ x: newX, y: newY });\n\n    if (mapWrapperRef.current) {\n      mapWrapperRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${newScale})`;\n    }",
  "    const oldPos = stage.getRelativePointerPosition() || { x: width / 2, y: height / 2 };\n    \n    // Zoom in on scroll up, zoom out on scroll down\n    const direction = e.evt.deltaY > 0 ? -1 : 1;\n    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;\n    \n    // Limit scale (e.g., between 0.1 and 10)\n    if (newScale < 0.1 || newScale > 10) return;\n\n    stage.scale({ x: newScale, y: newScale });\n    const newAbsolutePos = stage.getAbsoluteTransform().point(oldPos);\n    const dx = pointer.x - newAbsolutePos.x;\n    const dy = pointer.y - newAbsolutePos.y;\n    const newX = stage.x() + dx;\n    const newY = stage.y() + dy;\n    stage.scale({ x: oldScale, y: oldScale });\n\n    setStageScale(newScale);\n    setStagePos({ x: newX - width / 2, y: newY - height / 2 });\n\n    if (mapWrapperRef.current) {\n      mapWrapperRef.current.style.transform = `translate(${newX - width / 2}px, ${newY - height / 2}px) scale(${newScale}) rotate(${stage.rotation()}deg)`;\n    }"
);

// 5. Fix amenity rotation bug
content = content.replace(
  "      rotation_deg: (amenity.rotation_deg || 0) + node.rotation()\n    });",
  "      rotation_deg: ((amenity.rotation_deg || 0) + (rotRad * 180 / Math.PI)) % 360\n    });"
);

// 6. Fix mapWrapperRef transform rendering
content = content.replace(
  "              transform: `translate(${stagePos.x}px, ${stagePos.y}px) scale(${stageScale})`,\n              transformOrigin: `${width * 2}px ${height * 2}px`,",
  "              transform: `translate(${stagePos.x}px, ${stagePos.y}px) scale(${stageScale}) rotate(${stageRotation}deg)`,\n              transformOrigin: `${width * 2 + width / 2}px ${height * 2 + height / 2}px`,"
);

// 7. Fix Stage rotation rendering properties
content = content.replace(
  "            ref={stageRef}\n            width={width}\n            height={height}\n            x={stagePos.x}\n            y={stagePos.y}\n            scaleX={stageScale}",
  "            ref={stageRef}\n            width={width}\n            height={height}\n            x={stagePos.x + width / 2}\n            y={stagePos.y + height / 2}\n            offsetX={width / 2}\n            offsetY={height / 2}\n            rotation={stageRotation}\n            scaleX={stageScale}"
);

// 8. Fix Stage drag handlers
content = content.replace(
  "            onDragMove={(e) => {\n              if (e.target === stageRef.current) {\n                // Imperative update for zero latency\n                if (mapWrapperRef.current) {\n                  mapWrapperRef.current.style.transform = `translate(${e.target.x()}px, ${e.target.y()}px) scale(${stageScale})`;\n                }\n              }\n            }}\n            onDragEnd={(e) => {\n              if (e.target === stageRef.current) {\n                setStagePos({ x: e.target.x(), y: e.target.y() });\n              }\n            }}",
  "            onDragMove={(e) => {\n              if (e.target === stageRef.current) {\n                // Imperative update for zero latency\n                if (mapWrapperRef.current) {\n                  mapWrapperRef.current.style.transform = `translate(${e.target.x() - width / 2}px, ${e.target.y() - height / 2}px) scale(${stageScale}) rotate(${stageRotation}deg)`;\n                }\n              }\n            }}\n            onDragEnd={(e) => {\n              if (e.target === stageRef.current) {\n                setStagePos({ x: e.target.x() - width / 2, y: e.target.y() - height / 2 });\n              }\n            }}"
);

fs.writeFileSync(file, content);
console.log("Patched correctly!");
