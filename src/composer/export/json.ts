import { Masterplan } from '../types';

export class JSONExporter {
  static export(plan: Masterplan): string {
    return JSON.stringify(plan, null, 2);
  }
  
  static import(json: string): Masterplan {
    return JSON.parse(json) as Masterplan;
  }
}
