import pytest
import json
import sys
import os

# Add parent directory to path to import planning_engine
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from planning_engine import generate_procedural_fallback, get_road_width, MIN_TOWER_FOOTPRINT_SQM, MIN_FOOTPRINT_RATIO


def test_tower_footprints_size_aware():
    """Verify towers respect minimum footprint constraints."""
    # Test with a very constrained L-shaped polygon
    with open("tests/fixtures/l_shaped.geojson") as f:
        geojson = json.load(f)
    
    poly = geojson["coordinates"][0]
    # Convert to percentage coordinates (assuming 300x300 site)
    poly_pct = [[c[0]/300.0, c[1]/300.0] for c in poly]
    
    layout = generate_procedural_fallback(300.0, 300.0, {}, poly_pct)
    
    towers = layout.get("towers", [])
    assert len(towers) > 0, "Should generate at least one tower"
    
    # Calculate footprint areas for each tower
    for t in towers:
        area_sqm = (t["width_pct"] * 300.0) * (t["height_pct"] * 300.0)
        # Verify each tower meets minimum footprint requirement
        assert area_sqm >= MIN_TOWER_FOOTPRINT_SQM, f"Tower {t['id']} footprint {area_sqm:.2f} sqm below minimum {MIN_TOWER_FOOTPRINT_SQM} sqm"


def test_road_widths_scale_with_units():
    """Verify road widths differ by unit count bands."""
    # Small site (<300 units)
    small_width = get_road_width("primary", 200)
    assert small_width == 12.0, f"Primary road for <300 units should be 12m, got {small_width}"
    
    # Medium site (300-800 units)
    medium_width = get_road_width("primary", 500)
    assert medium_width == 15.0, f"Primary road for 300-800 units should be 15m, got {medium_width}"
    
    # Large site (>800 units)
    large_width = get_road_width("primary", 1000)
    assert large_width == 18.0, f"Primary road for >800 units should be 18m, got {large_width}"
    
    # Secondary roads
    small_secondary = get_road_width("ring_primary", 200)
    assert small_secondary == 9.0, f"Secondary road for <300 units should be 9m, got {small_secondary}"
    
    large_secondary = get_road_width("ring_primary", 1000)
    assert large_secondary == 15.0, f"Secondary road for >800 units should be 15m, got {large_secondary}"
    
    # Spur roads with branch units
    small_spur = get_road_width("spur", 500, branch_units=100)
    assert small_spur == 6.0, f"Spur with <150 branch units should be 6m, got {small_spur}"
    
    large_spur = get_road_width("spur", 500, branch_units=200)
    assert large_spur == 7.5, f"Spur with >150 branch units should be 7.5m, got {large_spur}"


def test_min_tower_footprint_constants():
    """Verify minimum footprint constants are set correctly."""
    assert MIN_TOWER_FOOTPRINT_SQM == 180.0, f"MIN_TOWER_FOOTPRINT_SQM should be 180.0, got {MIN_TOWER_FOOTPRINT_SQM}"
    assert MIN_FOOTPRINT_RATIO == 0.6, f"MIN_FOOTPRINT_RATIO should be 0.6, got {MIN_FOOTPRINT_RATIO}"


def test_road_widths_meet_nbc_minimums():
    """Verify all road widths meet NBC minimums."""
    # Test all road types across unit count bands
    road_types = ["primary", "entry", "secondary", "ring_primary", "access", "spur"]
    unit_counts = [100, 500, 1000]
    
    for road_type in road_types:
        for units in unit_counts:
            width = get_road_width(road_type, units)
            if road_type in ("primary", "entry"):
                assert width >= 12.0, f"{road_type} road width {width}m below NBC minimum 12m"
            elif road_type in ("secondary", "ring_primary"):
                assert width >= 9.0, f"{road_type} road width {width}m below NBC minimum 9m"
            else:  # access, spur
                assert width >= 6.0, f"{road_type} road width {width}m below NBC minimum 6m"
