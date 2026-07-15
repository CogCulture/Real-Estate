import { LineSegment } from '../../../geometry';
import { RoadNode } from '../types';

export class NodeBuilder {
  static build(segments: LineSegment[]): Map<string, RoadNode> {
    // Dummy implementation
    return new Map<string, RoadNode>();
  }
}
