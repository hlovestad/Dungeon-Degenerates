// Texture registry. Real art listed in assets/manifest.json is loaded first;
// anything missing gets a generated placeholder under the same key.
//
// Key convention (matches the ChatGPT art prompt filenames):
//   <name>_<pose>   e.g. haakon_idle, haakon_attack, goblin_grunt_hurt
//   bg_<room>       e.g. bg_dungeon_crypt
//   icon_<thing>, node_<type>, prop_<thing>

import * as Art from './characters.js';
import { drawIcon, ICON_KEYS } from './icons.js';
import { drawBackground, drawMapBackground, BG_KEYS } from './backgrounds.js';

const PLACEHOLDERS = {
  haakon_idle: () => Art.drawHero('haakon'),
  mike_idle: () => Art.drawHero('mike'),
  josh_idle: () => Art.drawHero('josh'),
  griffin_idle: () => Art.drawHero('griffin'),
  dani_idle: () => Art.drawDani(),
  goblin_grunt_idle: () => Art.drawGoblin('grunt'),
  goblin_archer_idle: () => Art.drawGoblin('archer'),
  goblin_brute_idle: () => Art.drawGoblinBrute(),
  dire_wolf_idle: () => Art.drawWolf(),
  skeleton_auditor_idle: () => Art.drawSkeleton(),
  slime_blob_idle: () => Art.drawSlime(),
  grey_alien_idle: () => Art.drawAlien(),
  alien_probe_drone_idle: () => Art.drawDrone(),
  mimic_chest_idle: () => Art.drawMimic(),
  boss_dungeon_landlord_idle: () => Art.drawLandlord(),
  npc_goblin_merchant_idle: () => Art.drawGoblinMerchant(),
  npc_goblin_dealer_idle: () => Art.drawGoblinDealer(),
  npc_devil_dealer_idle: () => Art.drawDevil(),
  prop_campfire: () => Art.drawCampfire(),
  prop_chest: () => Art.drawChest(),
  prop_boulder: () => Art.drawBoulder(),
  prop_slots: () => Art.drawSlotMachine(),
  map_background: () => drawMapBackground(),
};
ICON_KEYS.forEach((k) => { PLACEHOLDERS[k] = () => drawIcon(k); });
BG_KEYS.forEach((k) => { PLACEHOLDERS[k] = () => drawBackground(k); });

export function registerPlaceholders(scene) {
  for (const [key, fn] of Object.entries(PLACEHOLDERS)) {
    if (scene.textures.exists(key)) continue;
    const canvas = fn();
    if (canvas) scene.textures.addCanvas(key, canvas);
  }
}

// Pick the best available texture for a pose, falling back to idle.
export function poseKey(scene, base, pose = 'idle') {
  const k = `${base}_${pose}`;
  return scene.textures.exists(k) ? k : `${base}_idle`;
}

// Set a sprite's scale so its visible height matches `height` game pixels,
// whatever resolution the source art is.
export function fitHeight(sprite, height) {
  const src = sprite.frame.realHeight || sprite.height;
  sprite.setScale(height / src);
  return sprite;
}
