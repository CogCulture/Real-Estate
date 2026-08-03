import { create } from 'zustand';
import type { DesignSession, DesignGenome } from '@shared/types';

interface SessionStore extends DesignSession {
  setGenome: (genome: DesignGenome) => void;
  setWeight: (key: string, weight: number) => void;
  toggleCompareMode: () => void;
  syncCameras: boolean;
  toggleSyncCameras: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  currentGenome: { road_topology: 'GRID', far_target: 1.5, building_templates: {} },
  history: [],
  objectiveWeights: { saleable_area: 0.8, walkability: 0.5, privacy: 0.4 },
  selectedTheme: 'Dark',
  viewportState: { x: 0, y: 0, scale: 1 },
  layerVisibility: {},
  selectedIds: [],
  compareMode: false,
  optimizerBudget: 1000,
  syncCameras: true,

  setGenome: (currentGenome) => set({ currentGenome }),
  setWeight: (key, weight) => set((state) => ({ objectiveWeights: { ...state.objectiveWeights, [key]: weight } })),
  toggleCompareMode: () => set((state) => ({ compareMode: !state.compareMode })),
  toggleSyncCameras: () => set((state) => ({ syncCameras: !state.syncCameras }))
}));
