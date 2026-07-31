import { apiClient } from './client';
import type { DesignGenome, GenerationResponse } from '../../../shared/types';

export const MasterplanAPI = {
  generate: async (genome: DesignGenome, signal?: AbortSignal): Promise<GenerationResponse> => {
    const response = await apiClient.post<GenerationResponse>('/generate', genome, { signal });
    return response.data;
  }
};
