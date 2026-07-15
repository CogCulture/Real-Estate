import { 
  KnowledgeProvider, 
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
import { KnowledgeLoader } from './loader';
import { BuildingType } from '../engines/placement/types';
import { ApartmentTemplates } from './templates/apartments';
import { VillaTemplates } from './templates/villas';
import { CommercialTemplates } from './templates/commercial';
import { AmenityTemplates } from './templates/amenities';

export class DefaultKnowledgeProvider implements KnowledgeProvider {
  private activePack: any;

  constructor(private loader: KnowledgeLoader, activeJurisdiction: string) {
    this.activePack = this.loader.load(activeJurisdiction);
  }

  getMetadata(): RulePackMetadata { return this.activePack.metadata; }
  
  getRoadRuleSet(): RoadRuleSet { return this.activePack.road_rules; }
  getBlockRuleSet(): BlockRuleSet { return this.activePack.block_rules; }
  getPlacementRuleSet(): PlacementRuleSet { return this.activePack.placement_rules; }
  getParkingRuleSet(): ParkingRuleSet { return this.activePack.parking_rules; }

  getBuildingTemplates(type: BuildingType): BuildingTemplateSet {
    if (type === BuildingType.APARTMENT) return ApartmentTemplates;
    if (type === BuildingType.VILLA) return VillaTemplates;
    if (type === BuildingType.COMMERCIAL) return CommercialTemplates;
    return { templates: [] };
  }
  
  getAmenityTemplates(): AmenityTemplateSet { return AmenityTemplates; }
  getParkingTemplates(): ParkingTemplateSet { return { templates: [] }; }
  getRoadTemplates(): RoadTemplateSet { return { templates: [] }; }
  getLandscapeTemplates(): LandscapeTemplateSet { return { templates: [] }; }
  getUtilitiesTemplates(): UtilitiesTemplateSet { return { templates: [] }; }
}
