export type Point = { x: number; y: number };

export type RenderPrimitiveType = 'Path' | 'Polygon' | 'Circle' | 'Rectangle' | 'Text' | 'Icon' | 'Group';

export interface BasePrimitive {
  id?: string;
  type: RenderPrimitiveType;
  style: any; // using string cast to StyleToken
  zIndex?: number;
}

export interface RenderPolygon extends BasePrimitive {
  type: 'Polygon';
  points: Point[];
}

export interface RenderCircle extends BasePrimitive {
  type: 'Circle';
  center: Point;
  radius: number;
}

export interface RenderText extends BasePrimitive {
  type: 'Text';
  anchor: Point;
  text: string;
  hidden: boolean;
  fontSize?: number;
}

export type RenderPrimitive = RenderPolygon | RenderCircle | RenderText;

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
