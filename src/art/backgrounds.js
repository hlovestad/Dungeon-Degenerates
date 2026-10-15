// Placeholder room backgrounds, painted at 320x180 and shown at 2x.
// The bottom ~40% is open floor where the party and enemies stand.
import { makeCanvas, noise, shade } from './painter.js';

const BW = 320, BH = 180, FLOOR = 108;

const THEMES = {
  bg_dungeon_crypt: { wall: '#3a3048', floor: '#2e2638', accent: '#f7a038', props: 'crypt' },
  bg_dungeon_cave: { wall: '#2e3440', floor: '#262a34', accent: '#5fe8a0', props: 'cave', rough: true },
  bg_goblin_market: { wall: '#4a3428', floor: '#3a2a20', accent: '#f7c548', props: 'market' },
  bg_goblin_casino: { wall: '#4a1a28', floor: '#2a1420', accent: '#f7c548', props: 'casino' },
  bg_alien_crash_site: { wall: '#1e2a2e', floor: '#1a2228', accent: '#7af0c0', props: 'alien', rough: true },
  bg_landlord_office: { wall: '#3a2a20', floor: '#4a3020', accent: '#d9473c', props: 'office' },
  bg_treasure_vault: { wall: '#3a3020', floor: '#2e2618', accent: '#f7c548', props: 'vault' },
  bg_rest_campfire: { wall: '#1e1a2a', floor: '#221e2a', accent: '#f7a038', props: 'rest', rough: true },
  bg_devil_shrine: { wall: '#3a1418', floor: '#2a1014', accent: '#ff5a28', props: 'devil' },
  bg_trivia_stage: { wall: '#2a1a3a', floor: '#3a2a20', accent: '#f7e048', props: 'stage' },
  bg_boulder_pass: { wall: '#34303e', floor: '#2a2632', accent: '#f7a038', props: 'pass', rough: true },
  bg_title: { wall: '#2a2238', floor: '#221c2e', accent: '#f7a038', props: 'title' },
};
export const BG_KEYS = Object.keys(THEMES);

export function drawBackground(key) {
  const th = THEMES[key] || THEMES.bg_dungeon_crypt;
  const c = makeCanvas(BW, BH);
  const ctx = c.getContext('2d');
  const rnd = noise(key.length * 9973 + key.charCodeAt(4) * 31);
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const P = (x, y, col) => R(x, y, 1, 1, col);
  const ell = (cx, cy, rx, ry, col) => {
    for (let y = -ry; y <= ry; y++) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      R(cx - half, cy + y, half * 2 + 1, 1, col);
    }
  };

  // ---- wall
  const wl = shade(th.wall, 1.18), wd = shade(th.wall, 0.78);
  R(0, 0, BW, FLOOR, th.wall);
  if (th.rough) {
    for (let i = 0; i < 260; i++) {
      const x = rnd() * BW, y = rnd() * FLOOR, s = 2 + rnd() * 10;
      R(x, y, s, s * 0.6, rnd() < 0.5 ? wl : wd);
    }
    // stalactites
    for (let x = 4; x < BW; x += 10 + rnd() * 18) {
      const h = 6 + rnd() * 18;
      for (let j = 0; j < h; j++) R(x + j / 4, j, Math.max(1, 5 - j / 4), 1, wd);
    }
  } else {
    for (let row = 0; row * 9 < FLOOR; row++) {
      const y = row * 9;
      const off = row % 2 ? 9 : 0;
      for (let x = -off; x < BW; x += 18) {
        const tone = rnd();
        R(x + 1, y + 1, 16, 7, tone < 0.15 ? wd : tone > 0.85 ? wl : th.wall);
        R(x + 1, y + 1, 16, 1, wl);
        R(x, y, 18, 1, wd);
        R(x, y, 1, 9, wd);
      }
    }
  }
  // ---- floor in simple perspective
  const fl = shade(th.floor, 1.2), fd = shade(th.floor, 0.75);
  R(0, FLOOR, BW, BH - FLOOR, th.floor);
  let y = FLOOR + 3, hgt = 5;
  let band = 0;
  while (y < BH) {
    R(0, y, BW, 1, fd);
    if (band % 2) R(0, y + 1, BW, 1, fl);
    y += hgt; hgt += 2; band++;
  }
  for (let i = -14; i <= 14; i++) {
    const x0 = BW / 2 + i * 10;
    const x1 = BW / 2 + i * 34;
    for (let t = 0; t <= 1; t += 0.01) {
      P(x0 + (x1 - x0) * t, FLOOR + t * (BH - FLOOR), fd);
    }
  }
  for (let i = 0; i < 160; i++) P(rnd() * BW, FLOOR + 4 + rnd() * (BH - FLOOR), rnd() < 0.5 ? fl : fd);
  // baseboard
  R(0, FLOOR - 3, BW, 3, shade(th.wall, 0.55));
  R(0, FLOOR, BW, 2, shade(th.floor, 0.5));

  // ---- props
  const torch = (x, yy) => {
    R(x - 1, yy, 3, 10, '#5a3418'); R(x - 2, yy - 2, 5, 3, '#3a2a20');
    ell(x, yy - 6, 3, 4, '#e85a28'); ell(x, yy - 5, 2, 2, '#f7e048');
    for (let r = 14; r > 4; r -= 3) {
      ctx.globalAlpha = 0.06; ell(x, yy - 5, r, r, th.accent); ctx.globalAlpha = 1;
    }
  };
  const arch = (x, w, h, col) => {
    R(x, FLOOR - h, w, h, col);
    ell(x + w / 2, FLOOR - h, w / 2, w / 3, col);
  };

  switch (th.props) {
    case 'crypt':
    case 'title': {
      arch(40, 50, 60, '#140c1c'); arch(230, 50, 60, '#140c1c');
      R(36, FLOOR - 64, 4, 64, wl); R(90, FLOOR - 64, 4, 64, wl);
      R(226, FLOOR - 64, 4, 64, wl); R(280, FLOOR - 64, 4, 64, wl);
      torch(20, 50); torch(150, 44); torch(170, 44); torch(300, 50);
      // coffins
      R(54, FLOOR - 26, 22, 26, '#5a3a28'); R(56, FLOOR - 24, 18, 2, '#7a5a38'); R(64, FLOOR - 22, 2, 10, '#c8b890'); R(61, FLOOR - 19, 8, 2, '#c8b890');
      // skull pile
      [[250, FLOOR - 4], [256, FLOOR - 4], [253, FLOOR - 8]].forEach(([sx, sy]) => { ell(sx, sy, 3, 3, '#d8d4c0'); P(sx - 1, sy, '#140c1c'); P(sx + 1, sy, '#140c1c'); });
      // chains
      for (let j = 0; j < 30; j += 3) { P(120, j, '#8a8a9a'); P(200, j + 4, '#8a8a9a'); }
      if (th.props === 'title') { torch(110, 60); torch(210, 60); }
      break;
    }
    case 'cave': {
      for (let i = 0; i < 9; i++) {
        const mx = 20 + rnd() * 280, my = FLOOR - 2;
        R(mx, my - 6, 2, 6, '#c8c0d0'); ell(mx + 1, my - 7, 4, 2, '#5fe8a0'); P(mx + 1, my - 8, '#c8ffe8');
      }
      ell(160, 40, 40, 30, '#1a1e28'); torch(60, 60); torch(260, 60);
      break;
    }
    case 'market': {
      const stall = (x, col) => {
        R(x, FLOOR - 40, 3, 40, '#6a4018'); R(x + 54, FLOOR - 40, 3, 40, '#6a4018');
        for (let i = 0; i < 6; i++) R(x - 2 + i * 10, FLOOR - 50, 10, 10, i % 2 ? '#f4ead0' : col);
        for (let i = 0; i < 6; i++) ell(x + 3 + i * 10, FLOOR - 40, 5, 2, i % 2 ? '#f4ead0' : col);
        R(x, FLOOR - 16, 57, 16, '#8a5a2a'); R(x, FLOOR - 16, 57, 2, '#a06a35');
        for (let i = 0; i < 5; i++) ell(x + 8 + i * 10, FLOOR - 19, 3, 2, ['#d9473c', '#f7c548', '#6abe30', '#5fcde4', '#c58cff'][i]);
      };
      stall(20, '#c83a3a'); stall(240, '#3a7ac8');
      // crates + lanterns + bunting
      R(110, FLOOR - 14, 14, 14, '#7a4a28'); R(110, FLOOR - 14, 14, 2, '#9a6a38'); R(124, FLOOR - 10, 10, 10, '#6a4018');
      for (let x = 0; x < BW; x += 8) { P(x, 18 + Math.sin(x / 20) * 4, '#f4ead0'); R(x, 19 + Math.sin(x / 20) * 4, 3, 4, ['#d9473c', '#f7c548', '#6abe30'][(x / 8) % 3]); }
      [100, 160, 220].forEach((lx) => { R(lx, 22, 1, 12, '#3a2a20'); R(lx - 3, 34, 7, 8, '#f7c548'); R(lx - 2, 35, 5, 6, '#ffe888'); });
      break;
    }
    case 'casino': {
      R(0, 10, BW, 3, '#f7c548'); R(0, FLOOR - 26, BW, 2, '#c99a3a');
      for (let x = 10; x < BW; x += 16) { ell(x, 6, 2, 2, (x / 16) % 2 ? '#f7e048' : '#ff6b5e'); }
      // big dice sign
      R(140, 22, 18, 18, '#f4f0e0'); P(145, 27, '#140c1c'); P(152, 34, '#140c1c'); P(148, 30, '#140c1c');
      R(162, 26, 16, 16, '#d9473c'); P(166, 30, '#f4f0e0'); P(173, 37, '#f4f0e0');
      // roulette table
      ell(250, FLOOR - 4, 34, 8, '#1a5a2a'); ell(250, FLOOR - 6, 30, 6, '#2a7a3a'); ell(250, FLOOR - 7, 8, 3, '#8a5a2a');
      R(30, FLOOR - 30, 30, 30, '#2a1a20'); R(32, FLOOR - 28, 26, 12, '#f7c548');
      torch(110, 60); torch(210, 60);
      break;
    }
    case 'alien': {
      // crashed saucer
      ell(230, FLOOR - 14, 56, 12, '#7b8496'); ell(230, FLOOR - 20, 52, 6, '#9aa3b5'); ell(220, FLOOR - 30, 22, 14, '#5fe8ff');
      ell(215, FLOOR - 34, 6, 4, '#c8ffff');
      for (let i = 0; i < 7; i++) ell(186 + i * 14, FLOOR - 14, 2, 2, i % 2 ? '#f7c548' : '#d9473c');
      R(280, FLOOR - 40, 3, 26, '#3a3a48'); ell(282, FLOOR - 42, 3, 3, '#d9473c');
      ctx.globalAlpha = 0.25; ell(200, FLOOR + 6, 70, 10, th.accent); ctx.globalAlpha = 1;
      // crystals
      [[30, 'r'], [70, 'l'], [130, 'r']].forEach(([x]) => {
        for (let j = 0; j < 16; j++) R(x + j / 3, FLOOR - j, Math.max(1, 6 - j / 3), 1, j % 4 ? '#5af0a0' : '#c8ffe8');
      });
      // stars in hole
      ell(80, 26, 30, 18, '#0a0810');
      for (let i = 0; i < 20; i++) P(54 + rnd() * 52, 12 + rnd() * 28, '#ffffff');
      break;
    }
    case 'office': {
      // wallpaper stripes over bricks
      for (let x = 0; x < BW; x += 12) R(x, 0, 5, FLOOR - 3, shade(th.wall, 1.12));
      // filing cabinets
      [20, 44, 270].forEach((x) => {
        R(x, FLOOR - 46, 22, 46, '#6a7080'); R(x, FLOOR - 46, 22, 2, '#8a90a0');
        for (let j = 0; j < 4; j++) { R(x + 2, FLOOR - 43 + j * 11, 18, 9, '#5a6070'); R(x + 9, FLOOR - 39 + j * 11, 4, 1, '#c8d0dc'); }
      });
      // desk and banners
      R(110, FLOOR - 22, 100, 22, '#5a3418'); R(110, FLOOR - 22, 100, 3, '#7a4a28'); R(120, FLOOR - 30, 30, 8, '#f4ead0'); R(170, FLOOR - 32, 6, 10, '#f7c548');
      [90, 220].forEach((x) => { R(x, 6, 16, 44, '#8a1c2b'); R(x + 4, 18, 8, 8, '#f7c548'); R(x, 50, 4, 4, '#8a1c2b'); R(x + 12, 50, 4, 4, '#8a1c2b'); });
      torch(70, 56); torch(250, 56);
      break;
    }
    case 'vault': {
      for (let i = 0; i < 6; i++) {
        const gx = 20 + i * 52, gh = 10 + rnd() * 14;
        ell(gx, FLOOR, 22, gh, '#e0a830'); ell(gx - 4, FLOOR - gh / 2, 10, gh / 3, '#f7c548');
        for (let k = 0; k < 6; k++) P(gx - 15 + rnd() * 30, FLOOR - rnd() * gh, '#ffe888');
      }
      torch(60, 44); torch(260, 44);
      break;
    }
    case 'rest': {
      ell(160, 40, 70, 34, '#0e0c1c');
      for (let i = 0; i < 40; i++) P(95 + rnd() * 130, 10 + rnd() * 60, rnd() < 0.3 ? '#f7e048' : '#ffffff');
      ell(200, 26, 6, 6, '#f4f0d8'); ell(202, 24, 5, 5, '#0e0c1c');
      break;
    }
    case 'devil': {
      for (let x = 30; x < BW; x += 80) { R(x, 10, 14, FLOOR - 10, wd); R(x - 2, 8, 18, 4, wl); R(x - 2, FLOOR - 6, 18, 4, wl); }
      ctx.globalAlpha = 0.35; ell(160, FLOOR + 30, 120, 20, th.accent); ctx.globalAlpha = 1;
      ell(160, FLOOR + 20, 40, 8, '#5a1418'); ell(160, FLOOR + 20, 36, 6, '#2a1014');
      torch(110, 50); torch(210, 50);
      break;
    }
    case 'stage': {
      // red curtains, spotlights, a glittery sign frame (no text)
      for (let x = 0; x < 60; x += 6) { R(x, 0, 5, FLOOR, x % 12 ? '#8a1c2b' : '#6a1420'); R(BW - 60 + x, 0, 5, FLOOR, x % 12 ? '#8a1c2b' : '#6a1420'); }
      R(0, 0, BW, 10, '#6a1420'); for (let x = 0; x < BW; x += 10) ell(x + 5, 10, 5, 3, '#8a1c2b');
      R(110, 18, 100, 28, '#f7c548'); R(113, 21, 94, 22, '#2a1a3a');
      for (let x = 112; x < 210; x += 8) { P(x, 19, '#ffffff'); P(x + 4, 45, '#ffffff'); }
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.fillStyle = '#fff6c0'; ctx.moveTo(80 + i * 80, 0); ctx.lineTo(50 + i * 90, FLOOR + 40); ctx.lineTo(110 + i * 90, FLOOR + 40); ctx.fill(); }
      ctx.globalAlpha = 1;
      R(220, FLOOR - 26, 40, 26, '#5a3a8a'); R(220, FLOOR - 26, 40, 3, '#f7c548'); R(234, FLOOR - 20, 12, 12, '#d9473c');
      break;
    }
    case 'pass': {
      ell(160, 30, 60, 24, '#1e1a28');
      torch(40, 50); torch(280, 50);
      break;
    }
  }

  // ---- dithered vignette
  for (let yy = 0; yy < BH; yy++) {
    for (let xx = 0; xx < BW; xx++) {
      const dx = (xx - BW / 2) / (BW / 2), dy = (yy - BH / 2) / (BH / 2);
      const d = dx * dx * 0.9 + dy * dy * 0.6;
      if (d > 0.62 && (xx + yy) % 2 === 0) P(xx, yy, 'rgba(10,6,16,0.55)');
      if (d > 0.9 && (xx + yy) % 2 === 1) P(xx, yy, 'rgba(10,6,16,0.45)');
    }
  }
  return c;
}

export function drawMapBackground() {
  const c = makeCanvas(BW, BH);
  const ctx = c.getContext('2d');
  const rnd = noise(4242);
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  R(0, 0, BW, BH, '#2a2030');
  // dungeon rock texture
  for (let i = 0; i < 500; i++) R(rnd() * BW, rnd() * BH, 2 + rnd() * 6, 1 + rnd() * 3, rnd() < 0.5 ? '#332838' : '#221a28');
  // parchment-ish floor plan
  R(10, 8, BW - 20, BH - 16, '#4a3a2e');
  R(12, 10, BW - 24, BH - 20, '#5a4836');
  for (let i = 0; i < 400; i++) R(12 + rnd() * (BW - 26), 10 + rnd() * (BH - 22), 1 + rnd() * 3, 1, rnd() < 0.5 ? '#665240' : '#4e3e2e');
  // grid
  for (let x = 12; x < BW - 12; x += 12) for (let y = 10; y < BH - 10; y += 2) if ((y / 2) % 3 === 0) R(x, y, 1, 1, '#4e3e2e');
  for (let y = 10; y < BH - 10; y += 12) for (let x = 12; x < BW - 12; x += 2) if ((x / 2) % 3 === 0) R(x, y, 1, 1, '#4e3e2e');
  // corners
  [[10, 8], [BW - 16, 8], [10, BH - 14], [BW - 16, BH - 14]].forEach(([x, y]) => { R(x, y, 6, 6, '#c99a3a'); R(x + 2, y + 2, 2, 2, '#5a4836'); });
  return c;
}
