import { LayoutPattern } from '../types';

export class PatternEvaluator {
  static evaluate(blockAspectRatio: number): LayoutPattern {
    // Generates 2-4 candidates and scores them deterministically (mocked scoring)
    const candidates = [LayoutPattern.COURTYARD, LayoutPattern.PARALLEL, LayoutPattern.STAGGERED];
    
    let bestPattern = candidates[0];
    let bestScore = -1;
    
    for (const pattern of candidates) {
      let score = 0;
      if (pattern === LayoutPattern.COURTYARD && blockAspectRatio > 0.8 && blockAspectRatio < 1.2) {
        score += 50;
      }
      if (pattern === LayoutPattern.PARALLEL) {
        score += 30; // Reliable baseline
      }
      if (pattern === LayoutPattern.STAGGERED && blockAspectRatio > 1.5) {
        score += 40;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestPattern = pattern;
      }
    }
    
    return bestPattern;
  }
}
