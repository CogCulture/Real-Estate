import { Point } from '../../core/types';

export class GeometrySimplifier {
  static simplify(points: Point[], tolerance: number): Point[] {
    // Stub implementation of Douglas-Peucker or similar geometric simplification
    // For now, if poly is small enough, it returns as is, else filters out tightly packed nodes
    if (points.length < 4) return points;
    return points.filter((p, i) => i % 2 === 0 || i === points.length - 1);
  }
}
