import { Polygon, ElementType, Stage, SeedMap } from './types';

export interface Claim {
  element_type: ElementType;
  element_id: string;
  polygon: Polygon;
  planner: string;
  timestamp: string; // ISO8601
}

export interface SiteStageResult {
  site_boundary: Polygon;
}

export interface SetbackStageResult {
  buildable_envelope: Polygon;
}

export interface WorldState {
  site_stage: SiteStageResult | null;
  setback_stage: SetbackStageResult | null;
  road_stage: any | null; // Typed fully in Sprint 2 via RoadStageResult
  block_stage: any | null;
  placement_stage: any | null;
  plot_stage: any | null;
  
  // Legacy mutable fields (to be phased out as engines adopt StageResult)
  claims: Map<string, Claim[]>; 
  decision_log: any[];      
  stage_scores: Map<Stage, number>;
  seeds: SeedMap;
}

export function createEmptyWorldState(): WorldState {
  return {
    site_stage: null,
    setback_stage: null,
    road_stage: null,
    block_stage: null,
    placement_stage: null,
    plot_stage: null,
    claims: new Map<string, Claim[]>(),
    decision_log: [],
    stage_scores: new Map<Stage, number>(),
    seeds: {},
  };
}

// Intentionally removed since it's rewritten in the first chunk
