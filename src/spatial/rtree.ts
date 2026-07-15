import RBush from 'rbush';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface RBushItem<T> extends BoundingBox {
  item: T;
}

export class SpatialIndex<T> {
  private tree: RBush<RBushItem<T>>;

  constructor() {
    this.tree = new RBush<RBushItem<T>>();
  }

  insert(item: T, bbox: BoundingBox): void {
    this.tree.insert({ ...bbox, item });
  }

  search(bbox: BoundingBox): T[] {
    return this.tree.search(bbox).map(res => res.item);
  }

  clear(): void {
    this.tree.clear();
  }
}
