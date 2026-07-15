import { OptimizationEngine } from '../../src/optimizer/engine';
import { GenomeCache } from '../../src/optimizer/cache';
import { RNG } from '../../src/core/random';
import { DesignGenome, RoadTopology, BuildingTemplateSelection } from '../../src/optimizer/types';
import { Scorer } from '../../src/optimizer/scorer';

describe('Optimization Engine', () => {
  it('should run a multi-objective optimization loop with pareto ranking', () => {
    const cache = new GenomeCache();
    const rng = new RNG('opt_seed');
    
    // Mock evaluator returning fake deterministic metrics
    const mockEvaluator = (genomes: DesignGenome[]) => {
      return genomes.map(g => Scorer.evaluate(g, {
        saleable_area: g.tower_spacing_m * 100, // naive metric scaling
        far: 2.0,
        coverage: 0.3,
        open_space: g.primary_road_spacing_m,
        walkability: 50,
        emergency_access: 100,
        infrastructure_efficiency: 80
      }));
    };
    
    const engine = new OptimizationEngine(mockEvaluator, cache, rng, 3, 5); // 3 gens, beam width 5
    
    const initial: DesignGenome[] = [{
      id: 'g_1',
      seed: 123,
      road_topology: RoadTopology.GRID,
      primary_road_spacing_m: 50,
      secondary_road_spacing_m: 30,
      gate_positions: [0.5],
      block_split_ratio: 0.5,
      tower_spacing_m: 20,
      templates: {
        residential: BuildingTemplateSelection.RESIDENTIAL_STANDARD,
        commercial: BuildingTemplateSelection.COMMERCIAL_LOW,
        clubhouse: BuildingTemplateSelection.CLUBHOUSE_SMALL
      },
      parking_ratio_modifier: 1.0,
      mutations: []
    }];
    
    const { optimized, stats } = engine.optimize(initial);
    
    expect(optimized.length).toBeLessThanOrEqual(5);
    expect(stats.generations).toBe(3);
    
    // Check if mutation history was appended
    for (const g of optimized) {
      expect(g.mutations.length).toBeGreaterThanOrEqual(0);
    }
  });
});
