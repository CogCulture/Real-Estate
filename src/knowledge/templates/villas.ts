import { BuildingTemplateSet } from '../types';

export const VillaTemplates: BuildingTemplateSet = {
  templates: [
    {
      id: 'villa_row_house',
      dimensions: { width: 6, length: 15 },
      max_height_m: 12,
      core_type: 'internal_stair'
    },
    {
      id: 'villa_detached_premium',
      dimensions: { width: 12, length: 18 },
      max_height_m: 12,
      core_type: 'internal_stair'
    }
  ]
};
