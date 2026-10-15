// The whole run lives in one plain, serializable object (`run`). Scenes read
// and write it; nothing important is stored on Phaser objects. That is what
// lets us move to host-authoritative multiplayer later: the host owns `run`
// and broadcasts it, clients render it.

import { RACES } from '../data/races.js';
import { CLASSES } from '../data/classes.js';
import { Rng } from './rng.js';

export let run = null;
export let rng = new Rng();

export function hasRace(id) {
  return !!run && run.party.some((h) => h.race === id);
}
export function heroOf(id) {
  return run.party.find((h) => h.race === id);
}

export function createHero(raceId, classId) {
  const r = RACES[raceId];
  const c = CLASSES[classId];
  const s = {};
  for (const k of ['hp', 'atk', 'def', 'spd']) s[k] = r.base[k] + (c.mods[k] || 0);
  return {
    id: raceId,
    race: raceId,
    cls: classId,
    name: r.name,
    maxHp: s.hp,
    hp: s.hp,
    atk: s.atk,
    def: Math.max(0, s.def),
    spd: Math.max(1, s.spd),
    signature: r.signature === classId,
  };
}

export function newRun(picks, seed) {
  rng = new Rng(seed ?? (Date.now() >>> 0));
  run = {
    seed: rng.state,
    party: picks.map((p) => createHero(p.race, p.cls)),
    gold: 60,
    potions: 1,
    map: generateMap(),
    at: 0, // current node id
    visited: [0],
    flags: { daniDate: false, daniAngry: false },
    stats: { fights: 0, kills: 0, goldEarned: 0, goldGambled: 0, probes: 0, whipped: 0, longShots: 0, deaths: 0 },
    log: [],
  };
  return run;
}

export function addGold(n) {
  run.gold = Math.max(0, run.gold + n);
  if (n > 0) run.stats.goldEarned += n;
}

// ---------- Map generation ----------
// Left-to-right node map (landscape). Row 0 is the entrance, last row is the boss.
const ROWS = 8;

function rowTypes(r) {
  if (r === 1) return ['fight', 'treasure', 'fight'];
  if (r === 2) return ['fight', 'event', 'treasure', 'shop'];
  if (r === 3) return ['alien', 'casino', 'event', 'fight'];
  if (r === 4) return ['elite', 'shop', 'event', 'treasure', 'fight'];
  if (r === 5) return ['alien', 'casino', 'fight', 'event'];
  if (r === 6) return ['rest', 'shop', 'rest'];
  return ['fight'];
}

export function generateMap() {
  const nodes = [];
  const rows = [];
  let id = 0;
  for (let r = 0; r < ROWS; r++) {
    let count = r === 0 || r === ROWS - 1 ? 1 : rng.int(2, 3);
    const row = [];
    const types = rng.shuffle(rowTypes(r));
    for (let i = 0; i < count; i++) {
      let type;
      if (r === 0) type = 'start';
      else if (r === ROWS - 1) type = 'boss';
      else type = types[i % types.length];
      const yStep = 300 / (count + 1);
      row.push({
        id: id++,
        row: r,
        type,
        x: 52 + r * 77,
        y: 40 + yStep * (i + 1) + (r === 0 || r === ROWS - 1 ? 0 : rng.int(-12, 12)),
        next: [],
      });
    }
    rows.push(row);
    nodes.push(...row);
  }
  // Connect rows: each node links to the nearest 1-2 nodes in the next row,
  // then make sure every next-row node is reachable.
  for (let r = 0; r < ROWS - 1; r++) {
    const a = rows[r];
    const b = rows[r + 1];
    a.forEach((n, i) => {
      const ratio = a.length === 1 ? 0.5 : i / (a.length - 1);
      const j = Math.round(ratio * (b.length - 1));
      n.next.push(b[j].id);
      if (rng.chance(0.5)) {
        const k = j + (rng.chance(0.5) ? 1 : -1);
        if (b[k] && !n.next.includes(b[k].id)) n.next.push(b[k].id);
      }
    });
    b.forEach((m, j) => {
      if (!a.some((n) => n.next.includes(m.id))) {
        const ratio = b.length === 1 ? 0.5 : j / (b.length - 1);
        const i = Math.round(ratio * (a.length - 1));
        a[i].next.push(m.id);
      }
    });
  }
  return { nodes, rows: ROWS };
}

export function nodeById(id) {
  return run.map.nodes.find((n) => n.id === id);
}
