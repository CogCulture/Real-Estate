export interface ValidationResult {
  passed: boolean;
  warnings: string[];
  errors: string[];
  metrics: Record<string, number>;
}

export interface Diagnostics {
  logs: string[];
  timings: number[];
}

export interface DecisionExplanation {
  reason: string;
  affected_metrics: string[];
  alternatives_considered: string[];
  confidence: number;
  references: string[]; 
}

export interface CandidateScore {
  total: number;
  weighted_metrics: Record<string, number>;
  penalties: Record<string, number>;
  bonuses: Record<string, number>;
  confidence: number;
  explanation?: DecisionExplanation;
}

export interface StageResult<T> {
  stage_name: string;
  candidates: T[];
  winner: T | null;
  discarded: T[];
  metrics: Record<string, number>; // Kept simple
  diagnostics: Diagnostics;
  execution_time_ms: number;
  warnings: string[];
  errors: string[];
}
