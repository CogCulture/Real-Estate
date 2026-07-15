import { createEmptyWorldState, WorldState } from '../../src/core/state';

describe('WorldState', () => {
  it('should initialize empty WorldState correctly', () => {
    const state: WorldState = createEmptyWorldState();
    
    expect(state.site_stage).toBeNull();
    expect(state.setback_stage).toBeNull();
    expect(state.road_stage).toBeNull();
    expect(state.block_stage).toBeNull();
    expect(state.placement_stage).toBeNull();
    expect(state.plot_stage).toBeNull();
    
    // Legacy fields
    expect(state.claims.size).toBe(0);
    expect(state.decision_log).toEqual([]);
    expect(state.stage_scores.size).toBe(0);
    expect(state.seeds).toEqual({});
  });
});
