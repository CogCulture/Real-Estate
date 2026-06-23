import bpy
import os

def setup_lighting(quality: str = "high"):
    # Clear existing lights
    for obj in bpy.data.objects:
        if obj.type == 'LIGHT':
            bpy.data.objects.remove(obj, do_unlink=True)

    # Try HDRI sky first (best quality)
    hdri_path = find_hdri()
    if hdri_path:
        setup_hdri(hdri_path)
    else:
        setup_fallback_lighting()

    # Always add a sun for shadows
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 100))
    sun = bpy.context.active_object
    sun.name = "Sun"
    sun.data.energy = 3.0 if quality == "ultra" else 2.0
    sun.data.angle = 0.00872665   # 0.5 degrees - sharp shadows
    # Angle from south-east for realistic daylight
    sun.rotation_euler = (0.785398, 0, -0.785398)   # 45° alt, SE

    # Ambient fill light
    bpy.ops.object.light_add(type='AREA', location=(0, 0, 50))
    fill = bpy.context.active_object
    fill.name = "FillLight"
    fill.data.energy = 500
    fill.data.size = 100
    fill.data.color = (0.8, 0.9, 1.0)   # Slight blue sky fill

def find_hdri():
    assets_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "hdri")
    if os.path.exists(assets_dir):
        for f in os.listdir(assets_dir):
            if f.endswith(".exr") or f.endswith(".hdr"):
                return os.path.join(assets_dir, f)
    return None

def setup_hdri(hdri_path: str):
    world = bpy.context.scene.world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()

    bg = nodes.new(type='ShaderNodeBackground')
    env_tex = nodes.new(type='ShaderNodeTexEnvironment')
    output = nodes.new(type='ShaderNodeOutputWorld')
    mapping = nodes.new(type='ShaderNodeMapping')
    tex_coord = nodes.new(type='ShaderNodeTexCoord')

    env_tex.image = bpy.data.images.load(hdri_path)
    bg.inputs['Strength'].default_value = 1.2

    links.new(tex_coord.outputs['Generated'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], env_tex.inputs['Vector'])
    links.new(env_tex.outputs['Color'], bg.inputs['Color'])
    links.new(bg.outputs['Background'], output.inputs['Surface'])

def setup_fallback_lighting():
    """Fallback when no HDRI available"""
    world = bpy.context.scene.world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.35, 0.55, 0.85, 1)  # Sky blue
        bg.inputs['Strength'].default_value = 1.0
