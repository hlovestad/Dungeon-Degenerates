// Shared pixel-style UI pieces: text, panels, buttons, bubbles, floaters.
import { C, T, FONT } from '../config.js';
import { sfx } from '../audio/sfx.js';

export function text(scene, x, y, str, opts = {}) {
  const t = scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: (opts.size || 10) + 'px',
    color: opts.color || T.cream,
    align: opts.align || 'left',
    lineSpacing: opts.lineSpacing ?? 6,
    wordWrap: opts.wrap ? { width: opts.wrap, useAdvancedWrap: true } : undefined,
    stroke: opts.stroke === false ? undefined : T.ink,
    strokeThickness: opts.stroke === false ? 0 : (opts.strokeThickness ?? 3),
  });
  t.setOrigin(opts.ox ?? 0, opts.oy ?? 0);
  if (opts.depth) t.setDepth(opts.depth);
  return t;
}

export function panel(scene, x, y, w, h, opts = {}) {
  const g = scene.add.graphics();
  drawPanel(g, 0, 0, w, h, opts);
  g.setPosition(x, y);
  if (opts.depth) g.setDepth(opts.depth);
  return g;
}

export function drawPanel(g, x, y, w, h, { fill = C.panel, border = C.border, alpha = 0.94, hi = true } = {}) {
  g.fillStyle(C.ink, alpha);
  g.fillRect(x - 2, y, w + 4, h);
  g.fillRect(x, y - 2, w, h + 4);
  g.fillStyle(border, 1);
  g.fillRect(x, y, w, h);
  g.fillStyle(fill, alpha);
  g.fillRect(x + 2, y + 2, w - 4, h - 4);
  if (hi) {
    g.fillStyle(0xffffff, 0.08);
    g.fillRect(x + 2, y + 2, w - 4, 2);
    g.fillStyle(0x000000, 0.18);
    g.fillRect(x + 2, y + h - 4, w - 4, 2);
  }
}

// A chunky tappable button. Returns a container with .setEnabled(bool) and .setLabel(str).
export function button(scene, x, y, w, h, label, onTap, opts = {}) {
  const cont = scene.add.container(x, y);
  const g = scene.add.graphics();
  const fill = opts.fill ?? C.panelHi;
  const t = text(scene, w / 2, h / 2, label, { size: opts.size || 10, ox: 0.5, oy: 0.5, color: opts.color || T.cream, align: 'center', wrap: w - 8 });
  let sub = null;
  if (opts.sub) {
    // title near the top, description underneath (wraps to 2 lines on tall buttons)
    t.setY(Math.min(h / 2 - 6, 15));
    sub = text(scene, w / 2, h >= 52 ? h / 2 + 9 : h / 2 + 9, opts.sub, {
      size: 8, ox: 0.5, oy: 0.5, color: opts.subColor || T.grey, align: 'center', wrap: w - 10, lineSpacing: 3, strokeThickness: 2,
    });
  }
  cont.add([g, t]);
  if (sub) cont.add(sub);
  cont.setSize(w, h);
  let enabled = true;
  let pressed = false;
  const redraw = () => {
    g.clear();
    const f = !enabled ? C.ink2 : pressed ? C.panel : opts.selected ? 0x5a3f7a : fill;
    drawPanel(g, 0, pressed ? 2 : 0, w, h - (pressed ? 2 : 0), { fill: f, border: enabled ? (opts.border ?? C.border) : C.grey });
    t.setAlpha(enabled ? 1 : 0.45);
    if (sub) sub.setAlpha(enabled ? 1 : 0.45);
  };
  redraw();
  const zone = scene.add.zone(w / 2, h / 2, w + 6, h + 6).setInteractive({ useHandCursor: true });
  cont.add(zone);
  zone.on('pointerdown', () => { if (!enabled) return; pressed = true; redraw(); });
  zone.on('pointerout', () => { if (pressed) { pressed = false; redraw(); } });
  zone.on('pointerup', () => {
    if (!enabled || !pressed) return;
    pressed = false; redraw();
    sfx('select');
    onTap && onTap();
  });
  cont.setEnabled = (v) => { enabled = v; redraw(); return cont; };
  cont.setLabel = (s) => { t.setText(s); return cont; };
  cont.setSelected = (v) => { opts.selected = v; redraw(); return cont; };
  cont.label = t;
  if (opts.depth) cont.setDepth(opts.depth);
  return cont;
}

// Small icon-only toggle in a corner (mute, etc.)
export function iconButton(scene, x, y, label, onTap, depth = 50) {
  return button(scene, x, y, 30, 24, label, onTap, { size: 10, depth });
}

// Floating combat text that rises and fades.
export function floater(scene, x, y, str, color = T.white, size = 12, big = false) {
  const t = text(scene, x, y, str, { size: big ? 16 : size, color, ox: 0.5, oy: 1, depth: 60, strokeThickness: 4 });
  t.setScale(big ? 1.4 : 1);
  scene.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.Out' });
  scene.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 900, delay: 350, ease: 'Cubic.In', onComplete: () => t.destroy() });
  return t;
}

// Speech bubble above a point. Auto-removes.
export function bubble(scene, x, y, str, ms = 1300, color = T.ink) {
  const t = text(scene, 0, 0, str, { size: 8, color, stroke: false, wrap: 150, align: 'center', ox: 0.5, oy: 1, lineSpacing: 3 });
  const w = Math.min(160, t.width + 12), h = t.height + 10;
  const g = scene.add.graphics();
  g.fillStyle(C.ink, 1);
  g.fillRect(-w / 2 - 1, -h - 7, w + 2, h + 2);
  g.fillStyle(0xfff6e0, 1);
  g.fillRect(-w / 2, -h - 6, w, h);
  g.fillTriangle(-4, -7, 4, -7, 0, -1);
  t.setPosition(0, -11);
  const cx = Math.max(w / 2 + 4, Math.min(640 - w / 2 - 4, x));
  const cont = scene.add.container(cx, Math.max(h + 10, y), [g, t]).setDepth(70);
  cont.setScale(0.6);
  scene.tweens.add({ targets: cont, scale: 1, duration: 140, ease: 'Back.Out' });
  scene.time.delayedCall(ms, () => scene.tweens.add({ targets: cont, alpha: 0, duration: 200, onComplete: () => cont.destroy() }));
  return cont;
}

// Tiny HP bar drawn with a Graphics object.
export function hpBar(scene, w = 34) {
  const g = scene.add.graphics();
  g.draw = (hp, max, color = C.green) => {
    g.clear();
    g.fillStyle(C.ink, 1);
    g.fillRect(-w / 2 - 1, -1, w + 2, 6);
    g.fillStyle(0x3a1a24, 1);
    g.fillRect(-w / 2, 0, w, 4);
    const pct = Math.max(0, hp / max);
    g.fillStyle(pct < 0.3 ? C.red : pct < 0.6 ? C.gold : color, 1);
    g.fillRect(-w / 2, 0, Math.round(w * pct), 4);
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(-w / 2, 0, Math.round(w * pct), 1);
  };
  return g;
}

// Full-screen dim layer that blocks input below it.
export function dimmer(scene, alpha = 0.6, depth = 80) {
  const r = scene.add.rectangle(320, 180, 640, 360, C.ink, alpha).setDepth(depth).setInteractive();
  return r;
}

// Gold display in the corner.
export function goldBadge(scene, x, y, getGold, depth = 40) {
  const icon = scene.add.image(x, y, 'icon_gold_coin').setScale(1).setDepth(depth).setOrigin(0, 0.5);
  const t = text(scene, x + 20, y, '', { size: 10, color: T.gold, oy: 0.5, depth });
  const refresh = () => t.setText(String(getGold()));
  refresh();
  return { icon, t, refresh };
}

// Fade helpers for scene transitions.
export function fadeTo(scene, key, data) {
  scene.cameras.main.fadeOut(220, 11, 7, 16);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}
export function fadeIn(scene) {
  scene.cameras.main.fadeIn(260, 11, 7, 16);
}
