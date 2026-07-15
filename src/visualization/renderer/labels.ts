import { Point } from '../../core/types';
import { RenderText } from '../primitives';
import { HierarchicalStyleToken } from '../styling/tokens';

export class LabelRenderer {
  static render(text: string, anchor: Point, availableWidth: number): RenderText {
    let displayText = text;
    let hidden = false;
    
    // Abbreviation logic
    if (availableWidth < 100) {
      displayText = displayText.replace('Residential Tower', 'Tower');
    }
    if (availableWidth < 50) {
      displayText = displayText.replace('Tower', 'T').replace(' ', '');
    }
    if (availableWidth < 20) {
      hidden = true;
    }
    
    return {
      type: 'Text',
      style: HierarchicalStyleToken.ANNOTATION_PRIMARY,
      anchor,
      text: displayText,
      hidden
    };
  }
}
