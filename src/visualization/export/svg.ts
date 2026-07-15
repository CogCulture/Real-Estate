import { RenderScene } from '../types';
import { RenderPrimitive, RenderPolygon, RenderCircle, RenderText } from '../primitives';

export class SVGExporter {
  static export(scene: RenderScene): string {
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">\n';
    
    // Order matters: must match the defined strict layer ordering exactly.
    const layers = [
      scene.background, scene.terrain, scene.water, scene.landscape,
      scene.roads, scene.parking, scene.pedestrian, scene.buildings,
      scene.amenities, scene.trees, scene.roadMarkings, scene.shadows, 
      scene.labels, scene.debug
    ];
    
    for (const layer of layers) {
      if (layer.length === 0) continue;
      svg += '  <g>\n';
      for (const prim of layer) {
        svg += this.renderPrimitive(prim);
      }
      svg += '  </g>\n';
    }
    
    svg += '</svg>';
    return svg;
  }
  
  private static renderPrimitive(prim: RenderPrimitive): string {
    switch (prim.type) {
      case 'Polygon': {
        const poly = prim as RenderPolygon;
        const pts = poly.points.map(p => `${p.x},${p.y}`).join(' ');
        // We'd map token to actual class or fill here in reality
        return `    <polygon points="${pts}" class="${prim.style}" />\n`;
      }
      case 'Circle': {
        const circle = prim as RenderCircle;
        return `    <circle cx="${circle.center.x}" cy="${circle.center.y}" r="${circle.radius}" class="${prim.style}" />\n`;
      }
      case 'Text': {
        const text = prim as RenderText;
        if (text.hidden) return '';
        return `    <text x="${text.anchor.x}" y="${text.anchor.y}" class="${prim.style}">${text.text}</text>\n`;
      }
      default:
        return '';
    }
  }
}
