import { DesignGenome, EvaluatedGenome } from './types';
import { DiversityFilter } from './diversity';
import { ParetoRanking } from './pareto';

export class BeamSearch {
  static prune(population: EvaluatedGenome[], maxBeamWidth: number): EvaluatedGenome[] {
    // 1. Hard constraint filter
    let valid = population.filter(p => p.hard_constraints_passed);
    
    // If no valid exist, fall back to soft ranking to at least maintain the beam
    if (valid.length === 0) valid = population;
    
    // 2. Diversity filter (Remove exact semantic duplicates)
    valid = DiversityFilter.filter(valid);
    
    // 3. Pareto Sort
    const fronts = ParetoRanking.sort(valid);
    
    // 4. Select top N (Beam Width)
    const nextGeneration: EvaluatedGenome[] = [];
    for (const front of fronts) {
      if (nextGeneration.length >= maxBeamWidth) break;
      
      // If we can take the whole front, take it
      if (nextGeneration.length + front.length <= maxBeamWidth) {
        nextGeneration.push(...front);
      } else {
        // Tie-break within the front using a simple heuristic (e.g. saleable area for now)
        // CTO instructed that weighted aggregation is used as final tie-breaker
        front.sort((a, b) => b.objectives.saleable_area - a.objectives.saleable_area);
        const remainingSpots = maxBeamWidth - nextGeneration.length;
        nextGeneration.push(...front.slice(0, remainingSpots));
      }
    }
    
    return nextGeneration;
  }
}
