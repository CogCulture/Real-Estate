import { create } from 'zustand';

export interface LayerState {
  visible: boolean;
  locked: boolean;
  opacity: number;
}

interface EditorState {
  // Viewport
  scale: number;
  x: number;
  y: number;
  
  // Interactions
  tool: 'select' | 'pan';
  selectedIds: string[];
  
  // Layers
  layers: Record<string, LayerState>;
  
  // Actions
  setViewport: (x: number, y: number, scale: number) => void;
  setTool: (tool: 'select' | 'pan') => void;
  select: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
  toggleLayer: (name: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  scale: 1,
  x: 0,
  y: 0,
  
  tool: 'pan',
  selectedIds: [],
  layers: {},
  
  setViewport: (x, y, scale) => set({ x, y, scale }),
  
  setTool: (tool) => set({ tool, selectedIds: [] }),
  
  select: (id, multi = false) => set((state) => {
    if (state.tool !== 'select') return state;
    if (multi) {
      return { selectedIds: state.selectedIds.includes(id) 
        ? state.selectedIds.filter(s => s !== id) 
        : [...state.selectedIds, id] };
    }
    return { selectedIds: [id] };
  }),
  
  clearSelection: () => set({ selectedIds: [] }),
  
  toggleLayer: (name) => set((state) => ({
    layers: {
      ...state.layers,
      [name]: { ...state.layers[name], visible: !state.layers[name]?.visible }
    }
  }))
}));
