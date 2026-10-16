// Portrait ("tall") mode for scenes that play upright, like the card table.
// The rest of the game is 640x360 landscape. A tall scene switches the canvas
// to TALL_W wide and exactly as tall as the screen's shape, so it fills any
// phone with no black bars, and re-fits when the screen changes size.
import { W, H } from '../config.js';

export const TALL_W = 288; // narrow enough that text and cards stay big on a phone
const MIN_H = 480, MAX_H = 760;

export function tallSize() {
  const w = window.innerWidth || 390, h = window.innerHeight || 844;
  const portrait = h >= w;
  // phones held upright: match the screen; desktops / sideways: a tidy column
  const th = portrait ? Math.round((TALL_W * h) / w) : 560;
  return { w: TALL_W, h: Math.max(MIN_H, Math.min(MAX_H, th)) };
}

// Call in create(). onResize(size) runs when the screen changes shape.
export function enterTall(scene, onResize) {
  document.body.classList.add('tall');
  const apply = (first) => {
    const s = tallSize();
    if (s.w !== scene.scale.width || s.h !== scene.scale.height) {
      scene.scale.setGameSize(s.w, s.h);
      scene.cameras.main.setSize(s.w, s.h);
      if (!first) onResize?.(s);
    }
  };
  apply(true);
  let t = null;
  const handler = () => { clearTimeout(t); t = setTimeout(() => apply(false), 200); };
  window.addEventListener('resize', handler);
  window.addEventListener('orientationchange', handler);
  scene.events.once('shutdown', () => {
    window.removeEventListener('resize', handler);
    window.removeEventListener('orientationchange', handler);
    clearTimeout(t);
    leaveTall(scene);
  });
}

export function leaveTall(scene) {
  document.body.classList.remove('tall');
  if (scene.scale.width !== W || scene.scale.height !== H) scene.scale.setGameSize(W, H);
}
