import { RawFace } from './face_extractor';
import { Block } from '../types';
import { ClipperGeometryKernel } from '../../../geometry/kernel_impl';

export class BlockBuilder {
  static build(faces: RawFace[]): Block[] {
    const kernel = new ClipperGeometryKernel();
    return faces.map(face => {
      const area = kernel.computeArea(face.polygon);
      const centroid = kernel.computeCentroid(face.polygon);
      
      return {
        id: `block_${face.id}`,
        polygon: face.polygon,
        centroid: centroid,
        area_sqm: area,
        frontage: [{ road_id: 'dummy', length_m: 20 }], // Simplified
        adjacent_road_ids: []
      };
    });
  }
}
