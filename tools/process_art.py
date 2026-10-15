#!/usr/bin/env python3
"""
Turn raw ChatGPT art into game-ready pixel art and register it.

  python tools/process_art.py path/to/folder_of_pngs

For every PNG in the folder:
  * filename becomes the texture key (lowercase_snake_case, e.g. haakon_idle.png)
  * sprites: the magenta (#FF00FF) background is removed, the image is trimmed,
    snapped back down to its pixel grid and the colours are cleaned up
  * backgrounds (bg_* and map_background): resized to 480x270
  * result is saved to assets/sprites/ or assets/bg/ and added to
    assets/manifest.json, so the game uses it instead of the placeholder

Re-running is safe: files are overwritten and the manifest is merged.
Requires Pillow (pip install pillow).
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SPRITES = ROOT / "assets" / "sprites"
BGS = ROOT / "assets" / "bg"
MANIFEST = ROOT / "assets" / "manifest.json"

# Art-pixel height each category is snapped to (matches the ChatGPT art prompt grids).
GRID = {"boss": 128, "large": 96, "icon": 32, "default": 64}
LARGE = {"goblin_brute", "ogre_bouncer"}
ICON_PREFIXES = ("icon_", "node_", "status_", "action_", "class_", "fx_")


def key_for(path: Path) -> str:
    k = path.stem.lower()
    k = re.sub(r"[^a-z0-9]+", "_", k).strip("_")
    return k


def category(key: str) -> str:
    if key.startswith("bg_") or key == "map_background":
        return "bg"
    if key.startswith("boss_"):
        return "boss"
    if any(key.startswith(p) for p in ICON_PREFIXES):
        return "icon"
    base = re.sub(r"_(idle|attack|hurt|downed|cast|victory|heal|scold|happy|talk|special|portrait)$", "", key)
    if base in LARGE:
        return "large"
    return "default"


def is_magenta(r, g, b, tol=90):
    # pure-ish magenta and the pinkish fringe that image models leave around edges
    return r > 255 - tol and b > 255 - tol and g < tol + 40 and abs(r - b) < 80


def key_out(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0 or is_magenta(r, g, b):
                px[x, y] = (0, 0, 0, 0)
    return img


def snap_sprite(img: Image.Image, grid_h: int) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    img = img.crop(bbox)
    w, h = img.size
    # leave a little headroom: the sprite fills ~94% of its grid height
    target_h = max(8, round(grid_h * 0.94))
    scale = target_h / h
    target_w = max(1, round(w * scale))
    small = img.resize((target_w, target_h), Image.Resampling.BOX)
    # hard alpha (pixel art has no soft edges)
    px = small.load()
    for y in range(target_h):
        for x in range(target_w):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 128 else (0, 0, 0, 0)
    # tidy colours: quantize opaque pixels to a small palette
    rgb = small.convert("RGB").quantize(colors=32, method=Image.Quantize.MEDIANCUT).convert("RGBA")
    alpha = small.getchannel("A")
    rgb.putalpha(alpha)
    return rgb


def process(src: Path, manifest: dict) -> str:
    key = key_for(src)
    cat = category(key)
    img = Image.open(src)
    if cat == "bg":
        out = img.convert("RGB").resize((480, 270), Image.Resampling.BOX)
        out = out.quantize(colors=64, method=Image.Quantize.MEDIANCUT).convert("RGB")
        dest = BGS / f"{key}.png"
    else:
        out = snap_sprite(key_out(img), GRID[cat])
        dest = SPRITES / f"{key}.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, optimize=True)
    manifest.setdefault("images", {})[key] = str(dest.relative_to(ROOT)).replace("\\", "/")
    return f"{key:32s} {cat:8s} -> {dest.relative_to(ROOT)} {out.size[0]}x{out.size[1]}"


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    folder = Path(sys.argv[1])
    files = sorted(p for p in folder.rglob("*") if p.suffix.lower() in (".png", ".webp", ".jpg", ".jpeg"))
    if not files:
        print("No images found in", folder)
        sys.exit(1)
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    for f in files:
        try:
            print(process(f, manifest))
        except Exception as e:  # keep going on bad files
            print(f"SKIPPED {f.name}: {e}")
    manifest["images"] = dict(sorted(manifest.get("images", {}).items()))
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"\nManifest updated: {len(manifest['images'])} real images registered.")


if __name__ == "__main__":
    main()
