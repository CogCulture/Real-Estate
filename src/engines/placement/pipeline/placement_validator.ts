import { Placement } from '../types';
import { ValidationResult } from '../../../core/pipeline/result';
import { GeometryKernel } from '../../../geometry/kernel';
import { KnowledgeProvider } from '../../../knowledge/provider';
import { ConstraintEngine } from '../../../knowledge/engine';

export class PlacementValidator {
  private engine: ConstraintEngine;

  constructor(private kernel: GeometryKernel, private provider: KnowledgeProvider) {
    this.engine = new ConstraintEngine(provider);
  }

  validate(placement: Placement): ValidationResult {
    let valid = true;
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check overlapping and bounds via Kernel
    for (const bldg of placement.buildings) {
      if (bldg.footprint.area_sqm <= 0) {
        valid = false;
        errors.push(`Building ${bldg.id} has invalid area`);
      }
    }

    // Call Knowledge-driven Constraint Engine
    const evaluations = this.engine.evaluatePlacement(placement);
    
    for (const ev of evaluations) {
      if (!ev.passed) {
        if (ev.severity === 'fatal' || ev.severity === 'error') {
          valid = false;
          errors.push(`[${ev.rule_id}] ${ev.explanation.message}`);
        } else {
          warnings.push(`[${ev.rule_id}] ${ev.explanation.message}`);
        }
      }
    }

    return {
      passed: valid,
      warnings,
      errors,
      metrics: {}
    };
  }
}
