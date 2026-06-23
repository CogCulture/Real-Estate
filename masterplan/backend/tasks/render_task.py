import subprocess
import json
import os
import sys
import math
from celery import Celery
from PIL import Image, ImageDraw, ImageFont

# Ensure backend directory is in the path
sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from tasks.celery_app import celery_app
from database import update_render_status

class SeededRandom:
    def __init__(self, seed):
        self.state = seed
    def next(self):
        self.state = (self.state * 1103515245 + 12345) & 0x7fffffff
        return self.state / 2147483647.0

def calculate_iso_scale(site_w, site_h, canvas_w=3840, canvas_h=2160, margin=350):
    corners = [
        (0, 0),
        (site_w, 0),
        (site_w, site_h),
        (0, site_h)
    ]
    cos30 = 0.866025
    sin30 = 0.5
    cx = site_w / 2
    cy = site_h / 2
    
    u_coords = []
    v_coords = []
    for x, y in corners:
        rx = x - cx
        ry = y - cy
        u = (rx - ry) * cos30
        v = (rx + ry) * sin30
        u_coords.append(u)
        v_coords.append(v)
        
    w_span = max(u_coords) - min(u_coords)
    h_span = max(v_coords) - min(v_coords)
    
    scale_w = (canvas_w - margin * 2) / w_span if w_span > 0 else 1.0
    scale_h = (canvas_h - margin * 2) / h_span if h_span > 0 else 1.0
    return min(scale_w, scale_h)

def draw_mock_site_plan(layout: dict, output_path: str):
    meta = layout.get("meta", {})
    site_w = meta.get("site_width_m", 500)
    site_h = meta.get("site_height_m", 300)
    
    canvas_w = 3840
    canvas_h = 2160
    
    # Calculate scale to fit ground in canvas
    scale = calculate_iso_scale(site_w, site_h, canvas_w, canvas_h, margin=400)
    
    cos30 = 0.866025
    sin30 = 0.5
    cx = site_w / 2
    cy = site_h / 2
    
    def project(x, y, z):
        rx = x - cx
        ry = y - cy
        u = (rx - ry) * cos30
        v = (rx + ry) * sin30 - z
        px = canvas_w / 2 + u * scale
        py = canvas_h / 2 + v * scale
        return (px, py)
        
    # High-quality image (Soft light grey WebGL background look)
    img = Image.new("RGB", (canvas_w, canvas_h), "#f1f5f9")
    draw = ImageDraw.Draw(img)
    
    draw_ops = []
    
    # 1. Floating Island corners
    l0 = project(0, 0, 0)
    l1 = project(site_w, 0, 0)
    l2 = project(site_w, site_h, 0)
    l3 = project(0, site_h, 0)
    
    b0 = project(0, 0, -18)
    b1 = project(site_w, 0, -18)
    b2 = project(site_w, site_h, -18)
    b3 = project(0, site_h, -18)
    
    # Floating Island Left Side
    def draw_island_left(d):
        d.polygon([l3, l2, b2, b3], fill="#6e5044", outline="#473229")
    draw_ops.append((-99999, draw_island_left))
    
    # Floating Island Right Side
    def draw_island_right(d):
        d.polygon([l1, l2, b2, b1], fill="#543b32", outline="#473229")
    draw_ops.append((-99998, draw_island_right))
    
    # Floating Island Top Grass Plane
    def draw_island_top(d):
        d.polygon([l0, l1, l2, l3], fill="#4cb050", outline="#2c5c24")
    draw_ops.append((-99997, draw_island_top))

    # Helper for Flat elements
    def make_flat_draw(x, y, w, h, fill_color, outline_color, name):
        pts = [
            project(x, y, 0),
            project(x + w, y, 0),
            project(x + w, y + h, 0),
            project(x, y + h, 0)
        ]
        def fn(d):
            d.polygon(pts, fill=fill_color, outline=outline_color)
        depth = x + y + w/2 + h/2 - 50000
        return depth, fn

    # Helper for Roads
    def make_road_draw(road, p1, p2):
        road_w = road.get("width_m", 6)
        road_color = "#334155" if road.get("type") == "primary" else "#475569"
        
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        length = math.sqrt(dx*dx + dy*dy)
        if length == 0:
            return None
        nx = -dy / length * (road_w / 2)
        ny = dx / length * (road_w / 2)
        
        pts = [
            project(p1[0] + nx, p1[1] + ny, 0),
            project(p2[0] + nx, p2[1] + ny, 0),
            project(p2[0] - nx, p2[1] - ny, 0),
            project(p1[0] - nx, p1[1] - ny, 0)
        ]
        
        def fn(d):
            d.polygon(pts, fill=road_color, outline="#1e293b")
            # draw center dash markings
            c1 = project(p1[0], p1[1], 0)
            c2 = project(p2[0], p2[1], 0)
            if road.get("type") == "primary":
                d.line([c1, c2], fill="#f5b041", width=4)
            else:
                d.line([c1, c2], fill="#ffffff", width=2)
                
        depth = (p1[0] + p2[0]) / 2 + (p1[1] + p2[1]) / 2 - 20000
        return depth, fn

    # Helper for 3D Buildings
    def make_building_draw(zone, color_hex):
        x = zone["x_m"]
        y = zone["y_m"]
        w = zone["width_m"]
        h = zone["height_m"]
        
        props = zone.get("properties", {})
        setback_front = props.get("setback_front_m", 2.0)
        setback_side = props.get("setback_side_m", 1.5)
        
        build_w = max(1.0, w - setback_side * 2)
        build_h = max(1.0, h - setback_front * 2)
        bx = x + setback_side
        by = y + setback_front
        
        H = (zone.get("floors", 4) or 4) * 3.0
        
        # 3D corners
        p0 = project(bx, by, H)
        p1 = project(bx + build_w, by, H)
        p2 = project(bx + build_w, by + build_h, H)
        p3 = project(bx, by + build_h, H)
        
        g0 = project(bx, by, 0)
        g1 = project(bx + build_w, by, 0)
        g2 = project(bx + build_w, by + build_h, 0)
        g3 = project(bx, by + build_h, 0)
        
        try:
            hex_str = color_hex.lstrip('#')
            r = int(hex_str[0:2], 16)
            g = int(hex_str[2:4], 16)
            b = int(hex_str[4:6], 16)
        except Exception:
            r, g, b = 200, 200, 200
            
        c_top = (r, g, b)
        c_left = (int(r * 0.7), int(g * 0.7), int(b * 0.7))
        c_right = (int(r * 0.88), int(g * 0.88), int(b * 0.88))
        
        # Shadows projected to ground
        s_offset_x = H * 0.35
        s_offset_y = H * 0.18
        s0 = (g0[0] + s_offset_x * scale, g0[1] + s_offset_y * scale)
        s1 = (g1[0] + s_offset_x * scale, g1[1] + s_offset_y * scale)
        s2 = (g2[0] + s_offset_x * scale, g2[1] + s_offset_y * scale)
        s3 = (g3[0] + s_offset_x * scale, g3[1] + s_offset_y * scale)
        
        def draw_shadow(d):
            # Draw building shadow on ground
            d.polygon([s0, s1, s2, s3], fill="#275b2a")
            
        def draw_building(d):
            # Draw Left Face
            d.polygon([g3, g2, p2, p3], fill=c_left, outline="#1e293b")
            # Draw Right Face
            d.polygon([g1, g2, p2, p1], fill=c_right, outline="#1e293b")
            # Draw Top Face
            d.polygon([p0, p1, p2, p3], fill=c_top, outline="#1e293b")
            
            # Floor lines
            floors = zone.get("floors", 4) or 4
            for f in range(1, floors):
                fh = f * 3.0
                ls = project(bx, by + build_h, fh)
                le = project(bx + build_w, by + build_h, fh)
                rs = project(bx + build_w, by, fh)
                re = project(bx + build_w, by + build_h, fh)
                d.line([ls, le], fill="#1e293b", width=1)
                d.line([rs, re], fill="#1e293b", width=1)
                
        depth = bx + by + build_w/2 + build_h/2
        return depth, draw_shadow, draw_building

    # Helper for Trees
    def make_tree_draw(tx, ty, size='md'):
        H = 7.0 if size == 'sm' else 11.0 if size == 'lg' else 9.0
        radius = 16.0 if size == 'sm' else 32.0 if size == 'lg' else 24.0
        
        g_center = project(tx, ty, 0)
        s_center = (g_center[0] + H * 0.35 * scale, g_center[1] + H * 0.18 * scale)
        t_center = project(tx, ty, H)
        
        def draw_shadow(d):
            d.ellipse([s_center[0] - radius * 0.8, s_center[1] - radius * 0.4, s_center[0] + radius * 0.8, s_center[1] + radius * 0.4], fill="#275b2a")
            
        def draw_tree(d):
            trunk_base = project(tx, ty, 0)
            d.line([trunk_base, t_center], fill="#5c4033", width=6)
            d.ellipse([t_center[0] - radius, t_center[1] - radius, t_center[0] + radius, t_center[1] + radius], fill="#1e8449", outline="#145a32")
            d.ellipse([t_center[0] - radius * 0.7 - 2, t_center[1] - radius * 0.7 - 2, t_center[0] + radius * 0.3 - 2, t_center[1] + radius * 0.3 - 2], fill="#2ecc71")
            
        depth = tx + ty
        return depth, draw_shadow, draw_tree

    # --- COLLECT DRAW CALLS ---
    
    # Amenities (Water & Parks)
    for amenity in layout.get("amenities", []):
        x = amenity.get("x_m", 0)
        y = amenity.get("y_m", 0)
        w = amenity.get("width_m", 10)
        h = amenity.get("height_m", 10)
        a_type = amenity.get("type", "park")
        
        if a_type in ["park", "green_belt", "open_space"]:
            color = "#419934"
            outline = "#2c5c24"
            depth, fn = make_flat_draw(x, y, w, h, color, outline, a_type)
            draw_ops.append((depth, fn))
            
            # Scatter trees in park
            seed = int(x * 100 + y) & 0x7fffffff
            rng = SeededRandom(seed)
            area = w * h
            tree_count = min(20, int(area / 120))
            for _ in range(tree_count):
                tx = x + 3 + rng.next() * (w - 6)
                ty = y + 3 + rng.next() * (h - 6)
                size = "lg" if rng.next() > 0.75 else "sm" if rng.next() > 0.4 else "md"
                tdepth, tshadow, tfn = make_tree_draw(tx, ty, size)
                draw_ops.append((tdepth - 0.05, tshadow))
                draw_ops.append((tdepth, tfn))
        elif a_type == "water_body":
            color = "#5dade2"
            outline = "#2980b9"
            depth, fn = make_flat_draw(x, y, w, h, color, outline, a_type)
            draw_ops.append((depth, fn))

    # Zones (Buildings & Greens)
    COLORS = {
        "residential":  "#3b82f6",
        "commercial":   "#f59e0b",
        "mixed_use":    "#8b5cf6",
        "industrial":   "#64748b",
        "green_belt":   "#419934",
        "water_body":   "#5dade2",
        "park":         "#419934",
        "parking":      "#cbd5e1",
        "amenity":      "#ef4444",
        "institutional":"#f59e0b",
        "open_space":   "#f8fafc",
    }
    
    for zone in layout.get("zones", []):
        z_type = zone.get("type", "residential")
        color = zone.get("color") or COLORS.get(z_type, "#94a3b8")
        
        x = zone.get("x_m", 0)
        y = zone.get("y_m", 0)
        w = zone.get("width_m", 10)
        h = zone.get("height_m", 10)
        
        is_building = z_type in ["residential", "commercial", "mixed_use", "industrial", "institutional", "amenity"]
        
        if is_building:
            depth, shadow_fn, build_fn = make_building_draw(zone, color)
            draw_ops.append((depth - 0.1, shadow_fn))
            draw_ops.append((depth, build_fn))
        else:
            outline_color = "#2c5c24" if z_type in ["park", "green_belt"] else "#475569"
            depth, fn = make_flat_draw(x, y, w, h, color, outline_color, z_type)
            draw_ops.append((depth, fn))
            
            if z_type in ["park", "green_belt"]:
                seed = int(x * 100 + y) & 0x7fffffff
                rng = SeededRandom(seed)
                area = w * h
                tree_count = min(20, int(area / 120))
                for _ in range(tree_count):
                    tx = x + 3 + rng.next() * (w - 6)
                    ty = y + 3 + rng.next() * (h - 6)
                    size = "lg" if rng.next() > 0.75 else "sm" if rng.next() > 0.4 else "md"
                    tdepth, tshadow, tfn = make_tree_draw(tx, ty, size)
                    draw_ops.append((tdepth - 0.05, tshadow))
                    draw_ops.append((tdepth, tfn))

    # Roads
    for road in layout.get("roads", []):
        points = road.get("points_m", [])
        if len(points) < 2:
            continue
        for i in range(len(points) - 1):
            p1 = points[i]
            p2 = points[i+1]
            road_ops = make_road_draw(road, p1, p2)
            if road_ops:
                depth, fn = road_ops
                draw_ops.append((depth, fn))

    # --- EXECUTE DRAWING BY DEPTH ORDER ---
    draw_ops.sort(key=lambda item: item[0])
    for depth, fn in draw_ops:
        fn(draw)
        
    # Super-sampled downscaling for high-quality anti-aliased output
    final_img = img.resize((1920, 1080), Image.Resampling.LANCZOS)
    final_img.save(output_path)

@celery_app.task(bind=True)
def run_blender_render(self, job_id: str, layout_json: str, render_config: dict):
    # 1. Update status to 'processing'
    update_render_status(job_id, status="processing", progress=5)

    # Make temp folder local to backend
    backend_dir = os.path.dirname(os.path.dirname(__file__))
    temp_dir = os.path.join(backend_dir, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    temp_layout_path = os.path.join(temp_dir, f"layout_{job_id}.json")

    # 2. Write layout JSON to temp file
    with open(temp_layout_path, "w") as f:
        json.dump(json.loads(layout_json), f)

    # 3. Prepare output path
    output_filename = f"render_{job_id}.png"
    output_path = os.path.join(backend_dir, "outputs", output_filename)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # 4. Build Blender command
    blender_path = os.getenv("BLENDER_PATH", "blender")
    script_path = os.path.join(backend_dir, "blender", "render_scene.py")

    cmd = [
        blender_path,
        "--background",
        "--python", script_path,
        "--",
        "--layout", temp_layout_path,
        "--output", output_path,
        "--quality", render_config.get("quality", "high"),
        "--camera", render_config.get("camera_preset", "aerial"),
        "--job_id", job_id,
    ]

    # Check if Blender is available
    blender_available = False
    try:
        subprocess.run([blender_path, "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        blender_available = True
    except Exception:
        typical_win_paths = [
            r"C:\Program Files\Blender Foundation\Blender 4.2\blender.exe",
            r"C:\Program Files\Blender Foundation\Blender 4.1\blender.exe",
            r"C:\Program Files\Blender Foundation\Blender 4.0\blender.exe"
        ]
        for path in typical_win_paths:
            if os.path.exists(path):
                blender_path = path
                cmd[0] = path
                blender_available = True
                break

    # 5. Execute Render
    try:
        if blender_available:
            update_render_status(job_id, progress=10)
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            # Stream stdout to track progress
            for line in process.stdout:
                line = line.strip()
                print(f"[Blender] {line}")
                if line.startswith("PROGRESS:"):
                    pct = int(line.split(":")[1])
                    update_render_status(job_id, progress=pct)

            process.wait()

            if process.returncode != 0:
                error = process.stderr.read()
                print(f"Blender failed with error: {error}")
                print("Falling back to 3D Isometric PIL renderer...")
                draw_mock_site_plan(json.loads(layout_json), output_path)
            
        else:
            # No Blender found: fallback immediately to 3D Isometric PIL renderer
            print("Blender not found. Falling back to 3D Isometric PIL renderer...")
            update_render_status(job_id, progress=15)
            draw_mock_site_plan(json.loads(layout_json), output_path)
            update_render_status(job_id, progress=75)

        # 6. Mark done
        output_url = f"/outputs/{output_filename}"
        update_render_status(
            job_id,
            status="done",
            progress=100,
            output_path=f"outputs/{output_filename}",
            output_url=output_url
        )

    except Exception as e:
        print(f"Render task error: {e}")
        update_render_status(job_id, status="failed", error_msg=str(e))

    finally:
        # Cleanup temp file
        if os.path.exists(temp_layout_path):
            os.remove(temp_layout_path)
