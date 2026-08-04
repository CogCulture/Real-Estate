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

MAX_FAR = 2.5
MAX_COVERAGE_RATIO = 0.4
MIN_SETBACK_M = 6.0
PRIMARY_ROAD_WIDTH = 12.0
SECONDARY_ROAD_WIDTH = 9.0

def get_unit_size(unit_type_str: str) -> float:
    t = str(unit_type_str).upper().replace(" ", "")
    if "1BHK" in t: return 50.0
    if "2BHK" in t: return 80.0
    if "3.5BHK" in t: return 140.0
    if "3BHK" in t: return 120.0
    if "4BHK" in t: return 180.0
    if "PENTHOUSE" in t: return 250.0
    return 120.0

def compute_buildable_envelope(boundary_poly: list, setbacks_m: Any, site_width_m: float, site_height_m: float, green_area_pct: float) -> dict:
    if not boundary_poly:
        boundary_poly = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    
    poly_m = [[p[0] * site_width_m, p[1] * site_height_m] for p in boundary_poly]
    if len(poly_m) > 2 and poly_m[0] == poly_m[-1]:
        poly_m = poly_m[:-1]
    
    n = len(poly_m)
    
    def get_area(pts):
        a = 0.0
        num = len(pts)
        for i in range(num):
            x1, y1 = pts[i]
            x2, y2 = pts[(i+1)%num]
            a += (x1 * y2 - x2 * y1)
        return abs(a * 0.5)
        
    total_site_area_m2 = get_area(poly_m)
    
    a_sum = 0.0
    for i in range(n):
        x1, y1 = poly_m[i]
        x2, y2 = poly_m[(i+1)%n]
        a_sum += (x1 * y2 - x2 * y1)
        
    oriented_poly_m = list(poly_m)
    if a_sum < 0:
        oriented_poly_m.reverse()
        
    if isinstance(setbacks_m, dict):
        S_front = setbacks_m.get('front', 6.0)
        S_rear = setbacks_m.get('rear', 6.0)
        S_side = setbacks_m.get('side', 6.0)
    else:
        S_front = S_rear = S_side = float(setbacks_m)
        
    inset_poly_m = []
    normals = []
    edge_setbacks = []
    for i in range(n):
        p_curr = oriented_poly_m[i]
        p_next = oriented_poly_m[(i+1)%n]
        dx = p_next[0] - p_curr[0]
        dy = p_next[1] - p_curr[1]
        L = math.sqrt(dx*dx + dy*dy) or 1e-9
        ux = dx / L
        uy = dy / L
        nx = -uy
        ny = ux
        normals.append((nx, ny))
        
        mx = (p_curr[0] + p_next[0]) / 2.0
        my = (p_curr[1] + p_next[1]) / 2.0
        
        if abs(ux) > abs(uy):
            if my < site_height_m * 0.5:
                edge_setbacks.append(S_rear)
            else:
                edge_setbacks.append(S_front)
        else:
            edge_setbacks.append(S_side)
            
    for i in range(n):
        p_i = oriented_poly_m[i]
        n_prev_x, n_prev_y = normals[i-1]
        n_curr_x, n_curr_y = normals[i]
        S_prev = edge_setbacks[i-1]
        S_curr = edge_setbacks[i]
        
        d1 = p_i[0] * n_prev_x + p_i[1] * n_prev_y + S_prev
        d2 = p_i[0] * n_curr_x + p_i[1] * n_curr_y + S_curr
        
        det = n_prev_x * n_curr_y - n_prev_y * n_curr_x
        if abs(det) < 1e-4:
            avg_nx = (n_prev_x + n_curr_x) / 2.0
            avg_ny = (n_prev_y + n_curr_y) / 2.0
            avg_L = math.sqrt(avg_nx**2 + avg_ny**2) or 1.0
            avg_nx /= avg_L
            avg_ny /= avg_L
            avg_S = (S_prev + S_curr) / 2.0
            x = p_i[0] + avg_nx * avg_S
            y = p_i[1] + avg_ny * avg_S
        else:
            x = (d1 * n_curr_y - d2 * n_prev_y) / det
            y = (n_prev_x * d2 - n_curr_x * d1) / det
            
            shift_dx = x - p_i[0]
            shift_dy = y - p_i[1]
            shift_dist = math.sqrt(shift_dx**2 + shift_dy**2)
            max_shift = max(S_prev, S_curr) * 3.0
            if shift_dist > max_shift:
                scale = max_shift / shift_dist
                x = p_i[0] + shift_dx * scale
                y = p_i[1] + shift_dy * scale
                
        inset_poly_m.append([x, y])
        
    inset_poly = [[round(p[0]/site_width_m, 4), round(p[1]/site_height_m, 4)] for p in inset_poly_m]
    inset_area_m2 = get_area(inset_poly_m)
    
    road_corridor_area_m2 = total_site_area_m2 * 0.12
    green_area_m2 = total_site_area_m2 * (green_area_pct / 100.0)
    buildable_area_m2 = inset_area_m2 - road_corridor_area_m2 - green_area_m2
    if buildable_area_m2 < 0.05 * inset_area_m2:
        buildable_area_m2 = 0.05 * inset_area_m2
        
    return {
        "total_site_area_m2": total_site_area_m2,
        "inset_poly": inset_poly,
        "inset_area_m2": inset_area_m2,
        "road_corridor_area_m2": road_corridor_area_m2,
        "green_area_m2": green_area_m2,
        "buildable_area_m2": buildable_area_m2,
        "inset_min_x": min(p[0] for p in inset_poly),
        "inset_max_x": max(p[0] for p in inset_poly),
        "inset_min_y": min(p[1] for p in inset_poly),
        "inset_max_y": max(p[1] for p in inset_poly),
    }

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

        green_area_pct = 20.0
        if "project" in masterplan_json and "target_green_pct" in masterplan_json["project"]:
            green_area_pct = masterplan_json["project"]["target_green_pct"]
            
        setbacks = {"front": 6.0, "rear": 6.0, "side": 6.0}
        envelope = compute_buildable_envelope(boundary_poly, setbacks, site_width, site_height, green_area_pct)
        
        masterplan_json["boundary_violations"] = violations
        masterplan_json["site_width_m"] = site_width
        masterplan_json["site_height_m"] = site_height
        masterplan_json["buildable_area_available"] = envelope["inset_area_m2"]
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
    site_width = masterplan_json.get("site_width_m", 500.0)
    site_height = masterplan_json.get("site_height_m", 300.0)
    
    towers = masterplan_json.get("towers", [])
    amenities = masterplan_json.get("amenities", [])
    roads = masterplan_json.get("roads", [])
    
    # 2. Pairwise tower center distance validation
    for i in range(len(towers)):
        for j in range(i + 1, len(towers)):
            t1 = towers[i]
            t2 = towers[j]
            cx1 = t1.get("x_pct", 0) + t1.get("width_pct", 0) / 2
            cy1 = t1.get("y_pct", 0) + t1.get("height_pct", 0) / 2
            cx2 = t2.get("x_pct", 0) + t2.get("width_pct", 0) / 2
            cy2 = t2.get("y_pct", 0) + t2.get("height_pct", 0) / 2
            dist = math.sqrt((cx1 - cx2)**2 + (cy1 - cy2)**2)
            min_safe = (t1.get("width_pct", 0) + t2.get("width_pct", 0)) / 2 + 0.04
            if dist < min_safe:
                exists = any(c.get("element_a") == t1["id"] and c.get("element_b") == t2["id"] and c.get("type") == "tower_center_distance_violation" for c in conflicts)
                if not exists:
                    conflicts.append({
                        "element_a": t1["id"],
                        "element_b": t2["id"],
                        "type": "tower_center_distance_violation",
                        "distance": round(dist, 4),
                        "required_gap": round(min_safe, 4),
                        "severity": "critical"
                    })
                    
    # 3. Road self-intersection check
    def segments_intersect(p1, p2, p3, p4):
        def ccw(A, B, C):
            return (C[1]-A[1]) * (B[0]-A[0]) > (B[1]-A[1]) * (C[0]-A[0])
        return ccw(p1,p3,p4) != ccw(p2,p3,p4) and ccw(p1,p2,p3) != ccw(p1,p2,p4)

    for r in roads:
        pts = r.get("points", [])
        n_seg = len(pts) - 1
        self_intersects = False
        for i in range(n_seg):
            p1 = pts[i]
            p2 = pts[i+1]
            for j in range(i + 2, n_seg):
                if i == 0 and j == n_seg - 1 and pts[0] == pts[-1]:
                    continue
                p3 = pts[j]
                p4 = pts[j+1]
                if segments_intersect(p1, p2, p3, p4):
                    self_intersects = True
                    break
            if self_intersects:
                break
        if self_intersects:
            exists = any(v.get("element_id") == r.get("id") and v.get("violation") == "road self-intersection" for v in violations)
            if not exists:
                violations.append({
                    "element_id": r.get("id", "road"),
                    "element_type": "road",
                    "violation": "road self-intersection"
                })

    # 4. Green-area tolerance check (±5%)
    project_meta = masterplan_json.get("project", {})
    target_green = project_meta.get("target_green_pct", 20.0)
    land_use = masterplan_json.get("land_use", {})
    actual_green = land_use.get("parks_pct", 18.0)
    if abs(actual_green - target_green) > 5.0:
        exists = any(v.get("element_id") == "parks_pct" and "deviates from target" in v.get("violation", "") for v in violations)
        if not exists:
            violations.append({
                "element_id": "parks_pct",
                "element_type": "landscape",
                "violation": f"green area {actual_green}% deviates from target {target_green}% by more than 5%"
            })
            
    # 5. Road connectivity check (max 20m)
    max_dist_pct = 20.0 / min(site_width, site_height)
    for t in towers:
        tc_x = t.get("x_pct", 0) + t.get("width_pct", 0) / 2
        tc_y = t.get("y_pct", 0) + t.get("height_pct", 0) / 2
        min_road_dist = 999.0
        for r in roads:
            for pt in r.get("points", []):
                dist = math.sqrt((tc_x - pt[0])**2 + (tc_y - pt[1])**2)
                if dist < min_road_dist:
                    min_road_dist = dist
        if min_road_dist > max_dist_pct:
            exists = any(v.get("element_id") == t["id"] and v.get("violation") == "no road connectivity within 20m" for v in violations)
            if not exists:
                violations.append({
                    "element_id": t["id"],
                    "element_type": "tower",
                    "violation": "no road connectivity within 20m",
                    "value": round(min_road_dist * min(site_width, site_height), 2)
                })

    # 6. Calculate quality score and issue counts
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
        if v.get("element_id") == "parks_pct":
            score -= 5
            warning_count += 1
        elif "utilization" in v.get("violation", ""):
            pass
        else:
            score -= 8
            if v.get("element_type") == "road" or v.get("violation") == "no road connectivity within 20m":
                critical_count += 1
            else:
                warning_count += 1
                
    if len(towers) < 4 or len(towers) > 16:
        score -= 15
        
    has_lawn = any(a.get("type") in ["central_lawn", "lawn", "park"] or "lawn" in a.get("label", "").lower() for a in amenities)
    has_clubhouse = any(a.get("type") == "clubhouse" or "clubhouse" in a.get("label", "").lower() for a in amenities)
    
    if not has_lawn:
        score -= 10
    if not has_clubhouse:
        score -= 10
        
    entries = masterplan_json.get("entry_points", [])
    if len(entries) == 0:
        score -= 15
        
    # 7. Calculate utilization percentage
    buildable_area_available = masterplan_json.get("buildable_area_available", site_width * site_height * 0.7)
    buildable_area_actually_used = 0.0
    for t in towers:
        buildable_area_actually_used += t.get("width_pct", 0) * site_width * t.get("height_pct", 0) * site_height
    for a in amenities:
        if a.get("shape") == "ellipse" or ("rx_pct" in a and "ry_pct" in a):
            rx = a.get("rx_pct", a.get("width_pct", 0)/2)
            ry = a.get("ry_pct", a.get("height_pct", 0)/2)
            buildable_area_actually_used += math.pi * rx * site_width * ry * site_height
        else:
            buildable_area_actually_used += a.get("width_pct", 0) * site_width * a.get("height_pct", 0) * site_height
            
    utilization_pct = 0.0
    if buildable_area_available > 0:
        utilization_pct = (buildable_area_actually_used / buildable_area_available) * 100.0
        
    if "project" in masterplan_json:
        masterplan_json["project"]["utilization_pct"] = round(utilization_pct, 2)
        
    if utilization_pct < 60.0:
        warning_count += 1
        diff_pct = 60.0 - utilization_pct
        utilization_penalty = int(round(diff_pct * 0.6))
        score -= utilization_penalty
        exists = any(v.get("element_id") == "utilization" for v in violations)
        if not exists:
            violations.append({
                "element_id": "utilization",
                "element_type": "project",
                "violation": f"utilization_pct {round(utilization_pct, 1)}% is below 60% (penalty: {utilization_penalty} pts)",
                "value": round(utilization_pct, 1)
            })

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
        "quality_score": max(0, score),
        "grade": grade,
        "total_conflicts": len(conflicts),
        "critical_count": critical_count,
        "warning_count": warning_count,
        "boundary_violations": len(violations),
        "conflicts": conflicts,
        "boundary_violations_list": violations,
        "passed": passed,
        "summary": " ".join(summary_parts),
        "utilization_pct": round(utilization_pct, 2)
    }

def resolve_layout(masterplan_json: dict, boundary_poly: list = None) -> dict:
    towers = masterplan_json.get("towers", [])
    amenities = masterplan_json.get("amenities", [])
    roads = masterplan_json.get("roads", [])
    paths = masterplan_json.get("pedestrian_paths", [])
    
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
    solver.solve(elements, iterations=100, roads=roads, paths=paths)
    
    # Update back to masterplan_json
    masterplan_json["towers"] = towers
    masterplan_json["amenities"] = amenities
    masterplan_json["roads"] = roads
    masterplan_json["pedestrian_paths"] = paths
    return masterplan_json

def _inset_polygon(poly, offset):
    """Inset a polygon by offset (in pct units). Returns new polygon or original if degenerate."""
    if len(poly) < 3:
        return poly
    pts = list(poly)
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    n = len(pts)

    # Compute signed area to determine winding
    area = sum(pts[i][0] * pts[(i+1) % n][1] - pts[(i+1) % n][0] * pts[i][1] for i in range(n))
    ccw = area > 0  # counter-clockwise

    inset = []
    for i in range(n):
        prev = pts[(i - 1) % n]
        curr = pts[i]
        nxt  = pts[(i + 1) % n]

        def edge_normal(a, b):
            dx, dy = b[0] - a[0], b[1] - a[1]
            length = math.hypot(dx, dy)
            if length < 1e-9:
                return (0, 0)
            # Inward normal depends on winding
            if ccw:
                return (-dy / length, dx / length)
            else:
                return (dy / length, -dx / length)

        n1 = edge_normal(prev, curr)
        n2 = edge_normal(curr, nxt)

        bx = n1[0] + n2[0]
        by = n1[1] + n2[1]
        blen = math.hypot(bx, by)
        if blen < 1e-9:
            inset.append([curr[0] + n1[0] * offset, curr[1] + n1[1] * offset])
            continue

        bx /= blen
        by /= blen
        dot = bx * n1[0] + by * n1[1]
        if abs(dot) < 1e-9:
            length = offset
        else:
            length = offset / dot
        length = max(-abs(offset) * 5, min(abs(offset) * 5, length))
        inset.append([round(curr[0] + bx * length, 4), round(curr[1] + by * length, 4)])

    # Close
    inset.append([inset[0][0], inset[0][1]])
    return inset


def _grid_cells_in_polygon(poly, cell_w, cell_h, pad_x=0, pad_y=0):
    """Return list of (cx, cy) grid cell centres that fall inside poly."""
    if not poly or len(poly) < 3:
        return []
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    cells = []
    x = min_x + cell_w / 2 + pad_x
    while x < max_x - pad_x:
        y = min_y + cell_h / 2 + pad_y
        while y < max_y - pad_y:
            c1 = is_point_in_polygon(x - cell_w / 2, y - cell_h / 2, poly)
            c2 = is_point_in_polygon(x + cell_w / 2, y - cell_h / 2, poly)
            c3 = is_point_in_polygon(x + cell_w / 2, y + cell_h / 2, poly)
            c4 = is_point_in_polygon(x - cell_w / 2, y + cell_h / 2, poly)
            if c1 and c2 and c3 and c4:
                cells.append((round(x, 4), round(y, 4)))
            y += cell_h
        x += cell_w
    return cells


def _find_valid_amenity_position(w, h, used_positions, inset_poly, cx, cy):
    # Try a grid of candidates
    candidates = _grid_cells_in_polygon(inset_poly, w * 1.2, h * 1.2)
    # Sort candidates by distance to centroid (prefer near centroid)
    candidates.sort(key=lambda p: math.hypot(p[0] - cx, p[1] - cy))
    
    for cc_x, cc_y in candidates:
        corners = [
            (cc_x - w / 2, cc_y - h / 2),
            (cc_x + w / 2, cc_y - h / 2),
            (cc_x + w / 2, cc_y + h / 2),
            (cc_x - w / 2, cc_y + h / 2),
            (cc_x, cc_y)
        ]
        
        all_inside = all(is_point_in_polygon(px, py, inset_poly) for px, py in corners)
        if not all_inside:
            continue
            
        # Check overlap
        overlap = False
        for ux, uy, uw, uh in used_positions:
            if not (cc_x + w/2 < ux - uw/2 or cc_x - w/2 > ux + uw/2 or cc_y + h/2 < uy - uh/2 or cc_y - h/2 > uy + uh/2):
                overlap = True
                break
        if not overlap:
            return cc_x, cc_y
            
    # Spiral search
    for r in [0.05, 0.1, 0.15, 0.2, 0.25, 0.3]:
        for angle in range(0, 360, 45):
            rad = math.radians(angle)
            cc_x = cx + math.cos(rad) * r
            cc_y = cy + math.sin(rad) * r
            corners = [
                (cc_x - w / 2, cc_y - h / 2),
                (cc_x + w / 2, cc_y - h / 2),
                (cc_x + w / 2, cc_y + h / 2),
                (cc_x - w / 2, cc_y + h / 2),
                (cc_x, cc_y)
            ]
            if all(is_point_in_polygon(px, py, inset_poly) for px, py in corners):
                overlap = False
                for ux, uy, uw, uh in used_positions:
                    if not (cc_x + w/2 < ux - uw/2 or cc_x - w/2 > ux + uw/2 or cc_y + h/2 < uy - uh/2 or cc_y - h/2 > uy + uh/2):
                        overlap = True
                        break
                if not overlap:
                    return cc_x, cc_y
                    
    return cx, cy


def generate_procedural_fallback(site_width_m: float, site_height_m: float, project_features: dict = None, boundary_poly: list = None) -> dict:
    import random

    # ── 1. Buildable envelope ────────────────────────────────────────────────
    green_area_pct = 20.0
    if project_features and "green_area_pct" in project_features:
        try:
            green_area_pct = float(project_features["green_area_pct"])
        except ValueError:
            pass

    setbacks = {
        'front': project_features.get('front_setback_m', 6.0) if project_features else 6.0,
        'rear':  project_features.get('rear_setback_m',  6.0) if project_features else 6.0,
        'side':  project_features.get('side_setback_m',  6.0) if project_features else 6.0,
    }

    envelope       = compute_buildable_envelope(boundary_poly, setbacks, site_width_m, site_height_m, green_area_pct)
    buildable_area = envelope["inset_area_m2"]

    min_x = envelope["inset_min_x"]
    max_x = envelope["inset_max_x"]
    min_y = envelope["inset_min_y"]
    max_y = envelope["inset_max_y"]
    bw    = max_x - min_x
    bh    = max_y - min_y

    if boundary_poly:
        cx, cy = get_polygon_centroid(boundary_poly)
    else:
        cx, cy = 0.5, 0.52

    # Build a pct-space inset polygon from the envelope for all placement
    if boundary_poly and len(boundary_poly) >= 3:
        inset_offset = min(bw, bh) * 0.08        # ~8% of shorter dimension
        inset_poly   = _inset_polygon(boundary_poly, inset_offset)
    else:
        # Fallback: rectangular inset polygon
        inset_poly = [
            [min_x, min_y], [max_x, min_y],
            [max_x, max_y], [min_x, max_y],
            [min_x, min_y],
        ]

    # ── 2. Tower dimensions & count ─────────────────────────────────────────
    names  = ["Elysian Heights", "Pinecrest Groves", "Vanderbilt Meadows",
              "Amberwood Reserve", "Orchard Ridge", "Windermere Oasis"]
    themes = ["Modern Wellness Sanctuary", "European Heritage Estates",
              "Classic Contemporary Garden Living", "Neo-Classical Township Retreat"]
    name   = random.choice(names)
    theme  = random.choice(themes)
    if project_features:
        theme = project_features.get("theme", theme) or theme

    floors          = 24
    units_per_tower = 120
    unit_type       = "3BHK"

    if project_features:
        units_per_tower = project_features.get("units", units_per_tower)
        floors          = project_features.get("floors", floors)
        us = project_features.get("unit_specifications", {})
        if isinstance(us, dict):
            floors          = us.get("floors",          us.get("avg_floors",      floors))
            units_per_tower = us.get("units",            us.get("units_per_tower", units_per_tower))
            unit_type       = us.get("unit_type",        us.get("type",            unit_type))

    try:    floors          = int(floors)
    except: floors          = 24
    try:    units_per_tower = int(units_per_tower)
    except: units_per_tower = 120

    avg_unit_size    = get_unit_size(unit_type)
    footprint_area_sqm = (units_per_tower * avg_unit_size) / floors

    num_towers = 8
    if project_features and "total_towers" in project_features:
        try: num_towers = int(project_features["total_towers"])
        except: pass
    num_towers = max(4, min(16, num_towers))

    max_footprint_budget = MAX_COVERAGE_RATIO * buildable_area
    max_floor_budget     = MAX_FAR * buildable_area

    while num_towers > 4 and (
        num_towers * footprint_area_sqm > max_footprint_budget or
        num_towers * units_per_tower * avg_unit_size > max_floor_budget
    ):
        num_towers -= 1

    total_footprint = num_towers * footprint_area_sqm
    total_floor     = num_towers * units_per_tower * avg_unit_size
    if total_footprint > max_footprint_budget or total_floor > max_floor_budget:
        scale = min(max_footprint_budget / total_footprint, max_floor_budget / total_floor)
        footprint_area_sqm *= scale

    th_m = math.sqrt(footprint_area_sqm / 1.3)
    tw_m = th_m * 1.3
    th_m = max(12.0, min(40.0, th_m))
    tw_m = max(15.0, min(50.0, tw_m))

    tw = round(tw_m / site_width_m,  4)
    th = round(th_m / site_height_m, 4)

    actual_footprint_area  = num_towers * (tw_m * th_m)
    actual_floor_area      = num_towers * (tw_m * th_m * floors)
    actual_coverage_ratio  = actual_footprint_area  / buildable_area
    actual_far             = actual_floor_area / buildable_area

    # ── 3. Entry points ─────────────────────────────────────────────────────
    entry_x     = round(0.45 + random.random() * 0.1, 4)
    entry_points = [
        {"id": "main_entry",      "side": "south", "x_pct": entry_x,
         "y_pct": round(max_y, 4), "type": "main",      "label": "Main Entry / Exit"},
        {"id": "secondary_entry", "side": "north", "x_pct": entry_x,
         "y_pct": round(min_y, 4), "type": "secondary", "label": "Secondary Entry / Exit"},
    ]

    # ── 4. Tower placement — polygon-aware grid ──────────────────────────────
    # Build grid of candidate cells inside the inset polygon
    # Cell spacing = tower footprint + gap
    gap_w = tw * 0.6
    gap_h = th * 0.6
    cell_w = tw + gap_w
    cell_h = th + gap_h

    candidates = _grid_cells_in_polygon(inset_poly, cell_w, cell_h)

    # Sort: prefer cells near the polygon boundary first (perimeter-first placement)
    # gives the "ring of towers around the centre" feel without an ellipse
    def dist_to_centroid(cell):
        return math.hypot(cell[0] - cx, cell[1] - cy)

    candidates.sort(key=dist_to_centroid, reverse=True)  # perimeter first

    # Trim or expand candidate list to exactly num_towers
    if len(candidates) >= num_towers:
        # Pick evenly-spaced subset around the perimeter
        step = len(candidates) / num_towers
        chosen = [candidates[int(i * step) % len(candidates)] for i in range(num_towers)]
    elif candidates:
        # Fewer cells than towers — repeat as needed
        chosen = (candidates * ((num_towers // len(candidates)) + 1))[:num_towers]
    else:
        # Absolute fallback: use centroid with offsets
        chosen = [(cx + (i - num_towers / 2) * tw * 1.5, cy) for i in range(num_towers)]

    footprints = ["cruciform", "h_shaped", "u_shaped", "courtyard"]
    towers = []
    for i, (tcx, tcy) in enumerate(chosen):
        letter = chr(65 + i)
        towers.append({
            "id":                  f"tower_{letter.lower()}",
            "label":               f"Tower {letter}",
            "footprint":           random.choice(footprints),
            "x_pct":               round(tcx - tw / 2, 4),
            "y_pct":               round(tcy - th / 2, 4),
            "width_pct":           tw,
            "height_pct":          th,
            "rotation_deg":        0,
            "floors":              floors,
            "units":               units_per_tower,
            "unit_type":           unit_type,
            "has_arrival_plaza":   True,
            "has_drop_off_loop":   True,
            "has_landscape_buffer": True,
        })

    # ── 5. Roads — polygon-inset ring instead of ellipse ────────────────────
    # Ring road: inset the inset_poly by another 8% to sit between towers and centre
    ring_offset  = min(bw, bh) * 0.14
    ring_poly    = _inset_polygon(boundary_poly if boundary_poly else inset_poly, ring_offset)

    # Jogging track: slightly larger inset (closer to towers)
    jog_offset   = min(bw, bh) * 0.05
    jog_poly     = _inset_polygon(boundary_poly if boundary_poly else inset_poly, jog_offset)

    south_loop_pt = min(ring_poly, key=lambda p: -p[1])  # southernmost
    north_loop_pt = min(ring_poly, key=lambda p:  p[1])  # northernmost

    south_entry_pts = [
        [entry_points[0]["x_pct"], entry_points[0]["y_pct"]],
        [round(south_loop_pt[0],  4), round(south_loop_pt[1], 4)],
    ]
    north_entry_pts = [
        [entry_points[1]["x_pct"], entry_points[1]["y_pct"]],
        [round(north_loop_pt[0],  4), round(north_loop_pt[1], 4)],
    ]

    roads = [
        {"id": "south_entry", "type": "primary",      "width_meters": 12, "points": south_entry_pts, "tension": 0.0, "has_median": True,  "has_sidewalks": True, "has_trees": True},
        {"id": "north_entry", "type": "primary",      "width_meters": 12, "points": north_entry_pts, "tension": 0.0, "has_sidewalks": True,"has_trees": True},
        {"id": "inner_loop",  "type": "ring_primary", "width_meters":  9, "points": ring_poly,       "tension": 0.3, "has_sidewalks": True,"has_trees": True},
    ]

    # Spur roads: each tower connects to nearest point on ring
    for t in towers:
        tc_x = t["x_pct"] + t["width_pct"] / 2
        tc_y = t["y_pct"] + t["height_pct"] / 2
        
        # Sort ring points by distance to tower center
        sorted_ring_pts = sorted(ring_poly[:-1], key=lambda p: (p[0]-tc_x)**2 + (p[1]-tc_y)**2)
        
        chosen_conn = None
        for candidate in sorted_ring_pts:
            # Check containment of 10 sampled points along the spur segment
            valid = True
            for step in range(1, 10):
                t_factor = step / 10.0
                sx = tc_x + (candidate[0] - tc_x) * t_factor
                sy = tc_y + (candidate[1] - tc_y) * t_factor
                if not is_point_in_polygon(sx, sy, inset_poly):
                    valid = False
                    break
            if valid:
                chosen_conn = candidate
                break
                
        # Fallback to the absolute closest one if no fully contained spur segment was found
        if not chosen_conn and sorted_ring_pts:
            chosen_conn = sorted_ring_pts[0]
            
        if chosen_conn:
            roads.append({
                "id":           f"spur_{t['id']}",
                "type":         "ring_secondary",
                "width_meters": 6,
                "points":       [[round(tc_x, 4), round(tc_y, 4)], [round(chosen_conn[0], 4), round(chosen_conn[1], 4)]],
                "tension":      0.0,
            })

    # ── 6. Amenities — placed inside the inset polygon near the centroid ───────────────────
    clubhouse_w = min(40.0 / site_width_m,  0.12)
    clubhouse_h = min(25.0 / site_height_m, 0.08)
    
    pool_w = min(25.0 / site_width_m,  0.08)
    pool_h = min(12.0 / site_height_m, 0.04)
    
    lawn_w = min(bw * 0.22, 0.14)
    lawn_h = min(bh * 0.22, 0.10)
    
    tennis_w = min(24.0 / site_width_m,  0.07)
    tennis_h = min(11.0 / site_height_m, 0.04)
    
    kids_w = min(15.0 / site_width_m,  0.05)
    kids_h = min(15.0 / site_height_m, 0.05)

    used_positions = []
    for t in towers:
        tw_val = t["width_pct"]
        th_val = t["height_pct"]
        tcx = t["x_pct"] + tw_val / 2
        tcy = t["y_pct"] + th_val / 2
        used_positions.append((tcx, tcy, tw_val, th_val))

    ch_x, ch_y = _find_valid_amenity_position(clubhouse_w, clubhouse_h, used_positions, inset_poly, cx, cy)
    used_positions.append((ch_x, ch_y, clubhouse_w, clubhouse_h))
    
    pool_x, pool_y = _find_valid_amenity_position(pool_w, pool_h, used_positions, inset_poly, ch_x, ch_y)
    used_positions.append((pool_x, pool_y, pool_w, pool_h))
    
    lawn_x, lawn_y = _find_valid_amenity_position(lawn_w, lawn_h, used_positions, inset_poly, cx, cy)
    used_positions.append((lawn_x, lawn_y, lawn_w, lawn_h))
    
    tennis_x, tennis_y = _find_valid_amenity_position(tennis_w, tennis_h, used_positions, inset_poly, cx, cy)
    used_positions.append((tennis_x, tennis_y, tennis_w, tennis_h))
    
    kids_x, kids_y = _find_valid_amenity_position(kids_w, kids_h, used_positions, inset_poly, cx, cy)

    amenities = [
        {"id": "clubhouse",    "type": "clubhouse",    "label": "Grand Clubhouse", "shape": "rect",    "x_pct": round(ch_x - clubhouse_w/2, 4), "y_pct": round(ch_y - clubhouse_h/2, 4), "width_pct": round(clubhouse_w, 4), "height_pct": round(clubhouse_h, 4)},
        {"id": "swimming_pool","type": "pool",          "label": "Luxury Pool",     "shape": "rect",    "x_pct": round(pool_x - pool_w/2,      4), "y_pct": round(pool_y - pool_h/2,      4), "width_pct": round(pool_w,      4), "height_pct": round(pool_h,      4)},
        {"id": "central_lawn", "type": "central_lawn",  "label": "Central Green",   "shape": "rect",    "x_pct": round(lawn_x - lawn_w/2,      4), "y_pct": round(lawn_y - lawn_h/2,      4), "width_pct": round(lawn_w,      4), "height_pct": round(lawn_h,      4)},
        {"id": "tennis_court", "type": "sports",        "label": "Tennis Court",    "shape": "rect",    "x_pct": round(tennis_x - tennis_w/2,    4), "y_pct": round(tennis_y - tennis_h/2,    4), "width_pct": round(tennis_w,    4), "height_pct": round(tennis_h,    4)},
        {"id": "kids_play",    "type": "kids",          "label": "Kids Play Zone",  "shape": "rect",    "x_pct": round(kids_x - kids_w/2,      4), "y_pct": round(kids_y - kids_h/2,      4), "width_pct": round(kids_w,      4), "height_pct": round(kids_h,      4)},
    ]

    # ── 7. Jogging track — polygon inset ────────────────────────────────────
    pedestrian_paths = [
        {"id": "jogging_track", "type": "pedestrian", "points": jog_poly, "tension": 0.3, "width_meters": 2},
    ]

    # ── 8. Tree clusters — fill perimeter grid cells not used by towers ──────
    tree_candidates = _grid_cells_in_polygon(jog_poly, tw * 1.2, th * 1.2)
    tower_centres   = {(t["x_pct"] + t["width_pct"]/2, t["y_pct"] + t["height_pct"]/2) for t in towers}
    tree_clusters   = []
    used = 0
    for (tcx, tcy) in reversed(tree_candidates):  # reversed = perimeter first
        too_close = any(math.hypot(tcx - px, tcy - py) < tw * 1.5 for (px, py) in tower_centres)
        if not too_close:
            tree_clusters.append({
                "id":        f"tc_{used}",
                "cx_pct":    round(tcx, 4),
                "cy_pct":    round(tcy, 4),
                "radius_pct": 0.025,
                "density":   "medium",
            })
            used += 1
            if used >= num_towers:
                break

    return {
        "project": {
            "name":                   name,
            "total_area_acres":       round((site_width_m * site_height_m) / 4047.0, 2),
            "total_towers":           num_towers,
            "theme":                  theme,
            "actual_coverage_ratio":  round(actual_coverage_ratio, 4),
            "actual_far":             round(actual_far, 4),
            "utilization_pct":        0.0,
        },
        "land_use": {
            "residential_pct":   round(actual_coverage_ratio * 100.0, 2),
            "roads_pct":         12.0,
            "amenities_pct":     8.0,
            "open_spaces_pct":   round(100.0 - actual_coverage_ratio * 100.0 - 20.0, 2),
            "parks_pct":         green_area_pct,
        },
        "entry_points":    entry_points,
        "roads":           roads,
        "towers":          towers,
        "amenities":       amenities,
        "pedestrian_paths": pedestrian_paths,
        "landscape": {
            "tree_clusters":  tree_clusters,
            "water_features": [],
            "green_buffers":  [],
        },
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

def nearest_point_on_polygon(x: float, y: float, poly: list) -> tuple:
    if not poly or len(poly) < 3:
        return x, y
    best_dist = float('inf')
    best_pt = (x, y)
    best_normal = (0.0, 0.0)
    
    n = len(poly)
    loop_limit = n
    if n > 1 and poly[0] == poly[-1]:
        loop_limit = n - 1
        
    for i in range(loop_limit):
        a = poly[i]
        b = poly[(i + 1) % n]
        
        ax, ay = a[0], a[1]
        bx, by = b[0], b[1]
        
        dx = bx - ax
        dy = by - ay
        seg_len_sq = dx * dx + dy * dy
        
        if seg_len_sq < 1e-12:
            proj_x, proj_y = ax, ay
            nx, ny = 0.0, 0.0
        else:
            t = ((x - ax) * dx + (y - ay) * dy) / seg_len_sq
            t = max(0.0, min(1.0, t))
            proj_x = ax + t * dx
            proj_y = ay + t * dy
            
            # Perpendicular vector to AB
            nx = -dy
            ny = dx
            n_len = math.sqrt(nx*nx + ny*ny)
            nx /= n_len
            ny /= n_len
            
            # Find which direction points inward
            eps = 1e-5
            test_x = proj_x + nx * eps
            test_y = proj_y + ny * eps
            if not is_point_in_polygon(test_x, test_y, poly):
                nx = -nx
                ny = -ny
                
        dist_x = x - proj_x
        dist_y = y - proj_y
        dist = math.sqrt(dist_x * dist_x + dist_y * dist_y)
        
        if dist < best_dist:
            best_dist = dist
            best_pt = (proj_x, proj_y)
            best_normal = (nx, ny)
            
    epsilon = 0.005
    target_x = best_pt[0] + best_normal[0] * epsilon
    target_y = best_pt[1] + best_normal[1] * epsilon
    return target_x, target_y


class ConstraintSolver:
    def __init__(self, boundary_poly: list = None, site_width: float = 500.0, site_height: float = 300.0):
        self.boundary_poly = boundary_poly
        self.site_width = site_width
        self.site_height = site_height
        if boundary_poly:
            self.cx, self.cy = get_polygon_centroid(boundary_poly)
        else:
            self.cx, self.cy = 0.5, 0.52
            
    def solve(self, elements: list, iterations: int = 100, roads: list = None, paths: list = None) -> list:
        if roads is None: roads = []
        if paths is None: paths = []
        
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
                        cx_el, cy_el = nearest_point_on_polygon(cx_el, cy_el, self.boundary_poly)
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
                    
            # 3. Correct roads and paths boundary violations
            if self.boundary_poly:
                for r in roads:
                    points = r.get("points", [])
                    for pt in points:
                        if len(pt) >= 2:
                            rx, ry = pt[0], pt[1]
                            if not is_point_in_polygon(rx, ry, self.boundary_poly):
                                npx, npy = nearest_point_on_polygon(rx, ry, self.boundary_poly)
                                pt[0] = round(npx, 4)
                                pt[1] = round(npy, 4)
                                
                for p in paths:
                    points = p.get("points", [])
                    for pt in points:
                        if len(pt) >= 2:
                            rx, ry = pt[0], pt[1]
                            if not is_point_in_polygon(rx, ry, self.boundary_poly):
                                npx, npy = nearest_point_on_polygon(rx, ry, self.boundary_poly)
                                pt[0] = round(npx, 4)
                                pt[1] = round(npy, 4)
                                
        return elements
