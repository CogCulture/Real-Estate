import pytest
import json
import sys
import os

# Add parent directory to path to import planning_engine
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from planning_engine import generate_procedural_fallback, CollisionEngine, get_spacing_pct


def test_tower_to_tower_spacing():
    """Verify towers maintain minimum spacing from each other."""
    # Square boundary
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)
    
    # Run CollisionEngine
    collision_result = CollisionEngine().process(layout, site_width_m=500.0, site_height_m=300.0)
    
    conflicts = collision_result.get("conflicts", [])
    
    # Filter for tower-tower conflicts
    tower_conflicts = [c for c in conflicts if c.get("element_a_type") == "tower" and c.get("element_b_type") == "tower"]
    
    assert len(tower_conflicts) == 0, f"Towers should not overlap, found {len(tower_conflicts)} conflicts: {tower_conflicts}"


def test_tower_to_road_spacing():
    """Verify towers maintain minimum spacing from roads."""
    # Square boundary
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)
    
    # Run CollisionEngine
    collision_result = CollisionEngine().process(layout, site_width_m=500.0, site_height_m=300.0)
    
    conflicts = collision_result.get("conflicts", [])
    
    # Filter for tower-road conflicts
    tower_road_conflicts = [
        c for c in conflicts 
        if (c.get("element_a_type") == "tower" and c.get("element_b_type") == "road") or
           (c.get("element_b_type") == "tower" and c.get("element_a_type") == "road")
    ]
    
    assert len(tower_road_conflicts) == 0, f"Towers should not overlap roads, found {len(tower_road_conflicts)} conflicts"


def test_amenity_to_tower_spacing():
    """Verify amenities maintain minimum spacing from towers."""
    # Square boundary
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)
    
    # Run CollisionEngine
    collision_result = CollisionEngine().process(layout, site_width_m=500.0, site_height_m=300.0)
    
    conflicts = collision_result.get("conflicts", [])
    
    # Filter for amenity-tower conflicts
    amenity_tower_conflicts = [
        c for c in conflicts 
        if (c.get("element_a_type") == "amenity" and c.get("element_b_type") == "tower") or
           (c.get("element_b_type") == "amenity" and c.get("element_a_type") == "tower")
    ]
    
    assert len(amenity_tower_conflicts) == 0, f"Amenities should not overlap towers, found {len(amenity_tower_conflicts)} conflicts"


def test_get_spacing_pct_meter_based():
    """Verify spacing is calculated from meter values, not hardcoded percentages."""
    # Test tower-tower spacing
    spacing = get_spacing_pct("tower", "tower", 500.0, 300.0, None)
    
    # Should be based on DEFAULT_SPACING_M["tower", "tower"] = 15.0m
    # Converted to percentage: 15.0 / min(500, 300) = 15.0 / 300 = 0.05
    expected = 15.0 / 300.0
    assert abs(spacing - expected) < 0.001, f"Spacing {spacing} should be {expected} (15m / 300m min dimension)"


def test_get_spacing_pct_custom_override():
    """Verify custom spacing from project_features overrides defaults."""
    custom_spacing_m = 20.0
    project_features = {"tower_tower_spacing_m": custom_spacing_m}
    
    spacing = get_spacing_pct("tower", "tower", 500.0, 300.0, project_features)
    
    expected = custom_spacing_m / 300.0
    assert abs(spacing - expected) < 0.001, f"Custom spacing {spacing} should be {expected}"


def test_get_spacing_pct_reversed_order():
    """Verify spacing works regardless of element order."""
    spacing1 = get_spacing_pct("tower", "amenity", 500.0, 300.0, None)
    spacing2 = get_spacing_pct("amenity", "tower", 500.0, 300.0, None)
    
    assert spacing1 == spacing2, "Spacing should be symmetric regardless of order"


def test_collision_engine_with_custom_spacing():
    """Verify CollisionEngine accepts custom spacing parameter."""
    # Square boundary
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]

    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)

    # Run CollisionEngine with custom spacing (larger spacing to avoid conflicts)
    project_features = {"tower_tower_spacing_m": 25.0}
    collision_result = CollisionEngine().process(layout, site_width_m=500.0, site_height_m=300.0, project_features=project_features)

    # Should execute without error (spacing parameter is accepted)
    assert "conflicts" in collision_result, "CollisionEngine should return conflicts key"
