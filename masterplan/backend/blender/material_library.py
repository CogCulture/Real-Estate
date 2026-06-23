import bpy

_material_cache = {}

def get_material(name: str):
    if name in _material_cache:
        return _material_cache[name]
    mat = create_material(name)
    _material_cache[name] = mat
    return mat

def create_material(name: str):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    output = nodes.new(type='ShaderNodeOutputMaterial')
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    COLORS = {
        "grass":          (0.18, 0.55, 0.18, 1),
        "grass_rich":     (0.10, 0.50, 0.12, 1),
        "park_grass":     (0.12, 0.60, 0.15, 1),
        "plot_ground":    (0.85, 0.80, 0.70, 1),
        "residential":    (0.88, 0.88, 0.88, 1),   # Off white concrete
        "commercial":     (0.70, 0.75, 0.80, 1),   # Glass-ish blue gray
        "mixed_use":      (0.80, 0.72, 0.85, 1),   # Light purple
        "institutional":  (0.90, 0.82, 0.68, 1),   # Warm beige
        "asphalt":        (0.30, 0.30, 0.30, 1),
        "road_asphalt":   (0.20, 0.20, 0.22, 1),
        "road_marking":   (0.95, 0.95, 0.90, 1),
        "water":          (0.10, 0.35, 0.75, 1),
        "roof_tile":      (0.65, 0.22, 0.12, 1),   # Terra cotta
        "glass":          (0.60, 0.78, 0.90, 1),
        "metal":          (0.75, 0.75, 0.78, 1),
    }

    METALLIC = {
        "commercial": 0.1,
        "glass": 0.0,
        "metal": 0.9,
        "road_asphalt": 0.0,
        "water": 0.0,
    }

    ROUGHNESS = {
        "glass": 0.05,
        "water": 0.05,
        "metal": 0.2,
        "residential": 0.8,
        "road_asphalt": 0.95,
        "grass": 1.0,
    }

    TRANSMISSION = {
        "glass": 0.9,
        "water": 0.7,
    }

    color = COLORS.get(name, (0.7, 0.7, 0.7, 1))
    metallic = METALLIC.get(name, 0.0)
    roughness = ROUGHNESS.get(name, 0.7)
    transmission = TRANSMISSION.get(name, 0.0)

    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if 'Transmission' in bsdf.inputs:
        bsdf.inputs['Transmission'].default_value = transmission

    return mat
