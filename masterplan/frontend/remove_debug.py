import re
with open('src/components/editor/Canvas2D.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

pattern = r'\s*<Text text=\{`Z: \$\{zones\.length\} R: \$\{roads\.length\}`\} x=\{0\} y=\{0\} fontSize=\{100\} fill="red" />'
text = re.sub(pattern, '', text)

with open('src/components/editor/Canvas2D.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
