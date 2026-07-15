import { PipelineStage } from '../../core/pipeline/stage';
import { ValidationResult, StageResult, CandidateScore } from '../../core/pipeline/result';
import { ExecutionBudget } from '../../core/pipeline/budget';
import { Optimizer } from '../../core/pipeline/optimizer';
import { PipelineContext } from '../../core/pipeline/context';
import { KnowledgeProvider } from '../../knowledge/provider';
import { GeometryKernel } from '../../geometry/kernel';
import { RoadStageResult, RoadNetwork, RoadTopology } from '../road/types';
import { BlockCandidate, ClassifiedBlock } from './types';
import { FaceExtractor, RoadTopologyMetadata } from './pipeline/face_extractor';
import { BlockBuilder } from './pipeline/block_builder';
import { BuildableAreaCalculator } from './pipeline/buildable_area';
import { BlockAnalyzer } from './pipeline/block_analyzer';
import { AccessibilityAnalyzer } from './pipeline/accessibility';
import { BlockClassifier } from './pipeline/block_classifier';
import { BlockScorer } from './scorer';
import { Polygon } from '../../core/types';

export interface BlockEngineInput {
  road_stage: RoadStageResult;
  site_boundary: Polygon;
  provider: KnowledgeProvider;
}

export class BlockEngine implements PipelineStage<BlockEngineInput, BlockCandidate> {
  constructor(private kernel: GeometryKernel) {}

  validate(input: BlockEngineInput): ValidationResult {
    return { passed: true, warnings: [], errors: [], metrics: {} };
  }

  execute(input: BlockEngineInput, budget: ExecutionBudget): StageResult<BlockCandidate> {
    const start = Date.now();
    const candidates: BlockCandidate[] = [];
    let generatedCount = 0;
    
    // Generator: create candidates based on input road candidates
    for (const roadCand of input.road_stage.all_candidates) {
      if (generatedCount >= budget.maxCandidates) break;
      
      const graph = roadCand.network.graph;
      const meta: RoadTopologyMetadata = {
        is_grid: roadCand.topology === RoadTopology.GRID || roadCand.topology === RoadTopology.MODIFIED_GRID,
        has_loops: roadCand.topology === RoadTopology.LOOP,
        has_spines: roadCand.topology === RoadTopology.SPINE
      };
      
      const faces = FaceExtractor.extract(graph, input.site_boundary, meta);
      const rawBlocks = BlockBuilder.build(faces);
      
      const buildableCalc = new BuildableAreaCalculator(this.kernel);
      const classifiedBlocks: ClassifiedBlock[] = [];
      
      for (const b of rawBlocks) {
        const buildable = buildableCalc.calculate(b);
        const analyzed = BlockAnalyzer.analyze(buildable);
        const accessible = AccessibilityAnalyzer.analyze(analyzed, graph);
        const classified = BlockClassifier.classify(accessible, input.provider);
        classifiedBlocks.push(classified);
      }
      
      const scoreObj = BlockScorer.score(classifiedBlocks);
      
      const context: PipelineContext = {
        candidate_id: `block_cand_${generatedCount}`,
        parent_candidate_ids: [roadCand.seed.toString()],
        created_by_engine: 'BlockEngine',
        created_timestamp: new Date().toISOString(),
        mutation_reason: 'Initial extraction',
        decision_trace: ['FaceExtractor', 'BlockBuilder', 'BuildableArea', 'BlockAnalyzer', 'Accessibility', 'BlockClassifier']
      };
      
      candidates.push({
        context,
        blocks: classifiedBlocks,
        score: scoreObj.total
      });
      
      generatedCount++;
    }
    
    // Optimizer (replaces CandidateFilter logic)
    const bestCandidates = Optimizer.optimize(candidates, budget.maxCandidates);
    
    return {
      stage_name: 'BlockEngine',
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

  score(candidates: BlockCandidate[]): CandidateScore[] {
    // Already scored during generation for now
    return [];
  }
}
