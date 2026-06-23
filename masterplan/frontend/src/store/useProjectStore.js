import { create } from 'zustand';

export const useProjectStore = create((set) => ({
  currentProject: null,
  projectsList: [],
  isLoading: false,
  error: null,
  
  setCurrentProject: (project) => set({ currentProject: project }),
  setProjectsList: (list) => set({ projectsList: list }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (err) => set({ error: err }),
  
  clearCurrentProject: () => set({ currentProject: null })
}));
