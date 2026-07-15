import { EvaluatedGenome } from './types';

export class GenomeCache {
  private cache = new Map<string, EvaluatedGenome>();

  private hashGenome(genome: any): string {
    // Generate deterministic hash ignoring ID and mutations
    const clone = { ...genome };
    delete clone.id;
    delete clone.mutations;
    return JSON.stringify(clone);
  }

  get(genome: any): EvaluatedGenome | undefined {
    return this.cache.get(this.hashGenome(genome));
  }

  set(genome: any, evaluated: EvaluatedGenome) {
    this.cache.set(this.hashGenome(genome), evaluated);
  }
}
