import React, { useRef, useEffect, useState } from 'react';
import { Stage } from 'react-konva';
import { useEditorStore } from '../store/editor';
import { RenderScene } from '../types';
import { LayerManager } from './LayerManager';
import { InfiniteGrid } from './InfiniteGrid';

interface Props {
  scene: RenderScene | null;
}

export const Viewport: React.FC<Props> = ({ scene }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { x, y, scale, setViewport, tool, clearSelection } = useEditorStore();

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Zoom logic
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    
    // Zoom in/out factor
    const scaleBy = 1.1;
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    // Zoom to cursor
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    
    setViewport(newPos.x, newPos.y, newScale);
  };

  const handleDragEnd = (e: any) => {
    setViewport(e.target.x(), e.target.y(), scale);
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-[#1a1a1a] overflow-hidden relative cursor-crosshair">
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={scale}
        scaleY={scale}
        x={x}
        y={y}
        draggable={tool === 'pan'}
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          // If clicked empty space, clear selection
          if (e.target === e.target.getStage()) {
            clearSelection();
          }
        }}
      >
        <Layer name="grid">
          <InfiniteGrid width={size.width} height={size.height} scale={scale} x={x} y={y} />
        </Layer>
        {scene && <LayerManager scene={scene} />}
      </Stage>
    </div>
  );
};
