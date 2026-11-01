#!/usr/bin/env python3
"""Generate web images for every seeded job photo.

For each photo: strip EXIF (privacy — no GPS), apply EXIF orientation, and
write three sizes as JPEG into uploads/<slug>/<n>-<size>.jpg:
  - large  (max 1800px long edge) — lightbox / hero
  - medium (max 1100px)            — job page gallery
  - thumb  (640px, 4:3 center crop) — cards and grids
Also writes seed/photos.json with dimensions, used by the seed script.
"""
import json, os, sys
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
UPLOADS = os.path.join(ROOT, "data", "uploads")
SIZES = {"large": 1800, "medium": 1100}
THUMB = (640, 480)


def save(im, path, q):
    im.save(path, "JPEG", quality=q, optimize=True, progressive=True)


def main():
    jobs = json.load(open(os.path.join(HERE, "jobs.json")))["jobs"]
    sources = json.load(open(os.path.join(HERE, "sources.json")))  # slug -> folder of original photos (local only)
    # keep each photo's number stable across runs, so files already on a live site stay valid
    prev_path = os.path.join(HERE, "photos.json")
    prev = json.load(open(prev_path)) if os.path.exists(prev_path) else {}
    out = {}
    total = 0
    for j in jobs:
        known = {p["file"]: p["n"] for p in prev.get(j["slug"], []) if "file" in p}
        next_n = max(known.values(), default=0)
        d = os.path.join(UPLOADS, j["slug"])
        os.makedirs(d, exist_ok=True)
        out[j["slug"]] = []
        for p in j["photos"]:
            if p["file"] in known:
                i = known[p["file"]]
            else:
                next_n += 1
                i = next_n
            src = os.path.join(sources[j["slug"]], p["file"])
            im = Image.open(src)
            im = ImageOps.exif_transpose(im).convert("RGB")
            w, h = im.size
            rec = {"n": i, "file": p["file"], "caption": p.get("caption", ""), "w": w, "h": h, "files": {}}
            for name, mx in SIZES.items():
                c = im.copy()
                c.thumbnail((mx, mx), Image.LANCZOS)
                fn = f"{i:02d}-{name}.jpg"
                save(c, os.path.join(d, fn), 82 if name == "large" else 80)
                rec["files"][name] = fn
                rec[f"{name}_w"], rec[f"{name}_h"] = c.size
            t = ImageOps.fit(im, THUMB, Image.LANCZOS, centering=(0.5, 0.45))
            fn = f"{i:02d}-thumb.jpg"
            save(t, os.path.join(d, fn), 78)
            rec["files"]["thumb"] = fn
            out[j["slug"]].append(rec)
            total += 1
        print(j["slug"], len(j["photos"]))
    json.dump(out, open(os.path.join(HERE, "photos.json"), "w"), indent=1)
    print("done", total, "photos")


if __name__ == "__main__":
    main()
