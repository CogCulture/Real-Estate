import bpy

def configure_render(quality: str, output_path: str):
    scene = bpy.context.scene
    
    # Use EEVEE engine for fast background rendering
    scene.render.engine = 'BLENDER_EEVEE'
    
    # Set output filepath and settings
    scene.render.filepath = output_path
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    
    # Configure resolutions
    if quality == "preview":
        scene.render.resolution_x = 1280
        scene.render.resolution_y = 720
        scene.render.resolution_percentage = 100
        # Reduce samples for speed
        if hasattr(scene, "eevee"):
            scene.eevee.taa_render_samples = 16
    elif quality == "ultra":
        scene.render.resolution_x = 3840
        scene.render.resolution_y = 2160
        scene.render.resolution_percentage = 100
        if hasattr(scene, "eevee"):
            scene.eevee.taa_render_samples = 128
    else:  # high (default)
        scene.render.resolution_x = 1920
        scene.render.resolution_y = 1080
        scene.render.resolution_percentage = 100
        if hasattr(scene, "eevee"):
            scene.eevee.taa_render_samples = 64
            
    # Enable shadows and ambient occlusion
    if hasattr(scene, "eevee"):
        scene.eevee.use_shadows = True
        scene.eevee.use_gtao = True  # Ambient Occlusion
        scene.eevee.use_ssr = True   # Screen Space Reflections
