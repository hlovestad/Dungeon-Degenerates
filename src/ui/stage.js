// Helpers for putting characters into a scene: backgrounds, shadows, idle
// bobbing, Dani hovering beside Griffin, the party walking in.
import { SPRITE_HEIGHT, HERO_SLOTS, C } from '../config.js';
import { fitHeight, poseKey } from '../art/assets.js';
import { run } from '../systems/state.js';
import { text } from './ui.js';
import { T } from '../config.js';

export function background(scene, key) {
  const img = scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(-10);
  img.setDisplaySize(640, 360);
  return img;
}

// A character standing in the world. Returns a container whose (x, y) is the
// feet position, with .sprite, .shadow, .base (texture prefix), .h (height).
export function actor(scene, base, x, y, height, { flip = false, bob = true, float = 0, depth } = {}) {
  const cont = scene.add.container(x, y);
  const shadow = scene.add.ellipse(0, 0, Math.max(18, height * 0.45), 7, C.ink, 0.45);
  const sprite = scene.add.image(0, -float, poseKey(scene, base, 'idle')).setOrigin(0.5, 1);
  fitHeight(sprite, height);
  sprite.setFlipX(flip);
  cont.add([shadow, sprite]);
  cont.sprite = sprite;
  cont.shadow = shadow;
  cont.base = base;
  cont.h = height;
  cont.float = float;
  cont.setDepth(depth ?? y);
  if (bob) {
    scene.tweens.add({
      targets: sprite, y: sprite.y - (float ? 4 : 1), duration: float ? 900 : 520 + Math.random() * 200,
      yoyo: true, repeat: -1, ease: float ? 'Sine.InOut' : 'Stepped', delay: Math.random() * 400,
    });
  }
  cont.setPose = (pose) => {
    const k = poseKey(scene, base, pose);
    if (sprite.texture.key !== k) { sprite.setTexture(k); fitHeight(sprite, height); }
  };
  return cont;
}

// Spawn the whole party at the standard left-side slots, plus Dani if Griffin
// is present. Returns { heroes: [actor], dani: actor|null }.
export function spawnParty(scene, { walkIn = true, slots = HERO_SLOTS, onlyAlive = false } = {}) {
  const heroes = [];
  let dani = null;
  run.party.forEach((h, i) => {
    const s = slots[i];
    const a = actor(scene, h.race, s.x, s.y, SPRITE_HEIGHT.hero);
    a.hero = h;
    if (h.hp <= 0 && onlyAlive) a.setVisible(false);
    heroes.push(a);
    if (h.race === 'griffin') {
      dani = actor(scene, 'dani', s.x - 30, s.y - 8, SPRITE_HEIGHT.companion, { float: 14, depth: s.y - 9 });
    }
  });
  if (walkIn) {
    const all = dani ? [...heroes, dani] : heroes;
    all.forEach((a, i) => {
      const tx = a.x;
      a.x = tx - 260;
      scene.tweens.add({ targets: a, x: tx, duration: 900, delay: i * 70, ease: 'Quad.Out' });
      // step hop while walking
      scene.tweens.add({ targets: a.sprite, y: a.sprite.y - 3, duration: 110, yoyo: true, repeat: 3, delay: i * 70, ease: 'Stepped' });
    });
  }
  return { heroes, dani };
}

// Name tag under an actor (used outside battle).
export function nameTag(scene, a, str, color = T.cream) {
  return text(scene, a.x, a.y + 6, str, { size: 8, color, ox: 0.5, depth: a.depth + 1 });
}
