export enum LayoutPattern {
  PARALLEL = 'PARALLEL',
  STAGGERED = 'STAGGERED',
  COURTYARD = 'COURTYARD',
  H_LAYOUT = 'H_LAYOUT',
  U_LAYOUT = 'U_LAYOUT',
  PERIMETER = 'PERIMETER',
  LINEAR = 'LINEAR',
  CLUSTER = 'CLUSTER'
}

export interface PlanningProfile {
  pattern: LayoutPattern;
  requiredSpacingMeters: number;
  privacyBufferMeters: number;
  daylightAngleDegrees: number;
  maxBlockDepthMeters: number;
  emergencyAccessWidthMeters: number;
}

export interface DaylightMetrics {
  score: number;
  unobstructed_percentage: number;
}

export interface PrivacyMetrics {
  score: number;
  minimum_distance_m: number;
}

export interface FrontageMetrics {
  score: number;
  active_frontage_percentage: number;
}

export interface WalkabilityMetrics {
  score: number;
  max_walk_to_amenity_m: number;
}
