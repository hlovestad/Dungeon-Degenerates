// Helpers for putting characters into a scene: backgrounds, shadows, idle
// bobbing, Dani hovering beside Griffin, the party walking in.
import { SPRITE_HEIGHT, HERO_SLOTS, C } from '../config.js';
import { fitHeight, poseKey, sizeSprite, isReal } from '../art/assets.js';
import { ART_SCALE, DANI_HOVER } from '../config.js';
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
  sizeSprite(sprite, height);
  sprite.setFlipX(flip);
  if (isReal(sprite.texture.key)) shadow.setSize(Math.max(18, sprite.displayWidth * 0.5), 7);
  cont.add([shadow, sprite]);
  cont.sprite = sprite;
  cont.shadow = shadow;
  cont.base = base;
  cont.h = sprite.displayHeight;
  cont.float = float;
  cont.setDepth(depth ?? y);
  if (bob) {
    // idle: a 1px "breathing" bob; floaters (Dani, drones) get a slow gentle hover
    scene.tweens.add({
      targets: sprite, y: sprite.y - (float ? 3 : 1), duration: float ? 1100 : 520 + Math.random() * 200,
      yoyo: true, repeat: -1, ease: float ? 'Sine.InOut' : 'Stepped', delay: Math.random() * 400,
    });
  }
  cont.setPose = (pose) => {
    const k = poseKey(scene, base, pose);
    if (sprite.texture.key !== k) { sprite.setTexture(k); sizeSprite(sprite, height); }
  };
  return cont;
}

// Dani hovers beside and slightly behind Griffin (behind = to his left, drawn
// underneath him), ~12 art px off the ground.
export function spawnDani(scene, griffin, depthOffset = 1) {
  const hover = isReal('dani_idle') ? Math.round(DANI_HOVER * ART_SCALE) : 14;
  const gx = griffin.x, gy = griffin.y;
  const back = Math.max(26, griffin.sprite.displayWidth * 0.45);
  return actor(scene, 'dani', gx - back, gy - 6, SPRITE_HEIGHT.companion, { float: hover, depth: gy - 6 - depthOffset });
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
      dani = spawnDani(scene, a);
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
