import { DesignGenome, EvaluatedGenome } from './types';
import { RNG } from '../core/random';
import { MutationRegistry } from './mutation/registry';

// Define a type for the pipeline callback so HillClimb can re-evaluate genomes
export type GenomeEvaluatorCallback = (genomes: DesignGenome[]) => EvaluatedGenome[];

export class HillClimbing {
  static run(candidate: EvaluatedGenome, evaluator: GenomeEvaluatorCallback, rng: RNG, maxSteps: number): EvaluatedGenome {
    let current = candidate;
    
    for (let i = 0; i < maxSteps; i++) {
      const mutatedGenome = MutationRegistry.mutate(current.genome, rng);
      const evaluated = evaluator([mutatedGenome])[0];
      
      // Accept only if it passes hard constraints AND strictly improves a primary objective (e.g., saleable area)
      // or strictly dominates the current candidate.
      // We implement a simplified check for this stub:
      if (evaluated.hard_constraints_passed && evaluated.objectives.saleable_area > current.objectives.saleable_area) {
        current = evaluated;
      } else {
        // If no improvement, we stop early
        break;
      }
    }
    
    return current;
  }
}
