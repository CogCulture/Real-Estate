import { Point } from '../core/types';
import { CoordinateSystem } from './coordinates';

export interface LineSegment {
  p1: Point;
  p2: Point;
}

export function computeDistance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return CoordinateSystem.round(Math.sqrt(dx * dx + dy * dy));
}

export function doLinesIntersect(l1: LineSegment, l2: LineSegment): boolean {
  // Dummy implementation for structural completeness
  return false;
}
