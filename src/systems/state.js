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

export function createHero(raceId, classId, seat = 0) {
  const r = RACES[raceId];
  const c = CLASSES[classId];
  const s = {};
  for (const k of ['hp', 'atk', 'def', 'spd']) s[k] = r.base[k] + (c.mods[k] || 0);
  return {
    id: raceId,
    race: raceId,
    cls: classId,
    name: r.name,
    seat,
    maxHp: s.hp,
    hp: s.hp,
    atk: s.atk,
    def: Math.max(0, s.def),
    spd: Math.max(1, s.spd),
    signature: r.signature === classId,
    // ---- competitive party stuff: every friend has their own purse ----
    gold: 30,
    crowns: 0,
    cards: [],
    skipNext: false, // hit by a SKIP card: sits out the next showdown
    doubleNext: false, // played DOUBLE DOWN: next showdown payout x2
    st: { kills: 0, dmg: 0, stolen: 0, robbed: 0, gambled: 0, won: 0, showdowns: 0 },
  };
}

export function newRun(picks, seed) {
  rng = new Rng(seed ?? (Date.now() >>> 0));
  run = {
    seed: rng.state,
    party: picks.map((p, i) => createHero(p.race, p.cls, i)),
    potions: 1,
    map: generateMap(),
    at: 0, // current node id
    visited: [0],
    leader: 0, // whose pick it is; rotates every room
    crownPrice: 60,
    flags: { daniDate: false, daniAngry: false },
    stats: { fights: 0, kills: 0, goldEarned: 0, goldGambled: 0, probes: 0, whipped: 0, longShots: 0, deaths: 0, cardsPlayed: 0 },
    log: [],
  };
  // everyone starts with one dirty card
  run.party.forEach((h) => h.cards.push(randomCard()));
  return run;
}

// ---------- Economy: personal purses ----------
export const hero = (i) => run.party[i];
export const leader = () => run.party[run.leader];
export const totalGold = () => run.party.reduce((s, h) => s + h.gold, 0);

export function addGold(i, n) {
  const h = run.party[i];
  const before = h.gold;
  h.gold = Math.max(0, h.gold + n);
  if (n > 0) run.stats.goldEarned += n;
  return h.gold - before; // actual change
}

// Move gold from one friend to another (stealing, taxes). Returns amount moved.
export function steal(from, to, n) {
  const a = run.party[from], b = run.party[to];
  const amt = Math.min(a.gold, Math.max(0, Math.round(n)));
  a.gold -= amt; b.gold += amt;
  a.st.robbed += amt; b.st.stolen += amt;
  return amt;
}

export function nextLeader() {
  run.leader = (run.leader + 1) % run.party.length;
}

// Standings: crowns first, then gold.
export function standings() {
  return run.party.map((h, i) => ({ h, i })).sort((a, b) => b.h.crowns - a.h.crowns || b.h.gold - a.h.gold);
}

// ---------- Dirty cards ----------
export const CARD_IDS = ['tax', 'pickpocket', 'swap', 'reverse', 'skip', 'double'];
const CARD_WEIGHTS = { tax: 3, pickpocket: 3, swap: 1, reverse: 2, skip: 2, double: 2 };
export function randomCard() {
  const pool = [];
  CARD_IDS.forEach((c) => { for (let k = 0; k < CARD_WEIGHTS[c]; k++) pool.push(c); });
  return rng.pick(pool);
}
export function giveCard(i, card = randomCard()) {
  const h = run.party[i];
  if (h.cards.length >= 3) h.cards.shift(); // hand limit 3, oldest falls out
  h.cards.push(card);
  return card;
}

// ---------- Map generation ----------
// Left-to-right node map (landscape). Row 0 is the entrance, last row is the boss.
const ROWS = 8;

function rowTypes(r) {
  if (r === 1) return ['fight', 'treasure', 'fight'];
  if (r === 2) return ['casino', 'fight', 'trial', 'event'];
  if (r === 3) return ['wheel', 'alien', 'whack', 'shop', 'event'];
  if (r === 4) return ['casino', 'elite', 'trial', 'treasure'];
  if (r === 5) return ['wheel', 'alien', 'whack', 'event', 'fight'];
  if (r === 6) return ['casino', 'rest', 'shop'];
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
    // casinos show up a lot: guarantee one on rows 2, 4 and 6
    if ([2, 4, 6].includes(r) && types.indexOf('casino') >= count) { types.splice(types.indexOf('casino'), 1); types.unshift('casino'); }
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
