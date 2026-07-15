import { Polygon, Point } from '../core/types';

export enum CardinalDirection {
  NORTH = 'NORTH',
  SOUTH = 'SOUTH',
  EAST = 'EAST',
  WEST = 'WEST',
  NORTHEAST = 'NORTHEAST',
  NORTHWEST = 'NORTHWEST',
  SOUTHEAST = 'SOUTHEAST',
  SOUTHWEST = 'SOUTHWEST'
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SiteGeometryMetrics {
  area_sqm: number;
  perimeter_m: number;
  bounding_box: BoundingBox;
  orientation_angle: number;
  long_axis_m: number;
  short_axis_m: number;
  compactness_ratio: number;
  convexity_ratio: number;
  aspect_ratio: number;
}

export interface SiteAccessibility {
  frontage_lengths_m: Record<string, number>;
  entry_opportunities: Point[];
  road_adjacency: boolean;
  corner_plot: boolean;
}

export interface SiteEnvironment {
  solar_orientation: CardinalDirection;
  prevailing_wind_direction: CardinalDirection;
  terrain_type: 'flat' | 'sloped' | 'complex';
}

export interface UtilityAccess {
  water_connection: boolean;
  sewer_connection: boolean;
  power_connection: boolean;
  stormwater_connection: boolean;
  access_points: Point[];
}

export interface SiteContext {
  existing_roads: Polygon[];
  neighbour_plots: Polygon[];
  existing_buildings: Polygon[];
  water_bodies: Polygon[];
  highways: Polygon[];
  railways: Polygon[];
  green_buffers: Polygon[];
  views: CardinalDirection[];
  noise_sources: Point[];
}

export interface SiteConstraints {
  flood_zones: Polygon[];
  easements: Polygon[];
  protected_trees: Point[];
  power_lines: Polygon[];
  water_bodies: Polygon[];
  heritage_zones: Polygon[];
  no_build_areas: Polygon[];
}

export interface BuildabilityAnalysis {
  gross_area_sqm: number;
  buildable_area_sqm: number;
  restricted_area_sqm: number;
  usable_ratio: number;
  buildable_polygon: Polygon;
}

export interface ObjectiveWeights {
  saleable_area: number;
  far: number;
  coverage: number;
  open_space: number;
  road_efficiency: number;
  walkability: number;
  connectivity: number;
  privacy: number;
  emergency_access: number;
  landscape_quality: number;
}

export interface SiteAnalysisResult {
  id: string;
  geometry: SiteGeometryMetrics;
  accessibility: SiteAccessibility;
  environment: SiteEnvironment;
  utilities: UtilityAccess;
  context: SiteContext;
  constraints: SiteConstraints;
  buildability: BuildabilityAnalysis;
  objective_weights: ObjectiveWeights;
}
