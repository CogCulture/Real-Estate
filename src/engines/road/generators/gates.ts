import { PlanningIntent } from '../../../dsl/schema';
import { Polygon } from '../../../core/types';
import { Gate } from '../types';
import { RNG } from '../../../core/random';
import { ClipperGeometryKernel } from '../../../geometry/kernel_impl';

export class GateGenerator {
  static generate(intent: PlanningIntent, siteBoundary: Polygon, seed: number): Gate[] {
    const rng = new RNG(seed);
    const kernel = new ClipperGeometryKernel();
    
    // Fallback if boundary is missing or malformed
    if (!siteBoundary || siteBoundary.length < 3) {
      return [{ id: 'gate_0', position: { x: 0, y: 0 }, width_m: 10 }];
    }
    
    // Pick 2 random points on the boundary for gates
    const gates: Gate[] = [];
    const numGates = rng.nextInt(1, 3);
    
    for (let i = 0; i < numGates; i++) {
      const idx = rng.nextInt(0, siteBoundary.length - 1);
      const pt = siteBoundary[idx];
      gates.push({
        id: `gate_${i}`,
        position: { x: pt.x, y: pt.y },
        width_m: rng.nextRange(8, 12)
      });
    }
    
    return gates;
  }
}
