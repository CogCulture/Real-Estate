import pytest
import json
import sys
import os

# Add parent directory to path to import planning_engine
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from planning_engine import generate_procedural_fallback, BoundaryEngine, is_point_in_polygon


def test_towers_contained_in_boundary():
    """Verify all tower corners are inside the boundary polygon."""
    # Square boundary
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)
    
    towers = layout.get("towers", [])
    assert len(towers) > 0, "Should generate towers"
    
    for t in towers:
        x = t["x_pct"]
        y = t["y_pct"]
        w = t["width_pct"]
        h = t["height_pct"]
        
        # Check all four corners
        corners = [
            (x, y),
            (x + w, y),
            (x, y + h),
            (x + w, y + h)
        ]
        
        for cx, cy in corners:
            assert is_point_in_polygon(cx, cy, poly), f"Tower {t['id']} corner ({cx:.4f}, {cy:.4f}) outside boundary"


def test_amenities_contained_in_boundary():
    """Verify all amenity corners are inside the boundary polygon."""
    # Square boundary
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)
    
    amenities = layout.get("amenities", [])
    assert len(amenities) > 0, "Should generate amenities"
    
    for a in amenities:
        x = a["x_pct"]
        y = a["y_pct"]
        w = a["width_pct"]
        h = a["height_pct"]
        
        # Check all four corners
        corners = [
            (x, y),
            (x + w, y),
            (x, y + h),
            (x + w, y + h)
        ]
        
        for cx, cy in corners:
            assert is_point_in_polygon(cx, cy, poly), f"Amenity {a['id']} corner ({cx:.4f}, {cy:.4f}) outside boundary"


def test_road_points_contained_in_boundary():
    """Verify all road points are inside the boundary polygon."""
    # Square boundary
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)
    
    roads = layout.get("roads", [])
    assert len(roads) > 0, "Should generate roads"
    
    for r in roads:
        points = r.get("points", [])
        for pt in points:
            if len(pt) >= 2:
                rx, ry = pt[0], pt[1]
                assert is_point_in_polygon(rx, ry, poly), f"Road {r['id']} point ({rx:.4f}, {ry:.4f}) outside boundary"


def test_l_shaped_boundary_containment():
    """Verify containment works with non-convex L-shaped boundary."""
    # L-shaped polygon
    poly = [[0.0, 0.0], [0.6, 0.0], [0.6, 0.4], [1.0, 0.4], [1.0, 1.0], [0.0, 1.0]]
    
    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)
    
    towers = layout.get("towers", [])
    for t in towers:
        x = t["x_pct"]
        y = t["y_pct"]
        w = t["width_pct"]
        h = t["height_pct"]
        
        # Check center point
        cx = x + w / 2
        cy = y + h / 2
        assert is_point_in_polygon(cx, cy, poly), f"Tower {t['id']} center ({cx:.4f}, {cy:.4f}) outside L-shaped boundary"


def test_boundary_engine_no_violations():
    """Verify BoundaryEngine reports no violations for valid layout."""
    # Square boundary
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)
    
    # Run BoundaryEngine
    boundary_result = BoundaryEngine().process(layout, boundary_geojson=None, site_width=500.0, site_height=300.0)
    
    violations = boundary_result.get("boundary_violations", [])
    assert len(violations) == 0, f"Should have no boundary violations, got {len(violations)}: {violations}"


def test_boundary_engine_detects_out_of_bounds():
    """Verify BoundaryEngine detects elements outside boundary."""
    # Square boundary
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]

    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)

    # Deliberately place a tower outside boundary
    layout["towers"][0]["x_pct"] = 1.1  # Outside right edge

    # Run BoundaryEngine
    boundary_result = BoundaryEngine().process(layout, boundary_geojson=None, site_width=500.0, site_height=300.0)

    violations = boundary_result.get("boundary_violations", [])
    assert len(violations) > 0, "Should detect boundary violation for out-of-bounds tower"
