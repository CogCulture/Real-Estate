import { ObjectiveWeights } from './types';

export class ObjectiveEvaluator {
  static evaluate(weights: ObjectiveWeights, metrics: Record<string, number>): number {
    let score = 0;
    
    // Normalize and compute weighted sum
    if (metrics['saleable_area']) score += weights.saleable_area * metrics['saleable_area'];
    if (metrics['far']) score += weights.far * metrics['far'];
    if (metrics['coverage']) score -= weights.coverage * metrics['coverage']; // Example: minimize coverage
    if (metrics['open_space']) score += weights.open_space * metrics['open_space'];
    
    return score;
  }
}
