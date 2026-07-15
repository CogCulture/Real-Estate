import { Engine } from '../../core/contracts';
import { WorldState } from '../../core/state';
import { PlanningIntent } from '../../dsl/schema';
import { GateGenerator } from './generators/gates';
import { PrimaryRoadGenerator } from './generators/primary';
import { SecondaryRoadGenerator } from './generators/secondary';
import { RoadAssembler } from './assembler/road_assembler';
import { RoadValidator } from './validator';
import { RoadScorer } from './scorer';
import { RoadCandidate, RoadStageResult, RoadTopology } from './types';

export interface RoadEngineInput {
  intent: PlanningIntent;
  world_state: WorldState; 
  seed: number;
}

export class RoadEngine implements Engine<RoadEngineInput, RoadStageResult> {
  execute(input: RoadEngineInput): RoadStageResult {
    const candidates: RoadCandidate[] = [];
    const topologies = [
      RoadTopology.GRID, 
      RoadTopology.MODIFIED_GRID, 
      RoadTopology.SPINE, 
      RoadTopology.LOOP, 
      RoadTopology.HYBRID
    ];
    
    // We explore variants by modifying the seed slightly for each iteration
    const baseSeed = input.seed;
    
    for (const topology of topologies) {
      for (let variant = 0; variant < 3; variant++) {
        const variantSeed = baseSeed + variant * 1000;
        
        const gates = GateGenerator.generate(input.intent, input.world_state.site_stage!.site_boundary, variantSeed);
        const primary = PrimaryRoadGenerator.generate(input.intent, gates, variantSeed);
        const secondary = SecondaryRoadGenerator.generate(input.intent, primary, topology, variantSeed);
        
        const network = RoadAssembler.assemble(gates, primary, secondary, topology);
        const validation = RoadValidator.validate(network);
        
        if (!validation.is_valid) continue;
        
        const score = RoadScorer.score(network, input.world_state.site_stage!.site_boundary);
        
        candidates.push({
          network,
          topology,
          seed: variantSeed,
          score
        });
      }
    }
    
    if (candidates.length === 0) {
      throw new Error('Road Engine failed to generate any valid candidates.');
    }
    
    candidates.sort((a, b) => b.score.composite_score - a.score.composite_score);
    
    // Ensure we filter those passing discard threshold for the 'best'
    const bestPassing = candidates.find(c => c.score.pass_discard_threshold) || candidates[0];
    
    return {
      best_candidate: bestPassing,
      all_candidates: candidates,
      stage_score: bestPassing.score.composite_score
    };
  }
}
