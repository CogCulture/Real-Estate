import { BuildingTemplateSet, RuleSeverity } from '../types';

export const ApartmentTemplates: BuildingTemplateSet = {
  templates: [
    {
      id: 'apt_standard_core',
      dimensions: { width: 20, length: 40 },
      max_height_m: 60,
      core_type: 'central'
    },
    {
      id: 'apt_premium_point_block',
      dimensions: { width: 25, length: 25 },
      max_height_m: 100,
      core_type: 'central'
    }
  ]
};
