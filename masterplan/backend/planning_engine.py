import math
import json
from typing import Dict, List, Any

def is_point_in_polygon(x: float, y: float, polygon: list) -> bool:
    num = len(polygon)
    j = num - 1
    c = False
    for i in range(num):
        if ((polygon[i][1] > y) != (polygon[j][1] > y)) and \
                (x < (polygon[j][0] - polygon[i][0]) * (y - polygon[i][1]) / (polygon[j][1] - polygon[i][1] + 1e-9) + polygon[i][0]):
            c = not c
        j = i
    return c

def get_boundary_coords_pct(boundary_geojson_str: Any, sw: float, sh: float) -> list:
    if not boundary_geojson_str:
        return None
    try:
        if not isinstance(boundary_geojson_str, str):
            geojson = boundary_geojson_str
        else:
            geojson = json.loads(boundary_geojson_str)
            
        geometry = None
        if "geometry" in geojson:
            geometry = geojson["geometry"]
        elif "features" in geojson and len(geojson["features"]) > 0:
            geometry = geojson["features"][0].get("geometry")
        elif "type" in geojson and geojson["type"] == "Polygon":
            geometry = geojson

        if geometry and geometry.get("type") == "Polygon":
            coords = geometry["coordinates"][0]
            lats = [c[1] for c in coords]
            lngs = [c[0] for c in coords]
            min_lat = min(lats)
            max_lat = max(lats)
            min_lng = min(lngs)
            max_lng = max(lngs)
            
            center_lat = (min_lat + max_lat) / 2.0
            cos_center = math.cos(center_lat * math.pi / 180.0)
            
            actual_w = (max_lng - min_lng) * 111320.0 * cos_center
            actual_h = (max_lat - min_lat) * 111320.0
            
            if actual_w <= 0: actual_w = sw
            if actual_h <= 0: actual_h = sh
            
            boundary_coords_pct = []
            for c in coords:
                x_m = (c[0] - min_lng) * 111320.0 * cos_center
                y_m = (max_lat - c[1]) * 111320.0
                
                x_pct = x_m / actual_w
                y_pct = y_m / actual_h
                boundary_coords_pct.append([round(x_pct, 4), round(y_pct, 4)])
            return boundary_coords_pct
    except Exception as e:
        print(f"Error parsing boundary GeoJSON in planning engine: {e}")
    return None

def get_polygon_centroid(polygon_coords: list) -> tuple:
    if not polygon_coords:
        return (0.5, 0.5)
    pts = list(polygon_coords)
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    
    n = len(pts) - 1
    area = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(n):
        x_i, y_i = pts[i]
        x_next, y_next = pts[i+1]
        factor = (x_i * y_next - x_next * y_i)
        area += factor
        cx += (x_i + x_next) * factor
        cy += (y_i + y_next) * factor
    
    area *= 0.5
    if abs(area) < 1e-9:
        xs = [p[0] for p in polygon_coords]
        ys = [p[1] for p in polygon_coords]
        return (sum(xs)/len(xs), sum(ys)/len(ys))
        
    cx = cx / (6.0 * area)
    cy = cy / (6.0 * area)
    return (cx, cy)

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
        epsilon = 2e-4
        return not (
            self.x2() + padding <= other.x - padding + epsilon or
            self.x - padding >= other.x2() + padding - epsilon or
            self.y2() + padding <= other.y - padding + epsilon or
            self.y - padding >= other.y2() + padding - epsilon
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

    def process(self, masterplan_json: dict, boundary_geojson: str = None, site_width: float = 500.0, site_height: float = 300.0) -> dict:
        violations = []
        boundary_poly = None
        if boundary_geojson:
            boundary_poly = get_boundary_coords_pct(boundary_geojson, site_width, site_height)
        
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
            x = el.get("x_pct", el.get("cx_pct", 0.0))
            y = el.get("y_pct", el.get("cy_pct", 0.0))
            w = el.get("width_pct", el.get("rx_pct", 0.0))
            if "rx_pct" in el and "width_pct" not in el:
                w = el["rx_pct"] * 2
            h = el.get("height_pct", el.get("ry_pct", 0.0))
            if "ry_pct" in el and "height_pct" not in el:
                h = el["ry_pct"] * 2
                
            if boundary_poly:
                # Check corners or key points against the polygon
                shape = el.get("shape", "rect")
                if shape == "ellipse" or ("cx_pct" in el and "rx_pct" in el):
                    cx = el.get("cx_pct", x)
                    cy = el.get("cy_pct", y)
                    rx = el.get("rx_pct", w / 2.0)
                    ry = el.get("ry_pct", h / 2.0)
                    pts = [(cx, cy), (cx - rx, cy), (cx + rx, cy), (cx, cy - ry), (cx, cy + ry)]
                    outside_pts = [p for p in pts if not is_point_in_polygon(p[0], p[1], boundary_poly)]
                    if outside_pts:
                        violations.append({
                            "element_id": el_id, 
                            "element_type": el_type, 
                            "violation": "outside site boundary polygon", 
                            "value": outside_pts[0]
                        })
                else:
                    corners = [(x, y), (x + w, y), (x, y + h), (x + w, y + h)]
                    outside_corners = [c for c in corners if not is_point_in_polygon(c[0], c[1], boundary_poly)]
                    if outside_corners:
                        violations.append({
                            "element_id": el_id, 
                            "element_type": el_type, 
                            "violation": "outside site boundary polygon", 
                            "value": outside_corners[0]
                        })
            else:
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

        # Check roads if boundary_poly is active
        if boundary_poly and "roads" in masterplan_json:
            for r in masterplan_json["roads"]:
                for pt in r.get("points", []):
                    if len(pt) >= 2:
                        rx, ry = pt[0], pt[1]
                        if not is_point_in_polygon(rx, ry, boundary_poly):
                            violations.append({
                                "element_id": r.get("id", "road"),
                                "element_type": "road",
                                "violation": "road point outside boundary polygon",
                                "value": [rx, ry]
                            })
                            break

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
                is_ellipse = "cx_pct" in a and "rx_pct" in a
                w = a.get("width_pct", a["rx_pct"] * 2 if "rx_pct" in a else 0.0)
                h = a.get("height_pct", a["ry_pct"] * 2 if "ry_pct" in a else 0.0)
                if is_ellipse:
                    x = a["cx_pct"] - a["rx_pct"]
                    y = a["cy_pct"] - a["ry_pct"]
                else:
                    x = a.get("x_pct", 0.0)
                    y = a.get("y_pct", 0.0)
                    
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

def resolve_layout(masterplan_json: dict, boundary_poly: list = None) -> dict:
    towers = masterplan_json.get("towers", [])
    amenities = masterplan_json.get("amenities", [])
    
    # Collect all elements
    elements = []
    for t in towers:
        t["type"] = "tower"
        elements.append(t)
    for a in amenities:
        if "type" not in a:
            a["type"] = "amenity"
        elements.append(a)
        
    # Solve constraints
    solver = ConstraintSolver(boundary_poly)
    solver.solve(elements, iterations=100)
    
    # Update back to masterplan_json
    masterplan_json["towers"] = towers
    masterplan_json["amenities"] = amenities
    return masterplan_json

def generate_procedural_fallback(site_width_m: float, site_height_m: float, project_features: dict = None, boundary_poly: list = None) -> dict:
    import random
    
    # 1. Determine centroid and site aspects
    if boundary_poly:
        cx, cy = get_polygon_centroid(boundary_poly)
    else:
        cx, cy = 0.5, 0.52
        
    names = ["Elysian Heights", "Pinecrest Groves", "Vanderbilt Meadows", "Amberwood Reserve", "Orchard Ridge", "Windermere Oasis"]
    themes = ["Modern Wellness Sanctuary", "European Heritage Estates", "Classic Contemporary Garden Living", "Neo-Classical Township Retreat"]
    
    name = random.choice(names)
    theme = random.choice(themes)
    if project_features:
        if "theme" in project_features and project_features["theme"]:
            theme = project_features["theme"]
            
    tw = min(30.0 / site_width_m, 0.10)   # ~30m tower width
    th = min(22.0 / site_height_m, 0.08)   # ~22m tower depth
    
    # 2. Entry points
    entry_x = 0.45 + random.random() * 0.1
    entry_points = [
        { "id": "main_entry", "side": "south", "x_pct": round(entry_x, 4), "y_pct": 0.93, "type": "main", "label": "Main Entry / Exit" },
        { "id": "secondary_entry", "side": "north", "x_pct": round(entry_x + (random.random() * 0.08 - 0.04), 4), "y_pct": 0.07, "type": "secondary", "label": "Secondary Entry / Exit" }
    ]
    
    # 3. Towers
    num_towers = 8
    towers = []
    footprints = ["cruciform", "h_shaped", "u_shaped", "courtyard"]
    rotations = [0, 45, 90, 135]
    tower_radius = 0.28
    
    for i in range(num_towers):
        angle = (i * 2 * math.pi) / num_towers
        tx = cx + math.cos(angle) * tower_radius
        ty = cy + math.sin(angle) * tower_radius
        letter = chr(65 + i)
        
        towers.append({
            "id": f"tower_{letter.lower()}",
            "label": f"Tower {letter}",
            "footprint": random.choice(footprints),
            "x_pct": round(tx - tw / 2, 4),
            "y_pct": round(ty - th / 2, 4),
            "width_pct": round(tw, 4),
            "height_pct": round(th, 4),
            "rotation_deg": random.choice(rotations),
            "floors": random.randint(18, 36),
            "units": random.randint(80, 160),
            "unit_type": "3BHK" if random.random() > 0.5 else "4BHK",
            "has_arrival_plaza": True,
            "has_drop_off_loop": True,
            "has_landscape_buffer": True
        })
        
    # 4. Roads
    main_boulevard_pts = [
        [entry_points[0]["x_pct"], entry_points[0]["y_pct"]],
        [round(entry_x + (random.random() * 0.06 - 0.03), 4), 0.72],
        [round(cx + (random.random() * 0.04 - 0.02), 4), cy],
        [round(entry_x + (random.random() * 0.06 - 0.03), 4), 0.28],
        [entry_points[1]["x_pct"], entry_points[1]["y_pct"]]
    ]
    
    inner_loop_pts = []
    loop_radius = tower_radius - 0.10
    for i in range(num_towers):
        angle = (i * 2 * math.pi) / num_towers
        lx = cx + math.cos(angle) * loop_radius
        ly = cy + math.sin(angle) * loop_radius
        inner_loop_pts.append([round(lx, 4), round(ly, 4)])
    inner_loop_pts.append([inner_loop_pts[0][0], inner_loop_pts[0][1]])
    
    roads = [
        { "id": "main_boulevard", "type": "boulevard", "width_meters": 12, "points": main_boulevard_pts, "tension": 0.4, "has_median": True, "has_sidewalks": True, "has_trees": True },
        { "id": "inner_loop", "type": "loop", "width_meters": 9, "points": inner_loop_pts, "tension": 0.4, "has_sidewalks": True, "has_trees": True }
    ]
    
    # 5. Amenities
    clubhouse_w = min(40.0 / site_width_m, 0.12)
    clubhouse_h = min(25.0 / site_height_m, 0.08)
    clubhouse_x = cx - clubhouse_w / 2
    clubhouse_y = cy - 0.08
    
    pool_w = min(25.0 / site_width_m, 0.08)
    pool_h = min(12.0 / site_height_m, 0.04)
    pool_x = clubhouse_x + clubhouse_w + 0.02
    pool_y = clubhouse_y + (clubhouse_h - pool_h) / 2
    
    lawn_rx = 0.06
    lawn_ry = 0.05
    lawn_cx = cx
    lawn_cy = cy + 0.08
    
    tennis_w = min(24.0 / site_width_m, 0.07)
    tennis_h = min(11.0 / site_height_m, 0.04)
    tennis_x = cx - 0.15 - tennis_w
    tennis_y = cy
    
    kids_w = min(15.0 / site_width_m, 0.05)
    kids_h = min(15.0 / site_height_m, 0.05)
    kids_x = cx + 0.12 - kids_w
    kids_y = cy + 0.18
    
    amenities = [
        { "id": "clubhouse", "type": "clubhouse", "label": "Grand Clubhouse", "shape": "rect", "x_pct": round(clubhouse_x, 4), "y_pct": round(clubhouse_y, 4), "width_pct": round(clubhouse_w, 4), "height_pct": round(clubhouse_h, 4) },
        { "id": "swimming_pool", "type": "pool", "label": "Luxury Pool", "shape": "rect", "x_pct": round(pool_x, 4), "y_pct": round(pool_y, 4), "width_pct": round(pool_w, 4), "height_pct": round(pool_h, 4) },
        { "id": "central_lawn", "type": "central_lawn", "label": "Central Green", "shape": "ellipse", "cx_pct": round(lawn_cx, 4), "cy_pct": round(lawn_cy, 4), "rx_pct": round(lawn_rx, 4), "ry_pct": round(lawn_ry, 4) },
        { "id": "tennis_court", "type": "sports", "label": "Tennis Court", "shape": "rect", "x_pct": round(tennis_x, 4), "y_pct": round(tennis_y, 4), "width_pct": round(tennis_w, 4), "height_pct": round(tennis_h, 4) },
        { "id": "kids_play", "type": "kids", "label": "Kids Play Zone", "shape": "rect", "x_pct": round(kids_x, 4), "y_pct": round(kids_y, 4), "width_pct": round(kids_w, 4), "height_pct": round(kids_h, 4) }
    ]
    
    # 6. Pedestrian Paths
    jog_pts = []
    jog_radius = tower_radius + 0.06
    for i in range(num_towers):
        angle = (i * 2 * math.pi) / num_towers
        jx = cx + math.cos(angle) * jog_radius
        jy = cy + math.sin(angle) * jog_radius
        jog_pts.append([round(jx, 4), round(jy, 4)])
    jog_pts.append([jog_pts[0][0], jog_pts[0][1]])
    
    pedestrian_paths = [
        { "id": "jogging_track", "type": "jogging", "points": jog_pts, "tension": 0.4, "width_meters": 2 }
    ]
    
    # 7. Landscape tree clusters
    tree_clusters = []
    for i in range(num_towers):
        angle = ((i + 0.5) * 2 * math.pi) / num_towers
        tx = cx + math.cos(angle) * (tower_radius + 0.08)
        ty = cy + math.sin(angle) * (tower_radius + 0.08)
        tree_clusters.append({
            "id": f"tc_{i}",
            "cx_pct": round(tx, 4),
            "cy_pct": round(ty, 4),
            "radius_pct": 0.03,
            "density": "medium"
        })
        
    return {
        "project": {
            "name": name,
            "total_area_acres": round((site_width_m * site_height_m) / 4047.0, 2),
            "total_towers": num_towers,
            "theme": theme
        },
        "land_use": {
            "residential_pct": 20.0, "roads_pct": 12.0, "amenities_pct": 8.0,
            "open_spaces_pct": 42.0, "parks_pct": 18.0
        },
        "entry_points": entry_points,
        "roads": roads,
        "towers": towers,
        "amenities": amenities,
        "pedestrian_paths": pedestrian_paths,
        "landscape": {
            "tree_clusters": tree_clusters,
            "water_features": [],
            "green_buffers": []
        }
    }

def merge_layout_choices(template_layout: dict, claude_layout: dict) -> dict:
    if not claude_layout:
        return template_layout
        
    result = dict(template_layout)
    
    # 1. Merge project metadata
    if "project" in claude_layout:
        cp = claude_layout["project"]
        if "project" in result:
            result["project"]["name"] = cp.get("name", template_layout["project"].get("name", "Elysian Masterplan"))
            result["project"]["theme"] = cp.get("theme", template_layout["project"].get("theme", "Modern Sanctuary"))
            if "total_area_acres" in cp:
                result["project"]["total_area_acres"] = cp["total_area_acres"]
            if "total_towers" in cp:
                result["project"]["total_towers"] = cp["total_towers"]
            
    # 2. Merge land use
    if "land_use" in claude_layout and "land_use" in result:
        result["land_use"].update(claude_layout["land_use"])
        
    # 3. Merge towers
    if "towers" in claude_layout and "towers" in template_layout:
        ctowers = claude_layout["towers"]
        ttowers = template_layout["towers"]
        merged_towers = []
        for i, tt in enumerate(ttowers):
            if i < len(ctowers):
                ct = ctowers[i]
                mt = dict(tt)
                mt["label"] = ct.get("label", tt["label"])
                mt["footprint"] = ct.get("footprint", tt["footprint"])
                mt["rotation_deg"] = ct.get("rotation_deg", tt["rotation_deg"])
                mt["floors"] = ct.get("floors", tt["floors"])
                mt["units"] = ct.get("units", tt["units"])
                mt["unit_type"] = ct.get("unit_type", tt["unit_type"])
                mt["has_arrival_plaza"] = ct.get("has_arrival_plaza", tt["has_arrival_plaza"])
                mt["has_drop_off_loop"] = ct.get("has_drop_off_loop", tt["has_drop_off_loop"])
                mt["has_landscape_buffer"] = ct.get("has_landscape_buffer", tt["has_landscape_buffer"])
                merged_towers.append(mt)
            else:
                merged_towers.append(tt)
        result["towers"] = merged_towers
        
    # 4. Merge amenities
    if "amenities" in claude_layout and "amenities" in template_layout:
        camenities = claude_layout["amenities"]
        tamenities = template_layout["amenities"]
        merged_amenities = []
        for i, ta in enumerate(tamenities):
            ta_id = ta.get("id")
            match_ca = None
            for ca in camenities:
                if ca.get("id") == ta_id:
                    match_ca = ca
                    break
            if not match_ca and i < len(camenities):
                match_ca = camenities[i]
                
            if match_ca:
                ma = dict(ta)
                ma["label"] = match_ca.get("label", ta["label"])
                if "type" in match_ca:
                    ma["type"] = match_ca["type"]
                merged_amenities.append(ma)
            else:
                merged_amenities.append(ta)
        result["amenities"] = merged_amenities
        
    # 5. Merge landscape tree clusters
    if "landscape" in claude_layout and "landscape" in template_layout:
        cl = claude_layout["landscape"]
        tl = template_layout["landscape"]
        if "tree_clusters" in cl and "tree_clusters" in tl:
            ctrees = cl["tree_clusters"]
            ttrees = tl["tree_clusters"]
            merged_trees = []
            for i, tt in enumerate(ttrees):
                if i < len(ctrees):
                    ct = ctrees[i]
                    mt = dict(tt)
                    mt["density"] = ct.get("density", tt["density"])
                    merged_trees.append(mt)
                else:
                    merged_trees.append(tt)
            result["landscape"]["tree_clusters"] = merged_trees
            
    return result

class ConstraintSolver:
    def __init__(self, boundary_poly: list = None, site_width: float = 500.0, site_height: float = 300.0):
        self.boundary_poly = boundary_poly
        self.site_width = site_width
        self.site_height = site_height
        if boundary_poly:
            self.cx, self.cy = get_polygon_centroid(boundary_poly)
        else:
            self.cx, self.cy = 0.5, 0.52
            
    def solve(self, elements: list, iterations: int = 100) -> list:
        for _ in range(iterations):
            forces = {el["id"]: [0.0, 0.0] for el in elements}
            
            # 1. Overlap avoidance forces
            for i in range(len(elements)):
                el_a = elements[i]
                is_ellipse_a = "cx_pct" in el_a and "rx_pct" in el_a
                w_a = el_a.get("width_pct", el_a.get("rx_pct", 0.0) * 2.0 if "rx_pct" in el_a else 0.0)
                h_a = el_a.get("height_pct", el_a.get("ry_pct", 0.0) * 2.0 if "ry_pct" in el_a else 0.0)
                cx_a = el_a.get("cx_pct", el_a.get("x_pct", 0.0) + w_a/2.0)
                cy_a = el_a.get("cy_pct", el_a.get("y_pct", 0.0) + h_a/2.0)
                type_a = el_a.get("type", "tower")
                
                for j in range(i + 1, len(elements)):
                    el_b = elements[j]
                    is_ellipse_b = "cx_pct" in el_b and "rx_pct" in el_b
                    w_b = el_b.get("width_pct", el_b.get("rx_pct", 0.0) * 2.0 if "rx_pct" in el_b else 0.0)
                    h_b = el_b.get("height_pct", el_b.get("ry_pct", 0.0) * 2.0 if "ry_pct" in el_b else 0.0)
                    cx_b = el_b.get("cx_pct", el_b.get("x_pct", 0.0) + w_b/2.0)
                    cy_b = el_b.get("cy_pct", el_b.get("y_pct", 0.0) + h_b/2.0)
                    type_b = el_b.get("type", "tower")
                    
                    required_gap = SETBACKS.get((type_a, type_b), SETBACKS.get((type_b, type_a), 0.02))
                    min_dist_x = (w_a + w_b) / 2.0 + required_gap
                    min_dist_y = (h_a + h_b) / 2.0 + required_gap
                    
                    dx = cx_b - cx_a
                    dy = cy_b - cy_a
                    dist = math.sqrt(dx*dx + dy*dy)
                    if dist < 1e-6:
                        dx, dy, dist = 0.01, 0.01, 0.01414
                    
                    min_dist = math.sqrt(min_dist_x*min_dist_x + min_dist_y*min_dist_y)
                    
                    if dist < min_dist:
                        overlap = min_dist - dist
                        # Push along the separation vector
                        push_x = (dx / dist) * overlap * 0.25
                        push_y = (dy / dist) * overlap * 0.25
                            
                        forces[el_a["id"]][0] -= push_x
                        forces[el_a["id"]][1] -= push_y
                        forces[el_b["id"]][0] += push_x
                        forces[el_b["id"]][1] += push_y
                        
            # 2. Apply forces and keep elements inside boundary
            for el in elements:
                is_ellipse = "cx_pct" in el and "rx_pct" in el
                w = el.get("width_pct", el.get("rx_pct", 0.0) * 2.0 if "rx_pct" in el else 0.0)
                h = el.get("height_pct", el.get("ry_pct", 0.0) * 2.0 if "ry_pct" in el else 0.0)
                
                if is_ellipse:
                    cx_el = el.get("cx_pct", 0.0)
                    cy_el = el.get("cy_pct", 0.0)
                else:
                    cx_el = el.get("x_pct", 0.0) + w/2.0
                    cy_el = el.get("y_pct", 0.0) + h/2.0
                    
                f_x, f_y = forces[el["id"]]
                cx_el += f_x
                cy_el += f_y
                
                if self.boundary_poly:
                    if is_ellipse:
                        pts = [(cx_el, cy_el), (cx_el - w/2.0, cy_el), (cx_el + w/2.0, cy_el), (cx_el, cy_el - h/2.0), (cx_el, cy_el + h/2.0)]
                    else:
                        pts = [(cx_el - w/2.0, cy_el - h/2.0), (cx_el + w/2.0, cy_el - h/2.0), (cx_el - w/2.0, cy_el + h/2.0), (cx_el + w/2.0, cy_el + h/2.0)]
                        
                    outside = [p for p in pts if not is_point_in_polygon(p[0], p[1], self.boundary_poly)]
                    if outside:
                        vx = self.cx - cx_el
                        vy = self.cy - cy_el
                        dist = math.sqrt(vx*vx + vy*vy) or 1.0
                        cx_el += (vx / dist) * 0.015
                        cy_el += (vy / dist) * 0.015
                else:
                    margin = 0.06
                    max_pos_x = 1.0 - margin - w/2.0
                    max_pos_y = 1.0 - margin - h/2.0
                    min_pos_x = margin + w/2.0
                    min_pos_y = margin + h/2.0
                    
                    if cx_el < min_pos_x: cx_el = min_pos_x
                    if cx_el > max_pos_x: cx_el = max_pos_x
                    if cy_el < min_pos_y: cy_el = min_pos_y
                    if cy_el > max_pos_y: cy_el = max_pos_y
                    
                if is_ellipse:
                    el["cx_pct"] = round(cx_el, 4)
                    el["cy_pct"] = round(cy_el, 4)
                else:
                    el["x_pct"] = round(cx_el - w/2.0, 4)
                    el["y_pct"] = round(cy_el - h/2.0, 4)
                    
        return elements
