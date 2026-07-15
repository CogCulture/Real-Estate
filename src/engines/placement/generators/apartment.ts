import { PatternEvaluator } from '../../../planning/patterns/evaluator';
import { PatternPlanner } from '../../../planning/patterns/planner';
import { PlacementExecutor } from '../../../planning/patterns/executor';
import { GeometryKernel } from '../../../geometry/kernel';
import { PlanningProfile } from '../../../planning/types';
import { Polygon } from '../../../core/types';

export class ApartmentGenerator {
  static generate(plot: any, seed: number): any[] {
    // Phase 2 hook for backward compat
    return [];
  }
  
  static generatePhase2(blockAspectRatio: number, profile: PlanningProfile, kernel: GeometryKernel): Polygon[] {
    // 1. Evaluate best pattern candidate
    const bestPattern = PatternEvaluator.evaluate(blockAspectRatio);
    
    // Override profile pattern with evaluated one
    profile.pattern = bestPattern;
    
    // 2. Plan nodes
    const plan = PatternPlanner.plan(profile, 100, 100);
    
    // 3. Execute placement
    return PlacementExecutor.execute(plan, kernel);
  }
}
