import { Polygon, Point } from '../core/types';

export interface GeometryKernel {
  computeArea(poly: Polygon): number;
  computeCentroid(poly: Polygon): Point;
  offset(poly: Polygon, distance: number): Polygon;
  booleanIntersect(p1: Polygon, p2: Polygon): Polygon[];
  // Convex hull, simplification, distance, bounding boxes...
}

export interface BuildableGeometry {
  primary_polygon: Polygon;
  secondary_polygons: Polygon[];
  restricted_regions: Polygon[];
  effective_area_sqm: number;
}
