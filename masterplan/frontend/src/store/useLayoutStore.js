import { create } from 'zustand';

const initialLayoutState = {
  zones: [],
  roads: [],
  amenities: [],
  labels: [],
  meta: {
    site_width_m: 500,
    site_height_m: 300,
    canvas_width_px: 960,
    canvas_height_px: 576,
    scale_px_per_m: 1.92,
    north_angle_deg: 0,
    total_area_sqm: 150000
  },
  selectedElementId: null,
  activeTool: 'SELECT', // SELECT, RESIDENTIAL, COMMERCIAL, mixed_use, green_belt, park, water, parking, amenity, road_primary, etc.
  gridSnapped: true
};

export const useLayoutStore = create((set, get) => {
  // Helper to save history state
  const pushHistory = (state) => {
    const { history, historyIndex, zones, roads, amenities, labels, meta } = state;
    const nextHistory = history.slice(0, historyIndex + 1);
    const snap = JSON.stringify({ zones, roads, amenities, labels, meta });
    return {
      history: [...nextHistory, snap],
      historyIndex: nextHistory.length
    };
  };

  return {
    ...initialLayoutState,
    history: [JSON.stringify({
      zones: initialLayoutState.zones,
      roads: initialLayoutState.roads,
      amenities: initialLayoutState.amenities,
      labels: initialLayoutState.labels,
      meta: initialLayoutState.meta
    })],
    historyIndex: 0,

    setMeta: (newMeta) => set((state) => {
      const updatedMeta = { ...state.meta, ...newMeta };
      const nextState = { ...state, meta: updatedMeta };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    setActiveTool: (tool) => set({ activeTool: tool }),
    setSelectedElementId: (id) => set({ selectedElementId: id }),
    setGridSnapped: (val) => set({ gridSnapped: val }),

    setLayout: (layoutObj) => set((state) => {
      const zones = layoutObj.zones || [];
      const roads = layoutObj.roads || [];
      const amenities = layoutObj.amenities || [];
      const labels = layoutObj.labels || [];
      const meta = { ...state.meta, ...layoutObj.meta };
      
      const nextState = { ...state, zones, roads, amenities, labels, meta, selectedElementId: null };
      return {
        ...nextState,
        history: [JSON.stringify({ zones, roads, amenities, labels, meta })],
        historyIndex: 0
      };
    }),

    // ZONES CRUD
    addZone: (zone) => set((state) => {
      const zones = [...state.zones, zone];
      const nextState = { ...state, zones, selectedElementId: zone.id };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    updateZone: (id, updates) => set((state) => {
      const zones = state.zones.map((z) => (z.id === id ? { ...z, ...updates } : z));
      const nextState = { ...state, zones };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    deleteZone: (id) => set((state) => {
      const zones = state.zones.filter((z) => z.id !== id);
      const nextState = { ...state, zones, selectedElementId: state.selectedElementId === id ? null : state.selectedElementId };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    // ROADS CRUD
    addRoad: (road) => set((state) => {
      const roads = [...state.roads, road];
      const nextState = { ...state, roads, selectedElementId: road.id };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    updateRoad: (id, updates) => set((state) => {
      const roads = state.roads.map((r) => (r.id === id ? { ...r, ...updates } : r));
      const nextState = { ...state, roads };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    updateRoadPoints: (id, pointsPx, pointsM) => set((state) => {
      const roads = state.roads.map((r) => (r.id === id ? { ...r, points_px: pointsPx, points_m: pointsM } : r));
      return { roads };
    }),

    // Batch update multiple roads at once (e.g., when ring road moves and drags connected endpoints)
    batchUpdateRoads: (updates) => set((state) => {
      const roads = state.roads.map((r) => {
        const upd = updates.find((u) => u.id === r.id);
        return upd ? { ...r, ...upd.changes } : r;
      });
      const nextState = { ...state, roads };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    deleteRoad: (id) => set((state) => {
      const roads = state.roads.filter((r) => r.id !== id);
      const nextState = { ...state, roads, selectedElementId: state.selectedElementId === id ? null : state.selectedElementId };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    // AMENITIES CRUD
    addAmenity: (amenity) => set((state) => {
      const amenities = [...state.amenities, amenity];
      const nextState = { ...state, amenities, selectedElementId: amenity.id };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    updateAmenity: (id, updates) => set((state) => {
      const amenities = state.amenities.map((a) => (a.id === id ? { ...a, ...updates } : a));
      const nextState = { ...state, amenities };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    deleteAmenity: (id) => set((state) => {
      const amenities = state.amenities.filter((a) => a.id !== id);
      const nextState = { ...state, amenities, selectedElementId: state.selectedElementId === id ? null : state.selectedElementId };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    // LABELS CRUD
    addLabel: (label) => set((state) => {
      const labels = [...state.labels, label];
      const nextState = { ...state, labels, selectedElementId: label.id };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    updateLabel: (id, updates) => set((state) => {
      const labels = state.labels.map((l) => (l.id === id ? { ...l, ...updates } : l));
      const nextState = { ...state, labels };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    deleteLabel: (id) => set((state) => {
      const labels = state.labels.filter((l) => l.id !== id);
      const nextState = { ...state, labels, selectedElementId: state.selectedElementId === id ? null : state.selectedElementId };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    // UNDO / REDO
    undo: () => set((state) => {
      if (state.historyIndex > 0) {
        const nextIndex = state.historyIndex - 1;
        const snap = JSON.parse(state.history[nextIndex]);
        return {
          historyIndex: nextIndex,
          zones: snap.zones,
          roads: snap.roads,
          amenities: snap.amenities,
          labels: snap.labels,
          meta: snap.meta,
          selectedElementId: null
        };
      }
      return {};
    }),

    redo: () => set((state) => {
      if (state.historyIndex < state.history.length - 1) {
        const nextIndex = state.historyIndex + 1;
        const snap = JSON.parse(state.history[nextIndex]);
        return {
          historyIndex: nextIndex,
          zones: snap.zones,
          roads: snap.roads,
          amenities: snap.amenities,
          labels: snap.labels,
          meta: snap.meta,
          selectedElementId: null
        };
      }
      return {};
    }),

    shiftAllElements: (dx, dy, scale) => set((state) => {
      const scaleVal = scale || 2.4;
      const pxToM = (px, s) => px / s;
      
      const zones = state.zones.map(z => {
        const nextPtsPx = z.points_px ? z.points_px.map(p => [p[0] + dx, p[1] + dy]) : [];
        const nextPtsM = nextPtsPx.map(p => [pxToM(p[0], scaleVal), pxToM(p[1], scaleVal)]);
        return {
          ...z,
          x_px: z.x_px + dx,
          y_px: z.y_px + dy,
          x_m: pxToM(z.x_px + dx, scaleVal),
          y_m: pxToM(z.y_px + dy, scaleVal),
          points_px: nextPtsPx.length > 0 ? nextPtsPx : z.points_px,
          points_m: nextPtsM.length > 0 ? nextPtsM : z.points_m
        };
      });

      const roads = state.roads.map(r => {
        const nextPtsPx = r.points_px ? r.points_px.map(p => [p[0] + dx, p[1] + dy]) : [];
        const nextPtsM = nextPtsPx.map(p => [pxToM(p[0], scaleVal), pxToM(p[1], scaleVal)]);
        return {
          ...r,
          points_px: nextPtsPx,
          points_m: nextPtsM
        };
      });

      const amenities = state.amenities.map(a => {
        const nextPtsPx = a.points_px ? a.points_px.map(p => [p[0] + dx, p[1] + dy]) : [];
        const nextPtsM = nextPtsPx.map(p => [pxToM(p[0], scaleVal), pxToM(p[1], scaleVal)]);
        return {
          ...a,
          x_px: a.x_px + dx,
          y_px: a.y_px + dy,
          x_m: pxToM(a.x_px + dx, scaleVal),
          y_m: pxToM(a.y_px + dy, scaleVal),
          points_px: nextPtsPx,
          points_m: nextPtsM
        };
      });

      const labels = state.labels.map(l => ({
        ...l,
        x_px: l.x_px + dx,
        y_px: l.y_px + dy
      }));

      const nextState = { ...state, zones, roads, amenities, labels };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    resetLayout: () => set((state) => {
      const nextState = {
        ...state,
        zones: [],
        roads: [],
        amenities: [],
        labels: [],
        selectedElementId: null
      };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    })
  };
});
