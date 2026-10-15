#!/usr/bin/env python3
"""
Preprocess approved art from assets/raw/ into game-ready files.

    python tools/prep_sprites.py            (reads assets/raw, writes assets/sprites + assets/bg)
    python tools/prep_sprites.py --raw X --out Y --bg Z

What it does (raw files are never modified):
  1. Magenta (#FF00FF, with tolerance for off-magenta) -> transparent, hard edges only.
  2. Crops each image to its content.
  3. Scales every pose of a character by ONE factor, taken from that character's idle,
     so poses never change size. Box/area downsampling.
  4. Anchors every sprite on its feet: the output is padded so the feet sit exactly at
     the bottom-center. The game draws everything with origin (0.5, 1), so poses swap
     without jumping. (Dani floats in-game; her art is anchored the same way.)
  5. Backgrounds (bg_*) -> 480x270. Portraits (*_portrait) -> ~64x64, UI only.
  6. Registers every output in assets/manifest.json.

Sizes are in game-art pixels on a 480x270 stage (see ART_BASE in src/config.js).
Requires Pillow.
"""
import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

# Target idle heights (art pixels on the 480x270 stage).
TARGET_IDLE_H = {
    'haakon': 104,
    'mike': 92,
    'griffin': 96,
    'josh': 96,
    'dani': round(96 * 0.85),  # 85% of Griffin
    'goblin_grunt': 72,
}
DEFAULT_ENEMY_H = 72
PORTRAIT = 64
BG_SIZE = (480, 270)
POSES = ('idle', 'attack', 'hurt', 'downed', 'cast', 'victory', 'heal', 'scold', 'happy', 'talk', 'special', 'portrait')

# Magenta keying: distance from pure #FF00FF, plus a "magenta-ish" fringe test.
MAGENTA_TOL = 110


def is_magenta(r, g, b):
    dist2 = (255 - r) ** 2 + g ** 2 + (255 - b) ** 2
    if dist2 <= MAGENTA_TOL ** 2:
        return True
    # anti-aliased fringe: strongly red+blue, weak green, roughly balanced
    return r > 150 and b > 150 and g < 110 and abs(r - b) < 70 and (r + b) / 2 - g > 90


def split_key(stem):
    stem = re.sub(r'[^a-z0-9]+', '_', stem.lower()).strip('_')
    for pose in POSES:
        if stem.endswith('_' + pose):
            return stem[: -len(pose) - 1], pose, stem
    return stem, None, stem


def key_out(img):
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128 or is_magenta(r, g, b):
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (r, g, b, 255)
    return img


def hard_alpha(img):
    """No semi-transparent pixels: alpha >= 128 becomes opaque, the rest is cleared."""
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 128 else (0, 0, 0, 0)
    return img


def despeckle(img, min_px=4):
    """Drop tiny isolated specks left by the key (JPEG noise etc.)."""
    w, h = img.size
    px = img.load()
    seen = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if seen[y][x] or px[x, y][3] == 0:
                continue
            stack, comp = [(x, y)], []
            seen[y][x] = True
            while stack:
                cx, cy = stack.pop()
                comp.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny][3]:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            if len(comp) < min_px:
                for cx, cy in comp:
                    px[cx, cy] = (0, 0, 0, 0)
    return img


def feet_x(img):
    """Horizontal center of the feet: opaque-pixel centroid of the bottom 12% of rows."""
    w, h = img.size
    px = img.load()
    y0 = int(h * 0.88)
    xs = [x for y in range(y0, h) for x in range(w) if px[x, y][3]]
    if not xs:
        return w / 2
    return sum(xs) / len(xs)


def downscale(img, factor):
    w, h = img.size
    nw, nh = max(1, round(w * factor)), max(1, round(h * factor))
    if (nw, nh) == (w, h):
        return img
    # Pillow resizes RGBA with premultiplied alpha, so no magenta/black bleed at edges.
    return img.resize((nw, nh), Image.Resampling.BOX)


def anchor_feet(img):
    """Pad horizontally so the feet are centered; bottom of the image is the ground."""
    w, h = img.size
    fx = round(feet_x(img))
    half = max(fx, w - fx)
    out = Image.new('RGBA', (half * 2, h), (0, 0, 0, 0))
    out.paste(img, (half - fx, 0))
    return out


def process(raw_dir, out_dir, bg_dir, manifest_path):
    files = sorted(p for p in raw_dir.iterdir() if p.suffix.lower() in ('.png', '.webp', '.jpg', '.jpeg'))
    if not files:
        print(f'No images in {raw_dir}')
        sys.exit(1)
    groups = defaultdict(dict)
    backgrounds, others = [], []
    for f in files:
        base, pose, key = split_key(f.stem)
        if key.startswith('bg_') or key == 'map_background':
            backgrounds.append((key, f))
        elif pose:
            groups[base][pose] = f
        else:
            others.append((key, f))

    out_dir.mkdir(parents=True, exist_ok=True)
    bg_dir.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    images = manifest.setdefault('images', {})
    report = []

    for base, poses in sorted(groups.items()):
        # cropped, keyed versions of every pose (full resolution)
        cropped = {}
        for pose, f in poses.items():
            im = key_out(Image.open(f))
            im = despeckle(im)
            bbox = im.getbbox()
            if not bbox:
                report.append(f'SKIP {f.name}: empty after keying')
                continue
            cropped[pose] = im.crop(bbox)
        if not cropped:
            continue
        ref = cropped.get('idle') or next(iter(v for k, v in cropped.items() if k != 'portrait'), None)
        target = TARGET_IDLE_H.get(base, DEFAULT_ENEMY_H)
        factor = target / ref.size[1] if ref is not None else None
        for pose, im in cropped.items():
            key = f'{base}_{pose}'
            if pose == 'portrait':
                s = PORTRAIT / max(im.size)
                out = hard_alpha(downscale(im, s))
                # center on a square canvas
                sq = Image.new('RGBA', (PORTRAIT, PORTRAIT), (0, 0, 0, 0))
                sq.paste(out, ((PORTRAIT - out.size[0]) // 2, (PORTRAIT - out.size[1]) // 2))
                out = sq
            else:
                out = anchor_feet(hard_alpha(downscale(im, factor)))
            dest = out_dir / f'{key}.png'
            out.save(dest, optimize=True)
            images[key] = str(dest.relative_to(ROOT)).replace('\\', '/')
            report.append(f'{key:28s} {out.size[0]:4d}x{out.size[1]:<4d} scale {factor if pose != "portrait" else PORTRAIT / max(im.size):.4f}')

    for key, f in backgrounds:
        im = Image.open(f).convert('RGB')
        out = im.resize(BG_SIZE, Image.Resampling.BOX)
        dest = bg_dir / f'{key}.png'
        out.save(dest, optimize=True)
        images[key] = str(dest.relative_to(ROOT)).replace('\\', '/')
        report.append(f'{key:28s} {out.size[0]:4d}x{out.size[1]:<4d} background')

    for key, f in others:
        report.append(f'SKIP {f.name}: no pose suffix (expected name_idle, name_attack, ...)')

    manifest['images'] = dict(sorted(images.items()))
    manifest['artBase'] = {'width': BG_SIZE[0], 'height': BG_SIZE[1]}
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    print('\n'.join(report))
    print(f'\n{len(images)} images registered in {manifest_path.relative_to(ROOT)}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', default=str(ROOT / 'assets' / 'raw'))
    ap.add_argument('--out', default=str(ROOT / 'assets' / 'sprites'))
    ap.add_argument('--bg', default=str(ROOT / 'assets' / 'bg'))
    ap.add_argument('--manifest', default=str(ROOT / 'assets' / 'manifest.json'))
    a = ap.parse_args()
    process(Path(a.raw), Path(a.out), Path(a.bg), Path(a.manifest))


if __name__ == '__main__':
    main()
