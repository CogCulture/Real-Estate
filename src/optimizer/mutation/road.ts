import { DesignGenome, GenomeMutation } from '../types';
import { RNG } from '../../core/random';

export class RoadMutator {
  static mutate(genome: DesignGenome, rng: RNG): DesignGenome {
    const clone: DesignGenome = JSON.parse(JSON.stringify(genome));
    const mutationId = `mut_${rng.nextInt(0, 999999)}`;
    
    // Choose randomly what to mutate (primary spacing, secondary spacing, gate positions)
    const choice = rng.nextInt(0, 2);
    
    let previous: any;
    let next: any;
    let param: string;
    
    if (choice === 0) {
      previous = clone.primary_road_spacing_m;
      // +/- 10%
      next = previous * (1.0 + rng.nextRange(-0.1, 0.1));
      clone.primary_road_spacing_m = next;
      param = 'primary_road_spacing_m';
    } else if (choice === 1) {
      previous = clone.secondary_road_spacing_m;
      next = previous * (1.0 + rng.nextRange(-0.1, 0.1));
      clone.secondary_road_spacing_m = next;
      param = 'secondary_road_spacing_m';
    } else {
      previous = [...clone.gate_positions];
      if (clone.gate_positions.length > 0) {
        const idx = rng.nextInt(0, clone.gate_positions.length - 1);
        // Shift gate position along perimeter slightly
        clone.gate_positions[idx] += rng.nextRange(-0.05, 0.05);
        if (clone.gate_positions[idx] < 0) clone.gate_positions[idx] += 1;
        if (clone.gate_positions[idx] > 1) clone.gate_positions[idx] -= 1;
      }
      next = [...clone.gate_positions];
      param = 'gate_positions';
    }
    
    const mut: GenomeMutation = {
      id: mutationId,
      operator: 'RoadMutator',
      parameter: param,
      previous_value: previous,
      new_value: next
    };
    
    clone.mutations.push(mut);
    return clone;
  }
}
