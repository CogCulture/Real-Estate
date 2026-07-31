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

def generate_procedural_fallback(site_width_m: float, site_height_m: float, project_features: dict = None, boundary_poly: list = None) -> dict:
    import random
    
    # 1. Calculate buildable envelope and target metrics
    green_area_pct = 20.0
    if project_features and "green_area_pct" in project_features:
        try:
            green_area_pct = float(project_features["green_area_pct"])
        except ValueError:
            pass
            
    setbacks = {
        'front': project_features.get('front_setback_m', 6.0) if project_features else 6.0,
        'rear': project_features.get('rear_setback_m', 6.0) if project_features else 6.0,
        'side': project_features.get('side_setback_m', 6.0) if project_features else 6.0
    }
    
    envelope = compute_buildable_envelope(boundary_poly, setbacks, site_width_m, site_height_m, green_area_pct)
    buildable_area = envelope["inset_area_m2"]
    
    min_x = envelope["inset_min_x"]
    max_x = envelope["inset_max_x"]
    min_y = envelope["inset_min_y"]
    max_y = envelope["inset_max_y"]
    
    bw = max_x - min_x
    bh = max_y - min_y
    
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
            
    # 2. Extract BHK inputs and determine tower dimensions and counts
    floors = 24
    units_per_tower = 120
    unit_type = "3BHK"
    
    if project_features:
        units_per_tower = project_features.get("units", units_per_tower)
        floors = project_features.get("floors", floors)
        us = project_features.get("unit_specifications", {})
        if isinstance(us, dict):
            floors = us.get("floors", us.get("avg_floors", floors))
            units_per_tower = us.get("units", us.get("units_per_tower", units_per_tower))
            unit_type = us.get("unit_type", us.get("type", unit_type))
            
    try: floors = int(floors)
    except: floors = 24
    try: units_per_tower = int(units_per_tower)
    except: units_per_tower = 120
    
    avg_unit_size = get_unit_size(unit_type)
    
    # Starting tower count
    num_towers = 8
    if project_features and "total_towers" in project_features:
        try: num_towers = int(project_features["total_towers"])
        except: pass
    num_towers = max(4, min(16, num_towers))
    
    footprint_area_sqm = (units_per_tower * avg_unit_size) / floors
    
    # Check constraints and adjust down tower count if needed, then scale footprints if still needed
    max_footprint_budget = MAX_COVERAGE_RATIO * buildable_area
    max_floor_budget = MAX_FAR * buildable_area
    
    while num_towers > 4 and (num_towers * footprint_area_sqm > max_footprint_budget or 
                             num_towers * units_per_tower * avg_unit_size > max_floor_budget):
        num_towers -= 1
        
    # If still exceeding at 4 towers, shrink the footprint area
    total_footprint = num_towers * footprint_area_sqm
    total_floor = num_towers * units_per_tower * avg_unit_size
    
    if total_footprint > max_footprint_budget or total_floor > max_floor_budget:
        scale = min(max_footprint_budget / total_footprint, max_floor_budget / total_floor)
        footprint_area_sqm *= scale
        
    # Standard aspect ratio for a tower footprint is 1.3
    th_m = math.sqrt(footprint_area_sqm / 1.3)
    tw_m = th_m * 1.3
    
    # Clamp physically
    th_m = max(12.0, min(40.0, th_m))
    tw_m = max(15.0, min(50.0, tw_m))
    
    tw = round(tw_m / site_width_m, 4)
    th = round(th_m / site_height_m, 4)
    
    actual_footprint_area = num_towers * (tw_m * th_m)
    actual_floor_area = num_towers * (tw_m * th_m * floors)
    actual_coverage_ratio = actual_footprint_area / buildable_area
    actual_far = actual_floor_area / buildable_area
    
    # 3. Entry points
    entry_x = 0.45 + random.random() * 0.1
    entry_points = [
        { "id": "main_entry", "side": "south", "x_pct": round(entry_x, 4), "y_pct": round(max_y, 4), "type": "main", "label": "Main Entry / Exit" },
        { "id": "secondary_entry", "side": "north", "x_pct": round(entry_x + (random.random() * 0.08 - 0.04), 4), "y_pct": round(min_y, 4), "type": "secondary", "label": "Secondary Entry / Exit" }
    ]
    
    # 4. Towers placement along the ellipse
    towers = []
    footprints = ["cruciform", "h_shaped", "u_shaped", "courtyard"]
    rotations = [0, 45, 90, 135]
    
    rx_towers = bw * 0.35
    ry_towers = bh * 0.35
    
    for i in range(num_towers):
        angle = (i * 2 * math.pi) / num_towers
        tx = cx + math.cos(angle) * rx_towers
        ty = cy + math.sin(angle) * ry_towers
        letter = chr(65 + i)
        
        towers.append({
            "id": f"tower_{letter.lower()}",
            "label": f"Tower {letter}",
            "footprint": random.choice(footprints),
            "x_pct": round(tx - tw / 2, 4),
            "y_pct": round(ty - th / 2, 4),
            "width_pct": tw,
            "height_pct": th,
            "rotation_deg": random.choice(rotations),
            "floors": floors,
            "units": units_per_tower,
            "unit_type": unit_type,
            "has_arrival_plaza": True,
            "has_drop_off_loop": True,
            "has_landscape_buffer": True
        })
        
    # 5. Roads
    rx_loop = max(0.10, rx_towers - 0.10 * bw)
    ry_loop = max(0.10, ry_towers - 0.10 * bh)
    
    # South entry road (from entry_points[0] to southern edge of loop)
    south_loop_y = cy + ry_loop
    south_entry_pts = [
        [entry_points[0]["x_pct"], entry_points[0]["y_pct"]],
        [round(cx, 4), round(south_loop_y, 4)]
    ]
    
    # North entry road (from entry_points[1] to northern edge of loop)
    north_loop_y = cy - ry_loop
    north_entry_pts = [
        [entry_points[1]["x_pct"], entry_points[1]["y_pct"]],
        [round(cx, 4), round(north_loop_y, 4)]
    ]
    
    # Inner loop points
    inner_loop_pts = []
    loop_num_pts = max(8, num_towers)
    for i in range(loop_num_pts):
        angle = (i * 2 * math.pi) / loop_num_pts
        lx = cx + math.cos(angle) * rx_loop
        ly = cy + math.sin(angle) * ry_loop
        inner_loop_pts.append([round(lx, 4), round(ly, 4)])
    inner_loop_pts.append([inner_loop_pts[0][0], inner_loop_pts[0][1]])
    
    roads = [
        { "id": "south_entry", "type": "primary", "width_meters": 12, "points": south_entry_pts, "tension": 0.0, "has_median": True, "has_sidewalks": True, "has_trees": True },
        { "id": "north_entry", "type": "primary", "width_meters": 12, "points": north_entry_pts, "tension": 0.0, "has_sidewalks": True, "has_trees": True },
        { "id": "inner_loop", "type": "ring_primary", "width_meters": 9, "points": inner_loop_pts, "tension": 0.4, "has_sidewalks": True, "has_trees": True }
    ]
    
    for t in towers:
        tc_x = t["x_pct"] + t["width_pct"]/2
        tc_y = t["y_pct"] + t["height_pct"]/2
        closest_pt = min(inner_loop_pts[:-1], key=lambda p: (p[0] - tc_x)**2 + (p[1] - tc_y)**2)
        roads.append({
            "id": f"spur_{t['id']}",
            "type": "ring_secondary",
            "width_meters": 6,
            "points": [[round(tc_x, 4), round(tc_y, 4)], [round(closest_pt[0], 4), round(closest_pt[1], 4)]],
            "tension": 0.0
        })
        
    # 6. Amenities
    clubhouse_w = min(40.0 / site_width_m, 0.12)
    clubhouse_h = min(25.0 / site_height_m, 0.08)
    clubhouse_x = cx - clubhouse_w / 2
    clubhouse_y = cy - 0.08 * bh
    
    pool_w = min(25.0 / site_width_m, 0.08)
    pool_h = min(12.0 / site_height_m, 0.04)
    pool_x = clubhouse_x + clubhouse_w + 0.02
    pool_y = clubhouse_y + (clubhouse_h - pool_h) / 2
    
    target_lawn_area = envelope["green_area_m2"]
    lawn_ry_m = math.sqrt(target_lawn_area / (1.2 * math.pi))
    lawn_rx_m = 1.2 * lawn_ry_m
    
    lawn_rx = round(lawn_rx_m / site_width_m, 4)
    lawn_ry = round(lawn_ry_m / site_height_m, 4)
    lawn_rx = max(0.03, min(0.12, lawn_rx))
    lawn_ry = max(0.025, min(0.10, lawn_ry))
    
    lawn_cx = cx
    lawn_cy = cy + 0.08 * bh
    
    tennis_w = min(24.0 / site_width_m, 0.07)
    tennis_h = min(11.0 / site_height_m, 0.04)
    tennis_x = cx - 0.15 * bw - tennis_w
    tennis_y = cy
    
    kids_w = min(15.0 / site_width_m, 0.05)
    kids_h = min(15.0 / site_height_m, 0.05)
    kids_x = cx + 0.12 * bw - kids_w
    kids_y = cy + 0.18 * bh
    
    amenities = [
        { "id": "clubhouse", "type": "clubhouse", "label": "Grand Clubhouse", "shape": "rect", "x_pct": round(clubhouse_x, 4), "y_pct": round(clubhouse_y, 4), "width_pct": round(clubhouse_w, 4), "height_pct": round(clubhouse_h, 4) },
        { "id": "swimming_pool", "type": "pool", "label": "Luxury Pool", "shape": "rect", "x_pct": round(pool_x, 4), "y_pct": round(pool_y, 4), "width_pct": round(pool_w, 4), "height_pct": round(pool_h, 4) },
        { "id": "central_lawn", "type": "central_lawn", "label": "Central Green", "shape": "ellipse", "cx_pct": round(lawn_cx, 4), "cy_pct": round(lawn_cy, 4), "rx_pct": round(lawn_rx, 4), "ry_pct": round(lawn_ry, 4) },
        { "id": "tennis_court", "type": "sports", "label": "Tennis Court", "shape": "rect", "x_pct": round(tennis_x, 4), "y_pct": round(tennis_y, 4), "width_pct": round(tennis_w, 4), "height_pct": round(tennis_h, 4) },
        { "id": "kids_play", "type": "kids", "label": "Kids Play Zone", "shape": "rect", "x_pct": round(kids_x, 4), "y_pct": round(kids_y, 4), "width_pct": round(kids_w, 4), "height_pct": round(kids_h, 4) }
    ]
    
    # 7. Pedestrian Paths
    jog_pts = []
    rx_jog = rx_towers + 0.06 * bw
    ry_jog = ry_towers + 0.06 * bh
    jog_num_pts = max(8, num_towers)
    for i in range(jog_num_pts):
        angle = (i * 2 * math.pi) / jog_num_pts
        jx = cx + math.cos(angle) * rx_jog
        jy = cy + math.sin(angle) * ry_jog
        jog_pts.append([round(jx, 4), round(jy, 4)])
    jog_pts.append([jog_pts[0][0], jog_pts[0][1]])
    
    pedestrian_paths = [
        { "id": "jogging_track", "type": "pedestrian", "points": jog_pts, "tension": 0.4, "width_meters": 2 }
    ]
    
    # 8. Landscape tree clusters
    tree_clusters = []
    for i in range(num_towers):
        angle = ((i + 0.5) * 2 * math.pi) / num_towers
        tx = cx + math.cos(angle) * (rx_towers + 0.08 * bw)
        ty = cy + math.sin(angle) * (ry_towers + 0.08 * bh)
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
            "theme": theme,
            "actual_coverage_ratio": round(actual_coverage_ratio, 4),
            "actual_far": round(actual_far, 4),
            "utilization_pct": 0.0
        },
        "land_use": {
            "residential_pct": round(actual_coverage_ratio * 100.0, 2),
            "roads_pct": 12.0,
            "amenities_pct": 8.0,
            "open_spaces_pct": round(100.0 - actual_coverage_ratio * 100.0 - 20.0, 2),
            "parks_pct": green_area_pct
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
                        dx = cx_el - self.cx
                        dy = cy_el - self.cy
                        dist = math.sqrt(dx*dx + dy*dy) or 1e-9
                        ux = dx / dist
                        uy = dy / dist
                        new_dist = max(0.01, dist - 0.015)
                        cx_el = self.cx + ux * new_dist
                        cy_el = self.cy + uy * new_dist
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
                                dx = rx - self.cx
                                dy = ry - self.cy
                                dist = math.sqrt(dx*dx + dy*dy) or 1e-9
                                ux = dx / dist
                                uy = dy / dist
                                new_dist = max(0.01, dist - 0.015)
                                pt[0] = round(self.cx + ux * new_dist, 4)
                                pt[1] = round(self.cy + uy * new_dist, 4)
                                
                for p in paths:
                    points = p.get("points", [])
                    for pt in points:
                        if len(pt) >= 2:
                            rx, ry = pt[0], pt[1]
                            if not is_point_in_polygon(rx, ry, self.boundary_poly):
                                dx = rx - self.cx
                                dy = ry - self.cy
                                dist = math.sqrt(dx*dx + dy*dy) or 1e-9
                                ux = dx / dist
                                uy = dy / dist
                                new_dist = max(0.01, dist - 0.015)
                                pt[0] = round(self.cx + ux * new_dist, 4)
                                pt[1] = round(self.cy + uy * new_dist, 4)
                                
        return elements
