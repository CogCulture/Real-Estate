import { Point } from '../core/types';

export class CoordinateSystem {
  static readonly PRECISION_CM = 2; // 2 decimal places in metres
  static readonly TOLERANCE = 0.01; // 1cm tolerance for equality

  static round(val: number): number {
    const factor = Math.pow(10, this.PRECISION_CM);
    return Math.round(val * factor) / factor;
  }

  static arePointsEqual(p1: Point, p2: Point): boolean {
    return Math.abs(p1.x - p2.x) <= this.TOLERANCE && 
           Math.abs(p1.y - p2.y) <= this.TOLERANCE;
  }

  static snapToGrid(point: Point, gridSize: number): Point {
    return {
      x: this.round(Math.round(point.x / gridSize) * gridSize),
      y: this.round(Math.round(point.y / gridSize) * gridSize)
    };
  }
}
