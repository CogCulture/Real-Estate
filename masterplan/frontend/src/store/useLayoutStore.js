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
  selectedCluster: null,
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

    reserveBoundaries: (newRoads, newAmenities, layers) => set((state) => {
      const nextState = {
        ...state,
        roads: [...state.roads, ...newRoads],
        amenities: [...state.amenities, ...newAmenities],
        meta: {
          ...state.meta,
          boundary_layers: layers
        }
      };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    clearBoundaries: () => set((state) => {
      const newRoads = state.roads.filter(r => {
        if (!r.width_px) return false;
        if (r.label && r.label.toLowerCase().includes('boundary')) return false;
        if (r.type && r.type.includes('ring_')) return false;
        return true;
      });
      const newAmenities = state.amenities.filter(a => {
        if (!a.id) return false;
        if (a.id.startsWith('tree_')) return false;
        return true;
      });
      const nextState = {
        ...state,
        roads: newRoads,
        amenities: newAmenities,
        meta: {
          ...state.meta,
          boundary_layers: []
        }
      };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    setActiveTool: (tool) => set({ activeTool: tool }),
    setSelectedElementId: (id) => set((state) => {
      const updates = { selectedElementId: id };
      if (id !== null) {
        updates.selectedCluster = null;
      }
      return updates;
    }),
    setSelectedCluster: (cluster) => set((state) => {
      const updates = { selectedCluster: cluster };
      if (cluster !== null) {
        updates.selectedElementId = null;
      }
      return updates;
    }),
    clearSelectedCluster: () => set({ selectedCluster: null }),
    setGridSnapped: (val) => set({ gridSnapped: val }),

    moveClusterElements: (cluster, dx, dy) => set((state) => {
      const scaleVal = state.meta.scale_px_per_m || 1.92;
      const pxToM = (px, s) => px / s;
      const { zoneIds = [], roadIds = [], amenityIds = [], labelIds = [] } = cluster;

      const zones = state.zones.map(z => {
        if (!zoneIds.includes(z.id)) return z;
        const nextPtsPx = z.points_px ? z.points_px.map(p => [p[0] + dx, p[1] + dy]) : null;
        const nextPtsM = nextPtsPx ? nextPtsPx.map(p => [pxToM(p[0], scaleVal), pxToM(p[1], scaleVal)]) : null;
        return {
          ...z,
          x_px: z.x_px + dx,
          y_px: z.y_px + dy,
          x_m: pxToM(z.x_px + dx, scaleVal),
          y_m: pxToM(z.y_px + dy, scaleVal),
          points_px: nextPtsPx,
          points_m: nextPtsM
        };
      });

      const roads = state.roads.map(r => {
        if (!roadIds.includes(r.id)) return r;
        const nextPtsPx = r.points_px ? r.points_px.map(p => [p[0] + dx, p[1] + dy]) : [];
        const nextPtsM = nextPtsPx.map(p => [pxToM(p[0], scaleVal), pxToM(p[1], scaleVal)]);
        return {
          ...r,
          points_px: nextPtsPx,
          points_m: nextPtsM
        };
      });

      const amenities = state.amenities.map(a => {
        if (!amenityIds.includes(a.id)) return a;
        const nextPtsPx = a.points_px ? a.points_px.map(p => [p[0] + dx, p[1] + dy]) : null;
        const nextPtsM = nextPtsPx ? nextPtsPx.map(p => [pxToM(p[0], scaleVal), pxToM(p[1], scaleVal)]) : null;
        return {
          ...a,
          x_px: a.x_px + dx,
          y_px: a.y_px + dy,
          x_m: pxToM(a.x_px + dx, scaleVal),
          y_m: pxToM(a.y_px + dy, scaleVal),
          points_px: nextPtsPx || a.points_px,
          points_m: nextPtsM || a.points_m
        };
      });

      const labels = state.labels.map(l => {
        if (!labelIds.includes(l.id)) return l;
        return {
          ...l,
          x_px: l.x_px + dx,
          y_px: l.y_px + dy
        };
      });

      const nextState = { ...state, zones, roads, amenities, labels };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

    duplicateClusterElements: (cluster) => set((state) => {
      const scaleVal = state.meta.scale_px_per_m || 1.92;
      const pxToM = (px, s) => px / s;
      const { zoneIds = [], roadIds = [], amenityIds = [], labelIds = [] } = cluster;

      const dx = Math.max(state.gridSnapped ? 20 : 18, 18);
      const dy = Math.max(state.gridSnapped ? 20 : 18, 18);

      const makeCopyId = (prefix) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const newZoneIds = [];
      const newRoadIds = [];
      const newAmenityIds = [];
      const newLabelIds = [];

      const newZones = [];
      state.zones.forEach(z => {
        if (!zoneIds.includes(z.id)) return;
        const nextId = makeCopyId('zone');
        newZoneIds.push(nextId);
        const nextPtsPx = z.points_px ? z.points_px.map(p => [p[0] + dx, p[1] + dy]) : null;
        const nextPtsM = nextPtsPx ? nextPtsPx.map(p => [pxToM(p[0], scaleVal), pxToM(p[1], scaleVal)]) : null;
        newZones.push({
          ...z,
          id: nextId,
          label: `${z.label || 'Zone'} Copy`,
          x_px: z.x_px + dx,
          y_px: z.y_px + dy,
          x_m: pxToM(z.x_px + dx, scaleVal),
          y_m: pxToM(z.y_px + dy, scaleVal),
          points_px: nextPtsPx,
          points_m: nextPtsM
        });
      });

      const newRoads = [];
      state.roads.forEach(r => {
        if (!roadIds.includes(r.id)) return;
        const nextId = makeCopyId('road');
        newRoadIds.push(nextId);
        const nextPtsPx = r.points_px ? r.points_px.map(p => [p[0] + dx, p[1] + dy]) : [];
        const nextPtsM = nextPtsPx.map(p => [pxToM(p[0], scaleVal), pxToM(p[1], scaleVal)]);
        newRoads.push({
          ...r,
          id: nextId,
          label: `${r.label || 'Road'} Copy`,
          points_px: nextPtsPx,
          points_m: nextPtsM
        });
      });

      const newAmenities = [];
      state.amenities.forEach(a => {
        if (!amenityIds.includes(a.id)) return;
        const nextId = makeCopyId('amenity');
        newAmenityIds.push(nextId);
        const nextPtsPx = a.points_px ? a.points_px.map(p => [p[0] + dx, p[1] + dy]) : null;
        const nextPtsM = nextPtsPx ? nextPtsPx.map(p => [pxToM(p[0], scaleVal), pxToM(p[1], scaleVal)]) : null;
        newAmenities.push({
          ...a,
          id: nextId,
          label: `${a.label || 'Amenity'} Copy`,
          x_px: a.x_px + dx,
          y_px: a.y_px + dy,
          x_m: pxToM(a.x_px + dx, scaleVal),
          y_m: pxToM(a.y_px + dy, scaleVal),
          points_px: nextPtsPx || a.points_px,
          points_m: nextPtsM || a.points_m
        });
      });

      const newLabels = [];
      state.labels.forEach(l => {
        if (!labelIds.includes(l.id)) return;
        const nextId = makeCopyId('label');
        newLabelIds.push(nextId);
        newLabels.push({
          ...l,
          id: nextId,
          x_px: l.x_px + dx,
          y_px: l.y_px + dy
        });
      });

      const nextState = {
        ...state,
        zones: [...state.zones, ...newZones],
        roads: [...state.roads, ...newRoads],
        amenities: [...state.amenities, ...newAmenities],
        labels: [...state.labels, ...newLabels],
        selectedCluster: {
          zoneIds: newZoneIds,
          roadIds: newRoadIds,
          amenityIds: newAmenityIds,
          labelIds: newLabelIds
        }
      };
      return {
        ...nextState,
        ...pushHistory(nextState)
      };
    }),

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

    setRoads: (roads) => set((state) => {
      const nextState = { ...state, roads: typeof roads === 'function' ? roads(state.roads) : roads };
      return { ...nextState, ...pushHistory(nextState) };
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

    setAmenities: (amenities) => set((state) => {
      const nextState = { ...state, amenities: typeof amenities === 'function' ? amenities(state.amenities) : amenities };
      return { ...nextState, ...pushHistory(nextState) };
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
