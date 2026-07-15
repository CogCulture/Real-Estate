import { Polygon, Point } from '../core/types';

export enum StyleToken {
  ROAD_PRIMARY = 'ROAD_PRIMARY',
  ROAD_SECONDARY = 'ROAD_SECONDARY',
  RESIDENTIAL_BUILDING = 'RESIDENTIAL_BUILDING',
  COMMERCIAL_BUILDING = 'COMMERCIAL_BUILDING',
  PARK = 'PARK',
  WATER = 'WATER',
  CLUBHOUSE = 'CLUBHOUSE',
  PARKING = 'PARKING',
  TEXT_PRIMARY = 'TEXT_PRIMARY'
}

export interface RenderRoad {
  geometry: Polygon;
  style: StyleToken;
}

export interface RenderBuilding {
  geometry: Polygon;
  height: number;
  style: StyleToken;
}

export interface RenderLandscape {
  geometry: Polygon;
  style: StyleToken;
}

export interface RenderParking {
  geometry: Polygon;
  style: StyleToken;
}

export interface RenderAmenity {
  geometry: Polygon;
  style: StyleToken;
}

export interface RenderLabel {
  anchor: Point;
  text: string;
  rotation: number;
  priority: number;
  category: string;
  style: StyleToken;
}

export interface MasterplanStatistics {
  totalSiteArea: number;
  buildableArea: number;
  roadArea: number;
  landscapeArea: number;
  parkingArea: number;
  buildingCount: number;
  residentialUnits: number;
  commercialArea: number;
  far: number;
  coverage: number;
  openSpacePercentage: number;
  walkabilityScore: number;
  privacyScore: number;
  daylightScore: number;
  constraintViolations: number;
  optimizationScore: number;
}

export interface Masterplan {
  metadata: Record<string, string>;
  site: Polygon;
  roads: RenderRoad[];
  intersections: Polygon[];
  blocks: Polygon[];
  buildings: RenderBuilding[];
  amenities: RenderAmenity[];
  parking: RenderParking[];
  landscape: RenderLandscape[];
  pedestrianNetwork: Polygon[];
  labels: RenderLabel[];
  renderLayers: string[];
  statistics: MasterplanStatistics;
  optimizationSummary: Record<string, any>;
}
