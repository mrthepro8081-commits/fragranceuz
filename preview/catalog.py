"""Writes dist-preview/catalog.json: the seed catalog with compressed, watermark-free photos inlined."""
import base64, io, json, os
from PIL import Image
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
products = json.load(open(os.path.join(root, 'data', 'products.json')))
for p in products:
    path = os.path.join(root, 'public', p['image'].lstrip('/')) if p.get('image') else None
    if path and os.path.exists(path):
        im = Image.open(path).convert('RGB')
        w, h = im.size
        im = im.crop((0, 0, w, int(h * 0.8625))).resize((460, 397))
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=68)
        p['image'] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
    else:
        p['image'] = None
    p.pop('photoSource', None)
    p.pop('sourceText', None)
products.sort(key=lambda p: -int(p['id']))
out = os.path.join(root, 'dist-preview', 'catalog.json')
json.dump([p for p in products if p.get('active', True)], open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(products), 'products', os.path.getsize(out) // 1024, 'KB')
