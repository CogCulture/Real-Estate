import { Block, BuildableBlock } from '../types';
import { GeometryKernel } from '../../../geometry/kernel';

export class BuildableAreaCalculator {
  constructor(private kernel: GeometryKernel) {}

  calculate(block: Block): BuildableBlock {
    // True offset scaling to account for setback (distance = -3 for 3m setback inward)
    const setbackDistance = -3;
    const buildablePoly = this.kernel.offset(block.polygon, setbackDistance);
    const buildableArea = this.kernel.computeArea(buildablePoly);
    
    return {
      ...block,
      buildable_geometry: {
        primary_polygon: buildablePoly,
        secondary_polygons: [],
        restricted_regions: [],
        effective_area_sqm: buildableArea
      }
    };
  }
}
