export class TowerSpacing {
  static calculate(heightMeters: number, jurisdictionMultiplier: number): number {
    // Dynamic rule calculation: e.g. 1/3 building height * multiplier from Knowledge Provider
    return Math.max((heightMeters / 3.0) * jurisdictionMultiplier, 6.0); // minimum 6m hard floor fallback
  }
}
