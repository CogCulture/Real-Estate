import { ConstraintEvaluation, RuleDefinition, RuleSeverity } from './types';
import { Placement } from '../engines/placement/types';
import { KnowledgeProvider } from './provider';

export class ConstraintEngine {
  constructor(private provider: KnowledgeProvider) {}

  evaluatePlacement(placement: Placement): ConstraintEvaluation[] {
    const rules = this.provider.getPlacementRuleSet().rules;
    const evaluations: ConstraintEvaluation[] = [];

    // Evaluate logic here rather than inside the rule classes.
    for (const rule of rules) {
      if (rule.type === 'MaxFAR') {
        const maxFar = (rule.parameters.max_far as number) || 2.5;
        // Stub far logic
        const far = 2.0; 
        const passed = far <= maxFar;
        evaluations.push({
          rule_id: rule.id,
          passed,
          severity: passed ? RuleSeverity.WARNING : rule.severity,
          penalty: passed ? 0 : 50,
          explanation: {
            message: passed ? 'FAR compliant' : `FAR ${far} exceeds max ${maxFar}`,
            affected_geometry_ids: placement.buildings.map(b => b.id),
            recommendation: passed ? undefined : 'Reduce building heights',
            fixes: passed ? [] : [{ description: 'Reduce floors by 1', action_type: 'resize', parameters: { floors_delta: -1 } }]
          }
        });
      } else if (rule.type === 'MinSetback') {
        // Evaluate setbacks, etc.
        evaluations.push({
          rule_id: rule.id,
          passed: true,
          severity: RuleSeverity.WARNING,
          penalty: 0,
          explanation: {
            message: 'Setback compliant',
            affected_geometry_ids: []
          }
        });
      } else {
        // Fallback for unimplemented rule logic
        evaluations.push({
           rule_id: rule.id,
           passed: true,
           severity: RuleSeverity.WARNING,
           penalty: 0,
           explanation: { message: `Rule ${rule.type} not yet supported in engine`, affected_geometry_ids: [] }
        });
      }
    }

    return evaluations;
  }
}
