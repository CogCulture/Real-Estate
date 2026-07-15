import { LayoutPattern, PlanningProfile } from '../types';

export interface PlannedNode {
  type: string;
  x: number;
  y: number;
  width: number;
  length: number;
  height: number;
}

export interface PatternPlan {
  pattern: LayoutPattern;
  nodes: PlannedNode[];
}

export class PatternPlanner {
  static plan(profile: PlanningProfile, boundingWidth: number, boundingLength: number): PatternPlan {
    const nodes: PlannedNode[] = [];
    
    // Abstract reasoning about *what* should exist based on pattern
    if (profile.pattern === LayoutPattern.COURTYARD) {
      // 4 towers framing a courtyard
      nodes.push({ type: 'tower', x: 10, y: 10, width: 20, length: 20, height: 30 });
      nodes.push({ type: 'tower', x: boundingWidth - 30, y: 10, width: 20, length: 20, height: 30 });
      nodes.push({ type: 'tower', x: 10, y: boundingLength - 30, width: 20, length: 20, height: 30 });
      nodes.push({ type: 'tower', x: boundingWidth - 30, y: boundingLength - 30, width: 20, length: 20, height: 30 });
      nodes.push({ type: 'courtyard', x: 30, y: 30, width: boundingWidth - 60, length: boundingLength - 60, height: 0 });
    } else {
      // Stub for PARALLEL, LINEAR, STAGGERED
      nodes.push({ type: 'tower', x: 10, y: 10, width: 20, length: 40, height: 40 });
      nodes.push({ type: 'tower', x: 40, y: 10, width: 20, length: 40, height: 40 });
    }
    
    return { pattern: profile.pattern, nodes };
  }
}
