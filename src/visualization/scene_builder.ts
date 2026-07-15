import { RenderScene } from './types';
import { Masterplan } from '../composer/types';
import { HierarchicalStyleToken } from './styling/tokens';
import { RenderPolygon } from './primitives';

export class SceneBuilder {
  static build(masterplan: Masterplan): RenderScene {
    const scene: RenderScene = {
      background: [],
      terrain: [],
      water: [],
      landscape: [],
      roads: [],
      parking: [],
      pedestrian: [],
      buildings: [],
      amenities: [],
      trees: [],
      roadMarkings: [],
      labels: [],
      shadows: [],
      debug: []
    };
    
    // Stub implementation to map Masterplan items to RenderScene
    for (const b of masterplan.buildings) {
      scene.buildings.push({
        type: 'Polygon',
        style: HierarchicalStyleToken.BUILDING_RESIDENTIAL,
        points: b.geometry
      } as RenderPolygon);
      
      // Generate synthetic shadow primitive based on height
      const shadowPts = b.geometry.map(p => ({ x: p.x + b.height * 0.5, y: p.y + b.height * 0.5 }));
      scene.shadows.push({
        type: 'Polygon',
        style: HierarchicalStyleToken.ANNOTATION_SECONDARY, // Using as placeholder shadow token
        points: shadowPts
      } as RenderPolygon);
    }
    
    return scene;
  }
}
