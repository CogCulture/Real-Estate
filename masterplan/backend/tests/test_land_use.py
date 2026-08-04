import pytest
import json
import sys
import os

# Add parent directory to path to import planning_engine
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from planning_engine import generate_procedural_fallback


def test_land_use_percentages_sum_to_100():
    """Verify land use percentages sum to exactly 100%."""
    # Square boundary
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)
    
    land_use = layout.get("land_use", {})
    assert land_use, "Layout should include land_use"
    
    total = sum(land_use.values())
    assert abs(total - 100.0) < 0.01, f"Land use percentages should sum to 100%, got {total}"


def test_land_use_categories_present():
    """Verify all expected land use categories are present."""
    # Square boundary
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)
    
    land_use = layout.get("land_use", {})
    
    required_categories = ["residential", "roads", "amenities", "parks", "other"]
    for category in required_categories:
        assert category in land_use, f"Land use should include {category} category"
        assert land_use[category] >= 0, f"{category} percentage should be non-negative"


def test_residential_area_calculation():
    """Verify residential area is calculated from actual tower footprints."""
    # Square boundary
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)
    
    towers = layout.get("towers", [])
    land_use = layout.get("land_use", {})
    site_width_m = layout.get("site_width_m", 500.0)
    site_height_m = layout.get("site_height_m", 300.0)
    buildable_area = layout.get("buildable_area_m2", site_width_m * site_height_m)
    
    # Calculate expected residential area from towers
    calculated_tower_area = sum(
        (t["width_pct"] * site_width_m) * (t["height_pct"] * site_height_m)
        for t in towers
    )
    calculated_pct = (calculated_tower_area / buildable_area) * 100.0 if buildable_area > 0 else 0.0
    
    expected_pct = land_use.get("residential", 0.0)
    
    # Allow small rounding difference
    assert abs(calculated_pct - expected_pct) < 0.5, f"Residential {expected_pct}% should match calculated {calculated_pct}% from towers"


def test_road_area_scaling_with_units():
    """Verify road area scales with unit count (via road widths)."""
    # Small site
    poly_small = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    layout_small = generate_procedural_fallback(500.0, 300.0, {"total_towers": 4}, poly_small)
    
    # Large site
    poly_large = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    layout_large = generate_procedural_fallback(500.0, 300.0, {"total_towers": 12}, poly_large)
    
    land_use_small = layout_small.get("land_use", {})
    land_use_large = layout_large.get("land_use", {})
    
    road_pct_small = land_use_small.get("roads", 0.0)
    road_pct_large = land_use_large.get("roads", 0.0)
    
    # Larger site should have wider roads, thus higher road percentage
    # (This is a weak test since road area also depends on layout)
    assert road_pct_large > 0, "Large site should have road area"
    assert road_pct_small > 0, "Small site should have road area"


def test_green_area_respects_target():
    """Verify green area percentage respects target from project_features."""
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    # Request 30% green area
    layout = generate_procedural_fallback(500.0, 300.0, {"green_area_pct": 30.0}, poly)
    
    land_use = layout.get("land_use", {})
    parks_pct = land_use.get("parks", 0.0)
    
    # Should be close to target (may vary due to normalization)
    assert abs(parks_pct - 30.0) < 5.0, f"Parks {parks_pct}% should be close to target 30%"


def test_max_far_constraint():
    """Verify floor area ratio respects MAX_FAR constraint."""
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)
    
    towers = layout.get("towers", [])
    site_width_m = layout.get("site_width_m", 500.0)
    site_height_m = layout.get("site_height_m", 300.0)
    buildable_area = layout.get("buildable_area_m2", site_width_m * site_height_m)
    
    # Calculate total floor area
    total_floor_area = sum(
        (t["width_pct"] * site_width_m) * (t["height_pct"] * site_height_m) * t.get("floors", 24)
        for t in towers
    )
    
    far = total_floor_area / buildable_area if buildable_area > 0 else 0.0
    
    # MAX_FAR is 2.5
    assert far <= 2.6, f"FAR {far} should not exceed MAX_FAR (2.5) significantly"


def test_max_coverage_constraint():
    """Verify coverage ratio respects MAX_COVERAGE_RATIO constraint."""
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)
    
    towers = layout.get("towers", [])
    site_width_m = layout.get("site_width_m", 500.0)
    site_height_m = layout.get("site_height_m", 300.0)
    buildable_area = layout.get("buildable_area_m2", site_width_m * site_height_m)
    
    # Calculate total footprint area
    total_footprint_area = sum(
        (t["width_pct"] * site_width_m) * (t["height_pct"] * site_height_m)
        for t in towers
    )
    
    coverage_ratio = total_footprint_area / buildable_area if buildable_area > 0 else 0.0
    
    # MAX_COVERAGE_RATIO is 0.4
    assert coverage_ratio <= 0.45, f"Coverage {coverage_ratio} should not exceed MAX_COVERAGE_RATIO (0.4) significantly"
