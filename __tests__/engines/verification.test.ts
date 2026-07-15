import { ClipperGeometryKernel } from '../../src/geometry/kernel_impl';
import { PlotGenerator } from '../../src/engines/placement/pipeline/plot_generator';
import { BuildingGenerator } from '../../src/engines/placement/pipeline/building_generator';
import { KnowledgeProvider } from '../../src/knowledge/provider';
import { BlockStageResult, ClassifiedBlock, BlockClassification } from '../../src/engines/block/types';
import { Polygon } from '../../src/core/types';

class MockProvider implements KnowledgeProvider {
  getRules(type: string): any { return {}; }
  getConstraints(type: string): any { return {}; }
  getTemplate(type: string): any { return {}; }
}

describe('100-Seed Verification Pipeline Test', () => {
  const kernel = new ClipperGeometryKernel();
  const provider = new MockProvider();
  
  it('should deterministically generate valid non-overlapping footprints for 100 seeds', () => {
    // We will test 100 different seeds
    for (let seed = 1; seed <= 100; seed++) {
      // 1. Create a dummy block (representing the output of the Block Engine)
      const buildablePolygon: Polygon = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ];
      
      const dummyBlock: ClassifiedBlock = {
        id: `block_${seed}`,
        polygon: buildablePolygon, // Ignoring full block boundary for this specific test
        centroid: { x: 50, y: 50 },
        area_sqm: 10000,
        frontage: [],
        adjacent_road_ids: [],
        buildable_geometry: {
          primary_polygon: buildablePolygon,
          secondary_polygons: [],
          restricted_regions: [],
          effective_area_sqm: 10000
        },
        analysis: {} as any,
        accessibility: {} as any,
        classification: BlockClassification.RESIDENTIAL_PRIMARY
      };
      
      const plotGen = new PlotGenerator(kernel);
      const plots = plotGen.generate([dummyBlock]);
      const plot = plots[0];
      
      const bldgGen = new BuildingGenerator(kernel, provider);
      const buildings = bldgGen.generate(plot, seed);
      
      // Verification 1: Determinism (running same seed twice must yield exact same footprints)
      const buildingsRun2 = bldgGen.generate(plot, seed);
      expect(buildings.length).toBe(buildingsRun2.length);
      for(let i=0; i<buildings.length; i++) {
        expect(buildings[i].footprint.area_sqm).toBeCloseTo(buildingsRun2[i].footprint.area_sqm, 2);
      }
      
      // Verification 2: Non-overlapping footprints
      for (let i = 0; i < buildings.length; i++) {
        for (let j = i + 1; j < buildings.length; j++) {
          // Allow vertical stacking in mixed use
          if (buildings[i].id.includes('mixed') && buildings[j].id.includes('mixed')) continue;
          
          const overlap = kernel.booleanIntersect(buildings[i].footprint.polygon, buildings[j].footprint.polygon);
          let overlapArea = 0;
          for (const poly of overlap) overlapArea += kernel.computeArea(poly);
          
          expect(overlapArea).toBeLessThan(0.1); // No overlap
        }
      }
      
      // Verification 3: Bounded inside buildable polygon
      for (const bldg of buildings) {
        const intersection = kernel.booleanIntersect(bldg.footprint.polygon, buildablePolygon);
        let intersectArea = 0;
        for (const poly of intersection) intersectArea += kernel.computeArea(poly);
        
        expect(Math.abs(intersectArea - bldg.footprint.area_sqm)).toBeLessThan(0.1); // Fully contained
      }
    }
  });
});
