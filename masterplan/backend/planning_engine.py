import math

class BoundingBox:
    def __init__(self, x, y, width, height, element_type, element_id):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.element_type = element_type
        self.element_id = element_id

    def x2(self) -> float:
        return self.x + self.width

    def y2(self) -> float:
        return self.y + self.height

    def cx(self) -> float:
        return self.x + self.width / 2

    def cy(self) -> float:
        return self.y + self.height / 2

    def intersects(self, other, padding=0.0) -> bool:
        return not (
            self.x2() + padding <= other.x - padding or
            self.x - padding >= other.x2() + padding or
            self.y2() + padding <= other.y - padding or
            self.y - padding >= other.y2() + padding
        )

    def distance_to(self, other) -> float:
        # Distance between centers
        dx = self.cx() - other.cx()
        dy = self.cy() - other.cy()
        return math.sqrt(dx*dx + dy*dy)

    def area(self) -> float:
        return self.width * self.height

    def to_dict(self) -> dict:
        return {
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
            "element_type": self.element_type,
            "element_id": self.element_id
        }

SETBACKS = {
    ("tower", "tower"): 0.04,
    ("tower", "road"): 0.03,
    ("tower", "boundary"): 0.05,
    ("amenity", "road"): 0.02,
    ("amenity", "tower"): 0.02,
    ("amenity", "boundary"): 0.04,
    ("amenity", "amenity"): 0.02,
}

class BoundaryEngine:
    MARGIN = 0.06

    def process(self, masterplan_json: dict) -> dict:
        violations = []
        
        elements_to_check = []
        if "towers" in masterplan_json:
            for t in masterplan_json["towers"]:
                elements_to_check.append((t, "tower"))
        if "amenities" in masterplan_json:
            for a in masterplan_json["amenities"]:
                elements_to_check.append((a, "amenity"))
                
        for el, el_type in elements_to_check:
            el_id = el.get("id", "unknown")
            
            # Handle different coordinate names
            x = el.get("x_pct", el.get("cx_pct", 0))
            y = el.get("y_pct", el.get("cy_pct", 0))
            w = el.get("width_pct", el.get("rx_pct", 0)) # assuming rx is half width, but we'll use it as width if it's the only one
            if "rx_pct" in el and "width_pct" not in el:
                w = el["rx_pct"] * 2
            h = el.get("height_pct", el.get("ry_pct", 0))
            if "ry_pct" in el and "height_pct" not in el:
                h = el["ry_pct"] * 2
                
            if x < self.MARGIN:
                violations.append({"element_id": el_id, "element_type": el_type, "violation": "x_pct out of bounds (min)", "value": x, "allowed_min": self.MARGIN})
            if y < self.MARGIN:
                violations.append({"element_id": el_id, "element_type": el_type, "violation": "y_pct out of bounds (min)", "value": y, "allowed_min": self.MARGIN})
                
            x2 = x + w
            y2 = y + h
            max_allowed = 1.0 - self.MARGIN
            
            if x2 > max_allowed:
                violations.append({"element_id": el_id, "element_type": el_type, "violation": "x_pct out of bounds (max)", "value": x2, "allowed_max": max_allowed})
            if y2 > max_allowed:
                violations.append({"element_id": el_id, "element_type": el_type, "violation": "y_pct out of bounds (max)", "value": y2, "allowed_max": max_allowed})

        masterplan_json["boundary_violations"] = violations
        return masterplan_json

class CollisionEngine:
    def process(self, masterplan_json: dict) -> dict:
        conflicts = []
        boxes = []
        
        if "towers" in masterplan_json:
            for t in masterplan_json["towers"]:
                w = t.get("width_pct", 0)
                h = t.get("height_pct", 0)
                boxes.append(BoundingBox(t.get("x_pct", 0), t.get("y_pct", 0), w, h, "tower", t.get("id", "unknown")))
                
        if "amenities" in masterplan_json:
            for a in masterplan_json["amenities"]:
                x = a.get("x_pct", a.get("cx_pct", 0))
                y = a.get("y_pct", a.get("cy_pct", 0))
                w = a.get("width_pct", a.get("rx_pct", 0))
                if "rx_pct" in a and "width_pct" not in a:
                    w = a["rx_pct"] * 2
                h = a.get("height_pct", a.get("ry_pct", 0))
                if "ry_pct" in a and "height_pct" not in a:
                    h = a["ry_pct"] * 2
                    
                boxes.append(BoundingBox(x, y, w, h, "amenity", a.get("id", "unknown")))
                
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                box_a = boxes[i]
                box_b = boxes[j]
                
                # Check required setback padding
                required_gap = SETBACKS.get((box_a.element_type, box_b.element_type), 
                                          SETBACKS.get((box_b.element_type, box_a.element_type), 0.0))
                
                # Use half the required gap as padding for each box so they sum to the full gap
                padding = required_gap / 2.0
                
                if box_a.intersects(box_b, padding=padding):
                    dist = box_a.distance_to(box_b)
                    
                    # Determine severity
                    severity = "warning"
                    if box_a.element_type == "tower" and box_b.element_type == "tower":
                        severity = "critical"
                    elif (box_a.element_type == "tower" and box_b.element_type == "road") or \
                         (box_b.element_type == "tower" and box_a.element_type == "road"):
                        severity = "critical"
                        
                    conflict_type = f"{box_a.element_type}_{box_b.element_type}_overlap"
                    if box_a.element_type > box_b.element_type:
                        conflict_type = f"{box_b.element_type}_{box_a.element_type}_overlap"
                    
                    conflicts.append({
                        "element_a": box_a.element_id,
                        "element_b": box_b.element_id,
                        "type": conflict_type,
                        "distance": round(dist, 4),
                        "required_gap": required_gap,
                        "severity": severity
                    })

        masterplan_json["conflicts"] = conflicts
        return masterplan_json

def generate_report(masterplan_json: dict, conflicts: list, violations: list) -> dict:
    score = 100
    critical_count = 0
    warning_count = 0
    
    for c in conflicts:
        if c.get("severity") == "critical":
            score -= 10
            critical_count += 1
        elif c.get("severity") == "warning":
            score -= 3
            warning_count += 1
            
    for v in violations:
        score -= 8
        
    towers = masterplan_json.get("towers", [])
    if len(towers) < 6 or len(towers) > 8:
        score -= 15
        
    amenities = masterplan_json.get("amenities", [])
    has_lawn = any(a.get("type") in ["central_lawn", "lawn", "park"] or "lawn" in a.get("label", "").lower() for a in amenities)
    has_clubhouse = any(a.get("type") == "clubhouse" or "clubhouse" in a.get("label", "").lower() for a in amenities)
    
    if not has_lawn:
        score -= 10
    if not has_clubhouse:
        score -= 10
        
    entries = masterplan_json.get("entry_points", [])
    if len(entries) == 0:
        score -= 15
        
    # Grade scale
    if score >= 90:
        grade = "A"
    elif score >= 75:
        grade = "B"
    elif score >= 60:
        grade = "C"
    else:
        grade = "F"
        
    passed = grade in ["A", "B"]
    
    summary_parts = []
    total_issues = len(conflicts) + len(violations)
    if total_issues == 0:
        summary_parts.append("0 conflicts found.")
    else:
        summary_parts.append(f"{total_issues} issues found.")
        
    if critical_count > 0:
        first_crit = next((c for c in conflicts if c.get("severity") == "critical"), None)
        if first_crit:
            summary_parts.append(f"{critical_count} critical overlap(s), e.g. between {first_crit['element_a']} and {first_crit['element_b']}.")
            
    return {
        "quality_score": score,
        "grade": grade,
        "total_conflicts": len(conflicts),
        "critical_count": critical_count,
        "warning_count": warning_count,
        "boundary_violations": len(violations),
        "conflicts": conflicts,
        "boundary_violations_list": violations,
        "passed": passed,
        "summary": " ".join(summary_parts)
    }
