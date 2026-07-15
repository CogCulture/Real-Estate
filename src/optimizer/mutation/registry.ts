import { DesignGenome } from '../types';
import { RNG } from '../../core/random';
import { RoadMutator } from './road';

export class MutationRegistry {
  static mutate(genome: DesignGenome, rng: RNG): DesignGenome {
    // In full scale, this registry picks randomly or based on heuristics from road, block, placement operators.
    // We proxy it to RoadMutator for now.
    return RoadMutator.mutate(genome, rng);
  }
}
