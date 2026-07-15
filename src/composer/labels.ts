import { Point, Polygon } from '../core/types';
import { RenderLabel, StyleToken } from './types';

export class LabelEngine {
  static computeLabel(polygon: Polygon, text: string, category: string, priority: number): RenderLabel {
    // Simple centroid calculation for anchor (assuming non-complex polygons)
    let cx = 0, cy = 0;
    for (const pt of polygon) {
      cx += pt.x;
      cy += pt.y;
    }
    
    if (polygon.length > 0) {
      cx /= polygon.length;
      cy /= polygon.length;
    }
    
    return {
      anchor: { x: cx, y: cy },
      text,
      rotation: 0,
      priority,
      category,
      style: StyleToken.TEXT_PRIMARY
    };
  }
}
