// Tiny pixel painter used to build placeholder art at runtime.
// Draw on a small canvas, then an outline pass adds a 1px dark border, which
// is what makes the placeholders read as "pixel art" at a glance.

export const OUTLINE = '#140c1c';

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * f)));
  g = Math.max(0, Math.min(255, Math.round(g * f)));
  b = Math.max(0, Math.min(255, Math.round(b * f)));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Returns a painter that draws into a (w+2)x(h+2) canvas (1px margin for the outline).
export function painter(w, h, { outline = true, margin = 1 } = {}) {
  const m = outline ? margin : 0;
  const canvas = makeCanvas(w + m * 2, h + m * 2);
  const ctx = canvas.getContext('2d');
  const p = {
    canvas, ctx, w, h,
    r(x, y, rw, rh, col) {
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x) + m, Math.round(y) + m, Math.round(rw), Math.round(rh));
    },
    px(x, y, col) { p.r(x, y, 1, 1, col); },
    // horizontal line from x0 to x1 inclusive
    h(y, x0, x1, col) { p.r(x0, y, x1 - x0 + 1, 1, col); },
    v(x, y0, y1, col) { p.r(x, y0, 1, y1 - y0 + 1, col); },
    ell(cx, cy, rx, ry, col) {
      for (let y = -ry; y <= ry; y++) {
        const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
        p.h(cy + y, cx - half, cx + half, col);
      }
    },
    // pixels from an array of strings using a palette map; '.' is transparent
    map(x, y, rows, pal) {
      rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const ch = row[i];
          if (ch !== '.' && pal[ch]) p.px(x + i, y + j, pal[ch]);
        }
      });
    },
    finish() {
      if (outline) addOutline(canvas);
      return canvas;
    },
  };
  return p;
}

function addOutline(canvas) {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const marks = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) marks.push([x, y]);
    }
  }
  ctx.fillStyle = OUTLINE;
  marks.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
}

// Deterministic noise for backgrounds.
export function noise(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
