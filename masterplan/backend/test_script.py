import json
from planning_engine import BoundaryEngine, CollisionEngine, generate_report

# Good plan (no conflicts, all required elements)
good_plan = {
    "towers": [
        {"id": "t1", "x_pct": 0.2, "y_pct": 0.2, "width_pct": 0.1, "height_pct": 0.1},
        {"id": "t2", "x_pct": 0.5, "y_pct": 0.2, "width_pct": 0.1, "height_pct": 0.1},
        {"id": "t3", "x_pct": 0.8, "y_pct": 0.2, "width_pct": 0.1, "height_pct": 0.1},
        {"id": "t4", "x_pct": 0.2, "y_pct": 0.6, "width_pct": 0.1, "height_pct": 0.1},
        {"id": "t5", "x_pct": 0.5, "y_pct": 0.6, "width_pct": 0.1, "height_pct": 0.1},
        {"id": "t6", "x_pct": 0.8, "y_pct": 0.6, "width_pct": 0.1, "height_pct": 0.1}
    ],
    "amenities": [
        {"id": "a1", "type": "clubhouse", "x_pct": 0.45, "y_pct": 0.45, "width_pct": 0.1, "height_pct": 0.1},
        {"id": "a2", "type": "central_lawn", "x_pct": 0.5, "y_pct": 0.8, "width_pct": 0.1, "height_pct": 0.1}
    ],
    "entry_points": [{"id": "e1"}]
}

# Bad plan (overlaps, out of bounds, missing amenities)
bad_plan = {
    "towers": [
        {"id": "t1", "x_pct": 0.01, "y_pct": 0.2, "width_pct": 0.1, "height_pct": 0.1}, # out of bounds min X
        {"id": "t2", "x_pct": 0.05, "y_pct": 0.2, "width_pct": 0.1, "height_pct": 0.1}, # overlaps t1
        {"id": "t3", "x_pct": 0.8, "y_pct": 0.2, "width_pct": 0.1, "height_pct": 0.1},
        {"id": "t4", "x_pct": 0.95, "y_pct": 0.6, "width_pct": 0.1, "height_pct": 0.1}  # out of bounds max X
    ],
    "amenities": [
        {"id": "a1", "type": "pool", "x_pct": 0.05, "y_pct": 0.22, "width_pct": 0.1, "height_pct": 0.1} # overlaps t1, t2
    ],
    "entry_points": []
}

def process_plan(plan):
    b = BoundaryEngine().process(plan)
    c = CollisionEngine().process(b)
    rep = generate_report(c, c["conflicts"], c["boundary_violations"])
    c["validation"] = rep
    return c

print("=== GOOD PLAN ===")
print(json.dumps(process_plan(good_plan), indent=2))
print("=== BAD PLAN ===")
print(json.dumps(process_plan(bad_plan), indent=2))
