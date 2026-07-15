import { Plot, Building } from '../types';
import { KnowledgeProvider } from '../../../knowledge/provider';
import { GeometryKernel } from '../../../geometry/kernel';
import { ApartmentGenerator } from '../generators/apartment';
import { VillaGenerator } from '../generators/villa';
import { CommercialGenerator } from '../generators/commercial';
import { MixedUseGenerator } from '../generators/mixed_use';
import { ClubhouseGenerator } from '../generators/clubhouse';
import { ParkingStructureGenerator } from '../generators/parking';

export class BuildingGenerator {
  constructor(private kernel: GeometryKernel, private provider: KnowledgeProvider) {}

  generate(plot: Plot, seed: number): Building[] {
    // In a real system, we'd query the KnowledgeProvider using the plot's classification
    // For Phase II, we will use seed parity to simulate deterministic variations across plots
    if (seed % 3 === 0) return ApartmentGenerator.generate(plot, seed);
    if (seed % 3 === 1) return VillaGenerator.generate(plot, seed);
    return MixedUseGenerator.generate(plot, seed);
  }
}
