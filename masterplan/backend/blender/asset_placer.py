import bpy
import random
import math

def place_assets(layout: dict):
    random.seed(42)  # Deterministic placement

    for zone in layout.get("zones", []):
        zone_type = zone["type"]
        x = zone["x_m"]
        y = zone["y_m"]
        w = zone["width_m"]
        h = zone["height_m"]

        if zone_type in ["park", "green_belt"]:
            place_trees_dense(x, y, w, h, count=max(1, int(w * h / 100)))
        elif zone_type == "residential":
            place_trees_sparse(x, y, w, h, count=max(1, int(w * h / 500)))
            place_cars_on_road_edge(x, y, w, h, count=2)
        elif zone_type == "commercial":
            place_trees_sparse(x, y, w, h, count=max(1, int(w * h / 800)))
            place_cars_on_road_edge(x, y, w, h, count=4)

def place_trees_dense(x, y, w, h, count):
    for i in range(count):
        tx = x + random.uniform(2, w - 2)
        ty = y + random.uniform(2, h - 2)
        create_tree_proxy(tx, ty, random.uniform(3, 6))

def place_trees_sparse(x, y, w, h, count):
    for i in range(count):
        tx = x + random.uniform(1, w - 1)
        ty = y + random.uniform(1, h - 1)
        create_tree_proxy(tx, ty, random.uniform(2.5, 4.5))

def place_cars_on_road_edge(x, y, w, h, count):
    # Place cars along plot edge (just simple boxes)
    for i in range(count):
        cx = x + random.uniform(1, w - 1)
        cy = y + 0.5  # near front boundary
        create_car_proxy(cx, cy)

def create_tree_proxy(x, y, height):
    # Tree trunk (cylinder)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=height * 0.4, location=(x, y, height * 0.2))
    trunk = bpy.context.active_object
    trunk.name = "TreeTrunk"
    from material_library import get_material
    trunk.data.materials.append(get_material("asphalt"))  # gray/brownish trunk
    
    # Tree canopy (cone)
    bpy.ops.mesh.primitive_cone_add(radius=0.8, depth=height * 0.8, location=(x, y, height * 0.7))
    canopy = bpy.context.active_object
    canopy.name = "TreeCanopy"
    canopy.data.materials.append(get_material("grass_rich"))

def create_car_proxy(x, y):
    # Simple car box
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0.4))
    car = bpy.context.active_object
    car.name = "CarProxy"
    car.scale = (1.8, 0.8, 0.5)
    bpy.ops.object.transform_apply(scale=True)
    
    from material_library import get_material
    car.data.materials.append(get_material("mixed_use")) # purple/metallic colored car
