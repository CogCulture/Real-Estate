import { LineSegment } from '../../../geometry';
import { RoadNode, RoadEdge } from '../types';

export class EdgeBuilder {
  static build(segments: LineSegment[], nodes: Map<string, RoadNode>): Map<string, RoadEdge> {
    // Dummy implementation
    return new Map<string, RoadEdge>();
  }
}
