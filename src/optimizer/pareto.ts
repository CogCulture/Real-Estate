import { EvaluatedGenome, ObjectiveVector } from './types';

export class ParetoRanking {
  private static dominates(a: ObjectiveVector, b: ObjectiveVector): boolean {
    let strictImprovement = false;
    
    // We assume maximization for all these objectives
    const metrics = ['saleable_area', 'far', 'open_space', 'walkability', 'emergency_access', 'infrastructure_efficiency'] as const;
    
    for (const m of metrics) {
      if (a[m] < b[m]) return false; // a is worse
      if (a[m] > b[m]) strictImprovement = true; // a is strictly better
    }
    
    // Coverage we want to minimize
    if (a.coverage > b.coverage) return false;
    if (a.coverage < b.coverage) strictImprovement = true;

    return strictImprovement;
  }

  static sort(population: EvaluatedGenome[]): EvaluatedGenome[][] {
    const fronts: EvaluatedGenome[][] = [];
    let remaining = [...population];

    while (remaining.length > 0) {
      const currentFront: EvaluatedGenome[] = [];
      
      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        let isDominated = false;
        
        for (let j = 0; j < remaining.length; j++) {
          if (i === j) continue;
          if (this.dominates(remaining[j].objectives, candidate.objectives)) {
            isDominated = true;
            break;
          }
        }
        
        if (!isDominated) {
          currentFront.push(candidate);
        }
      }
      
      for (const p of currentFront) {
        p.pareto_rank = fronts.length + 1;
      }
      
      fronts.push(currentFront);
      remaining = remaining.filter(p => p.pareto_rank === 0);
    }

    return fronts;
  }
}
