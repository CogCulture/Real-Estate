import { Point } from '../../core/types';
import { RenderCircle } from '../primitives';
import { HierarchicalStyleToken } from '../styling/tokens';

export class TreeSymbol {
  static create(center: Point, radius: number): RenderCircle {
    return {
      type: 'Circle',
      style: HierarchicalStyleToken.SYMBOL_TREE,
      center,
      radius
    };
  }
}
