import { ValidationResult, StageResult, CandidateScore } from './result';
import { ExecutionBudget } from './budget';

export interface PipelineStage<TInput, TOutput> {
  validate(input: TInput): ValidationResult;
  execute(input: TInput, budget: ExecutionBudget): StageResult<TOutput>;
  score(candidates: TOutput[]): CandidateScore[];
}
