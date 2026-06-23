import bpy
import math

def setup_camera(layout: dict, preset: str = "aerial"):
    meta = layout["meta"]
    site_w = meta["site_width_m"]
    site_h = meta["site_height_m"]
    cx = site_w / 2
    cy = site_h / 2

    # Remove existing cameras
    for obj in bpy.data.objects:
        if obj.type == 'CAMERA':
            bpy.data.objects.remove(obj, do_unlink=True)

    bpy.ops.object.camera_add()
    cam = bpy.context.active_object
    cam.name = "RenderCamera"
    bpy.context.scene.camera = cam

    max_dim = max(site_w, site_h)

    PRESETS = {
        "aerial": {
            "location": (cx, cy, max_dim * 1.2),
            "rotation": (0, 0, 0),
            "lens": 35,
        },
        "isometric": {
            "location": (cx - max_dim * 0.7, cy - max_dim * 0.7, max_dim * 0.8),
            "rotation": (math.radians(55), 0, math.radians(-45)),
            "lens": 50,
        },
        "street": {
            "location": (cx, -10, 2.0),
            "rotation": (math.radians(85), 0, 0),
            "lens": 28,
        },
        "cinematic": {
            "location": (cx - max_dim * 0.6, cy - max_dim * 0.5, max_dim * 0.3),
            "rotation": (math.radians(65), 0, math.radians(-30)),
            "lens": 24,
        },
    }

    config = PRESETS.get(preset, PRESETS["aerial"])
    cam.location = config["location"]
    cam.rotation_euler = config["rotation"]
    cam.data.lens = config["lens"]
    cam.data.clip_end = 100000

    # Point camera at scene center (for isometric and cinematic)
    if preset in ["isometric", "cinematic", "aerial"]:
        # Add Track-To constraint
        constraint = cam.constraints.new(type='TRACK_TO')
        empty = bpy.data.objects.new("CameraTarget", None)
        bpy.context.collection.objects.link(empty)
        empty.location = (cx, cy, 0)
        constraint.target = empty
        constraint.track_axis = 'TRACK_NEGATIVE_Z'
        constraint.up_axis = 'UP_Y'
