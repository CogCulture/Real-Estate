import { LayoutPattern } from '../types';

export class ApartmentPatterns {
  static getPattern(blockAspectRatio: number): LayoutPattern {
    // Basic deterministic logic for pattern selection based on block geometry
    if (blockAspectRatio > 2.0) return LayoutPattern.LINEAR;
    if (blockAspectRatio < 1.2) return LayoutPattern.COURTYARD;
    return LayoutPattern.STAGGERED;
  }
}
