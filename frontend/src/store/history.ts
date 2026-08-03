import { create } from 'zustand';
import type { DesignGenome, Snapshot } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

interface HistoryStore {
  history: Snapshot[];
  currentIndex: number;
  
  pushSnapshot: (genome: DesignGenome, statistics: any) => void;
  undo: () => Snapshot | null;
  redo: () => Snapshot | null;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  history: [],
  currentIndex: -1,
  
  pushSnapshot: (genome, statistics) => {
    const { history, currentIndex } = get();
    // In browser, a simple hash for demonstration
    const backendHash = JSON.stringify(genome).length.toString(); // Weak hash for demo
    
    const snap: Snapshot = {
      id: uuidv4(),
      timestamp: Date.now(),
      genome,
      statistics,
      backendHash
    };
    
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(snap);
    
    set({ history: newHistory, currentIndex: newHistory.length - 1 });
  },
  
  undo: () => {
    const { history, currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
      return history[currentIndex - 1];
    }
    return null;
  },
  
  redo: () => {
    const { history, currentIndex } = get();
    if (currentIndex < history.length - 1) {
      set({ currentIndex: currentIndex + 1 });
      return history[currentIndex + 1];
    }
    return null;
  }
}));
