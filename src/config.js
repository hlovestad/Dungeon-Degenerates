// Global constants shared by every scene.
export const VERSION = '0.3.0';

// Internal resolution. Everything is drawn at this size and scaled up to the
// screen with nearest-neighbour filtering, so pixel art stays crisp.
export const W = 640;
export const H = 360;

export const FONT = 'PressStart, monospace';

// UI palette (hex numbers for Phaser graphics, strings for text).
export const C = {
  ink: 0x140c1c,
  ink2: 0x1f1430,
  panel: 0x2a1d3a,
  panelHi: 0x3b2a52,
  border: 0xf4e3b5,
  gold: 0xf7c548,
  red: 0xd9473c,
  green: 0x6abe30,
  blue: 0x5fcde4,
  purple: 0x9b59d0,
  grey: 0x8a7f99,
  white: 0xfff6e0,
};
export const T = {
  cream: '#f4e3b5',
  gold: '#f7c548',
  red: '#ff6b5e',
  green: '#8be04e',
  blue: '#7fe0f0',
  purple: '#c58cff',
  grey: '#a89cb8',
  white: '#fff6e0',
  ink: '#140c1c',
};

// How tall (in game pixels) each kind of sprite is drawn on screen.
// Real art of any resolution is scaled to these heights, so ChatGPT's
// 512px images and the 32px placeholders line up identically.
export const SPRITE_HEIGHT = {
  hero: 76,
  companion: 58,
  enemy: 64,
  large: 92,
  boss: 132,
  npc: 72,
  icon: 24,
};

// Where units stand in a battle scene (feet positions). Heroes on the left
// facing right, enemies on the right facing left, like For The King.
export const HERO_SLOTS = [
  { x: 232, y: 254 },
  { x: 168, y: 226 },
  { x: 140, y: 274 },
  { x: 84, y: 240 },
];
export const ENEMY_SLOTS = [
  { x: 446, y: 252 },
  { x: 506, y: 228 },
  { x: 540, y: 272 },
  { x: 590, y: 242 },
];
export const BOSS_SLOT = { x: 520, y: 268 };
// Where Josh hides during dog fights.
export const BUSH_SPOT = { x: 330, y: 206 };
