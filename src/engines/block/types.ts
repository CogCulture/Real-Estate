import { Polygon, Point } from '../../core/types';
import { BoundingBox } from '../../spatial/rtree';
import { PipelineContext } from '../../core/pipeline/context';
import { BuildableGeometry } from '../../geometry/kernel';

export enum BlockClassification {
  ANCHOR = 'anchor',
  RESIDENTIAL_PRIMARY = 'residential_primary',
  RESIDENTIAL_SECONDARY = 'residential_secondary',
  COMMERCIAL = 'commercial',
  UTILITY = 'utility',
  LANDSCAPE_RESERVE = 'landscape_reserve',
  UNDETERMINED = 'undetermined'
}

// 1. Output from BlockBuilder
export interface Block {
  id: string;
  polygon: Polygon;
  centroid: Point;
  area_sqm: number;
  frontage: { road_id: string; length_m: number }[];
  adjacent_road_ids: string[];
}

// 2. Output from BuildableAreaCalculator
export interface BuildableBlock extends Block {
  buildable_geometry: BuildableGeometry;
}

// 3. Output from BlockAnalyzer
export interface BlockAnalysis {
  compactness: number;
  aspect_ratio: number;
  regularity: number;
  edge_count: number;
  frontage_ratio: number;
  orientation_angle: number;
  convexity: number;
  perimeter_m: number;
  bounding_box: BoundingBox;
  shape_index: number;
  road_exposure_score: number;
}

export interface AnalyzedBlock extends BuildableBlock {
  analysis: BlockAnalysis;
}

// 4. Output from AccessibilityAnalyzer
export interface AccessibilityMetrics {
  distance_to_entry_m: number;
  is_accessible: boolean;
  has_emergency_access: boolean;
  pedestrian_routing_score: number;
}

export interface AccessibleBlock extends AnalyzedBlock {
  accessibility: AccessibilityMetrics;
}

// 5. Output from BlockClassifier
export interface ClassifiedBlock extends AccessibleBlock {
  classification: BlockClassification;
}

export interface BlockCandidate {
  context: PipelineContext;
  blocks: ClassifiedBlock[];
  score: number;
}
