import { Gate, RoadNetwork, RoadTopology } from '../types';
import { LineSegment, Polygon } from '../../../geometry';
import { IntersectionResolver } from './intersection_resolver';
import { NodeBuilder } from './node_builder';
import { EdgeBuilder } from './edge_builder';

export class RoadAssembler {
  static assemble(
    gates: Gate[],
    primary: LineSegment[],
    secondary: LineSegment[],
    topology: RoadTopology
  ): RoadNetwork {
    const allSegments = [...primary, ...secondary];
    const resolved = IntersectionResolver.resolve(allSegments);
    
    const nodes = NodeBuilder.build(resolved);
    const edges = EdgeBuilder.build(resolved, nodes);
    
    return {
      segments: Array.from(edges.values()),
      gates,
      intersections: Array.from(nodes.values()).map(n => n.point),
      graph: { nodes, edges },
      metadata: {
        topology_type: topology,
        total_area_sqm: 0
      },
      road_polygons: [] as Polygon[]
    };
  }
}
