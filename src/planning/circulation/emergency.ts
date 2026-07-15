export class EmergencyCirculation {
  static checkAccess(buildingPerimeterMeters: number, accessiblePerimeterMeters: number): boolean {
    // Basic emergency vehicle access rule: 50% of perimeter must be accessible
    const ratio = accessiblePerimeterMeters / buildingPerimeterMeters;
    return ratio >= 0.5;
  }
}
