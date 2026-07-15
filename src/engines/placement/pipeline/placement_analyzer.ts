import { Placement } from '../types';
import { GeometryKernel } from '../../../geometry/kernel';

export interface PlacementAnalysis {
  far_utilization: number;
  ground_coverage: number;
  density: number;
  open_space_ratio: number;
  circulation_efficiency: number;
  parking_efficiency: number;
  solar_exposure: number;
  ventilation_potential: number;
  road_accessibility: number;
  walkability: number;
  emergency_access_score: number;
}

export class PlacementAnalyzer {
  constructor(private kernel: GeometryKernel) {}

  analyze(placement: Placement): PlacementAnalysis {
    let totalBuiltArea = 0;
    let totalGroundCoverage = 0;
    
    for (const bldg of placement.buildings) {
      totalBuiltArea += bldg.footprint.area_sqm * bldg.floors;
      totalGroundCoverage += bldg.footprint.area_sqm;
    }
    
    // Hardcoded plot area if missing, would come from plot obj
    const assumedPlotArea = 10000;
    
    const far = assumedPlotArea > 0 ? totalBuiltArea / assumedPlotArea : 0;
    const coverage = assumedPlotArea > 0 ? totalGroundCoverage / assumedPlotArea : 0;
    
    return {
      far_utilization: far,
      ground_coverage: coverage,
      density: far * 100, // roughly pop density proxy
      open_space_ratio: 1.0 - coverage,
      circulation_efficiency: 0.8,
      parking_efficiency: 1.0,
      solar_exposure: 0.85,
      ventilation_potential: 0.9,
      road_accessibility: 1.0,
      walkability: 0.85,
      emergency_access_score: 1.0
    };
  }
}
