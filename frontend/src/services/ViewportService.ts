export class ViewportService {
  static screenToWorld(x: number, y: number, stageX: number, stageY: number, scale: number) {
    return {
      x: (x - stageX) / scale,
      y: (y - stageY) / scale
    };
  }

  static getVisibleBounds(stageWidth: number, stageHeight: number, stageX: number, stageY: number, scale: number) {
    const min = this.screenToWorld(0, 0, stageX, stageY, scale);
    const max = this.screenToWorld(stageWidth, stageHeight, stageX, stageY, scale);
    
    return {
      minX: min.x,
      minY: min.y,
      maxX: max.x,
      maxY: max.y
    };
  }
}
