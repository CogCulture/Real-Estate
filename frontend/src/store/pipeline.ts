import { create } from 'zustand';

export type PipelineState = 'Idle' | 'Generating' | 'Optimizing' | 'Rendering' | 'Completed' | 'Failed';

interface PipelineStore {
  state: PipelineState;
  error: string | null;
  setState: (state: PipelineState) => void;
  setError: (error: string) => void;
}

export const usePipelineStore = create<PipelineStore>((set) => ({
  state: 'Idle',
  error: null,
  setState: (state) => set({ state, error: null }),
  setError: (error) => set({ state: 'Failed', error })
}));
