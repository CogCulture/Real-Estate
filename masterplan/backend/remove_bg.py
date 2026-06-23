import sys
import time
from PIL import Image

for _ in range(60):
    try:
        from rembg import remove
        import onnxruntime as ort
        print("rembg and onnxruntime are ready")
        break
    except ImportError:
        print("Waiting for rembg and onnxruntime to install...")
        time.sleep(5)
else:
    print("Failed to install dependencies")
    sys.exit(1)

def process_image(input_path):
    print(f"Processing {input_path}...")
    try:
        input_image = Image.open(input_path)
        output_image = remove(input_image)
        output_image.save(input_path)
        print(f"Saved {input_path}")
    except Exception as e:
        print(f"Failed to process {input_path}: {e}")

if __name__ == "__main__":
    process_image(r"d:\RE 2.0\masterplan\frontend\public\free-assets\tree_plan_1.png")
    process_image(r"d:\RE 2.0\masterplan\frontend\public\free-assets\tree_plan_2.png")
