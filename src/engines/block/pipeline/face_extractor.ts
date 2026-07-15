import { Polygon } from '../../../core/types';
import { RoadGraph } from '../../road/types';
import { DCEL } from './dcel';

export interface RoadTopologyMetadata {
  is_grid: boolean;
  has_loops: boolean;
  has_spines: boolean;
}

export interface RawFace {
  id: string;
  cycle_nodes: string[];
  polygon: Polygon;
}

export class FaceExtractor {
  static extract(graph: RoadGraph, boundary: Polygon, metadata: RoadTopologyMetadata): RawFace[] {
    if (graph.edges.size === 0) {
      return boundary && boundary.length >= 3 ? [{ id: 'f_0', cycle_nodes: [], polygon: boundary }] : [];
    }
    
    const dcel = DCEL.fromGraph(graph);
    const polys = dcel.extractFaces();
    
    // Convert extracted DCEL polygons to RawFace models
    return polys.map((p, i) => ({
      id: `face_${i}`,
      cycle_nodes: [], // Cycle IDs can be mapped later if needed
      polygon: p
    }));
  }
}
