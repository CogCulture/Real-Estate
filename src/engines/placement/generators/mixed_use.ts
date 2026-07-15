import { Plot, Building, BuildingType, BuildingOrientation } from '../types';
import { RNG } from '../../../core/random';
import { ClipperGeometryKernel } from '../../../geometry/kernel_impl';

export class MixedUseGenerator {
  static generate(plot: Plot, seed: number): Building[] {
    const rng = new RNG(seed);
    const kernel = new ClipperGeometryKernel();
    const bbox = kernel.getBoundingBox(plot.buildable_polygon);
    
    const podiumWidth = bbox.maxX - bbox.minX;
    const podiumLength = (bbox.maxY - bbox.minY) / 2;
    
    const buildings: Building[] = [];
    
    if (podiumWidth > 20 && podiumLength > 20) {
      // Podium
      buildings.push({
        id: `mixed_podium`,
        type: BuildingType.MIXED_USE,
        footprint: {
          polygon: [
            { x: bbox.minX, y: bbox.minY },
            { x: bbox.maxX, y: bbox.minY },
            { x: bbox.maxX, y: bbox.minY + podiumLength },
            { x: bbox.minX, y: bbox.minY + podiumLength }
          ],
          area_sqm: podiumWidth * podiumLength,
          dimensions: { width: podiumWidth, length: podiumLength }
        },
        centroid: { x: bbox.minX + podiumWidth/2, y: bbox.minY + podiumLength/2 },
        height_m: 12,
        floors: 3,
        orientation: BuildingOrientation.ROAD_ALIGNED
      });
      
      // Residential Tower on top
      const towerWidth = 20;
      const towerLength = 20;
      if (podiumWidth >= towerWidth && podiumLength >= towerLength) {
        buildings.push({
          id: `mixed_tower`,
          type: BuildingType.APARTMENT,
          footprint: {
            polygon: [
              { x: bbox.minX + 5, y: bbox.minY + 5 },
              { x: bbox.minX + 5 + towerLength, y: bbox.minY + 5 },
              { x: bbox.minX + 5 + towerLength, y: bbox.minY + 5 + towerWidth },
              { x: bbox.minX + 5, y: bbox.minY + 5 + towerWidth }
            ],
            area_sqm: towerWidth * towerLength,
            dimensions: { width: towerWidth, length: towerLength }
          },
          centroid: { x: bbox.minX + 5 + towerLength/2, y: bbox.minY + 5 + towerWidth/2 },
          height_m: rng.nextRange(30, 80),
          floors: rng.nextInt(10, 25),
          orientation: BuildingOrientation.ROAD_ALIGNED
        });
      }
    }
    
    return buildings;
  }
}
