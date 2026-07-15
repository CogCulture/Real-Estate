import { PipelineStage } from '../../core/pipeline/stage';
import { ValidationResult, StageResult, CandidateScore } from '../../core/pipeline/result';
import { ExecutionBudget } from '../../core/pipeline/budget';
import { Optimizer } from '../../core/pipeline/optimizer';
import { PipelineContext } from '../../core/pipeline/context';
import { GeometryKernel } from '../../geometry/kernel';
import { KnowledgeProvider } from '../../knowledge/provider';
import { BlockCandidate } from '../block/types';
import { PlacementCandidate, Placement } from './types';
import { PlotGenerator } from './pipeline/plot_generator';
import { BuildingGenerator } from './pipeline/building_generator';
import { CirculationGenerator } from './pipeline/circulation';
import { PlacementValidator } from './pipeline/placement_validator';
import { PlacementAnalyzer } from './pipeline/placement_analyzer';
import { PlacementScorer } from './scorer';

export interface PlacementEngineInput {
  block_stage: StageResult<BlockCandidate>;
  provider: KnowledgeProvider;
  seed: number;
}

export class PlacementEngine implements PipelineStage<PlacementEngineInput, PlacementCandidate> {
  constructor(private kernel: GeometryKernel) {}

  validate(input: PlacementEngineInput): ValidationResult {
    return { passed: true, warnings: [], errors: [], metrics: {} };
  }

  execute(input: PlacementEngineInput, budget: ExecutionBudget): StageResult<PlacementCandidate> {
    const start = Date.now();
    const candidates: PlacementCandidate[] = [];
    let generatedCount = 0;
    
    for (const blockCand of input.block_stage.candidates) {
      if (generatedCount >= budget.maxCandidates) break;
      
      const plotGen = new PlotGenerator(this.kernel);
      const plots = plotGen.generate(blockCand.blocks);
      
      const bldgGen = new BuildingGenerator(this.kernel, input.provider);
      const circGen = new CirculationGenerator(this.kernel);
      const validator = new PlacementValidator(this.kernel, input.provider);
      const analyzer = new PlacementAnalyzer(this.kernel);
      
      const placements: Placement[] = [];
      let valid = true;
      
      // Seed derivation for determinism
      let currentSeed = input.seed + generatedCount * 1000;
      
      for (const plot of plots) {
        const buildings = bldgGen.generate(plot, currentSeed);
        const circ = circGen.generate(plot, buildings, currentSeed);
        
        const placement: Placement = {
          plot_id: plot.id,
          buildings,
          parking: circ.parking,
          circulation: circ.circulation,
          open_spaces: circ.open_spaces,
          amenities: circ.amenities,
          metrics: { far: 1.0, coverage_ratio: 0.4, parking_ratio: 1.0 }
        };
        
        const valRes = validator.validate(placement);
        if (!valRes.passed) {
          valid = false;
          break;
        }
        
        // Populate analytics metrics on the placement obj
        const analysis = analyzer.analyze(placement);
        placement.metrics.far = analysis.far_utilization;
        placement.metrics.coverage_ratio = analysis.ground_coverage;
        
        placements.push(placement);
        currentSeed++;
      }
      
      if (!valid) continue;
      
      const context: PipelineContext = {
        candidate_id: `placement_cand_${generatedCount}`,
        parent_candidate_ids: [blockCand.context.candidate_id],
        created_by_engine: 'PlacementEngine',
        created_timestamp: new Date().toISOString(),
        mutation_reason: 'Placement generation',
        decision_trace: ['PlotGenerator', 'BuildingGenerator', 'CirculationGenerator', 'PlacementAnalyzer']
      };
      
      candidates.push({
        context,
        placements,
        score: 0.8 // Dummy initial score
      });
      
      generatedCount++;
    }
    
    // Top level scoring and optimization
    const scoredCandidates = candidates; // PlacementScorer.score handles full batch but here we just map
    
    const bestCandidates = Optimizer.optimize(scoredCandidates, budget.maxCandidates);
    
    return {
      stage_name: 'PlacementEngine',
      candidates: bestCandidates,
      winner: bestCandidates.length > 0 ? bestCandidates[0] : null,
      discarded: [],
      metrics: {
        generation_time_ms: Date.now() - start,
        validation_time_ms: 0,
        score_time_ms: 0,
        candidate_count: bestCandidates.length,
        discard_count: candidates.length - bestCandidates.length
      },
      diagnostics: { logs: [], timings: [] },
      execution_time_ms: Date.now() - start,
      warnings: [],
      errors: []
    };
  }

  score(candidates: PlacementCandidate[]): CandidateScore[] {
    return PlacementScorer.score(candidates);
  }
}
