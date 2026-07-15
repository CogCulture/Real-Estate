import { Polygon } from '../core/types';
import { GeometryKernel } from '../geometry/kernel';
import { 
  SiteAnalysisResult, 
  SiteConstraints, 
  ObjectiveWeights, 
  SiteAccessibility 
} from './types';

import { BoundaryAnalyzer } from './analyzers/boundary';
import { BuildabilityAnalyzer } from './analyzers/buildability';
import { EnvironmentAnalyzer } from './analyzers/environment';
import { UtilitiesAnalyzer } from './analyzers/utilities';
import { ContextAnalyzer } from './analyzers/context';

export class SiteAnalysisEngine {
  constructor(private kernel: GeometryKernel) {}

  analyze(
    siteId: string, 
    boundary: Polygon, 
    constraints: SiteConstraints,
    objectiveWeights: ObjectiveWeights
  ): SiteAnalysisResult {
    
    const geometry = BoundaryAnalyzer.analyze(boundary, this.kernel);
    const buildability = BuildabilityAnalyzer.analyze(boundary, constraints, this.kernel);
    const environment = EnvironmentAnalyzer.analyze();
    const utilities = UtilitiesAnalyzer.analyze();
    const context = ContextAnalyzer.analyze();
    
    // Stub Accessibility
    const accessibility: SiteAccessibility = {
      frontage_lengths_m: {},
      entry_opportunities: [],
      road_adjacency: false,
      corner_plot: false
    };

    return {
      id: siteId,
      geometry,
      accessibility,
      environment,
      utilities,
      context,
      constraints,
      buildability,
      objective_weights: objectiveWeights
    };
  }
}
