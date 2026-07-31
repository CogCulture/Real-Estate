import React from 'react';
import { Layer } from 'react-konva';
import type { RenderScene } from '../types';
import { PrimitiveRenderer } from './PrimitiveRenderer';
import { useEditorStore } from '../store/editor';

interface Props {
  scene: RenderScene;
}

export const LayerManager: React.FC<Props> = ({ scene }) => {
  const { select, selectedIds } = useEditorStore();

  const renderLayer = (primitives: any[]) => {
    return primitives.map((prim, i) => (
      <PrimitiveRenderer 
        key={`${prim.style}-${i}`} 
        primitive={prim} 
        isSelected={prim.id && selectedIds.includes(prim.id)}
        onClick={() => {
          if (prim.id) select(prim.id);
        }}
      />
    ));
  };

  return (
    <>
      <Layer name="background">{renderLayer(scene.background)}</Layer>
      <Layer name="terrain">{renderLayer(scene.terrain)}</Layer>
      <Layer name="water">{renderLayer(scene.water)}</Layer>
      <Layer name="landscape">{renderLayer(scene.landscape)}</Layer>
      <Layer name="roads">{renderLayer(scene.roads)}</Layer>
      <Layer name="parking">{renderLayer(scene.parking)}</Layer>
      <Layer name="pedestrian">{renderLayer(scene.pedestrian)}</Layer>
      <Layer name="buildings">{renderLayer(scene.buildings)}</Layer>
      <Layer name="amenities">{renderLayer(scene.amenities)}</Layer>
      <Layer name="trees">{renderLayer(scene.trees)}</Layer>
      <Layer name="roadMarkings">{renderLayer(scene.roadMarkings)}</Layer>
      <Layer name="shadows">{renderLayer(scene.shadows)}</Layer>
      <Layer name="labels">{renderLayer(scene.labels)}</Layer>
      <Layer name="debug">{renderLayer(scene.debug)}</Layer>
    </>
  );
};
