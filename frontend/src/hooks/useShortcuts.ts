import { useEffect } from 'react';
import { useEditorStore } from '../store/editor';
import { CommandDispatcher, PanCommand, ZoomCommand, SelectCommand } from '../services/CommandSystem';

export const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 'f':
          // Fit Scene
          CommandDispatcher.execute(new ZoomCommand(1));
          CommandDispatcher.execute(new PanCommand(0, 0));
          break;
        case ' ':
          // Pan tool
          useEditorStore.getState().setTool('pan');
          break;
        case 'escape':
          // Clear Selection
          CommandDispatcher.execute(new SelectCommand([]));
          break;
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // Stub Select All
          }
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            CommandDispatcher.execute(new ZoomCommand(1));
            CommandDispatcher.execute(new PanCommand(0, 0));
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
