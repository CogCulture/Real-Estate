import { PatternEvaluator } from '../../src/planning/patterns/evaluator';
import { LayoutPattern } from '../../src/planning/types';
import { AmenityOptimizer } from '../../src/planning/placement/amenity';
import { WalkabilityNetwork } from '../../src/planning/circulation/walkability';
import { ApartmentGenerator } from '../../src/engines/placement/generators/apartment';
import { ClipperGeometryKernel } from '../../src/geometry/kernel_impl';

describe('Sprint 8 Phase II: Architectural Quality', () => {
  it('should evaluate and select the best pattern', () => {
    // blockAspectRatio 1.0 -> COURTYARD gets +50 score
    const pattern = PatternEvaluator.evaluate(1.0);
    expect(pattern).toBe(LayoutPattern.COURTYARD);
  });
  
  it('should optimize amenity placement (center of gravity)', () => {
    const candidates = [
      { x: 10, y: 10 },
      { x: 50, y: 50 },
      { x: 90, y: 90 }
    ];
    const centroid = { x: 48, y: 48 };
    
    const best = AmenityOptimizer.placeClubhouse(candidates, centroid);
    expect(best.x).toBe(50);
    expect(best.y).toBe(50);
  });
  
  it('should compute walkability metrics correctly', () => {
    const nodes = [
      { x: 10, y: 10 },
      { x: 200, y: 200 }
    ];
    const amenities = [{ x: 50, y: 50 }];
    
    const metrics = WalkabilityNetwork.compute(nodes, amenities);
    expect(metrics.max_walk_to_amenity_m).toBeCloseTo(212.13, 1);
    expect(metrics.score).toBe(100); // 212m is < 400m
  });
  
  it('should orchestrate pattern generation decoupled from geometry', () => {
    const kernel = new ClipperGeometryKernel();
    const polygons = ApartmentGenerator.generatePhase2(1.0, {
      pattern: LayoutPattern.LINEAR,
      requiredSpacingMeters: 10,
      privacyBufferMeters: 10,
      daylightAngleDegrees: 45,
      maxBlockDepthMeters: 60,
      emergencyAccessWidthMeters: 6
    }, kernel);
    
    // Courtyard pattern spawns 4 towers
    expect(polygons.length).toBe(4);
    expect(polygons[0].length).toBe(4); // 4 points in poly
  });
});
