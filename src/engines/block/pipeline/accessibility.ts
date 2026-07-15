import { AnalyzedBlock, AccessibleBlock } from '../types';
import { RoadGraph } from '../../road/types';

export class AccessibilityAnalyzer {
  static analyze(block: AnalyzedBlock, roadGraph: RoadGraph): AccessibleBlock {
    // Dummy implementation
    return {
      ...block,
      accessibility: {
        distance_to_entry_m: 10,
        is_accessible: true,
        has_emergency_access: true,
        pedestrian_routing_score: 1
      }
    };
  }
}
