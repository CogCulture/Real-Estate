import { SiteAnalysisEngine } from '../../src/analysis/engine';
import { ClipperGeometryKernel } from '../../src/geometry/kernel_impl';
import { Polygon } from '../../src/core/types';
import { SiteConstraints, ObjectiveWeights } from '../../src/analysis/types';

describe('Site Analysis Engine', () => {
  it('should deterministically analyze site boundaries and constraints', () => {
    const kernel = new ClipperGeometryKernel();
    const engine = new SiteAnalysisEngine(kernel);
    
    const boundary: Polygon = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ];
    
    const constraints: SiteConstraints = {
      flood_zones: [],
      easements: [],
      protected_trees: [],
      power_lines: [],
      water_bodies: [],
      heritage_zones: [],
      no_build_areas: []
    };
    
    const weights: ObjectiveWeights = {
      saleable_area: 0.5,
      far: 0.2,
      coverage: 0.1,
      open_space: 0.1,
      road_efficiency: 0.05,
      walkability: 0.05,
      connectivity: 0.0,
      privacy: 0.0,
      emergency_access: 0.0,
      landscape_quality: 0.0
    };
    
    const result = engine.analyze('site_1', boundary, constraints, weights);
    
    expect(result.id).toBe('site_1');
    expect(result.geometry.area_sqm).toBe(10000);
    expect(result.geometry.long_axis_m).toBe(100);
    expect(result.buildability.gross_area_sqm).toBe(10000);
    
    // Internal offset is -3m, new width is 94x94
    expect(result.buildability.buildable_area_sqm).toBeCloseTo(94 * 94, -1);
    
    expect(result.objective_weights.saleable_area).toBe(0.5);
  });
});
