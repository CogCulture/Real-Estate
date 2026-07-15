import { RulePack } from './types';

export class KnowledgeCache {
  private cache = new Map<string, RulePack>();
  
  get(jurisdictionId: string): RulePack | undefined {
    return this.cache.get(jurisdictionId);
  }
  
  set(jurisdictionId: string, pack: RulePack) {
    this.cache.set(jurisdictionId, pack);
  }
}
