import { StageResult } from './result';

export class Optimizer {
  static optimize<T extends { score: number }>(candidates: T[], maxKeep: number): T[] {
    // Sort descending by score, deterministic tie breaking is natural if array is stable or by index
    // We sort here
    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    return sorted.slice(0, maxKeep);
  }
}
