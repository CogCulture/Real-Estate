import { AmenityTemplateSet } from '../types';

export const AmenityTemplates: AmenityTemplateSet = {
  templates: [
    {
      id: 'clubhouse_standard',
      dimensions: { width: 30, length: 30 },
      type: 'recreation'
    },
    {
      id: 'park_pocket',
      dimensions: { width: 15, length: 15 },
      type: 'green_space'
    }
  ]
};
