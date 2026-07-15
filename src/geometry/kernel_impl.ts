import { GeometryKernel } from './kernel';
import { Polygon, Point } from '../core/types';
import * as clipper from 'clipper-lib';
import polygonClipping from 'polygon-clipping';
import { CoordinateSystem } from './coordinates';

export class ClipperGeometryKernel implements GeometryKernel {
  private scale = 1000; // Clipper requires integer coordinates

  private toClipper(poly: Polygon): { X: number; Y: number }[] {
    return poly.map(p => ({ X: Math.round(p.x * this.scale), Y: Math.round(p.y * this.scale) }));
  }

  private fromClipper(path: { X: number; Y: number }[]): Polygon {
    return path.map(p => ({ x: p.X / this.scale, y: p.Y / this.scale }));
  }

  computeArea(poly: Polygon): number {
    if (poly.length < 3) return 0;
    const path = this.toClipper(poly);
    return Math.abs(clipper.Clipper.Area(path)) / (this.scale * this.scale);
  }

  computeCentroid(poly: Polygon): Point {
    if (poly.length < 3) return poly.length === 0 ? {x:0,y:0} : poly[0];
    let x = 0, y = 0, area = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const p1 = poly[i];
      const p2 = poly[j];
      const f = p1.x * p2.y - p2.x * p1.y;
      x += (p1.x + p2.x) * f;
      y += (p1.y + p2.y) * f;
      area += f * 3;
    }
    if (area === 0) return poly[0];
    return { x: x / area, y: y / area };
  }

  offset(poly: Polygon, distance: number): Polygon {
    if (poly.length < 3 || distance === 0) return poly;
    const path = this.toClipper(poly);
    const co = new clipper.ClipperOffset();
    co.AddPath(path, clipper.JoinType.jtMiter, clipper.EndType.etClosedPolygon);
    const solution = new clipper.Paths();
    // distance is scaled
    co.Execute(solution, distance * this.scale);
    
    // Return largest path if multiple
    if (solution.length === 0) return [];
    let largest = solution[0];
    let maxArea = Math.abs(clipper.Clipper.Area(largest));
    for (let i = 1; i < solution.length; i++) {
      const area = Math.abs(clipper.Clipper.Area(solution[i]));
      if (area > maxArea) {
        maxArea = area;
        largest = solution[i];
      }
    }
    return this.fromClipper(largest);
  }

  booleanIntersect(p1: Polygon, p2: Polygon): Polygon[] {
    // using polygon-clipping for robustness over clipper1's strict integer rules
    try {
      const geom1 = [p1.map(p => [p.x, p.y] as [number, number])];
      const geom2 = [p2.map(p => [p.x, p.y] as [number, number])];
      const intersection = polygonClipping.intersection(geom1, geom2);
      
      const results: Polygon[] = [];
      for (const poly of intersection) {
        for (const ring of poly) {
          results.push(ring.map(p => ({ x: p[0], y: p[1] })));
        }
      }
      return results;
    } catch(e) {
      return []; // Return empty on non-intersect or degenerate polygons
    }
  }
  
  getBoundingBox(poly: Polygon) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }
}
