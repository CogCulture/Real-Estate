import { z } from 'zod';
import { PlanningIntent } from './schema';
import { IntentValidationError } from '../core/errors';

export const intentOperationSchema = z.object({
  type: z.string().min(1),
  params: z.record(z.any()).optional(),
});

export const planningIntentSchema = z.object({
  intent_version: z.string().refine(val => val === "2.1" || val === "2.2", {
    message: "intent_version must be 2.1 or 2.2",
  }),
  site_id: z.string().min(1),
  seeds: z.record(z.number()),
  planning_archetype: z.string().min(1),
  density_strategy: z.string().min(1),
  zoning_strategy: z.string().min(1),
  road_topology: z.string().min(1),
  operations: z.array(intentOperationSchema),
});

export class IntentValidator {
  /**
   * Validates the raw JSON intent.
   * Throws an IntentValidationError if the schema is invalid or operations are unknown.
   */
  validate(rawIntent: unknown): PlanningIntent {
    const result = planningIntentSchema.safeParse(rawIntent);
    
    if (!result.success) {
      throw new IntentValidationError(
        'Intent validation failed',
        result.error.issues
      );
    }
    
    // Check for supported operation types
    const validOperationTypes = new Set([
      'apply_regulatory_setbacks',
      'place_entry_gates',
      'generate_primary_spine',
      'generate_secondary_roads',
      'reserve_utility_corridors',
      'generate_blocks',
      'place_anchor_amenities',
      'allocate_residential_towers',
      'allocate_villa_zones',
      'allocate_commercial_zones',
      'allocate_parking',
      'reserve_landscape_zones',
      'place_water_features',
      'place_walkways',
      'place_trees',
      'validate_layout'
    ]);

    for (const op of result.data.operations) {
      if (!validOperationTypes.has(op.type)) {
        throw new IntentValidationError(`Unknown operation type: ${op.type}`);
      }
    }

    return result.data as PlanningIntent;
  }
}
