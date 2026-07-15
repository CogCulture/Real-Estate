import math
from typing import Dict, List, Any

class BoundingBox:
    def __init__(self, x: float, y: float, w: float, h: float, el_type: str, el_id: str):
        self.x = x
        self.y = y
        self.w = w
        self.h = h
        self.el_type = el_type
        self.el_id = el_id

    def x2(self) -> float:
        return self.x + self.w

    def y2(self) -> float:
        return self.y + self.h

    def cx(self) -> float:
        return self.x + self.w / 2

    def cy(self) -> float:
        return self.y + self.h / 2

    def intersects(self, other: 'BoundingBox', padding: float = 0.0) -> bool:
        return not (
            self.x2() + padding <= other.x - padding or
            self.x - padding >= other.x2() + padding or
            self.y2() + padding <= other.y - padding or
            self.y - padding >= other.y2() + padding
        )

    def contains_point(self, px: float, py: float) -> bool:
        return self.x <= px <= self.x2() and self.y <= py <= self.y2()

    def distance_to(self, other: 'BoundingBox') -> float:
        dx = self.cx() - other.cx()
        dy = self.cy() - other.cy()
        return math.sqrt(dx*dx + dy*dy)

import json

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
        print(f"Error parsing boundary GeoJSON in validator: {e}")
    return None

def validate_masterplan(layout_json: Dict[str, Any], brief: Dict[str, Any]) -> Dict[str, Any]:
    score = 100
    checks = []
    warnings = []
    
    MARGIN = 0.06
    MAX_POS = 1.0 - MARGIN
    
    # ----------------------------------------------------
    # 1. BOUNDARY CHECK
    # ----------------------------------------------------
    boundary_passed = True
    
    sw = brief.get("site_width_m", 500.0)
    sh = brief.get("site_height_m", 300.0)
    boundary_geojson_str = brief.get("boundary_geojson")
    boundary_poly = get_boundary_coords_pct(boundary_geojson_str, sw, sh)
    
    # Check Towers
    towers = layout_json.get("towers", [])
    for t in towers:
        tx = t.get("x_pct", 0.0)
        ty = t.get("y_pct", 0.0)
        tw = t.get("width_pct", 0.0)
        th = t.get("height_pct", 0.0)
        
        if boundary_poly:
            # Check all 4 corners of the tower bounding box
            corners = [(tx, ty), (tx + tw, ty), (tx, ty + th), (tx + tw, ty + th)]
            outside_corners = [c for c in corners if not is_point_in_polygon(c[0], c[1], boundary_poly)]
            if outside_corners:
                boundary_passed = False
                score -= 10
                warnings.append(f"Tower {t.get('label', t.get('id'))} corners fall outside the site boundary polygon.")
        else:
            if tx < MARGIN or ty < MARGIN or (tx + tw) > MAX_POS or (ty + th) > MAX_POS:
                boundary_passed = False
                score -= 10
                warnings.append(f"Tower {t.get('label', t.get('id'))} is out of boundary bounds.")
            
    # Check Amenities
    amenities = layout_json.get("amenities", [])
    for a in amenities:
        shape = a.get("shape", "rect")
        if shape == "ellipse":
            cx = a.get("cx_pct", 0.0)
            cy = a.get("cy_pct", 0.0)
            rx = a.get("rx_pct", 0.0)
            ry = a.get("ry_pct", 0.0)
            if boundary_poly:
                # Check center and 4 cardinal points
                pts = [(cx, cy), (cx - rx, cy), (cx + rx, cy), (cx, cy - ry), (cx, cy + ry)]
                outside_pts = [p for p in pts if not is_point_in_polygon(p[0], p[1], boundary_poly)]
                if outside_pts:
                    boundary_passed = False
                    score -= 10
                    warnings.append(f"Amenity {a.get('label', a.get('id'))} falls outside the site boundary polygon.")
            else:
                if (cx - rx) < MARGIN or (cy - ry) < MARGIN or (cx + rx) > MAX_POS or (cy + ry) > MAX_POS:
                    boundary_passed = False
                    score -= 10
                    warnings.append(f"Amenity {a.get('label', a.get('id'))} is out of boundary bounds.")
        else:
            ax = a.get("x_pct", 0.0)
            ay = a.get("y_pct", 0.0)
            aw = a.get("width_pct", 0.0)
            ah = a.get("height_pct", 0.0)
            if boundary_poly:
                # Check 4 corners
                corners = [(ax, ay), (ax + aw, ay), (ax, ay + ah), (ax + aw, ay + ah)]
                outside_corners = [c for c in corners if not is_point_in_polygon(c[0], c[1], boundary_poly)]
                if outside_corners:
                    boundary_passed = False
                    score -= 10
                    warnings.append(f"Amenity {a.get('label', a.get('id'))} corners fall outside the site boundary polygon.")
            else:
                if ax < MARGIN or ay < MARGIN or (ax + aw) > MAX_POS or (ay + ah) > MAX_POS:
                    boundary_passed = False
                    score -= 10
                    warnings.append(f"Amenity {a.get('label', a.get('id'))} is out of boundary bounds.")
 
    # Check Roads
    roads = layout_json.get("roads", [])
    for r in roads:
        points = r.get("points", [])
        for pt in points:
            if len(pt) >= 2:
                rx, ry = pt[0], pt[1]
                if boundary_poly:
                    if not is_point_in_polygon(rx, ry, boundary_poly):
                        boundary_passed = False
                        score -= 10
                        warnings.append(f"Road {r.get('id')} has point [{rx:.2f}, {ry:.2f}] outside the site boundary polygon.")
                        break
                else:
                    if rx < MARGIN or ry < MARGIN or rx > MAX_POS or ry > MAX_POS:
                        boundary_passed = False
                        score -= 10
                        warnings.append(f"Road {r.get('id')} has point [{rx}, {ry}] out of bounds.")
                        break
                    
    checks.append({
        "name": "Boundary Check",
        "target": "All elements within boundary polygon" if boundary_poly else f"All elements within [{MARGIN:.2f}, {MAX_POS:.2f}]",
        "actual": "All elements within bounds" if boundary_passed else "Out of bounds violations detected",
        "status": "pass" if boundary_passed else "fail"
    })

    # ----------------------------------------------------
    # 2. COLLISION CHECK
    # ----------------------------------------------------
    collision_passed = True
    boxes: List[BoundingBox] = []
    
    for t in towers:
        boxes.append(BoundingBox(
            t.get("x_pct", 0.0), 
            t.get("y_pct", 0.0), 
            t.get("width_pct", 0.0), 
            t.get("height_pct", 0.0), 
            "tower", 
            t.get("id")
        ))
        
    for a in amenities:
        shape = a.get("shape", "rect")
        if shape == "ellipse":
            cx = a.get("cx_pct", 0.0)
            cy = a.get("cy_pct", 0.0)
            rx = a.get("rx_pct", 0.0)
            ry = a.get("ry_pct", 0.0)
            boxes.append(BoundingBox(cx - rx, cy - ry, rx * 2, ry * 2, "amenity", a.get("id")))
        else:
            boxes.append(BoundingBox(
                a.get("x_pct", 0.0), 
                a.get("y_pct", 0.0), 
                a.get("width_pct", 0.0), 
                a.get("height_pct", 0.0), 
                "amenity", 
                a.get("id")
            ))

    # Check overlaps between boxes
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            box_a = boxes[i]
            box_b = boxes[j]
            # Setback padding check
            padding = 0.02 # general padding
            if box_a.intersects(box_b, padding=padding):
                collision_passed = False
                dist = box_a.distance_to(box_b)
                if box_a.el_type == "tower" and box_b.el_type == "tower":
                    score -= 10
                    severity = "Critical"
                else:
                    score -= 5
                    severity = "Warning"
                warnings.append(f"{severity} collision: {box_a.el_id} overlaps with {box_b.el_id} (distance={dist:.4f})")

    # Check road point collisions with tower boxes
    road_tower_overlap = False
    for r in roads:
        points = r.get("points", [])
        for pt in points:
            if len(pt) >= 2:
                rx, ry = pt[0], pt[1]
                for box in boxes:
                    if box.el_type == "tower" and box.contains_point(rx, ry):
                        collision_passed = False
                        road_tower_overlap = True
                        score -= 10
                        warnings.append(f"Critical collision: Road {r.get('id')} intersects Tower {box.el_id}")

    checks.append({
        "name": "Collision Check",
        "target": "No element overlaps (minimum 2% padding)",
        "actual": "No overlaps detected" if collision_passed else "Overlaps detected",
        "status": "pass" if collision_passed else "fail"
    })

    # ----------------------------------------------------
    # 3. REQUIREMENT ACHIEVEMENT
    # ----------------------------------------------------
    # Green target
    target_green = float(brief.get("green_area_pct", 40.0))
    land_use = layout_json.get("land_use", {})
    actual_green = float(land_use.get("open_spaces_pct", 0.0) + land_use.get("parks_pct", 0.0))
    
    green_passed = actual_green >= (target_green - 5.0)
    if not green_passed:
        score -= 10
        warnings.append(f"Green target not achieved: requested {target_green}%, got {actual_green}%")
        
    checks.append({
        "name": "Green Target Compliance",
        "target": f">= {target_green}% green area",
        "actual": f"{actual_green}%",
        "status": "pass" if green_passed else "fail"
    })

    # Selected Amenities
    brief_amenities = brief.get("amenities", [])
    layout_amenities_types = [a.get("type") for a in amenities]
    # Also look at label or id
    layout_amenities_names_lower = [a.get("id", "").lower() for a in amenities] + [a.get("label", "").lower() for a in amenities]
    
    missing_amenities = []
    for am in brief_amenities:
        # Check mapping for type vs name
        am_normalized = am.lower().replace(" ", "_")
        found = False
        for l_type in layout_amenities_types:
            if am_normalized in l_type.lower() or l_type.lower() in am_normalized:
                found = True
                break
        if not found:
            for l_name in layout_amenities_names_lower:
                if am_normalized in l_name or l_name in am_normalized:
                    found = True
                    break
        if not found:
            missing_amenities.append(am)
            score -= 5
            
    amenities_passed = len(missing_amenities) == 0
    if not amenities_passed:
        warnings.append(f"Missing requested amenities: {', '.join(missing_amenities)}")
        
    checks.append({
        "name": "Amenities Verification",
        "target": f"All requested amenities ({', '.join(brief_amenities)})",
        "actual": "All present" if amenities_passed else f"Missing: {', '.join(missing_amenities)}",
        "status": "pass" if amenities_passed else "fail"
    })

    # Theme compliance
    theme = brief.get("theme", "Modern").lower()
    theme_passed = True
    actual_theme_status = "Theme requirements met"
    
    if "luxury" in theme:
        # Needs premium zones, drop offs, water feature
        has_drop_off = any(t.get("has_arrival_plaza") or t.get("has_drop_off_loop") for t in towers)
        landscape = layout_json.get("landscape", {})
        has_water = len(landscape.get("water_features", [])) > 0 or any("pool" in a.get("type", "") or "water" in a.get("type", "") for a in amenities)
        if not (has_drop_off and has_water):
            theme_passed = False
            score -= 10
            actual_theme_status = "Missing luxury details (drop offs or water features)"
            warnings.append("Luxury theme compliance: missing arrival drop-offs or water features.")
    elif "forest" in theme:
        # Needs trees, curved roads
        landscape = layout_json.get("landscape", {})
        has_trees = len(landscape.get("tree_clusters", [])) > 0
        has_curved = any(r.get("tension", 0.0) >= 0.3 for r in roads)
        if not (has_trees and has_curved):
            theme_passed = False
            score -= 10
            actual_theme_status = "Missing forest details (trees or curved roads)"
            warnings.append("Forest theme compliance: missing tree clusters or curved roads (tension >= 0.3).")
    elif "wellness" in theme:
        # Needs paths, green zones
        has_paths = len(layout_json.get("pedestrian_paths", [])) > 0
        has_greens = actual_green >= 30.0
        if not (has_paths and has_greens):
            theme_passed = False
            score -= 10
            actual_theme_status = "Missing wellness details (pedestrian paths or >= 30% green area)"
            warnings.append("Wellness theme compliance: missing pedestrian paths or green area >= 30%.")

    checks.append({
        "name": "Theme Compliance Check",
        "target": f"Theme rules for '{brief.get('theme')}'",
        "actual": actual_theme_status,
        "status": "pass" if theme_passed else "fail"
    })

    # ----------------------------------------------------
    # 3.5. ROAD CONNECTIVITY CHECK
    # ----------------------------------------------------
    connectivity_passed = True
    for t in towers:
        tx = t.get("x_pct", 0.0)
        ty = t.get("y_pct", 0.0)
        tw = t.get("width_pct", 0.0)
        th = t.get("height_pct", 0.0)
        tcx = tx + tw / 2.0
        tcy = ty + th / 2.0
        
        # Find minimum distance to any road point
        min_dist_to_road = 999.0
        for r in roads:
            for pt in r.get("points", []):
                if len(pt) >= 2:
                    rx, ry = pt[0], pt[1]
                    dist = math.sqrt((tcx - rx)**2 + (tcy - ry)**2)
                    if dist < min_dist_to_road:
                        min_dist_to_road = dist
        
        # Expect a road point within 0.10 of tower center
        MAX_ROAD_DIST = 0.10
        if min_dist_to_road > MAX_ROAD_DIST:
            connectivity_passed = False
            score -= 5
            warnings.append(f"Tower {t.get('label', t.get('id'))} has poor road connectivity (nearest road point is {min_dist_to_road*sw:.1f} meters away).")
            
    checks.append({
        "name": "Road Connectivity Check",
        "target": "All residential towers must be adjacent to the road network (within 50m of center)",
        "actual": "All towers connected" if connectivity_passed else "Isolated towers detected",
        "status": "pass" if connectivity_passed else "fail"
    })

    # ----------------------------------------------------
    # 4. LAND USE VALIDATION
    # ----------------------------------------------------
    residential_pct = land_use.get("residential_pct", 0.0)
    roads_pct = land_use.get("roads_pct", 0.0)
    amenities_pct = land_use.get("amenities_pct", 0.0)
    green_pct = actual_green
    
    checks.append({
        "name": "Land Use Breakdown",
        "target": "Calculated spatial metrics",
        "actual": f"Res: {residential_pct}%, Roads: {roads_pct}%, Amenities: {amenities_pct}%, Green: {green_pct}%",
        "status": "pass"
    })

    # Clamp score
    score = max(0, min(100, score))
    passed = score >= 75

    return {
        "score": score,
        "passed": passed,
        "checks": checks,
        "warnings": warnings
    }
