import { Plot, Building, BuildingType, BuildingOrientation } from '../types';
import { RNG } from '../../../core/random';
import { ClipperGeometryKernel } from '../../../geometry/kernel_impl';
import { Polygon } from '../../../core/types';

export class VillaGenerator {
  static generate(plot: Plot, seed: number): Building[] {
    const rng = new RNG(seed);
    const kernel = new ClipperGeometryKernel();
    const buildings: Building[] = [];
    const placedPolygons: Polygon[] = [];
    
    const width = 10;
    const length = 15;
    const spacing = 5;
    
    const bbox = kernel.getBoundingBox(plot.buildable_polygon);
    
    let currentX = bbox.minX;
    let currentY = bbox.minY;
    let bldgCounter = 0;
    
    while (currentY + length <= bbox.maxY) {
      currentX = bbox.minX;
      while (currentX + width <= bbox.maxX) {
        const footprintPoly: Polygon = [
          { x: currentX, y: currentY },
          { x: currentX + width, y: currentY },
          { x: currentX + width, y: currentY + length },
          { x: currentX, y: currentY + length }
        ];
        
        // Ensure strictly inside buildable polygon
        const intersection = kernel.booleanIntersect(footprintPoly, plot.buildable_polygon);
        let intersectArea = 0;
        for (const poly of intersection) intersectArea += kernel.computeArea(poly);
        
        const footArea = width * length;
        if (Math.abs(intersectArea - footArea) < 0.1) {
          
          let overlaps = false;
          for (const placed of placedPolygons) {
            const overlap = kernel.booleanIntersect(footprintPoly, placed);
            let overlapArea = 0;
            for (const p of overlap) overlapArea += kernel.computeArea(p);
            if (overlapArea > 0.1) {
              overlaps = true;
              break;
            }
          }
          
          if (!overlaps) {
            buildings.push({
              id: `villa_${bldgCounter++}`,
              type: BuildingType.VILLA,
              footprint: {
                polygon: footprintPoly,
                area_sqm: footArea,
                dimensions: { width, length }
              },
              centroid: { x: currentX + width/2, y: currentY + length/2 },
              height_m: rng.nextRange(6, 9),
              floors: rng.nextInt(1, 2),
              orientation: BuildingOrientation.NORTH_SOUTH
            });
            placedPolygons.push(footprintPoly);
          }
        }
        currentX += width + spacing;
      }
      currentY += length + spacing;
    }
    
    return buildings;
  }
}
