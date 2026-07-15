import { ClassifiedBlock } from '../../block/types';
import { Plot } from '../types';
import { GeometryKernel } from '../../../geometry/kernel';

export class PlotGenerator {
  constructor(private kernel: GeometryKernel) {}

  generate(blocks: ClassifiedBlock[]): Plot[] {
    // For now, mapping 1 Block to 1 Plot
    return blocks.map(b => ({
      id: `plot_${b.id}`,
      block_id: b.id,
      polygon: b.polygon,
      area_sqm: b.area_sqm,
      buildable_polygon: b.buildable_geometry.primary_polygon
    }));
  }
}
