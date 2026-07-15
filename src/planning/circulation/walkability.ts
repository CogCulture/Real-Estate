import { Point } from '../../core/types';
import { WalkabilityMetrics } from '../types';

export class WalkabilityNetwork {
  static compute(nodes: Point[], amenities: Point[]): WalkabilityMetrics {
    let maxDist = 0;
    
    // Very simple stub computing distances from each node to nearest amenity
    for (const node of nodes) {
      let minDist = Infinity;
      for (const amenity of amenities) {
        const d = Math.sqrt(Math.pow(node.x - amenity.x, 2) + Math.pow(node.y - amenity.y, 2));
        if (d < minDist) minDist = d;
      }
      if (minDist > maxDist && minDist !== Infinity) maxDist = minDist;
    }
    
    // Score based on max walking distance (e.g. < 400m is ideal)
    let score = 100;
    if (maxDist > 400) {
      score = Math.max(0, 100 - ((maxDist - 400) / 10));
    }
    
    return { score, max_walk_to_amenity_m: maxDist };
  }
}
