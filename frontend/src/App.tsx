import React, { useEffect } from 'react';
import { Viewport } from './canvas/Viewport';
import { Toolbar } from './components/Toolbar';
import { GenomeEditorPanel } from './components/GenomeEditorPanel';
import { StatusBar } from './components/StatusBar';
import { Minimap } from './components/Minimap';
import { LayerPanel } from './components/LayerPanel';
import { useSessionStore } from './store/session';
import { useWebSocket } from './hooks/useWebSocket';

const App: React.FC = () => {
  useWebSocket();
  const { compareMode, toggleCompareMode, syncCameras, toggleSyncCameras } = useSessionStore();

  return (
    <div className="w-screen h-screen overflow-hidden flex font-sans bg-[#111]">
      <Toolbar />
      <LayerPanel />
      <GenomeEditorPanel />
      
      {/* Top Bar for Toggles */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        <button onClick={toggleCompareMode} className="bg-[#2a2a2a] text-white px-3 py-1 rounded shadow">
          {compareMode ? 'Exit Compare Mode' : 'Enter Compare Mode'}
        </button>
        {compareMode && (
          <button onClick={toggleSyncCameras} className={`px-3 py-1 rounded shadow text-white ${syncCameras ? 'bg-blue-600' : 'bg-[#2a2a2a]'}`}>
            🔗 Sync Cameras: {syncCameras ? 'ON' : 'OFF'}
          </button>
        )}
      </div>

      <div className="flex-1 relative flex">
        {compareMode ? (
          <>
            <div className="flex-1 border-r border-[#444] relative">
              <Viewport scene={null} />
              <div className="absolute top-2 left-2 text-white bg-black/50 px-2 rounded">Current</div>
            </div>
            <div className="flex-1 relative">
              <Viewport scene={null} />
              <div className="absolute top-2 left-2 text-white bg-black/50 px-2 rounded">Candidate</div>
            </div>
          </>
        ) : (
          <Viewport scene={null} />
        )}
      </div>
      
      {!compareMode && <Minimap />}
      <StatusBar />
    </div>
  );
}

export default App;
