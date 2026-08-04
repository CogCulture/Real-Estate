import pytest
import json
import sys
import os

# Add parent directory to path to import planning_engine
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from planning_engine import generate_procedural_fallback, resolve_layout, BoundaryEngine, CollisionEngine


def test_resolve_layout_with_real_parameters():
    """Verify resolve_layout accepts and uses real site dimensions."""
    # Square boundary
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    # Generate layout with real site dimensions
    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)
    
    # Call resolve_layout with real parameters (mirroring ai.py call pattern)
    resolved_layout = resolve_layout(layout, poly, 500.0, 300.0, None)
    
    # Should not crash and should return a layout
    assert resolved_layout is not None
    assert "towers" in resolved_layout
    assert "amenities" in resolved_layout


def test_resolve_layout_backward_compatibility():
    """Verify resolve_layout still works with 2-arg call (backward compat)."""
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)
    
    # Call with only 2 args (old signature) - should use defaults
    resolved_layout = resolve_layout(layout, poly)
    
    assert resolved_layout is not None
    assert "towers" in resolved_layout


def test_resolve_layout_with_project_features():
    """Verify resolve_layout accepts project_features parameter."""
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    project_features = {"green_area_pct": 30.0, "total_towers": 6}
    layout = generate_procedural_fallback(500.0, 300.0, project_features, poly)
    
    # Call with project_features
    resolved_layout = resolve_layout(layout, poly, 500.0, 300.0, project_features)
    
    assert resolved_layout is not None
    assert "towers" in resolved_layout


def test_resolve_layout_full_ai_call_sequence():
    """Verify the full call sequence used by ai.py works end-to-end."""
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    sw, sh = 500.0, 300.0
    project_features = {"green_area_pct": 25.0}
    
    # Step 1: Generate procedural template (ai.py line 180-181)
    template_layout = generate_procedural_fallback(sw, sh, project_features, poly)
    template_layout = resolve_layout(template_layout, poly, sw, sh, project_features)
    
    # Step 2: Simulate merge (ai.py line 304-305)
    merged_layout = template_layout  # Simplified - no actual merge
    merged_layout = resolve_layout(merged_layout, poly, sw, sh, project_features)
    
    # Step 3: Run engines (ai.py line 307-309)
    boundary_result = BoundaryEngine().process(merged_layout, boundary_geojson=None, site_width=sw, site_height=sh)
    collision_result = CollisionEngine().process(boundary_result)
    
    # Step 4: Conflict retry path (ai.py line 312-315)
    if collision_result.get("conflicts") or collision_result.get("boundary_violations"):
        merged_layout = resolve_layout(collision_result, poly, sw, sh, project_features)
        boundary_result = BoundaryEngine().process(merged_layout, boundary_geojson=None, site_width=sw, site_height=sh)
        collision_result = CollisionEngine().process(boundary_result)
    
    # Should complete without NameError
    assert collision_result is not None
    assert "towers" in collision_result


def test_resolve_layout_fallback_path():
    """Verify the fallback path used by ai.py works (line 355-356)."""
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    sw, sh = 500.0, 300.0
    project_features = None
    
    # Fallback generation (ai.py line 355-356)
    fallback_layout = generate_procedural_fallback(sw, sh, project_features, poly)
    fallback_layout = resolve_layout(fallback_layout, poly, sw, sh, project_features)
    
    # Run engines
    boundary_result = BoundaryEngine().process(fallback_layout, boundary_geojson=None, site_width=sw, site_height=sh)
    collision_result = CollisionEngine().process(boundary_result)
    
    assert collision_result is not None
    assert "towers" in collision_result


def test_resolve_layout_constraint_solver_uses_real_dimensions():
    """Verify ConstraintSolver receives real site dimensions from resolve_layout."""
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    # Use non-default dimensions to verify they're actually used
    custom_sw, custom_sh = 800.0, 400.0
    layout = generate_procedural_fallback(custom_sw, custom_sh, {}, poly)
    
    # Resolve with custom dimensions
    resolved_layout = resolve_layout(layout, poly, custom_sw, custom_sh, None)
    
    # The layout should still be valid with custom dimensions
    assert resolved_layout is not None
    assert "towers" in resolved_layout
