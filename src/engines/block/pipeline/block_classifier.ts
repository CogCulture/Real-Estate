import { AccessibleBlock, ClassifiedBlock, BlockClassification } from '../types';
import { KnowledgeProvider } from '../../../knowledge/provider';

export class BlockClassifier {
  static classify(block: AccessibleBlock, provider: KnowledgeProvider): ClassifiedBlock {
    // Dummy implementation
    return {
      ...block,
      classification: BlockClassification.RESIDENTIAL_PRIMARY
    };
  }
}
