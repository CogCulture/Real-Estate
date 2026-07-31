import type { RenderScene, RenderPrimitive } from '../../../shared/types';

export interface DiffResult {
  added: RenderPrimitive[];
  removed: string[]; // IDs
  updated: RenderPrimitive[];
  unchanged: string[];
}

export class SceneDiffer {
  static diff(oldScene: RenderScene | null, newScene: RenderScene): DiffResult {
    const result: DiffResult = {
      added: [],
      removed: [],
      updated: [],
      unchanged: []
    };

    if (!oldScene) {
      // Everything is added
      Object.values(newScene).forEach(layer => {
        if (Array.isArray(layer)) {
          result.added.push(...layer);
        }
      });
      return result;
    }

    const oldNodes = new Map<string, RenderPrimitive>();
    Object.values(oldScene).forEach(layer => {
      if (Array.isArray(layer)) {
        layer.forEach(prim => { if(prim.id) oldNodes.set(prim.id, prim); });
      }
    });

    Object.values(newScene).forEach(layer => {
      if (Array.isArray(layer)) {
        layer.forEach(prim => {
          if (!prim.id) return;
          const old = oldNodes.get(prim.id);
          if (!old) {
            result.added.push(prim);
          } else {
            // Primitive comparison (JSON.stringify is slow but safe for now. A real app would check points/styles specifically)
            if (JSON.stringify(old) !== JSON.stringify(prim)) {
              result.updated.push(prim);
            } else {
              result.unchanged.push(prim.id);
            }
            oldNodes.delete(prim.id);
          }
        });
      }
    });

    // Anything left in oldNodes was removed
    result.removed = Array.from(oldNodes.keys());

    return result;
  }
}
