import { EvaluatedGenome } from './types';

export class DiversityFilter {
  static computeFingerprint(metrics: any): string {
    // Quantize floating point metrics into stable integer bins to filter near-duplicates
    const q = (val: number, step: number) => Math.floor(val / step);
    
    // Using mock variables for the fingerprint based on typical layout outputs
    // (In full integration, this would consume the actual RoadGraph and Block properties)
    const roadCount = q(metrics.total_road_length_m || 0, 50);
    const blockCount = metrics.block_count || 0;
    const buildingCount = metrics.building_count || 0;
    const coverage = q(metrics.coverage || 0, 0.05); // 5% bins
    const far = q(metrics.far || 0, 0.1); // 0.1 bins
    
    return `${roadCount}_${blockCount}_${buildingCount}_${coverage}_${far}`;
  }

  static filter(population: EvaluatedGenome[]): EvaluatedGenome[] {
    const unique = new Map<string, EvaluatedGenome>();
    for (const p of population) {
      if (!unique.has(p.diversity_hash)) {
        unique.set(p.diversity_hash, p);
      }
    }
    return Array.from(unique.values());
  }
}
