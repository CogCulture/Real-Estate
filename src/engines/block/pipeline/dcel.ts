import { Point, Polygon } from '../../../core/types';
import { RoadGraph, RoadNode } from '../../road/types';

export class HalfEdge {
  origin: Point;
  destination: Point;
  twin: HalfEdge | null = null;
  next: HalfEdge | null = null;
  prev: HalfEdge | null = null;
  faceId: string | null = null;
  angle: number; // Angle from origin to destination

  constructor(origin: Point, destination: Point) {
    this.origin = origin;
    this.destination = destination;
    this.angle = Math.atan2(destination.y - origin.y, destination.x - origin.x);
  }
}

export class DCEL {
  halfEdges: HalfEdge[] = [];
  
  static fromGraph(graph: RoadGraph): DCEL {
    const dcel = new DCEL();
    const nodeMap = new Map<string, HalfEdge[]>(); // edges starting at node
    
    // Create half edges
    for (const edge of graph.edges.values()) {
      const n1 = graph.nodes.get(edge.from_id);
      const n2 = graph.nodes.get(edge.to_id);
      if (!n1 || !n2) continue;
      
      const he1 = new HalfEdge(n1.point, n2.point);
      const he2 = new HalfEdge(n2.point, n1.point);
      he1.twin = he2;
      he2.twin = he1;
      
      dcel.halfEdges.push(he1, he2);
      
      if (!nodeMap.has(edge.from_id)) nodeMap.set(edge.from_id, []);
      nodeMap.get(edge.from_id)!.push(he1);
      
      if (!nodeMap.has(edge.to_id)) nodeMap.set(edge.to_id, []);
      nodeMap.get(edge.to_id)!.push(he2);
    }
    
    // Sort outgoing edges radially counter-clockwise
    for (const [nodeId, edges] of nodeMap.entries()) {
      edges.sort((a, b) => a.angle - b.angle);
      
      // Link next/prev correctly
      for (let i = 0; i < edges.length; i++) {
        const e1 = edges[i];
        // The edge that comes "into" this node before e1 (in ccw order) is the twin of the next outgoing edge
        const prevOutgoing = edges[(i === 0 ? edges.length - 1 : i - 1)];
        const e1Prev = prevOutgoing.twin!;
        
        e1Prev.next = e1;
        e1.prev = e1Prev;
      }
    }
    
    return dcel;
  }

  extractFaces(): Polygon[] {
    const faces: Polygon[] = [];
    let faceCounter = 0;
    
    for (const he of this.halfEdges) {
      if (he.faceId) continue;
      
      const cycle: Point[] = [];
      let current = he;
      let isOuter = false; // Outer boundary face check via signed area
      
      do {
        current.faceId = `f_${faceCounter}`;
        cycle.push(current.origin);
        current = current.next!;
      } while (current !== he && cycle.length < 1000); // prevent infinite loops
      
      if (cycle.length >= 3) {
        // Calculate signed area to drop the outer face
        let area = 0;
        for(let i=0, j=cycle.length-1; i<cycle.length; j=i++) {
          area += (cycle[j].x + cycle[i].x) * (cycle[j].y - cycle[i].y);
        }
        
        // Counter-clockwise faces have negative area in standard cartesian with y up,
        // but typically outer faces bound the entire graph negatively. 
        // Depending on coordinate system, keep positive inner faces.
        if (area < 0) { // Keep internal cycles
          faces.push(cycle);
        }
      }
      faceCounter++;
    }
    
    return faces;
  }
}
