export enum RuleSeverity {
  FATAL = 'fatal',
  ERROR = 'error',
  WARNING = 'warning'
}

export interface SuggestedFix {
  description: string;
  action_type: 'resize' | 'move' | 'delete' | 'reorient';
  parameters: Record<string, unknown>;
}

export interface ConstraintEvaluation {
  rule_id: string;
  passed: boolean;
  severity: RuleSeverity;
  penalty: number;
  explanation: {
    message: string;
    affected_geometry_ids: string[];
    recommendation?: string;
    fixes?: SuggestedFix[];
  };
}

// Data-only rule definition
export interface RuleDefinition {
  id: string;
  type: string;
  severity: RuleSeverity;
  parameters: Record<string, unknown>;
}

// Grouped rule sets
export interface RoadRuleSet { rules: RuleDefinition[]; }
export interface BlockRuleSet { rules: RuleDefinition[]; }
export interface PlacementRuleSet { rules: RuleDefinition[]; }
export interface ParkingRuleSet { rules: RuleDefinition[]; }

// Templates (intelligence inputs)
export interface BuildingTemplate {
  id: string;
  dimensions: { width: number; length: number };
  max_height_m: number;
  core_type: string;
}

export interface AmenityTemplate {
  id: string;
  dimensions: { width: number; length: number };
  type: string;
}

export interface BuildingTemplateSet { templates: BuildingTemplate[]; }
export interface AmenityTemplateSet { templates: AmenityTemplate[]; }
export interface ParkingTemplateSet { templates: any[]; }
export interface RoadTemplateSet { templates: any[]; }
export interface LandscapeTemplateSet { templates: any[]; }
export interface UtilitiesTemplateSet { templates: any[]; }

export interface RulePackMetadata {
  id: string;
  version: string;
  effective_date: string;
  source: string;
  checksum: string;
  jurisdiction: string;
}

export interface RulePack {
  metadata: RulePackMetadata;
  road_rules: RoadRuleSet;
  block_rules: BlockRuleSet;
  placement_rules: PlacementRuleSet;
  parking_rules: ParkingRuleSet;
}
