import { useEditorStore } from '../store/editor';

export interface Command {
  execute(): void;
  // undo(): void; // For future Redo/Undo
}

export class CommandDispatcher {
  static execute(command: Command) {
    command.execute();
  }
}

export class PanCommand implements Command {
  constructor(private x: number, private y: number) {}
  execute() {
    useEditorStore.getState().setViewport(this.x, this.y, useEditorStore.getState().scale);
  }
}

export class ZoomCommand implements Command {
  constructor(private scale: number) {}
  execute() {
    useEditorStore.getState().setViewport(useEditorStore.getState().x, useEditorStore.getState().y, this.scale);
  }
}

export class SelectCommand implements Command {
  constructor(private ids: string[], private multi: boolean = false) {}
  execute() {
    const store = useEditorStore.getState();
    if (this.ids.length === 0) {
      store.clearSelection();
    } else if (this.ids.length === 1) {
      store.select(this.ids[0], this.multi);
    } else {
      // Box selection logic (replace selection)
      useEditorStore.setState({ selectedIds: this.ids });
    }
  }
}
