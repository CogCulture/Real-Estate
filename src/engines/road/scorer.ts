import { RoadNetwork, RoadScoreResult } from './types';
import { Polygon } from '../../core/types';

export class RoadScorer {
  static score(network: RoadNetwork, siteBoundary: Polygon): RoadScoreResult {
    // Dummy implementation
    return {
      composite_score: 0.8,
      metrics: {
        connectivity: 0.8,
        hierarchy: 0.8,
        regularity: 0.8,
        entry_access: 0.8,
        utilisation: 0.8
      },
      pass_discard_threshold: true,
      rejection_reasons: []
    };
  }
}
