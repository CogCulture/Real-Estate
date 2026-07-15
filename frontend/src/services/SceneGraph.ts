import RBush from 'rbush';
import { RenderPrimitive, RenderPolygon, RenderCircle, RenderText } from '../types';

export interface SceneNode {
  id: string;
  primitive: RenderPrimitive;
  layer: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class SceneGraph {
  private rtree = new RBush<SceneNode>();
  private nodes = new Map<string, SceneNode>();

  build(scene: any) {
    this.rtree.clear();
    this.nodes.clear();
    
    const items: SceneNode[] = [];
    let idCounter = 0;

    Object.keys(scene).forEach(layerName => {
      const primitives = scene[layerName] as RenderPrimitive[];
      if (!Array.isArray(primitives)) return;

      primitives.forEach(prim => {
        const id = prim.id || `node_${idCounter++}`;
        prim.id = id;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        if (prim.type === 'Polygon') {
          (prim as RenderPolygon).points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          });
        } else if (prim.type === 'Circle') {
          const c = prim as RenderCircle;
          minX = c.center.x - c.radius;
          maxX = c.center.x + c.radius;
          minY = c.center.y - c.radius;
          maxY = c.center.y + c.radius;
        } else if (prim.type === 'Text') {
          const t = prim as RenderText;
          minX = t.anchor.x;
          maxX = t.anchor.x + 50; // Stub width
          minY = t.anchor.y - 10; // Stub height
          maxY = t.anchor.y + 10;
        }

        // Avoid invalid bounds
        if (minX === Infinity) { minX = 0; maxX = 0; minY = 0; maxY = 0; }

        const node: SceneNode = { id, primitive: prim, layer: layerName, minX, minY, maxX, maxY };
        items.push(node);
        this.nodes.set(id, node);
      });
    });

    this.rtree.load(items);
  }

  queryBox(minX: number, minY: number, maxX: number, maxY: number): SceneNode[] {
    return this.rtree.search({ minX, minY, maxX, maxY });
  }

  queryPoint(x: number, y: number): SceneNode | null {
    const results = this.rtree.search({ minX: x - 1, minY: y - 1, maxX: x + 1, maxY: y + 1 });
    return results.length > 0 ? results[results.length - 1] : null; // Topmost
  }
}

// Singleton instance
export const sceneGraph = new SceneGraph();
