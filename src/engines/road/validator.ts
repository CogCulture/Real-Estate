import { RoadNetwork, RoadValidationResult } from './types';

export class RoadValidator {
  static validate(network: RoadNetwork): RoadValidationResult {
    // Dummy implementation
    return {
      is_valid: true,
      errors: []
    };
  }
}
