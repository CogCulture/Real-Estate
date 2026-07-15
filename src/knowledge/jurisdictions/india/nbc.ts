import { RulePack, RuleSeverity } from '../../types';

export const IndiaNBC_V1: RulePack = {
  metadata: {
    id: 'india_nbc_2016',
    version: '1.0.0',
    effective_date: '2016-01-01',
    source: 'National Building Code of India',
    checksum: 'a1b2c3d4e5f6',
    jurisdiction: 'india'
  },
  road_rules: {
    rules: [
      {
        id: 'nbc_road_width_primary',
        type: 'MinRoadWidth',
        severity: RuleSeverity.FATAL,
        parameters: { min_width_m: 12.0, road_class: 'primary' }
      },
      {
        id: 'nbc_road_width_secondary',
        type: 'MinRoadWidth',
        severity: RuleSeverity.FATAL,
        parameters: { min_width_m: 9.0, road_class: 'secondary' }
      }
    ]
  },
  block_rules: {
    rules: [
      {
        id: 'nbc_max_block_length',
        type: 'MaxBlockLength',
        severity: RuleSeverity.WARNING,
        parameters: { max_length_m: 250.0 }
      }
    ]
  },
  placement_rules: {
    rules: [
      {
        id: 'nbc_setback_front',
        type: 'MinSetback',
        severity: RuleSeverity.FATAL,
        parameters: { min_distance_m: 6.0, edge_type: 'front' }
      },
      {
        id: 'nbc_far_limit',
        type: 'MaxFAR',
        severity: RuleSeverity.ERROR,
        parameters: { max_far: 2.5 }
      },
      {
        id: 'nbc_coverage_limit',
        type: 'MaxCoverage',
        severity: RuleSeverity.ERROR,
        parameters: { max_coverage_ratio: 0.4 }
      }
    ]
  },
  parking_rules: {
    rules: [
      {
        id: 'nbc_parking_ratio_res',
        type: 'MinParkingRatio',
        severity: RuleSeverity.ERROR,
        parameters: { spaces_per_100_sqm: 1.5, use_type: 'residential' }
      }
    ]
  }
};
