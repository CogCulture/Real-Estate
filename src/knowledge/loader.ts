import { RulePack } from './types';
import { IndiaNBC_V1 } from './jurisdictions/india/nbc';
import { KnowledgeCache } from './cache';

export class KnowledgeLoader {
  constructor(private cache: KnowledgeCache) {}

  load(jurisdictionId: string): RulePack {
    const cached = this.cache.get(jurisdictionId);
    if (cached) return cached;

    // Simulate JSON parsing and compilation
    let pack: RulePack;
    if (jurisdictionId === 'india_nbc_2016') {
      pack = IndiaNBC_V1;
    } else {
      throw new Error(`Jurisdiction ${jurisdictionId} not found`);
    }

    this.cache.set(jurisdictionId, pack);
    return pack;
  }
}
