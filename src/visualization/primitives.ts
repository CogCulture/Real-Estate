import { HierarchicalStyleToken } from './styling/tokens';
import { Point } from '../core/types';

export type RenderPrimitiveType = 'Path' | 'Polygon' | 'Circle' | 'Rectangle' | 'Text' | 'Icon' | 'Group';

export interface BasePrimitive {
  type: RenderPrimitiveType;
  style: HierarchicalStyleToken;
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
