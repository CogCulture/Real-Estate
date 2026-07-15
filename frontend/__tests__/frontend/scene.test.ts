import { SceneGraph } from '../../src/services/SceneGraph';
import { ViewportService } from '../../src/services/ViewportService';
import { CommandDispatcher, PanCommand, SelectCommand } from '../../src/services/CommandSystem';
import { useEditorStore } from '../../src/store/editor';

describe('Frontend Sprint 2: CAD Editor Architecture', () => {
  beforeEach(() => {
    useEditorStore.setState({ scale: 1, x: 0, y: 0, selectedIds: [], tool: 'select' });
  });

  it('ViewportService should correctly convert screen to world coordinates', () => {
    const pt = ViewportService.screenToWorld(100, 100, 50, 50, 2);
    // (100 - 50) / 2 = 25
    expect(pt.x).toBe(25);
    expect(pt.y).toBe(25);
  });

  it('SceneGraph should build an RBush index and query correctly', () => {
    const sg = new SceneGraph();
    const mockScene = {
      buildings: [
        { type: 'Polygon', style: 'Building.Residential', points: [{x:0, y:0}, {x:10, y:0}, {x:10, y:10}, {x:0, y:10}] }
      ]
    };

    sg.build(mockScene);
    const results = sg.queryBox(2, 2, 8, 8);
    expect(results.length).toBe(1);
    expect(results[0].primitive.type).toBe('Polygon');
    expect(results[0].minX).toBe(0);
    expect(results[0].maxX).toBe(10);
  });

  it('CommandSystem should execute commands and mutate Zustand state securely', () => {
    CommandDispatcher.execute(new PanCommand(100, 200));
    const state = useEditorStore.getState();
    expect(state.x).toBe(100);
    expect(state.y).toBe(200);

    CommandDispatcher.execute(new SelectCommand(['bldg_1']));
    expect(useEditorStore.getState().selectedIds).toContain('bldg_1');
  });
});
