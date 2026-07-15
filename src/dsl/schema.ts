import { SeedMap } from '../core/types';

export interface IntentOperation {
  type: string;
  params?: Record<string, any>;
}

export interface PlanningIntent {
  intent_version: string;
  site_id: string;
  seeds: SeedMap;
  planning_archetype: string;
  density_strategy: string;
  zoning_strategy: string;
  road_topology: string;
  operations: IntentOperation[];
}
