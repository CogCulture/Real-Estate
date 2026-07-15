import { DesignGenome, EvaluatedGenome, ObjectiveVector } from './types';
import { DiversityFilter } from './diversity';

export class Scorer {
  static evaluate(genome: DesignGenome, layoutMetrics: any): EvaluatedGenome {
    // Determine hard constraints pass/fail
    let hard_constraints_passed = true;
    if (layoutMetrics.far && layoutMetrics.far > 2.5) hard_constraints_passed = false;
    
    // Calculate Objective Vector
    const objectives: ObjectiveVector = {
      saleable_area: layoutMetrics.saleable_area || 0,
      far: layoutMetrics.far || 0,
      coverage: layoutMetrics.coverage || 0,
      open_space: layoutMetrics.open_space || 0,
      walkability: layoutMetrics.walkability || 0,
      emergency_access: layoutMetrics.emergency_access || 0,
      infrastructure_efficiency: layoutMetrics.infrastructure_efficiency || 0
    };

    return {
      genome,
      objectives,
      hard_constraints_passed,
      pareto_rank: 0,
      diversity_hash: DiversityFilter.computeFingerprint(layoutMetrics)
    };
  }
}
