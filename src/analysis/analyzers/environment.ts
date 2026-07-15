import { SiteEnvironment, CardinalDirection } from '../types';

export class EnvironmentAnalyzer {
  static analyze(): SiteEnvironment {
    return {
      solar_orientation: CardinalDirection.SOUTH,
      prevailing_wind_direction: CardinalDirection.SOUTHWEST,
      terrain_type: 'flat'
    };
  }
}
