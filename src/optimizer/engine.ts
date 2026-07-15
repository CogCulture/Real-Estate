import { DesignGenome, OptimizationStatistics, EvaluatedGenome } from './types';
import { RNG } from '../core/random';
import { GenomeEvaluatorCallback } from './hill_climb';
import { BeamSearch } from './beam_search';
import { HillClimbing } from './hill_climb';
import { MutationRegistry } from './mutation/registry';
import { GenomeCache } from './cache';

export class OptimizationEngine {
  constructor(
    private evaluator: GenomeEvaluatorCallback, 
    private cache: GenomeCache,
    private rng: RNG,
    private maxGenerations: number,
    private maxBeamWidth: number
  ) {}

  optimize(initialGenomes: DesignGenome[]): { optimized: DesignGenome[], stats: OptimizationStatistics } {
    let currentPopulation = this.evaluateWithCache(initialGenomes);
    
    const stats: OptimizationStatistics = {
      generations: 0,
      genomesEvaluated: 0,
      cacheHits: 0,
      mutationsAccepted: 0,
      mutationsRejected: 0,
      paretoFrontSize: 0,
      duplicateGenomesRemoved: 0
    };

    for (let gen = 0; gen < this.maxGenerations; gen++) {
      stats.generations++;
      
      // 1. Mutate
      const mutatedGenomes: DesignGenome[] = [];
      for (const p of currentPopulation) {
        // generate 2 mutations per survivor
        mutatedGenomes.push(MutationRegistry.mutate(p.genome, this.rng));
        mutatedGenomes.push(MutationRegistry.mutate(p.genome, this.rng));
      }
      
      // 2. Evaluate
      const newEvaluations = this.evaluateWithCache(mutatedGenomes);
      
      // Combine old and new for beam search
      const combined = [...currentPopulation, ...newEvaluations];
      
      // 3. Beam Search (Pareto, Diversity, Hard Constraints)
      const initialSize = combined.length;
      currentPopulation = BeamSearch.prune(combined, this.maxBeamWidth);
      stats.duplicateGenomesRemoved += (initialSize - currentPopulation.length); // Rough approximation
    }
    
    stats.paretoFrontSize = currentPopulation.filter(p => p.pareto_rank === 1).length;

    // 4. Hill Climb the survivors
    const finalGenomes: DesignGenome[] = [];
    for (const survivor of currentPopulation) {
      const peaked = HillClimbing.run(survivor, this.evaluateWithCache.bind(this), this.rng, 5);
      finalGenomes.push(peaked.genome);
    }

    return { optimized: finalGenomes, stats };
  }
  
  private evaluateWithCache(genomes: DesignGenome[]): EvaluatedGenome[] {
    const toEvaluate: DesignGenome[] = [];
    const results: EvaluatedGenome[] = [];
    
    for (const g of genomes) {
      const cached = this.cache.get(g);
      if (cached) {
        results.push(cached);
      } else {
        toEvaluate.push(g);
      }
    }
    
    if (toEvaluate.length > 0) {
      const evaluated = this.evaluator(toEvaluate);
      for (let i = 0; i < toEvaluate.length; i++) {
        this.cache.set(toEvaluate[i], evaluated[i]);
        results.push(evaluated[i]);
      }
    }
    
    return results;
  }
}
