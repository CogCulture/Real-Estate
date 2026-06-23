import bpy
import math
from material_library import get_material

def build_scene(layout):
    meta = layout["meta"]
    site_w = meta["site_width_m"]
    site_h = meta["site_height_m"]

    # Create ground plane
    bpy.ops.mesh.primitive_plane_add(size=1, location=(site_w/2, site_h/2, 0))
    ground = bpy.context.active_object
    ground.name = "Ground"
    ground.scale = (site_w, site_h, 1)
    bpy.ops.object.transform_apply(scale=True)
    ground.data.materials.append(get_material("grass"))

    # Build zones
    for zone in layout.get("zones", []):
        build_zone(zone)

    # Build roads
    for road in layout.get("roads", []):
        build_road(road)

    # Build amenities
    for amenity in layout.get("amenities", []):
        build_amenity(amenity)

def build_zone(zone):
    zone_type = zone["type"]
    x = zone["x_m"]
    y = zone["y_m"]
    w = zone["width_m"]
    h = zone["height_m"]
    floors = zone.get("floors", 1)
    floor_height = zone.get("properties", {}).get("floor_height_m", 3.0)
    total_height = floors * floor_height

    # Determine building footprint (apply setbacks)
    setback_front = zone.get("properties", {}).get("setback_front_m", 2)
    setback_side = zone.get("properties", {}).get("setback_side_m", 1.5)
    build_w = w - (setback_side * 2)
    build_h = h - (setback_front * 2)
    build_x = x + setback_side
    build_y = y + setback_front

    if zone_type in ["residential", "commercial", "mixed_use", "institutional"]:
        # Create building mesh
        bpy.ops.mesh.primitive_cube_add(size=1, location=(
            build_x + build_w / 2,
            build_y + build_h / 2,
            total_height / 2
        ))
        obj = bpy.context.active_object
        obj.name = f"Zone_{zone['id']}"
        obj.scale = (build_w, build_h, total_height)
        bpy.ops.object.transform_apply(scale=True)

        # Apply material based on zone type
        mat = get_material(zone_type)
        obj.data.materials.append(mat)

        # Add roof detail for residential
        if zone_type == "residential" and floors <= 3:
            add_roof(obj, build_w, build_h, build_x, build_y, total_height)

        # Ground patch (plot boundary)
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x + w/2, y + h/2, 0.01))
        ground_patch = bpy.context.active_object
        ground_patch.name = f"Plot_{zone['id']}"
        ground_patch.scale = (w, h, 1)
        bpy.ops.object.transform_apply(scale=True)
        ground_patch.data.materials.append(get_material("plot_ground"))

    elif zone_type in ["green_belt", "park"]:
        # Flat green area with slight elevation (0.1m)
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x + w/2, y + h/2, 0.05))
        obj = bpy.context.active_object
        obj.name = f"Green_{zone['id']}"
        obj.scale = (w, h, 1)
        bpy.ops.object.transform_apply(scale=True)
        obj.data.materials.append(get_material("grass_rich"))

    elif zone_type == "water_body":
        # Flat blue area, slightly below ground
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x + w/2, y + h/2, -0.05))
        obj = bpy.context.active_object
        obj.name = f"Water_{zone['id']}"
        obj.scale = (w, h, 1)
        bpy.ops.object.transform_apply(scale=True)
        obj.data.materials.append(get_material("water"))

    elif zone_type == "parking":
        # Flat gray surface
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x + w/2, y + h/2, 0.02))
        obj = bpy.context.active_object
        obj.name = f"Parking_{zone['id']}"
        obj.scale = (w, h, 1)
        bpy.ops.object.transform_apply(scale=True)
        obj.data.materials.append(get_material("asphalt"))

def add_roof(building_obj, w, h, x, y, height):
    """Add a simple sloped roof on low-rise buildings"""
    # Create pyramid roof
    verts = [
        (x, y, height),
        (x + w, y, height),
        (x + w, y + h, height),
        (x, y + h, height),
        (x + w/2, y + h/2, height + 2.5),  # Ridge point
    ]
    faces = [(0,1,4), (1,2,4), (2,3,4), (3,0,4), (0,1,2,3)]
    mesh = bpy.data.meshes.new("Roof")
    obj = bpy.data.objects.new("Roof", mesh)
    bpy.context.collection.objects.link(obj)
    mesh.from_pydata(verts, [], faces)
    obj.data.materials.append(get_material("roof_tile"))

def build_road(road):
    """Build road from waypoints"""
    points = road["points_m"]
    road_width = road.get("width_m", 6)
    road_type = road.get("type", "secondary")

    # For each segment between waypoints, create a flat box
    for i in range(len(points) - 1):
        p1 = points[i]
        p2 = points[i + 1]
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        length = math.sqrt(dx**2 + dy**2)
        angle = math.atan2(dy, dx)

        mid_x = (p1[0] + p2[0]) / 2
        mid_y = (p1[1] + p2[1]) / 2

        bpy.ops.mesh.primitive_cube_add(size=1, location=(mid_x, mid_y, 0.05))
        obj = bpy.context.active_object
        obj.name = f"Road_{road['id']}_{i}"
        obj.scale = (length, road_width, 0.1)
        obj.rotation_euler[2] = angle
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        obj.data.materials.append(get_material("road_asphalt"))

        # Add road markings (thin white line on top)
        if road_type in ["primary", "secondary"]:
            add_road_markings(mid_x, mid_y, length, road_width, angle)

def add_road_markings(x, y, length, width, angle):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0.11))
    obj = bpy.context.active_object
    obj.name = "RoadMarking"
    obj.scale = (length, 0.3, 0.01)
    obj.rotation_euler[2] = angle
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    obj.data.materials.append(get_material("road_marking"))

def build_amenity(amenity):
    amenity_type = amenity["type"]
    x = amenity["x_m"]
    y = amenity["y_m"]
    w = amenity["width_m"]
    h = amenity["height_m"]

    if amenity_type == "park":
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x + w/2, y + h/2, 0.05))
        obj = bpy.context.active_object
        obj.scale = (w, h, 1)
        bpy.ops.object.transform_apply(scale=True)
        obj.data.materials.append(get_material("park_grass"))
