import { SiteContext, CardinalDirection } from '../types';

export class ContextAnalyzer {
  static analyze(): SiteContext {
    return {
      existing_roads: [],
      neighbour_plots: [],
      existing_buildings: [],
      water_bodies: [],
      highways: [],
      railways: [],
      green_buffers: [],
      views: [CardinalDirection.EAST],
      noise_sources: []
    };
  }
}
