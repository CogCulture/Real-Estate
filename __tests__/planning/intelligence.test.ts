import { ApartmentPatterns } from '../../src/planning/patterns/apartment';
import { TowerSpacing } from '../../src/planning/spacing/tower_spacing';
import { PrivacyScore } from '../../src/planning/scoring/privacy_score';
import { ApartmentPlanningProfile } from '../../src/planning/profiles/apartment';
import { LayoutPattern } from '../../src/planning/types';

describe('Architectural Planning Framework', () => {
  it('should deterministically select an apartment layout pattern based on geometry', () => {
    expect(ApartmentPatterns.getPattern(2.5)).toBe(LayoutPattern.LINEAR);
    expect(ApartmentPatterns.getPattern(1.0)).toBe(LayoutPattern.COURTYARD);
    expect(ApartmentPatterns.getPattern(1.5)).toBe(LayoutPattern.STAGGERED);
  });
  
  it('should calculate tower spacing without hardcoded engine constants', () => {
    // 30m tower height, 1.0 multiplier
    expect(TowerSpacing.calculate(30.0, 1.0)).toBeCloseTo(10.0);
    // 30m tower height, 1.5 multiplier (e.g., stricter jurisdiction)
    expect(TowerSpacing.calculate(30.0, 1.5)).toBeCloseTo(15.0);
    // 12m height, should fallback to min 6.0m
    expect(TowerSpacing.calculate(12.0, 1.0)).toBe(6.0);
  });
  
  it('should evaluate privacy scores cleanly', () => {
    const result1 = PrivacyScore.evaluate(12.0, 9.0);
    expect(result1.score).toBe(100);
    
    const result2 = PrivacyScore.evaluate(4.5, 9.0);
    expect(result2.score).toBeCloseTo(50);
  });

  it('should compile an ApartmentPlanningProfile orchestrator', () => {
    const profile = ApartmentPlanningProfile.compute(1.5, 60.0, {
      spacingMultiplier: 1.0,
      privacyBuffer: 12.0,
      daylightAngle: 30.0,
      maxBlockDepth: 80.0,
      emergencyAccessWidth: 7.0
    });
    
    expect(profile.pattern).toBe(LayoutPattern.STAGGERED);
    expect(profile.requiredSpacingMeters).toBe(20.0); // 60 / 3
    expect(profile.privacyBufferMeters).toBe(12.0);
  });
});
