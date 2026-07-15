import { Masterplan, MasterplanStatistics, RenderBuilding, StyleToken } from './types';

export class MasterplanBuilder {
  private buildings: RenderBuilding[] = [];
  
  // Note: in a real implementation we would take outputs from the Road, Block, Placement engines
  // For Sprint 9, we're proving the deterministic composition pattern
  
  addBuilding(geometry: any, height: number, style: StyleToken): void {
    // Deep copy geometry to ensure immutability from engine outputs
    const geomCopy = JSON.parse(JSON.stringify(geometry));
    this.buildings.push({ geometry: geomCopy, height, style });
  }
  
  build(): Masterplan {
    // Compute stats deterministically based on collected objects
    const stats: MasterplanStatistics = {
      totalSiteArea: 10000, // stub
      buildableArea: 8000, // stub
      roadArea: 1000,
      landscapeArea: 500,
      parkingArea: 500,
      buildingCount: this.buildings.length,
      residentialUnits: this.buildings.length * 10,
      commercialArea: 0,
      far: 2.5,
      coverage: 0.3,
      openSpacePercentage: 0.2,
      walkabilityScore: 90,
      privacyScore: 95,
      daylightScore: 85,
      constraintViolations: 0,
      optimizationScore: 890
    };
    
    // Hardcoded layer order ensuring deterministic rendering stack
    const renderLayers = [
      'site',
      'landscape',
      'roads',
      'intersections',
      'blocks',
      'parking',
      'pedestrianNetwork',
      'amenities',
      'buildings',
      'labels'
    ];
    
    return {
      metadata: { generatedAt: '1234567890', version: '1.0' },
      site: [],
      roads: [],
      intersections: [],
      blocks: [],
      buildings: [...this.buildings], // copy array
      amenities: [],
      parking: [],
      landscape: [],
      pedestrianNetwork: [],
      labels: [],
      renderLayers,
      statistics: stats,
      optimizationSummary: { beamWidth: 5, generation: 100 }
    };
  }
}
