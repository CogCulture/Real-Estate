import re
with open('src/components/editor/Canvas2D.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# find {/* Zones Layer (Architectural Blueprint Style as Polygons) */}
#         <Layer>
# and add <Text text={`Zones: ${zones.length}, Roads: ${roads.length}`} x={0} y={0} fontSize={100} fill="red" />
pattern = r'(\{\/\* Zones Layer.*?<Layer>)'
replacement = r'\1\n          <Text text={`Z: ${zones.length} R: ${roads.length}`} x={0} y={0} fontSize={100} fill="red" />'
text = re.sub(pattern, replacement, text, flags=re.DOTALL)

with open('src/components/editor/Canvas2D.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
