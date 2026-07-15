import { Plot, Building, BuildingType, BuildingOrientation } from '../types';
import { ClipperGeometryKernel } from '../../../geometry/kernel_impl';

export class CommercialGenerator {
  static generate(plot: Plot, seed: number): Building[] {
    const kernel = new ClipperGeometryKernel();
    const bbox = kernel.getBoundingBox(plot.buildable_polygon);
    
    const width = Math.max(10, bbox.maxX - bbox.minX - 10);
    const length = Math.max(10, bbox.maxY - bbox.minY - 10);
    
    return [{
      id: `comm_0`,
      type: BuildingType.COMMERCIAL,
      footprint: {
        polygon: [
          { x: bbox.minX, y: bbox.minY },
          { x: bbox.minX + width, y: bbox.minY },
          { x: bbox.minX + width, y: bbox.minY + length },
          { x: bbox.minX, y: bbox.minY + length }
        ],
        area_sqm: width * length,
        dimensions: { width, length }
      },
      centroid: { x: bbox.minX + width/2, y: bbox.minY + length/2 },
      height_m: 15,
      floors: 4,
      orientation: BuildingOrientation.ROAD_ALIGNED
    }];
  }
}
