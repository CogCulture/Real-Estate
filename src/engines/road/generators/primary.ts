import { PlanningIntent } from '../../../dsl/schema';
import { Gate } from '../types';
import { LineSegment } from '../../../geometry';
import { RNG } from '../../../core/random';
import { CoordinateSystem } from '../../../geometry/coordinates';

export class PrimaryRoadGenerator {
  static generate(intent: PlanningIntent, gates: Gate[], seed: number): LineSegment[] {
    const rng = new RNG(seed);
    const segments: LineSegment[] = [];
    
    if (gates.length >= 2) {
      // Connect gates directly for a primary spine
      for (let i = 0; i < gates.length - 1; i++) {
        segments.push({ p1: gates[i].position, p2: gates[i+1].position });
      }
    } else if (gates.length === 1) {
      // Create a spine extending from the single gate
      const g = gates[0];
      const endX = CoordinateSystem.round(g.position.x + rng.nextRange(-100, 100));
      const endY = CoordinateSystem.round(g.position.y + rng.nextRange(50, 200));
      segments.push({ p1: g.position, p2: { x: endX, y: endY } });
    }
    
    return segments;
  }
}
