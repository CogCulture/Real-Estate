import { Point, Polygon, SeedMap } from '../../core/types';

export enum RoadTopology {
  GRID = 'grid',
  MODIFIED_GRID = 'modified_grid',
  SPINE = 'spine',
  LOOP = 'loop',
  HYBRID = 'hybrid'
}

export interface Gate {
  id: string;
  position: Point;
  width_m: number;
}

export interface RoadNode {
  id: string;
  point: Point;
  is_intersection: boolean;
  is_dead_end: boolean;
}

export interface RoadEdge {
  id: string;
  from_node: string;
  to_node: string;
  width_m: number;
  length_m: number;
  type: 'primary' | 'secondary' | 'access';
}

export interface RoadGraph {
  nodes: Map<string, RoadNode>;
  edges: Map<string, RoadEdge>;
}

export interface RoadNetwork {
  segments: RoadEdge[];
  gates: Gate[];
  intersections: Point[];
  graph: RoadGraph;               
  metadata: {
    topology_type: RoadTopology;        
    total_area_sqm: number;
  };
  road_polygons: Polygon[];       
}

export interface RoadScoreMetrics {
  connectivity: number;
  hierarchy: number;
  regularity: number;
  entry_access: number;
  utilisation: number;
}

export interface RoadScoreResult {
  composite_score: number;
  metrics: RoadScoreMetrics;
  pass_discard_threshold: boolean; 
  rejection_reasons: string[];     
}

export interface RoadValidationResult {
  is_valid: boolean;
  errors: string[];
}

export interface RoadCandidate {
  network: RoadNetwork;
  topology: RoadTopology;
  seed: number;
  score: RoadScoreResult;
}

export interface RoadStageResult {
  best_candidate: RoadCandidate;
  all_candidates: RoadCandidate[]; // Preserved for downstream analysis/AI review
  stage_score: number;
}
