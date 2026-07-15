import re
import sys

def main():
    file_path = 'src/components/editor/Canvas2D.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove unrotatePoints function
    pattern_unrotate = r'const unrotatePoints = \([^)]*\) => \{[\s\S]*?\};\n+'
    content = re.sub(pattern_unrotate, '', content)

    # 2. Revert Group rendering block
    pattern_group_setup = r'const originalBbox = getPolygonBoundingBox\(originalPts\);\s+const isBuilding = \[.*?\]\.includes\(zone\.type\);\s+const groupRot = \(isBuilding && zone\.rotation_deg\) \? zone\.rotation_deg : 0;\s+const cx = isBuilding \? originalBbox\.cx : 0;\s+const cy = isBuilding \? originalBbox\.cy : 0;\s+const renderPts = isBuilding \? unrotatePoints\(pts, cx, cy, groupRot\) : pts;\s+const flatPts = renderPts\.flat\(\);'
    
    replacement_group_setup = """const isBuilding = ['residential', 'commercial', 'mixed_use', 'industrial', 'institutional', 'amenity'].includes(zone.type);
            const flatPts = pts.flat();"""
    content = re.sub(pattern_group_setup, replacement_group_setup, content)

    # 3. Revert Group attributes
    # We want to change the <Group x={cx} y={cy} offsetX={cx} offsetY={cy} rotation={groupRot}
    # To <Group x={0} y={0} offsetX={0} offsetY={0} rotation={0}
    pattern_group_attrs = r'<Group\s+key=\{zone\.id\}\s+id=\{zone\.id\}\s+x=\{cx\}\s+y=\{cy\}\s+offsetX=\{cx\}\s+offsetY=\{cy\}\s+scaleX=\{1\}\s+scaleY=\{1\}\s+rotation=\{groupRot\}'
    replacement_group_attrs = """<Group
                key={zone.id}
                id={zone.id}
                x={0}
                y={0}
                offsetX={0}
                offsetY={0}
                scaleX={1}
                scaleY={1}
                rotation={0}"""
    content = re.sub(pattern_group_attrs, replacement_group_attrs, content)

    # 4. Revert onDragEnd
    pattern_drag_end = r'onDragEnd=\{\(e\) => \{\s+e\.cancelBubble = true;\s+if \(selectedCluster && selectedCluster\.zoneIds && selectedCluster\.zoneIds\.includes\(zone\.id\)\) \{\s+handleClusterDragEnd\(e, zone\.id\);\s+return;\s+\}\s+let dx = e\.currentTarget\.x\(\);\s+let dy = e\.currentTarget\.y\(\);\s+if \(isBuilding\) \{\s+dx -= cx;\s+dy -= cy;\s+e\.currentTarget\.x\(cx\);\s+e\.currentTarget\.y\(cy\);\s+\} else \{\s+e\.currentTarget\.x\(0\);\s+e\.currentTarget\.y\(0\);\s+\}\s+handleZoneDragEnd\(e, zone, dx, dy\);\s+\}\}'
    replacement_drag_end = """onDragEnd={(e) => {
                  e.cancelBubble = true;
                  if (selectedCluster && selectedCluster.zoneIds && selectedCluster.zoneIds.includes(zone.id)) {
                    handleClusterDragEnd(e, zone.id);
                    return;
                  }
                  const dx = e.currentTarget.x();
                  const dy = e.currentTarget.y();
                  e.currentTarget.x(0);
                  e.currentTarget.y(0);
                  handleZoneDragEnd(e, zone, dx, dy);
                }}"""
    content = re.sub(pattern_drag_end, replacement_drag_end, content)

    # 5. Revert onTransformEnd
    pattern_transform_end = r'onTransformEnd=\{\(e\) => \{\s+if \(isBuilding\) \{\s+const node = e\.target;\s+node\.x\(node\.x\(\) - cx\);\s+node\.y\(node\.y\(\) - cy\);\s+node\.rotation\(node\.rotation\(\) - groupRot\);\s+handleTransformEnd\(e, zone\);\s+\} else \{\s+handleTransformEnd\(e, zone\);\s+\}\s+\}\}'
    replacement_transform_end = """onTransformEnd={(e) => {
                  handleTransformEnd(e, zone);
                }}"""
    content = re.sub(pattern_transform_end, replacement_transform_end, content)

    # 6. Revert clipFunc isBuilding ? undefined to isBuilding ? null
    pattern_clipfunc = r'clipFunc=\{isBuilding \? undefined : \(ctx\) => \{'
    replacement_clipfunc = r'clipFunc={isBuilding ? null : (ctx) => {'
    content = re.sub(pattern_clipfunc, replacement_clipfunc, content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Reverted Canvas2D.jsx!")

if __name__ == '__main__':
    main()
