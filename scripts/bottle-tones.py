"""Extract each bottle's dominant colour from public/products/*.jpg.

Writes data/bottle-tones.json: {"<id>": {"tone": "#rrggbb", "family": "gold"}}.
The storefront uses the tone to tint each product's showcase and the family for the
"bottle colour" filter. Products added later without an entry get a tone computed in
the browser, so re-running this is optional:  python3 scripts/bottle-tones.py
"""
import colorsys
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS = os.path.join(ROOT, "public", "products")
OUT = os.path.join(ROOT, "data", "bottle-tones.json")
BOTTLE_AREA = 0.86  # the channel watermark sits below this line


def family(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    h *= 360
    if s < 0.16 or (l < 0.12) or (l > 0.9):
        return "black" if l < 0.28 else "clear" if l > 0.7 else "silver"
    if l < 0.2 and s < 0.4:
        return "black"
    if h < 14 or h >= 345:
        return "pink" if l > 0.62 else "red"
    if h < 34:
        return "amber" if l < 0.62 else "pink"
    if h < 66:
        return "gold"
    if h < 165:
        return "green"
    if h < 252:
        return "blue"
    if h < 295:
        return "purple"
    return "pink"


def analyse(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    im = im.crop((0, 0, w, int(h * BOTTLE_AREA))).resize((90, 77))
    pixels = [p for p in im.getdata() if min(p) < 228]
    if len(pixels) < 120:
        return {"tone": "#e6dfd3", "family": "clear"}
    dark = sum(1 for p in pixels if max(p) < 60) / len(pixels)
    sample = Image.new("RGB", (len(pixels), 1))
    sample.putdata(pixels)
    clusters = sample.quantize(colors=6, method=Image.Quantize.MEDIANCUT)
    palette = clusters.getpalette()
    best, best_score = (200, 200, 200), -1
    for count, idx in clusters.getcolors():
        r, g, b = palette[idx * 3: idx * 3 + 3]
        _, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        score = count * (0.25 + s) * (0.4 if l < 0.12 or l > 0.92 else 1)
        if score > best_score:
            best, best_score = (r, g, b), score
    fam = "black" if dark > 0.42 else family(*best)
    if fam == "black":
        best = (58, 50, 46)
    return {"tone": "#%02x%02x%02x" % best, "family": fam}


def main():
    result = {}
    files = sorted(f for f in os.listdir(PHOTOS) if f.endswith(".jpg"))
    for name in files:
        result[name[:-4]] = analyse(os.path.join(PHOTOS, name))
    with open(OUT, "w") as fh:
        json.dump(result, fh, separators=(",", ":"), sort_keys=True)
    counts = {}
    for v in result.values():
        counts[v["family"]] = counts.get(v["family"], 0) + 1
    print(f"{len(result)} bottles →", ", ".join(f"{k} {v}" for k, v in sorted(counts.items(), key=lambda x: -x[1])), file=sys.stderr)


if __name__ == "__main__":
    main()
