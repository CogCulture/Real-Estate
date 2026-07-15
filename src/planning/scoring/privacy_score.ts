import { PrivacyMetrics } from '../types';

export class PrivacyScore {
  static evaluate(actualMinDistance: number, requiredBuffer: number): PrivacyMetrics {
    let score = 0;
    if (actualMinDistance >= requiredBuffer) {
      score = 100; // Perfect score
    } else {
      score = Math.max(0, (actualMinDistance / requiredBuffer) * 100);
    }
    
    return {
      score,
      minimum_distance_m: actualMinDistance
    };
  }
}
