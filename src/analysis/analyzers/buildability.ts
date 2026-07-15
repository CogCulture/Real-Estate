import { Polygon } from '../../core/types';
import { GeometryKernel } from '../../geometry/kernel';
import { BuildabilityAnalysis, SiteConstraints } from '../types';

export class BuildabilityAnalyzer {
  static analyze(
    boundary: Polygon, 
    constraints: SiteConstraints, 
    kernel: GeometryKernel
  ): BuildabilityAnalysis {
    const gross = kernel.computeArea(boundary);
    
    // We will do a generic offset inward by 3m to represent standard plot setbacks.
    // We also clip out no_build_areas using boolean intersection if needed.
    // For now, simple offset:
    const buildable_polygon = kernel.offset(boundary, -3.0);
    const buildable_area = kernel.computeArea(buildable_polygon);
    const restricted = gross - buildable_area;
    
    return {
      gross_area_sqm: gross,
      buildable_area_sqm: buildable_area,
      restricted_area_sqm: restricted,
      usable_ratio: gross > 0 ? buildable_area / gross : 0,
      buildable_polygon
    };
  }
}
