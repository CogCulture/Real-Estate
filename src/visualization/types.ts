import { RenderPrimitive } from './primitives';

export interface RenderScene {
  background: RenderPrimitive[];
  terrain: RenderPrimitive[];
  water: RenderPrimitive[];
  landscape: RenderPrimitive[];
  roads: RenderPrimitive[];
  parking: RenderPrimitive[];
  pedestrian: RenderPrimitive[];
  buildings: RenderPrimitive[];
  amenities: RenderPrimitive[];
  trees: RenderPrimitive[];
  roadMarkings: RenderPrimitive[];
  labels: RenderPrimitive[];
  shadows: RenderPrimitive[];
  debug: RenderPrimitive[];
}
