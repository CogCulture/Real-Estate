import { create } from 'zustand';
import { ProgressEvent } from '../../../shared/types';

interface ProgressStore {
  event: ProgressEvent | null;
  setEvent: (event: ProgressEvent) => void;
  clear: () => void;
}

export const useProgressStore = create<ProgressStore>((set) => ({
  event: null,
  setEvent: (event) => set({ event }),
  clear: () => set({ event: null })
}));
