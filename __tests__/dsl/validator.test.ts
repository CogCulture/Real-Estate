import { IntentValidator } from '../../src/dsl/validator';
import { IntentValidationError } from '../../src/core/errors';

describe('IntentValidator', () => {
  const validator = new IntentValidator();

  const validIntent = {
    intent_version: "2.1",
    site_id: "site_01",
    seeds: {
      road_seed: 1001
    },
    planning_archetype: "high_density_residential",
    density_strategy: "compact_vertical",
    zoning_strategy: "mixed_use_periphery",
    road_topology: "hierarchical_grid",
    operations: [
      {
        type: "generate_blocks"
      }
    ]
  };

  it('should pass valid intent', () => {
    expect(() => validator.validate(validIntent)).not.toThrow();
    const result = validator.validate(validIntent);
    expect(result.intent_version).toBe("2.1");
  });

  it('should fail with invalid intent version', () => {
    const invalid = { ...validIntent, intent_version: "1.0" };
    expect(() => validator.validate(invalid)).toThrow(IntentValidationError);
  });

  it('should fail with missing fields', () => {
    const { site_id, ...invalid } = validIntent;
    expect(() => validator.validate(invalid)).toThrow(IntentValidationError);
  });

  it('should fail with unknown operation type', () => {
    const invalid = {
      ...validIntent,
      operations: [
        { type: "unknown_operation" }
      ]
    };
    expect(() => validator.validate(invalid)).toThrow(IntentValidationError);
    expect(() => validator.validate(invalid)).toThrow(/Unknown operation type/);
  });
});
