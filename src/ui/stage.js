// Helpers for putting characters into a scene: backgrounds, shadows, idle
// bobbing, Dani hovering beside Griffin, the party walking in.
import { SPRITE_HEIGHT, HERO_SLOTS, C } from '../config.js';
import { fitHeight, poseKey, sizeSprite, isReal, faceKey } from '../art/assets.js';
import { isArcade } from '../systems/arcade.js';
import { RACES } from '../data/races.js';
import { ART_SCALE, DANI_HOVER } from '../config.js';
import { run } from '../systems/state.js';
import { text } from './ui.js';
import { T } from '../config.js';

export function background(scene, key) {
  const img = scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(-10);
  img.setDisplaySize(640, 360);
  sideFill(scene, key, img.depth);
  return img;
}

// Wide phones see past the 640 stage: mirror the background into that space
// so the floor lines up and there are no black bars.
export function sideFill(scene, key, depth = -10) {
  [-640, 640].forEach((x) => {
    scene.add.image(x, 0, key).setOrigin(0, 0).setDisplaySize(640, 360).setFlipX(true).setDepth(depth - 0.5);
  });
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

// ARCADE characters are portraits, never full bodies. This returns a framed
// portrait that behaves like an actor: (x, y) is the bottom of the frame,
// .sprite/.h/.float/.setPose work, so bubbles, chaos and floaters all land.
// scale: 1 = 64px portrait, 2 = 128px. Keep it a whole number (crisp pixels).
export function portraitActor(scene, race, x, y, { scale = 1, depth, label = true } = {}) {
  const cont = scene.add.container(x, y);
  const img = scene.add.image(0, 0, faceKey(scene, race)).setOrigin(0.5, 1);
  if (isReal(img.texture.key)) img.setScale(scale); else fitHeight(img, 64 * scale);
  const s = img.displayHeight;
  const pad = 3;
  const col = Phaser.Display.Color.HexStringToColor(RACES[race]?.color || '#f4e3b5').color;
  const frame = scene.add.graphics();
  const drawFrame = (border) => {
    frame.clear();
    frame.fillStyle(C.ink, 1).fillRect(-s / 2 - pad - 1, -s - pad - 1, s + pad * 2 + 2, s + pad * 2 + 2);
    frame.fillStyle(0x2a1d3a, 1).fillRect(-s / 2 - pad + 1, -s - pad + 1, s + pad * 2 - 2, s + pad * 2 - 2);
    frame.lineStyle(2, border, 1).strokeRect(-s / 2 - pad + 1, -s - pad + 1, s + pad * 2 - 2, s + pad * 2 - 2);
  };
  drawFrame(col);
  img.setY(0);
  cont.add([frame, img]);
  const tint = RACES[race]?.tint;
  if (tint) img.setTint(tint);
  if (label && RACES[race]) {
    cont.add(text(scene, 0, pad + 2, RACES[race].name.toUpperCase(), { size: 8, ox: 0.5, color: RACES[race].color }));
  }
  cont.sprite = img;
  cont.base = race;
  cont.h = s + pad;
  cont.float = 0;
  cont.portrait = true;
  cont.setDepth(depth ?? 50);
  // gentle 1px breathing so the room doesn't feel frozen
  scene.tweens.add({ targets: img, y: -1, duration: 600 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Stepped', delay: Math.random() * 400 });
  cont.setPose = (pose) => {
    if (pose === 'hurt') { drawFrame(C.red); img.setTint(0xff9a8a); }
    else if (pose === 'victory') { drawFrame(C.gold); img.clearTint(); }
    else if (pose === 'downed') { drawFrame(C.grey); img.setTint(0x6a6070); }
    else { drawFrame(col); if (tint) img.setTint(tint); else img.clearTint(); }
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
  if (isArcade()) return spawnPortraits(scene, slots);
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

// Arcade version of spawnParty: a row of portraits where the party
// would have stood, plus a small Dani tucked onto Griffin's frame.
function spawnPortraits(scene, slots) {
  const cx = Math.round(slots.reduce((n, s) => n + s.x, 0) / slots.length);
  const by = Math.max(...slots.map((s) => s.y));
  const x0 = Math.max(40, cx - 108);
  const spots = [0, 1, 2, 3].map((k) => ({ x: x0 + k * 72, y: by - 14 }));
  const heroes = [];
  let dani = null;
  run.party.forEach((h, i) => {
    const s = spots[i % 4];
    const a = portraitActor(scene, h.race, s.x, s.y, { depth: 60 + i });
    a.hero = h;
    heroes.push(a);
    if (h.race === 'griffin') dani = spawnDaniPortrait(scene, a);
  });
  return { heroes, dani };
}

// Dani's little portrait, pinned to the top corner of Griffin's frame.
export function spawnDaniPortrait(scene, griffin, scale = 0.5) {
  const a = portraitActor(scene, 'dani', griffin.x + griffin.h * 0.42, griffin.y - griffin.h + 30 * scale, { scale, depth: griffin.depth + 1, label: false });
  return a;
}

// Name tag under an actor (used outside battle).
export function nameTag(scene, a, str, color = T.cream) {
  return text(scene, a.x, a.y + 6, str, { size: 8, color, ox: 0.5, depth: a.depth + 1 });
}
