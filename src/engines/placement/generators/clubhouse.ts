import { Plot, Building, BuildingType, BuildingOrientation } from '../types';
import { ClipperGeometryKernel } from '../../../geometry/kernel_impl';

export class ClubhouseGenerator {
  static generate(plot: Plot, seed: number): Building[] {
    const kernel = new ClipperGeometryKernel();
    const centroid = kernel.computeCentroid(plot.buildable_polygon);
    
    const size = 30;
    
    return [{
      id: `clubhouse_0`,
      type: BuildingType.CLUBHOUSE,
      footprint: {
        polygon: [
          { x: centroid.x - size/2, y: centroid.y - size/2 },
          { x: centroid.x + size/2, y: centroid.y - size/2 },
          { x: centroid.x + size/2, y: centroid.y + size/2 },
          { x: centroid.x - size/2, y: centroid.y + size/2 }
        ],
        area_sqm: size * size,
        dimensions: { width: size, length: size }
      },
      centroid: centroid,
      height_m: 8,
      floors: 2,
      orientation: BuildingOrientation.PARK_FACING
    }];
  }
}
