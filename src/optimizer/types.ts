export enum RoadTopology {
  GRID = 'GRID',
  MODIFIED_GRID = 'MODIFIED_GRID',
  LOOPS = 'LOOPS',
  ORGANIC = 'ORGANIC'
}

export enum BuildingTemplateSelection {
  RESIDENTIAL_PREMIUM = 'RESIDENTIAL_PREMIUM',
  RESIDENTIAL_STANDARD = 'RESIDENTIAL_STANDARD',
  COMMERCIAL_HIGH = 'COMMERCIAL_HIGH',
  COMMERCIAL_LOW = 'COMMERCIAL_LOW',
  CLUBHOUSE_LARGE = 'CLUBHOUSE_LARGE',
  CLUBHOUSE_SMALL = 'CLUBHOUSE_SMALL'
}

export interface DesignGenome {
  id: string;
  seed: number;
  road_topology: RoadTopology;
  primary_road_spacing_m: number;
  secondary_road_spacing_m: number;
  gate_positions: number[]; // Array of normalized [0..1] perimeter positions
  block_split_ratio: number;
  tower_spacing_m: number;
  templates: {
    residential: BuildingTemplateSelection;
    commercial: BuildingTemplateSelection;
    clubhouse: BuildingTemplateSelection;
  };
  parking_ratio_modifier: number;
  mutations: GenomeMutation[];
}

export interface GenomeMutation {
  id: string;
  operator: string;
  parameter: string;
  previous_value: unknown;
  new_value: unknown;
  improvement?: number;
}

export interface ObjectiveVector {
  saleable_area: number;
  far: number;
  coverage: number;
  open_space: number;
  walkability: number;
  emergency_access: number;
  infrastructure_efficiency: number;
}

export interface OptimizationStatistics {
  generations: number;
  genomesEvaluated: number;
  cacheHits: number;
  mutationsAccepted: number;
  mutationsRejected: number;
  paretoFrontSize: number;
  duplicateGenomesRemoved: number;
}

export interface EvaluatedGenome {
  genome: DesignGenome;
  objectives: ObjectiveVector;
  hard_constraints_passed: boolean;
  pareto_rank: number;
  diversity_hash: string;
}
