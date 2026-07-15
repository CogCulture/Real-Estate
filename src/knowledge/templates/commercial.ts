import { BuildingTemplateSet } from '../types';

export const CommercialTemplates: BuildingTemplateSet = {
  templates: [
    {
      id: 'comm_strip_mall',
      dimensions: { width: 15, length: 60 },
      max_height_m: 15,
      core_type: 'none'
    },
    {
      id: 'comm_office_tower',
      dimensions: { width: 30, length: 30 },
      max_height_m: 120,
      core_type: 'central'
    }
  ]
};
