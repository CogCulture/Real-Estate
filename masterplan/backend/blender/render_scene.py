import bpy
import sys
import json
import os
import argparse

def parse_args():
    """Parse args passed after '--' in the blender command"""
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--layout", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--quality", default="high")
    parser.add_argument("--camera", default="aerial")
    parser.add_argument("--job_id", default="")
    return parser.parse_args(argv)

def main():
    args = parse_args()

    # Load layout JSON
    with open(args.layout, "r") as f:
        layout = json.load(f)

    print("PROGRESS:5")

    # Clear default scene
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    print("PROGRESS:10")

    # Import pipeline modules
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    from scene_builder import build_scene
    from lighting_setup import setup_lighting
    from camera_setup import setup_camera
    from asset_placer import place_assets
    from exporter import configure_render

    # Build scene from layout
    print("PROGRESS:15")
    build_scene(layout)

    # Place environmental assets
    print("PROGRESS:40")
    place_assets(layout)

    # Setup lighting
    print("PROGRESS:55")
    setup_lighting(args.quality)

    # Setup camera
    print("PROGRESS:65")
    setup_camera(layout, args.camera)

    # Configure render settings
    print("PROGRESS:70")
    configure_render(args.quality, args.output)

    # Render
    print("PROGRESS:75")
    bpy.ops.render.render(write_still=True)

    print("PROGRESS:100")
    print(f"Render complete: {args.output}")

if __name__ == "__main__":
    main()
