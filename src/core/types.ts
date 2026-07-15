export type Point = { x: number; y: number; z?: number };
export type Polygon = Point[];
export type ElementType = string;
export type Stage = 
  | 'boundary'
  | 'setbacks'
  | 'gates'
  | 'spine'
  | 'secondary_roads'
  | 'utility_corridors'
  | 'block_generation'
  | 'anchors'
  | 'towers'
  | 'villas'
  | 'commercial'
  | 'parking'
  | 'landscape_reservation'
  | 'water_features'
  | 'walkways'
  | 'trees'
  | 'final_validation';
export type SeedMap = Record<string, number>;
