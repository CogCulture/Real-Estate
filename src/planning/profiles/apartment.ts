import { PlanningProfile, LayoutPattern } from '../types';
import { TowerSpacing } from '../spacing/tower_spacing';
import { ApartmentPatterns } from '../patterns/apartment';

export class ApartmentPlanningProfile {
  static compute(
    blockAspectRatio: number, 
    maxTowerHeightMeters: number, 
    knowledgeConstants: any
  ): PlanningProfile {
    // In full implementation, knowledgeConstants is drawn from KnowledgeProvider
    const multiplier = knowledgeConstants.spacingMultiplier || 1.0;
    
    return {
      pattern: ApartmentPatterns.getPattern(blockAspectRatio),
      requiredSpacingMeters: TowerSpacing.calculate(maxTowerHeightMeters, multiplier),
      privacyBufferMeters: knowledgeConstants.privacyBuffer || 9.0,
      daylightAngleDegrees: knowledgeConstants.daylightAngle || 45.0,
      maxBlockDepthMeters: knowledgeConstants.maxBlockDepth || 60.0,
      emergencyAccessWidthMeters: knowledgeConstants.emergencyAccessWidth || 6.0
    };
  }
}
