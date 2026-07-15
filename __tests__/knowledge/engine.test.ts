import { ConstraintEngine } from '../../src/knowledge/engine';
import { DefaultKnowledgeProvider } from '../../src/knowledge/provider_impl';
import { KnowledgeLoader } from '../../src/knowledge/loader';
import { KnowledgeCache } from '../../src/knowledge/cache';
import { Placement } from '../../src/engines/placement/types';

describe('Knowledge Base & Constraint Engine Integration', () => {
  it('should load India NBC and evaluate rules successfully', () => {
    const cache = new KnowledgeCache();
    const loader = new KnowledgeLoader(cache);
    const provider = new DefaultKnowledgeProvider(loader, 'india_nbc_2016');
    const engine = new ConstraintEngine(provider);
    
    expect(provider.getMetadata().jurisdiction).toBe('india');
    
    // Create dummy placement to evaluate
    const mockPlacement: Placement = {
      id: 'p_1',
      plot_id: 'plot_1',
      buildings: [
        {
          id: 'b_1',
          type: 'apartment' as any,
          footprint: { polygon: [], area_sqm: 500, dimensions: {width: 20, length: 25} },
          centroid: {x: 0, y: 0},
          height_m: 30,
          floors: 10,
          orientation: 'road_aligned' as any
        }
      ],
      metrics: {
        total_built_area: 5000,
        coverage_ratio: 0.2,
        far: 2.0 // compliant with 2.5 NBC limit
      },
      score: 0
    };
    
    const evals = engine.evaluatePlacement(mockPlacement);
    expect(evals.length).toBeGreaterThan(0);
    
    const farEval = evals.find(e => e.rule_id === 'nbc_far_limit');
    expect(farEval).toBeDefined();
    expect(farEval?.passed).toBe(true);
    expect(farEval?.penalty).toBe(0);
  });
});
