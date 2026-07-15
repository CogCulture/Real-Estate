import { RenderScene } from '../types';

export class SceneCache {
  private cache = new Map<string, RenderScene>();
  
  get(hash: string): RenderScene | undefined {
    return this.cache.get(hash);
  }
  
  set(hash: string, scene: RenderScene): void {
    this.cache.set(hash, scene);
  }
}
