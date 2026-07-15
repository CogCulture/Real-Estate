import { WorldState } from './state';

export interface Engine<TInput, TOutput> {
  execute(input: TInput): TOutput;
}

export interface PlannerInput {
  blocks: any[]; // Typed in Sprint 3
  world_state: WorldState;
  knowledge_base: any; // Typed in Sprint 4
  operation_params: Record<string, any>;
  seed: number;
}

export interface PlannerOutput {
  placements: any[];
  updated_state: WorldState;
  decisions: any[];
  score: number;
}

export interface Planner {
  execute(input: PlannerInput): PlannerOutput;
}
