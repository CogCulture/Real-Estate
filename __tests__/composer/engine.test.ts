import { MasterplanBuilder } from '../../src/composer/builder';
import { JSONExporter } from '../../src/composer/export/json';
import { StyleToken } from '../../src/composer/types';
import { LabelEngine } from '../../src/composer/labels';

describe('Sprint 9: Masterplan Composer', () => {
  it('should deterministically compile an immutable masterplan', () => {
    const builder = new MasterplanBuilder();
    const mockPoly = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    
    builder.addBuilding(mockPoly, 30, StyleToken.RESIDENTIAL_BUILDING);
    
    const plan = builder.build();
    
    expect(plan.buildings.length).toBe(1);
    expect(plan.statistics.buildingCount).toBe(1);
    
    // Assert immutability (modifying original poly doesn't affect plan)
    mockPoly[0].x = 999;
    expect(plan.buildings[0].geometry[0].x).toBe(0);
    
    // Assert layer ordering
    expect(plan.renderLayers.indexOf('landscape')).toBeLessThan(plan.renderLayers.indexOf('buildings'));
    expect(plan.renderLayers.indexOf('buildings')).toBeLessThan(plan.renderLayers.indexOf('labels'));
  });
  
  it('should compute labels without collision logic', () => {
    const mockPoly = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const label = LabelEngine.computeLabel(mockPoly, 'Tower A', 'residential', 1);
    
    expect(label.anchor.x).toBe(5);
    expect(label.anchor.y).toBe(5);
    expect(label.text).toBe('Tower A');
  });
  
  it('should losslessly serialize to JSON', () => {
    const builder = new MasterplanBuilder();
    builder.addBuilding([{ x: 0, y: 0 }], 10, StyleToken.COMMERCIAL_BUILDING);
    const plan = builder.build();
    
    const jsonStr = JSONExporter.export(plan);
    const parsedPlan = JSONExporter.import(jsonStr);
    
    expect(parsedPlan.statistics.buildingCount).toBe(1);
    expect(parsedPlan.buildings[0].style).toBe(StyleToken.COMMERCIAL_BUILDING);
  });
});
