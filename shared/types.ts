export interface DesignGenome {
  road_topology: string;
  building_templates: Record<string, any>;
  far_target: number;
}

export type Point = { x: number; y: number };

export type RenderPrimitiveType = 'Path' | 'Polygon' | 'Circle' | 'Rectangle' | 'Text' | 'Icon' | 'Group';

export interface BasePrimitive {
  id?: string;
  type: RenderPrimitiveType;
  style: string;
  zIndex?: number;
}

export interface RenderPolygon extends BasePrimitive {
  type: 'Polygon';
  points: Point[];
}

export interface RenderCircle extends BasePrimitive {
  type: 'Circle';
  center: Point;
  radius: number;
}

export interface RenderText extends BasePrimitive {
  type: 'Text';
  anchor: Point;
  text: string;
  hidden: boolean;
  fontSize?: number;
}

export type RenderPrimitive = RenderPolygon | RenderCircle | RenderText;

export interface RenderScene {
  background: RenderPrimitive[];
  terrain: RenderPrimitive[];
  water: RenderPrimitive[];
  landscape: RenderPrimitive[];
  roads: RenderPrimitive[];
  parking: RenderPrimitive[];
  pedestrian: RenderPrimitive[];
  buildings: RenderPrimitive[];
  amenities: RenderPrimitive[];
  trees: RenderPrimitive[];
  roadMarkings: RenderPrimitive[];
  labels: RenderPrimitive[];
  shadows: RenderPrimitive[];
  debug: RenderPrimitive[];
}

export interface MasterplanStatistics {
  far: number;
  coverage: number;
  saleable_area: number;
  open_space: number;
  walkability_score: number;
  privacy_score: number;
}

export interface Masterplan {
  id: string;
  statistics: MasterplanStatistics;
}

export interface GenerationResponse {
  version: string;
  masterplan: Masterplan;
  renderScene: RenderScene;
}

export type PipelineStage = 'analysis' | 'roads' | 'blocks' | 'placement' | 'constraints' | 'optimization' | 'composer' | 'visualization';

export interface ProgressEvent {
  stage: PipelineStage;
  progress: number;
  generation: number;
  candidateCount: number;
  beamWidth: number;
  paretoFrontSize: number;
  elapsedMs: number;
}

export interface Snapshot {
  id: string;
  timestamp: number;
  genome: DesignGenome;
  statistics: MasterplanStatistics;
  backendHash: string;
}

export interface DesignSession {
  currentGenome: DesignGenome;
  history: Snapshot[];
  objectiveWeights: Record<string, number>;
  selectedTheme: string;
  viewportState: { x: number, y: number, scale: number };
  layerVisibility: Record<string, boolean>;
  selectedIds: string[];
  compareMode: boolean;
  optimizerBudget: number;
}
