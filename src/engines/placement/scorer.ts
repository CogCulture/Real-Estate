import { PlacementCandidate } from './types';
import { CandidateScore } from '../../core/pipeline/result';

export class PlacementScorer {
  static score(candidates: PlacementCandidate[]): CandidateScore[] {
    return candidates.map(c => {
      // Calculate composite score based on avg metrics of all placements in candidate
      let totalFar = 0;
      let totalCov = 0;
      for (const p of c.placements) {
        totalFar += p.metrics.far;
        totalCov += p.metrics.coverage_ratio;
      }
      const avgFar = c.placements.length > 0 ? totalFar / c.placements.length : 0;
      
      // Target FAR = 2.0
      const farPenalty = Math.abs(2.0 - avgFar) * 10;
      const compositeScore = Math.max(0, 100 - farPenalty);
      
      return {
        total: compositeScore,
        weighted_metrics: { far: avgFar },
        penalties: { far_deviation: farPenalty },
        bonuses: {},
        confidence: 0.95,
        explanation: {
          reason: 'Score derived from FAR optimization target 2.0',
          affected_metrics: ['far'],
          alternatives_considered: [],
          confidence: 0.95,
          references: []
        }
      };
    });
  }
}
