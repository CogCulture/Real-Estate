import pytest
import json
import sys
import os

# Add parent directory to path to import planning_engine
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from planning_engine import generate_candidate_slots, resolve_selected_slots, generate_procedural_fallback


def test_generate_candidate_slots_pool_size():
    """Verify candidate pool size is multiplier x required count."""
    # Simple square polygon
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    # Request 8 towers with default multiplier (1.75)
    slots = generate_candidate_slots(poly, 8, 0.1, 0.08, multiplier=1.75)
    
    # Pool should be min(available, 8 * 1.75 = 14)
    assert len(slots) <= 14, f"Pool size {len(slots)} exceeds expected max of 14"
    assert len(slots) > 0, "Should generate at least some candidate slots"


def test_generate_candidate_slots_excludes_invalid():
    """Verify slots with no valid footprint are excluded from pool."""
    # Very narrow polygon that can't fit towers
    poly = [[0.0, 0.0], [0.02, 0.0], [0.02, 1.0], [0.0, 1.0]]
    
    # Request towers with large ideal footprint
    slots = generate_candidate_slots(poly, 4, 0.1, 0.08, multiplier=2.0)
    
    # Should return empty or very small pool since no slots can fit
    assert len(slots) == 0, f"Narrow polygon should exclude invalid slots, got {len(slots)}"


def test_generate_candidate_slots_perimeter_sorting():
    """Verify slots are sorted by distance from centroid (perimeter first)."""
    # Square polygon
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    slots = generate_candidate_slots(poly, 8, 0.1, 0.08, multiplier=2.0)
    
    if len(slots) > 1:
        # Calculate centroid
        cx, cy = 0.5, 0.5
        
        # Check that slots are sorted by distance from centroid (descending)
        distances = [abs(s["cx"] - cx) + abs(s["cy"] - cy) for s in slots]
        # First slot should have larger distance than last slot
        assert distances[0] >= distances[-1], "Slots should be sorted perimeter-first"


def test_resolve_selected_slots_valid():
    """Verify valid slot IDs are correctly resolved."""
    pool = [
        {"id": "slot_0", "cx": 0.5, "cy": 0.5},
        {"id": "slot_1", "cx": 0.6, "cy": 0.6},
        {"id": "slot_2", "cx": 0.7, "cy": 0.7},
    ]
    
    valid_slots, invalid_ids = resolve_selected_slots(["slot_0", "slot_2"], pool)
    
    assert len(valid_slots) == 2, f"Should resolve 2 valid slots, got {len(valid_slots)}"
    assert len(invalid_ids) == 0, f"Should have no invalid IDs, got {invalid_ids}"
    assert valid_slots[0]["id"] == "slot_0"
    assert valid_slots[1]["id"] == "slot_2"


def test_resolve_selected_slots_invalid():
    """Verify invalid slot IDs are reported."""
    pool = [
        {"id": "slot_0", "cx": 0.5, "cy": 0.5},
        {"id": "slot_1", "cx": 0.6, "cy": 0.6},
    ]

    valid_slots, invalid_ids = resolve_selected_slots(["slot_0", "slot_invalid", "slot_1"], pool)

    assert len(valid_slots) == 2, f"Should resolve 2 valid slots (slot_0 and slot_1), got {len(valid_slots)}"
    assert len(invalid_ids) == 1, f"Should have 1 invalid ID, got {len(invalid_ids)}"
    assert "slot_invalid" in invalid_ids


def test_resolve_selected_slots_empty_pool():
    """Verify behavior with empty candidate pool."""
    pool = []
    
    valid_slots, invalid_ids = resolve_selected_slots(["slot_0"], pool)
    
    assert len(valid_slots) == 0, "Empty pool should return no valid slots"
    assert len(invalid_ids) == 1, "Should report the ID as invalid"


def test_procedural_fallback_includes_candidate_slots():
    """Verify generate_procedural_fallback returns candidate_slots."""
    # Simple square polygon
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    layout = generate_procedural_fallback(500.0, 300.0, {}, poly)
    
    assert "candidate_slots" in layout, "Layout should include candidate_slots"
    assert isinstance(layout["candidate_slots"], list), "candidate_slots should be a list"
    
    # Each slot should have required fields
    for slot in layout["candidate_slots"]:
        assert "id" in slot, "Slot should have id"
        assert "cx" in slot, "Slot should have cx"
        assert "cy" in slot, "Slot should have cy"
        assert "max_width_pct" in slot, "Slot should have max_width_pct"
        assert "max_height_pct" in slot, "Slot should have max_height_pct"


def test_candidate_slot_multiplier_clamping():
    """Verify multiplier affects pool size (clamping is done in caller)."""
    poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]

    # Test with low multiplier
    slots_low = generate_candidate_slots(poly, 4, 0.1, 0.08, multiplier=1.2)
    # Pool size should be roughly 4 * 1.2 = 4.8 (rounded down)
    assert len(slots_low) <= 6, f"Pool size {len(slots_low)} should be small with low multiplier"

    # Test with high multiplier
    slots_high = generate_candidate_slots(poly, 4, 0.1, 0.08, multiplier=3.0)
    # Pool size should be roughly 4 * 3.0 = 12
    assert len(slots_high) >= len(slots_low), "Higher multiplier should generate larger pool"
