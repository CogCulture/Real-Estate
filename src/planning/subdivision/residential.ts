export class ResidentialSubdivision {
  static calculateMaxBlocks(totalArea: number, maxBlockSize: number): number {
    if (maxBlockSize <= 0) return 1;
    return Math.floor(totalArea / maxBlockSize);
  }
}
