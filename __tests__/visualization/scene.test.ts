import { SceneBuilder } from '../../src/visualization/scene_builder';
import { SVGExporter } from '../../src/visualization/export/svg';
import { LabelRenderer } from '../../src/visualization/renderer/labels';
import { MasterplanBuilder } from '../../src/composer/builder';
import { StyleToken } from '../../src/composer/types';
import { HierarchicalStyleToken } from '../../src/visualization/styling/tokens';
import { SceneCache } from '../../src/visualization/cache/scene_cache';

describe('Sprint 10: Visualization Engine', () => {
  it('should generate an ordered RenderScene from a Masterplan', () => {
    const builder = new MasterplanBuilder();
    builder.addBuilding([{x:0, y:0}, {x:10, y:0}, {x:10, y:10}, {x:0, y:10}], 20, StyleToken.RESIDENTIAL_BUILDING);
    const plan = builder.build();
    
    const scene = SceneBuilder.build(plan);
    
    // Verify building primitive was generated
    expect(scene.buildings.length).toBe(1);
    expect(scene.buildings[0].type).toBe('Polygon');
    expect(scene.buildings[0].style).toBe(HierarchicalStyleToken.BUILDING_RESIDENTIAL);
    
    // Verify deterministic shadow offset based on height 20
    const shadow = scene.shadows[0] as any;
    expect(shadow.points[0].x).toBe(10); // 0 + 20*0.5
    expect(shadow.points[0].y).toBe(10);
  });
  
  it('should abbreviate or hide labels based on available width', () => {
    const text1 = LabelRenderer.render('Residential Tower 14', {x:0,y:0}, 150);
    expect(text1.text).toBe('Residential Tower 14');
    expect(text1.hidden).toBe(false);
    
    const text2 = LabelRenderer.render('Residential Tower 14', {x:0,y:0}, 80);
    expect(text2.text).toBe('Tower 14');
    
    const text3 = LabelRenderer.render('Residential Tower 14', {x:0,y:0}, 30);
    expect(text3.text).toBe('T14');
    
    const text4 = LabelRenderer.render('Residential Tower 14', {x:0,y:0}, 10);
    expect(text4.hidden).toBe(true);
  });
  
  it('should identically compile to SVG without modifying geometry', () => {
    const builder = new MasterplanBuilder();
    builder.addBuilding([{x:5, y:5}, {x:15, y:5}, {x:15, y:15}, {x:5, y:15}], 10, StyleToken.RESIDENTIAL_BUILDING);
    const plan = builder.build();
    const scene = SceneBuilder.build(plan);
    
    const svgStr = SVGExporter.export(scene);
    
    expect(svgStr).toContain('<svg');
    expect(svgStr).toContain('points="5,5 15,5 15,15 5,15"');
    expect(svgStr).toContain('class="Building.Residential"');
  });
  
  it('should cache scenes successfully', () => {
    const cache = new SceneCache();
    const scene = SceneBuilder.build(new MasterplanBuilder().build());
    
    cache.set('hash123', scene);
    expect(cache.get('hash123')).toBe(scene);
    expect(cache.get('hash456')).toBeUndefined();
  });
});
