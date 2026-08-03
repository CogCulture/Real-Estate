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
  private x: number;
  private y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  execute() {
    useEditorStore.getState().setViewport(this.x, this.y, useEditorStore.getState().scale);
  }
}

export class ZoomCommand implements Command {
  private scale: number;
  constructor(scale: number) {
    this.scale = scale;
  }
  execute() {
    useEditorStore.getState().setViewport(useEditorStore.getState().x, useEditorStore.getState().y, this.scale);
  }
}

export class SelectCommand implements Command {
  private ids: string[];
  private multi: boolean;
  constructor(ids: string[], multi: boolean = false) {
    this.ids = ids;
    this.multi = multi;
  }
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
