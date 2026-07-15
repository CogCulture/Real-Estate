import re

def main():
    file_path = 'src/components/editor/Canvas2D.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    search_str = """const isBuilding = ['residential', 'commercial', 'mixed_use', 'industrial', 'institutional', 'amenity'].includes(zone.type);
            const flatPts = pts.flat();"""
            
    replace_str = """const originalBbox = getPolygonBoundingBox(originalPts);
            const isBuilding = ['residential', 'commercial', 'mixed_use', 'industrial', 'institutional', 'amenity'].includes(zone.type);
            const flatPts = pts.flat();"""
            
    content = content.replace(search_str, replace_str)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Fixed originalBbox!")

if __name__ == '__main__':
    main()
