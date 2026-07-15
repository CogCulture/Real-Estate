import { Polygon, Point } from '../../core/types';
import { PipelineContext } from '../../core/pipeline/context';
import { ClassifiedBlock } from '../block/types';

export enum BuildingType {
  VILLA = 'villa',
  APARTMENT = 'apartment',
  COMMERCIAL = 'commercial',
  MIXED_USE = 'mixed_use',
  CLUBHOUSE = 'clubhouse',
  PARKING_STRUCTURE = 'parking_structure'
}

export enum BuildingOrientation {
  NORTH_SOUTH = 'north_south',
  EAST_WEST = 'east_west',
  ROAD_ALIGNED = 'road_aligned',
  PARK_FACING = 'park_facing'
}

export interface BuildingFootprint {
  polygon: Polygon;
  area_sqm: number;
  dimensions: { width: number; length: number };
}

export interface Building {
  id: string;
  type: BuildingType;
  footprint: BuildingFootprint;
  centroid: Point;
  height_m: number;
  floors: number;
  orientation: BuildingOrientation;
}

export interface ParkingRequirement {
  required_spaces: number;
  provided_spaces: number;
}

export interface ParkingLayout {
  id: string;
  polygon: Polygon;
  capacity: number;
  is_underground: boolean;
}

export interface CirculationArea {
  id: string;
  polygon: Polygon;
  type: 'pedestrian' | 'vehicular' | 'mixed';
  area_sqm: number;
}

export interface OpenSpaceArea {
  id: string;
  polygon: Polygon;
  type: 'green' | 'hardscape' | 'water_feature';
  area_sqm: number;
}

export interface AmenityZone {
  id: string;
  polygon: Polygon;
  type: 'playground' | 'sports_court' | 'pool' | 'seating';
}

export interface Plot {
  id: string;
  block_id: string;
  polygon: Polygon;
  area_sqm: number;
  buildable_polygon: Polygon;
}

export interface Placement {
  plot_id: string;
  buildings: Building[];
  parking: ParkingLayout[];
  circulation: CirculationArea[];
  open_spaces: OpenSpaceArea[];
  amenities: AmenityZone[];
  metrics: {
    far: number;
    coverage_ratio: number;
    parking_ratio: number;
  };
}

export interface PlacementCandidate {
  context: PipelineContext;
  placements: Placement[];
  score: number;
}
