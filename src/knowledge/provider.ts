import { 
  RulePackMetadata, 
  RoadRuleSet, 
  BlockRuleSet, 
  PlacementRuleSet, 
  ParkingRuleSet,
  BuildingTemplateSet,
  AmenityTemplateSet,
  ParkingTemplateSet,
  RoadTemplateSet,
  LandscapeTemplateSet,
  UtilitiesTemplateSet
} from './types';
import { BuildingType } from '../engines/placement/types';

export interface KnowledgeProvider {
  getMetadata(): RulePackMetadata;
  
  // Grouped rule sets
  getRoadRuleSet(): RoadRuleSet;
  getBlockRuleSet(): BlockRuleSet;
  getPlacementRuleSet(): PlacementRuleSet;
  getParkingRuleSet(): ParkingRuleSet;

  // Templates
  getBuildingTemplates(type: BuildingType): BuildingTemplateSet;
  getAmenityTemplates(): AmenityTemplateSet;
  getParkingTemplates(): ParkingTemplateSet;
  getRoadTemplates(): RoadTemplateSet;
  getLandscapeTemplates(): LandscapeTemplateSet;
  getUtilitiesTemplates(): UtilitiesTemplateSet;
}
