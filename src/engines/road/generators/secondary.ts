import { PlanningIntent } from '../../../dsl/schema';
import { RoadTopology } from '../types';
import { LineSegment } from '../../../geometry';
import { RNG } from '../../../core/random';
import { CoordinateSystem } from '../../../geometry/coordinates';

export class SecondaryRoadGenerator {
  static generate(
    intent: PlanningIntent, 
    primarySpine: LineSegment[], 
    topology: RoadTopology,
    seed: number
  ): LineSegment[] {
    const rng = new RNG(seed);
    const segments: LineSegment[] = [];
    
    // Generate perpendicular offshoots based on topology
    for (const spine of primarySpine) {
      const dx = spine.p2.x - spine.p1.x;
      const dy = spine.p2.y - spine.p1.y;
      
      const numBranches = rng.nextInt(2, 5);
      for (let i = 1; i <= numBranches; i++) {
        const t = i / (numBranches + 1);
        const midX = spine.p1.x + dx * t;
        const midY = spine.p1.y + dy * t;
        
        // Perpendicular vector
        const px = -dy;
        const py = dx;
        const len = Math.sqrt(px * px + py * py) || 1;
        
        const branchLen = rng.nextRange(30, 80);
        
        segments.push({
          p1: { x: CoordinateSystem.round(midX), y: CoordinateSystem.round(midY) },
          p2: { 
            x: CoordinateSystem.round(midX + (px / len) * branchLen),
            y: CoordinateSystem.round(midY + (py / len) * branchLen)
          }
        });
        
        // Both sides for grid
        if (topology === RoadTopology.GRID || topology === RoadTopology.MODIFIED_GRID) {
          segments.push({
            p1: { x: CoordinateSystem.round(midX), y: CoordinateSystem.round(midY) },
            p2: { 
              x: CoordinateSystem.round(midX - (px / len) * branchLen),
              y: CoordinateSystem.round(midY - (py / len) * branchLen)
            }
          });
        }
      }
    }
    
    return segments;
  }
}
