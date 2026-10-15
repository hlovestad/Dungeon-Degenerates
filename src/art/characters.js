// Placeholder pixel sprites, generated in code. Every sprite is drawn facing
// RIGHT; enemies are flipped in-game. When real art arrives (assets/manifest.json)
// it replaces these by texture key, e.g. "haakon_idle".

import { painter, shade } from './painter.js';

// ------------------------------------------------------------------ humanoid
function humanoid(p, o) {
  const b = o.bulk || 0;
  const skin = o.skin, skinD = shade(o.skin, 0.78);
  const out = o.outfit, outD = shade(o.outfit, 0.7);
  const armW = 2 + b;

  // things behind the body
  if (o.behind) o.behind(p);

  // legs + boots
  if (!o.robe) {
    p.r(12 - Math.floor(b / 2), 24, 3 + Math.ceil(b / 2), 8, shade(o.pants, 0.8));
    p.r(17, 24, 3 + Math.ceil(b / 2), 8, o.pants);
    p.r(15, 24, 2, 2, o.pants);
  }
  p.r(11 - Math.floor(b / 2), 32, 4 + Math.ceil(b / 2), 3, shade(o.boots, 0.8));
  p.r(17, 32, 4 + Math.ceil(b / 2), 3, o.boots);

  // back arm
  const bx = 11 - b - armW;
  p.r(bx, 15, armW, 9, o.bareArms ? skinD : outD);
  p.r(bx, 24, armW, 2, o.gloves || skinD);

  // torso
  if (o.robe) {
    p.r(11 - b, 15, 10 + b * 2, 18, out);
    p.r(11 - b, 15, 2, 18, outD);
    if (o.trim) { p.h(32, 11 - b, 20 + b, o.trim); p.v(16, 17, 32, o.trim); }
  } else {
    p.r(11 - b, 15, 10 + b * 2, 9, out);
    p.r(11 - b, 15, 2, 9, outD);
  }
  if (o.torso) o.torso(p, b);
  if (o.belt) p.h(23, 11 - b, 20 + b, o.belt);

  // neck + head
  p.r(14, 13, 4, 2, o.collar || skinD);
  p.r(12, 6, 8, 8, skin);
  p.v(12, 6, 13, skinD);
  p.h(13, 13, 19, skinD);
  // ear
  if (o.ears === 'pointy') {
    p.r(12, 8, 2, 3, skinD); p.px(11, 7, skinD); p.px(10, 6, skinD); p.px(11, 8, skinD);
  } else {
    p.r(13, 9, 1, 2, skinD);
  }
  // eyes / brows / mouth
  p.px(15, 9, '#1a1020'); p.px(18, 9, '#1a1020');
  p.px(15, 8, shade(o.hair, 0.8)); p.px(18, 8, shade(o.hair, 0.8)); p.px(19, 8, shade(o.hair, 0.8));
  p.h(12, 17, 18, o.mouth || shade(skin, 0.6));
  // nose
  if (o.nose === 'big') {
    p.h(9, 19, 21, skin);
    p.h(10, 19, 22, skin);
    p.h(11, 19, 23, skin);
    p.h(12, 20, 22, skinD);
    p.px(22, 11, skinD); p.px(20, 9, shade(skin, 1.1));
  } else {
    p.px(20, 10, skin); p.px(20, 11, skinD);
  }
  if (o.face) o.face(p);
  // hair on top
  if (o.hairFn) o.hairFn(p, o.hair);
  if (o.head) o.head(p);

  // front arm (over torso)
  const fx = 21 + b;
  p.r(fx, 15, armW, 9, o.bareArms ? skin : out);
  if (o.bareArms) p.v(fx, 16, 22, shade(skin, 1.12));
  if (o.shoulders) o.shoulders(p, b);
  p.r(fx, 24, armW, 2, o.gloves || skin);

  if (o.weapon) o.weapon(p, b);
}

// Hair styles -------------------------------------------------------------
const hairShortWavy = (p, c) => {
  const d = shade(c, 0.75);
  p.h(5, 12, 19, c); p.h(4, 13, 19, c); p.px(14, 3, c); p.px(17, 3, c); p.px(19, 3, d);
  p.r(12, 6, 2, 4, c); p.px(14, 6, c); p.px(19, 6, c); p.px(12, 10, d);
  p.px(15, 4, d); p.px(18, 4, d);
};
const hairCurly = (p, c) => {
  const d = shade(c, 0.72);
  p.ell(15, 4, 6, 3, c);
  p.r(10, 5, 4, 7, c);
  [[10, 2], [13, 1], [16, 1], [19, 2], [21, 4], [9, 6], [9, 9], [10, 11]].forEach(([x, y]) => p.px(x, y, c));
  [[12, 3], [15, 2], [18, 3], [11, 7], [11, 10], [14, 5], [17, 5]].forEach(([x, y]) => p.px(x, y, d));
  p.px(20, 6, c); p.px(19, 6, c);
};
const hairBlond = (p, c) => {
  const d = shade(c, 0.78);
  p.h(5, 12, 19, c); p.h(4, 13, 18, c); p.r(12, 6, 2, 3, c); p.px(19, 5, d); p.px(18, 5, d);
  p.px(16, 4, d); p.px(14, 3, c); p.px(15, 3, c);
};
const hairLong = (len) => (p, c) => {
  const d = shade(c, 0.72);
  p.h(5, 12, 19, c); p.h(4, 13, 18, c); p.h(3, 14, 17, c);
  p.r(9, 5, 5, len, c);
  p.r(8, 9, 2, len - 6, d);
  p.v(11, 7, 5 + len - 2, d);
  p.px(19, 6, c); p.px(18, 6, d);
  for (let y = 6; y < 5 + len; y += 3) p.px(8 + ((y / 3) % 2), y, c);
};

// Weapons -----------------------------------------------------------------
const hammer = (p, b) => {
  const x = 24 + b;
  p.r(x, 8, 2, 22, '#7a4a28'); p.v(x, 8, 29, '#5a3418');
  p.r(x - 3, 3, 8, 6, '#9aa3b5'); p.r(x - 3, 3, 8, 1, '#c8d0dc'); p.r(x - 3, 8, 8, 1, '#5d6474');
  p.r(x - 1, 4, 4, 4, '#b8c0cc');
};
const cleaver = (p, b) => {
  const x = 23 + b;
  p.r(x, 23, 2, 4, '#5a3418');
  p.r(x - 1, 15, 5, 8, '#b8c0cc'); p.v(x + 3, 15, 22, '#e8eef4'); p.px(x, 16, '#5d6474');
  p.px(x + 1, 18, '#8a3020');
};
const staff = (p) => {
  p.v(26, 6, 34, '#8a5a2a'); p.v(27, 6, 34, '#6a4018');
  p.ell(26, 3, 2, 2, '#5fe8ff'); p.px(25, 2, '#e8ffff');
  p.px(29, 1, '#c58cff'); p.px(23, 0, '#c58cff');
};
const dagger = (p, b) => {
  const x = 23 + b;
  p.r(x, 18, 1, 6, '#dfe6ee'); p.r(x + 1, 18, 1, 6, '#a8b0bc');
  p.r(x - 1, 24, 4, 1, '#f7c548'); p.r(x, 25, 2, 2, '#5a3418');
};

// ------------------------------------------------------------------ heroes
export const HERO_DEFS = {
  haakon: {
    skin: '#e9b48a', hair: '#3a2418', hairFn: hairShortWavy, outfit: '#7b8496', pants: '#3b2f4a',
    boots: '#4a3020', bulk: 2, bareArms: true, belt: '#5a3418', weapon: hammer,
    torso: (p, b) => {
      p.r(12 - b, 16, 8 + b * 2, 6, '#9aa3b5');
      p.h(16, 12 - b, 19 + b, '#c8d0dc');
      p.v(16, 17, 21, '#5d6474');
      p.px(14, 18, '#c8d0dc'); p.px(18, 18, '#c8d0dc');
    },
    shoulders: (p, b) => {
      p.r(7, 14, 6, 3, '#8b5a2b'); p.r(19, 14, 7, 3, '#a06a35');
      p.px(8, 13, '#a06a35'); p.px(21, 13, '#c08048'); p.px(24, 13, '#a06a35');
    },
  },
  mike: {
    skin: '#d9a07a', hair: '#24150e', hairFn: hairCurly, outfit: '#7a4b2a', pants: '#4a3b2a',
    boots: '#3a2a1a', bulk: 1, nose: 'big', ears: 'pointy', belt: '#2a1a10', weapon: cleaver,
    torso: (p, b) => {
      p.r(14, 15, 4, 8, '#b0864a');
      p.px(12, 18, '#5a3418'); p.px(19, 20, '#5a3418'); p.px(13, 21, '#9a6a3a');
    },
    face: (p) => {
      // short beard
      p.r(13, 12, 7, 2, '#24150e'); p.h(14, 14, 18, '#24150e');
      p.h(12, 17, 18, '#7a3a2a');
      p.h(11, 18, 19, '#24150e');
    },
    head: (p) => {
      // rusty crown
      p.h(1, 13, 18, '#c99a3a'); p.h(0, 13, 13, '#c99a3a'); p.px(15, 0, '#c99a3a'); p.px(18, 0, '#c99a3a');
      p.px(14, 1, '#8a6a2a'); p.px(16, 1, '#d9473c');
    },
  },
  josh: {
    skin: '#f0c8a8', hair: '#f0d070', hairFn: hairBlond, outfit: '#5a3a8a', pants: '#3a2a5a',
    boots: '#c99a3a', robe: true, trim: '#f7c548', weapon: staff, mouth: '#a0505a',
    torso: (p) => {
      p.h(15, 13, 18, '#f7c548'); p.px(15, 16, '#f7c548'); p.px(16, 16, '#5fe8ff');
      p.r(12, 18, 1, 1, '#f7c548'); p.r(19, 20, 1, 1, '#f7c548');
    },
    face: (p) => {
      // third eye
      p.px(16, 7, '#ffffff'); p.px(17, 7, '#1fb8ff'); p.px(16, 6, '#c58cff'); p.px(17, 6, '#c58cff');
      p.h(12, 16, 18, '#a0505a'); p.px(19, 11, '#a0505a');
    },
    shoulders: (p) => { p.r(21, 15, 2, 1, '#f7c548'); },
  },
  griffin: {
    skin: '#ecbc96', hair: '#6a4426', hairFn: hairLong(12), outfit: '#8a1c2b', pants: '#1e1a24',
    boots: '#2a1a14', bulk: 0, belt: '#2a1a14', weapon: dagger,
    behind: (p) => { p.r(8, 15, 4, 15, '#4a0f1a'); p.px(8, 30, '#4a0f1a'); },
    torso: (p) => {
      p.r(15, 15, 3, 8, '#e8e0d0');
      p.px(14, 17, '#f7c548'); p.px(14, 19, '#f7c548'); p.px(14, 21, '#f7c548');
      p.px(12, 23, '#ffffff'); p.px(19, 23, '#ffffff');
    },
    face: (p) => {
      p.h(11, 17, 21, '#4a2e18'); p.px(16, 12, '#4a2e18'); p.px(21, 12, '#4a2e18');
      p.r(17, 13, 2, 2, '#4a2e18');
    },
  },
};

export function drawHero(id) {
  const p = painter(32, 36);
  humanoid(p, HERO_DEFS[id]);
  return p.finish();
}

// ------------------------------------------------------------------ Dani
// Griffin's demon companion. Fully clothed: high-neck tunic, long coat,
// gloves, leggings, boots, cloak. Black hair. Floats.
export function drawDani() {
  const p = painter(36, 38);
  const o = 3; // offset so wings fit
  const q = { ...p, r: (x, y, w, h, c) => p.r(x + o, y + 2, w, h, c), px: (x, y, c) => p.r(x + o, y + 2, 1, 1, c) };
  q.h = (y, x0, x1, c) => q.r(x0, y, x1 - x0 + 1, 1, c);
  q.v = (x, y0, y1, c) => q.r(x, y0, 1, y1 - y0 + 1, c);
  q.ell = (cx, cy, rx, ry, c) => p.ell(cx + o, cy + 2, rx, ry, c);
  humanoid(q, {
    skin: '#f2cdb4', hair: '#120c16', hairFn: hairLong(15), outfit: '#24161f', pants: '#1a1018',
    boots: '#2e1a22', bulk: 0, gloves: '#120c16', robe: true, trim: '#6e1a2e', collar: '#6e1a2e',
    mouth: '#9a2a40',
    behind: (pp) => {
      // wings
      p.ell(5, 16, 5, 8, '#3a1e4a');
      p.v(2, 9, 23, '#22122e'); p.v(5, 8, 24, '#22122e'); p.v(8, 10, 22, '#22122e');
      p.r(26, 9, 7, 6, '#3a1e4a'); p.v(29, 8, 15, '#22122e');
      // tail
      p.r(10, 30, 2, 2, '#5a1a24'); p.r(8, 32, 2, 2, '#5a1a24'); p.r(5, 33, 3, 2, '#5a1a24');
      p.px(4, 32, '#5a1a24'); p.px(4, 34, '#5a1a24');
    },
    torso: (pp) => {
      // burgundy high-neck tunic visible down the front of the coat
      q.r(15, 15, 4, 17, '#6e1a2e');
      q.v(15, 15, 31, '#4e1020');
      q.h(22, 12, 19, '#8a8a9a');
      q.px(16, 22, '#d8d8e8');
    },
    head: () => {
      // horns
      q.px(13, 3, '#5a1a24'); q.px(12, 2, '#5a1a24'); q.px(12, 1, '#7a2a34');
      q.px(18, 3, '#5a1a24'); q.px(19, 2, '#5a1a24'); q.px(19, 1, '#7a2a34');
      // eyes with a red glint
      q.px(15, 9, '#7a1020'); q.px(18, 9, '#7a1020');
    },
    shoulders: () => { q.r(20, 14, 3, 2, '#3a2230'); },
  });
  return p.finish();
}

// ------------------------------------------------------------------ enemies
export function drawGoblin(kind = 'grunt') {
  const p = painter(30, 30);
  const g = '#6aa03a', gd = '#4a7a28', rag = kind === 'archer' ? '#4a5a2a' : '#6a4a2a';
  // legs
  p.r(10, 22, 3, 5, gd); p.r(15, 22, 3, 5, g);
  p.r(9, 27, 4, 2, '#3a2a1a'); p.r(15, 27, 4, 2, '#3a2a1a');
  // body
  p.r(9, 15, 10, 8, rag); p.r(9, 15, 2, 8, shade(rag, 0.7)); p.h(21, 9, 18, '#3a2a1a');
  // arms
  p.r(7, 15, 2, 7, gd); p.r(19, 15, 2, 7, g);
  // head
  p.r(9, 6, 11, 9, g); p.v(9, 6, 14, gd);
  p.r(4, 6, 5, 2, gd); p.r(2, 5, 3, 1, gd); // back ear
  p.r(20, 6, 4, 2, g); p.r(23, 5, 3, 1, g); // front ear
  p.px(16, 9, '#f7e048'); p.px(19, 9, '#f7e048'); p.px(17, 9, '#1a1020');
  p.r(19, 10, 3, 2, gd); // nose
  p.h(13, 15, 19, '#2a1a10'); p.px(16, 13, '#f4f0d8'); p.px(18, 13, '#f4f0d8');
  if (kind === 'archer') {
    p.v(23, 6, 24, '#8a5a2a'); p.px(22, 5, '#8a5a2a'); p.px(22, 25, '#8a5a2a');
    p.v(21, 7, 23, '#d8d0c0');
    p.r(4, 14, 3, 7, '#5a3a1a'); p.px(4, 13, '#d8d0c0'); p.px(6, 13, '#d8d0c0');
  } else {
    p.v(22, 8, 27, '#7a4a28'); p.r(21, 4, 3, 4, '#b8c0cc'); p.px(22, 3, '#e8eef4');
  }
  return p.finish();
}

export function drawGoblinBrute() {
  const p = painter(40, 42);
  const g = '#5a9030', gd = '#3e6a20';
  p.r(11, 31, 6, 7, gd); p.r(22, 31, 6, 7, g);
  p.r(10, 38, 8, 3, '#3a2a1a'); p.r(22, 38, 8, 3, '#3a2a1a');
  p.r(8, 16, 24, 16, '#6a4a2a'); p.r(8, 16, 4, 16, '#4a3018'); p.r(12, 20, 16, 8, g);
  p.h(30, 8, 31, '#2a1a10');
  p.r(3, 16, 5, 13, gd); p.r(32, 16, 6, 13, g); p.r(32, 29, 6, 3, g);
  p.r(11, 4, 18, 13, g); p.v(11, 4, 16, gd);
  p.r(4, 6, 7, 3, gd); p.r(29, 6, 6, 3, g);
  p.px(22, 9, '#f7e048'); p.px(26, 9, '#f7e048');
  p.r(25, 11, 5, 3, gd);
  p.h(15, 18, 27, '#2a1a10'); p.px(19, 14, '#f4f0d8'); p.px(25, 14, '#f4f0d8');
  // club
  p.r(34, 4, 4, 26, '#7a4a28'); p.r(33, 2, 6, 8, '#8a5a30'); p.px(34, 4, '#b8c0cc'); p.px(37, 6, '#b8c0cc');
  return p.finish();
}

export function drawWolf() {
  const p = painter(40, 28);
  const f = '#6a6478', fd = '#4a4458', fl = '#8a84a0';
  p.r(4, 8, 4, 3, fd); p.r(1, 6, 4, 3, fd); // tail
  p.ell(18, 13, 12, 6, f);
  p.h(8, 12, 26, fl); p.h(19, 10, 26, fd);
  p.r(9, 17, 3, 8, fd); p.r(14, 17, 3, 8, f); p.r(23, 17, 3, 8, fd); p.r(27, 17, 3, 8, f);
  p.r(8, 25, 4, 1, fd); p.r(26, 25, 5, 1, f);
  // head
  p.r(27, 4, 8, 9, f); p.r(34, 8, 5, 4, f); p.r(34, 11, 5, 1, fd);
  p.px(38, 8, '#1a1020'); p.px(31, 6, '#f7e048');
  p.r(28, 1, 2, 3, fd); p.r(31, 1, 2, 3, f);
  p.px(35, 12, '#f4f0d8'); p.px(37, 12, '#f4f0d8');
  return p.finish();
}

export function drawSkeleton() {
  const p = painter(30, 36);
  const bone = '#e8e4d0', bd = '#b8b4a0';
  p.r(11, 25, 2, 8, bd); p.r(16, 25, 2, 8, bone);
  p.r(10, 33, 4, 2, '#2a2a34'); p.r(16, 33, 4, 2, '#2a2a34');
  // blazer
  p.r(9, 14, 11, 11, '#3a4a6a'); p.r(9, 14, 2, 11, '#2a3450');
  p.r(13, 14, 3, 9, bone); p.h(16, 13, 15, bd); p.h(18, 13, 15, bd); p.h(20, 13, 15, bd);
  p.v(14, 15, 21, '#c03030'); p.px(14, 14, '#c03030');
  p.r(7, 14, 2, 9, bd); p.r(20, 14, 2, 9, bone);
  // skull
  p.r(10, 4, 10, 9, bone); p.v(10, 4, 12, bd);
  p.r(13, 7, 2, 2, '#1a1020'); p.r(17, 7, 2, 2, '#1a1020'); p.px(16, 9, '#1a1020');
  p.h(11, 14, 19, bd); p.px(15, 11, '#1a1020'); p.px(17, 11, '#1a1020');
  // glasses + clipboard
  p.h(6, 12, 19, '#1a1020');
  p.r(21, 15, 6, 8, '#a0703a'); p.r(22, 16, 4, 6, '#f4f0e0'); p.h(17, 22, 25, '#8a8a9a'); p.h(19, 22, 24, '#8a8a9a');
  p.r(23, 14, 2, 1, '#b8c0cc');
  return p.finish();
}

export function drawSlime() {
  const p = painter(30, 22);
  p.ell(15, 13, 13, 8, '#3ac0a0');
  p.h(21, 3, 27, '#2a9080');
  p.r(6, 7, 4, 2, '#a8f0e0'); p.px(5, 9, '#a8f0e0');
  p.r(17, 9, 2, 3, '#1a1020'); p.r(22, 9, 2, 3, '#1a1020');
  p.px(17, 9, '#ffffff'); p.px(22, 9, '#ffffff');
  p.px(12, 15, '#2a9080'); p.px(9, 17, '#c8ffe8');
  return p.finish();
}

export function drawAlien() {
  const p = painter(28, 36);
  const s = '#a8b0b8', sd = '#808890';
  p.r(11, 26, 2, 7, sd); p.r(15, 26, 2, 7, s);
  p.r(10, 33, 3, 2, '#5a6470'); p.r(15, 33, 3, 2, '#5a6470');
  p.r(10, 17, 8, 9, '#c0c8d8'); p.r(10, 17, 2, 9, '#9098a8'); p.h(21, 10, 17, '#5fe8ff');
  p.r(8, 17, 2, 8, sd); p.r(18, 17, 2, 7, s);
  // ray gun
  p.r(19, 21, 6, 2, '#5a6470'); p.r(24, 20, 2, 4, '#5fe8ff'); p.px(26, 21, '#e8ffff');
  // head
  p.ell(14, 8, 7, 7, s);
  p.r(12, 14, 4, 2, s);
  p.v(7, 5, 11, sd);
  p.r(15, 7, 3, 3, '#0a0610'); p.px(18, 8, '#0a0610'); p.r(10, 7, 2, 3, '#0a0610');
  p.px(15, 7, '#5a6470');
  p.h(13, 14, 15, sd);
  return p.finish();
}

export function drawDrone() {
  const p = painter(34, 28);
  p.ell(16, 7, 6, 5, '#5fe8ff'); p.px(14, 4, '#e8ffff'); p.px(15, 4, '#e8ffff');
  p.ell(16, 11, 15, 3, '#9aa3b5');
  p.h(9, 3, 29, '#c8d0dc'); p.h(13, 4, 28, '#5d6474');
  [6, 11, 16, 21, 26].forEach((x, i) => p.px(x, 11, i % 2 ? '#f7c548' : '#d9473c'));
  // telescoping scanner arm
  p.v(16, 15, 22, '#7b8496'); p.v(17, 15, 22, '#5d6474');
  p.r(14, 23, 6, 2, '#7b8496'); p.px(14, 25, '#5fe8ff'); p.px(19, 25, '#5fe8ff');
  return p.finish();
}

export function drawMimic() {
  const p = painter(30, 26);
  p.r(3, 12, 24, 12, '#8a5a2a'); p.r(3, 12, 24, 2, '#6a4018'); p.r(3, 22, 24, 2, '#6a4018');
  p.v(8, 12, 23, '#c99a3a'); p.v(21, 12, 23, '#c99a3a');
  // open lid
  p.r(3, 2, 24, 6, '#8a5a2a'); p.v(8, 2, 7, '#c99a3a'); p.v(21, 2, 7, '#c99a3a');
  p.r(4, 8, 22, 4, '#3a0a14');
  for (let x = 5; x < 26; x += 3) { p.px(x, 8, '#f4f0d8'); p.px(x + 1, 11, '#f4f0d8'); }
  p.r(14, 10, 8, 3, '#d9476a'); p.r(20, 13, 3, 3, '#d9476a');
  p.px(11, 4, '#f7e048'); p.px(17, 4, '#f7e048');
  return p.finish();
}

export function drawLandlord() {
  const p = painter(52, 56);
  const r = '#b03a3a', rd = '#802424', rl = '#d05a4a';
  // legs
  p.r(15, 44, 7, 8, '#3a2a3a'); p.r(29, 44, 7, 8, '#4a3a4a');
  p.r(13, 52, 10, 3, '#1a1018'); p.r(28, 52, 10, 3, '#1a1018');
  // belly + stained vest
  p.ell(25, 34, 15, 12, r);
  p.r(12, 24, 26, 20, '#e8e0c8');
  p.ell(25, 36, 12, 8, '#f0e8d0');
  p.r(10, 24, 7, 20, '#4a3a2a'); p.r(33, 24, 7, 20, '#5a4a3a');
  p.px(22, 34, '#c8a040'); p.px(27, 38, '#a08a40'); p.r(20, 30, 3, 2, '#c8a040');
  p.v(25, 24, 33, '#3a5a8a'); p.r(24, 33, 3, 3, '#3a5a8a');
  // arms
  p.r(5, 24, 6, 16, rd); p.r(40, 24, 6, 16, r); p.r(40, 40, 6, 4, r);
  // keys ring
  p.ell(43, 46, 3, 3, '#c99a3a'); p.ell(43, 46, 1, 1, '#140c1c');
  p.r(46, 46, 2, 5, '#c99a3a'); p.r(40, 48, 2, 5, '#c99a3a'); p.px(47, 51, '#c99a3a');
  // eviction scroll in back hand
  p.r(2, 36, 8, 10, '#f4ead0'); p.h(38, 3, 8, '#a08a6a'); p.h(40, 3, 7, '#a08a6a'); p.h(42, 3, 8, '#a08a6a');
  p.px(7, 44, '#d9473c');
  // head
  p.r(15, 6, 20, 18, r); p.v(15, 6, 23, rd); p.h(6, 15, 34, rl);
  p.ell(25, 23, 9, 3, r); // double chin
  // horns
  p.r(14, 2, 3, 5, '#e8d8b8'); p.px(13, 0, '#e8d8b8'); p.px(13, 1, '#e8d8b8');
  p.r(33, 2, 3, 5, '#e8d8b8'); p.px(36, 0, '#e8d8b8'); p.px(36, 1, '#e8d8b8');
  // face
  p.r(25, 11, 3, 2, '#f7e048'); p.r(31, 11, 3, 2, '#f7e048'); p.px(26, 11, '#140c1c'); p.px(32, 11, '#140c1c');
  p.h(9, 24, 28, rd); p.h(9, 30, 34, rd);
  p.r(32, 14, 5, 4, rl);
  p.h(19, 25, 35, '#3a0a14'); p.px(28, 19, '#f7e048');
  // comb-over
  p.h(5, 18, 32, '#2a1a1a'); p.h(4, 20, 30, '#2a1a1a');
  return p.finish();
}

// ------------------------------------------------------------------ NPCs
export function drawGoblinMerchant() {
  const p = painter(34, 34);
  // backpack of junk
  p.r(2, 6, 10, 18, '#8a5a2a'); p.r(2, 6, 10, 2, '#6a4018');
  p.px(4, 4, '#b8c0cc'); p.px(5, 3, '#b8c0cc'); p.r(8, 2, 3, 4, '#d9473c'); p.r(3, 9, 3, 3, '#f7c548');
  const g = '#6aa03a', gd = '#4a7a28';
  p.r(13, 26, 3, 5, gd); p.r(18, 26, 3, 5, g);
  p.r(12, 31, 4, 2, '#3a2a1a'); p.r(18, 31, 4, 2, '#3a2a1a');
  p.r(12, 17, 11, 10, '#a0784a'); p.r(14, 19, 7, 8, '#e8dcc0'); p.px(17, 21, '#c99a3a');
  p.r(23, 17, 2, 8, g);
  p.r(12, 7, 11, 10, g); p.v(12, 7, 16, gd);
  p.r(8, 7, 4, 2, gd); p.r(23, 7, 4, 2, g); p.r(26, 6, 2, 1, g);
  p.px(19, 10, '#f7e048'); p.px(22, 10, '#f7e048');
  p.r(22, 11, 3, 3, gd);
  p.h(15, 18, 22, '#2a1a10'); p.px(20, 15, '#f7c548');
  p.r(12, 4, 11, 3, '#5a3a8a'); p.h(6, 10, 25, '#5a3a8a');
  return p.finish();
}

export function drawGoblinDealer() {
  const p = painter(30, 32);
  const g = '#6aa03a', gd = '#4a7a28';
  p.r(10, 24, 3, 5, '#1a1018'); p.r(15, 24, 3, 5, '#2a2028');
  p.r(9, 29, 4, 2, '#1a1018'); p.r(15, 29, 4, 2, '#1a1018');
  p.r(9, 15, 10, 10, '#e8e0d0'); p.r(9, 15, 3, 10, '#2a2a34'); p.r(16, 15, 3, 10, '#2a2a34');
  p.px(13, 16, '#d9473c'); p.px(14, 16, '#d9473c');
  p.r(19, 15, 2, 7, g); p.r(7, 15, 2, 7, gd);
  p.r(19, 21, 4, 3, '#f4f0e0'); p.px(21, 22, '#d9473c');
  p.r(9, 6, 11, 9, g); p.v(9, 6, 14, gd);
  p.r(5, 6, 4, 2, gd); p.r(20, 6, 4, 2, g);
  p.px(16, 9, '#f7e048'); p.px(18, 9, '#f7e048');
  p.r(19, 10, 3, 2, gd); p.h(13, 15, 19, '#2a1a10'); p.px(17, 13, '#f7c548');
  p.r(9, 4, 12, 2, '#3ac080'); p.r(13, 6, 10, 1, '#2a9060');
  return p.finish();
}

export function drawDevil() {
  const p = painter(30, 36);
  const r = '#c83a3a', rd = '#902424';
  p.r(11, 25, 3, 8, '#1a1018'); p.r(16, 25, 3, 8, '#2a2028');
  p.r(10, 33, 4, 2, '#0a0610'); p.r(16, 33, 4, 2, '#0a0610');
  p.r(9, 14, 12, 12, '#1a1018'); p.r(13, 14, 4, 9, '#e8e0d0'); p.v(14, 15, 21, '#d9473c');
  p.r(7, 14, 2, 9, '#1a1018'); p.r(21, 14, 2, 9, '#2a2028');
  p.r(21, 23, 2, 2, r);
  p.r(22, 16, 6, 8, '#f4ead0'); p.h(18, 23, 27, '#a08a6a'); p.h(20, 23, 26, '#a08a6a'); p.px(26, 22, '#d9473c');
  p.r(10, 5, 10, 9, r); p.v(10, 5, 13, rd);
  p.px(10, 3, rd); p.px(11, 4, rd); p.px(19, 3, rd); p.px(18, 4, rd); p.px(10, 2, '#e8d8b8'); p.px(19, 2, '#e8d8b8');
  p.px(15, 8, '#f7e048'); p.px(18, 8, '#f7e048');
  p.h(11, 15, 19, '#3a0a14'); p.px(16, 12, '#1a1018'); p.px(17, 12, '#1a1018'); p.px(16, 13, '#1a1018');
  p.r(4, 26, 2, 2, r); p.r(3, 24, 2, 2, r); p.px(2, 23, r); p.px(4, 23, r);
  return p.finish();
}

// ------------------------------------------------------------------ props
export function drawCampfire() {
  const p = painter(28, 22);
  p.r(4, 17, 20, 3, '#6a4018'); p.r(7, 15, 14, 2, '#8a5a2a');
  p.ell(14, 10, 6, 6, '#e85a28'); p.ell(14, 11, 4, 4, '#f7a038'); p.ell(14, 12, 2, 3, '#f7e048');
  p.px(12, 3, '#e85a28'); p.px(16, 2, '#f7a038');
  [[2, 19], [24, 19], [3, 15], [23, 15]].forEach(([x, y]) => p.r(x, y, 3, 3, '#6a6478'));
  return p.finish();
}

export function drawChest() {
  const p = painter(26, 20);
  p.r(1, 8, 24, 11, '#8a5a2a'); p.r(1, 2, 24, 7, '#a06a35'); p.h(8, 1, 24, '#6a4018');
  p.v(6, 2, 18, '#c99a3a'); p.v(19, 2, 18, '#c99a3a');
  p.r(11, 7, 4, 4, '#f7c548'); p.px(12, 9, '#140c1c');
  return p.finish();
}

export function drawBoulder() {
  const p = painter(40, 32);
  p.ell(20, 17, 18, 14, '#7a7088');
  p.ell(17, 13, 11, 8, '#9a90a8');
  p.px(12, 9, '#c8c0d8'); p.px(13, 9, '#c8c0d8');
  p.h(28, 6, 34, '#5a5068');
  p.px(26, 20, '#5a5068'); p.px(27, 21, '#5a5068'); p.px(10, 22, '#5a5068');
  return p.finish();
}

export function drawSlotMachine() {
  const p = painter(28, 36);
  p.r(2, 6, 22, 28, '#c83a3a'); p.r(2, 6, 3, 28, '#902424');
  p.r(4, 2, 18, 5, '#f7c548'); p.h(2, 5, 20, '#ffe888');
  p.r(5, 11, 16, 9, '#f4f0e0');
  p.r(6, 13, 4, 5, '#d9473c'); p.r(11, 13, 4, 5, '#3a8adf'); p.r(16, 13, 4, 5, '#6abe30');
  p.r(5, 24, 16, 4, '#2a1a20'); p.r(9, 25, 8, 2, '#f7c548');
  p.v(25, 10, 20, '#b8c0cc'); p.ell(25, 8, 2, 2, '#d9473c');
  return p.finish();
}
