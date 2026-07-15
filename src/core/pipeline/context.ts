export interface PipelineContext {
  candidate_id: string;
  parent_candidate_ids: string[];
  created_by_engine: string;
  created_timestamp: string; // ISO8601
  mutation_reason: string;
  decision_trace: string[];
}

export class Serializer {
  static serialize(candidate: any): string {
    return JSON.stringify(candidate);
  }

  static deserialize(data: string): any {
    return JSON.parse(data);
  }
}
