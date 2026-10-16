// ARCADE MODE rules: a party night of back-to-back minigames with no dungeon.
// Pure logic, no Phaser. The Arcade scene animates what these return, and the
// future multiplayer host will run them and broadcast the results.
//
// Between games, random stuff happens: a friend goes AFK (their running gag)
// and everyone else profits, or the arcade itself messes with the purses.

import { run, rng, newRun, addGold, steal, giveCard } from './state.js';
import { QUIPS, DANI_QUIPS } from '../data/quips.js';

// Every game the arcade can launch. `scene` + `data` is what the Arcade scene
// hands to Phaser. `solo` games are played by the picker, everyone else watches.
export const ARCADE_GAMES = [
  { id: 'stack', name: 'STACK ATTACK', scene: 'Stack', data: {} },
  { id: 'quickdraw', name: 'QUICK DRAW', scene: 'Showdown', data: { game: 'quickdraw' } },
  { id: 'mash', name: 'MASH OFF', scene: 'Showdown', data: { game: 'mash' } },
  { id: 'highcard', name: 'HIGH CARD', scene: 'Showdown', data: { game: 'highcard' } },
  { id: 'chests', name: 'PICK A CHEST', scene: 'Showdown', data: { game: 'chests' } },
  { id: 'potato', name: 'HOT POTATO', scene: 'Showdown', data: { game: 'potato' } },
  { id: 'split', name: 'SPLIT OR STEAL', scene: 'Showdown', data: { game: 'split' } },
  { id: 'derby', name: 'GOBLIN DERBY', scene: 'Showdown', data: { game: 'derby' } },
  { id: 'clock', name: 'STOP THE CLOCK', scene: 'Showdown', data: { game: 'clock' } },
  { id: 'trivia', name: 'SKULL TRIVIA', scene: 'Trivia', data: { mode: 'crawl' } },
  { id: 'whack', name: 'WHACK-A-GOB', scene: 'Whack', data: { mode: 'crawl' }, solo: true },
  { id: 'wheel', name: 'WHEEL OF MISFORTUNE', scene: 'Wheel', data: {}, solo: true },
  { id: 'casino', name: 'GOBLIN CASINO', scene: 'Casino', data: {}, solo: true },
];
export const gameById = (id) => ARCADE_GAMES.find((g) => g.id === id);

export const ARCADE_START_GOLD = 50;

// Start a fresh arcade night. picks: [{ race, cls }]
export function startArcade(picks, { games = 8, seed, only = null } = {}) {
  newRun(picks, seed);
  run.mode = 'arcade';
  run.party.forEach((h) => { h.gold = ARCADE_START_GOLD; });
  run.arcade = {
    round: 0, // games finished
    total: games,
    picker: 0, // whose turn it is to spin / pick (rotates)
    before: null, // gold snapshot when a game starts
    pot: 0, // GOBLIN TAX pot, paid to the next game's winner
    history: [], // [{ game, winner, deltas }]
    lastGame: null,
    lastEvent: null,
    eventsSeen: {},
    only, // 'trivia' = TRIVIA NIGHT: every game is trivia
    usedQ: [], // trivia question ids already asked tonight
  };
  return run;
}

export const isArcade = () => !!run && run.mode === 'arcade';
// Where minigames go when they finish.
export const hubScene = () => (isArcade() ? 'Arcade' : 'Map');

// Spin for a game (never the same one twice in a row).
export function spinGame() {
  if (run.arcade.only) return gameById(run.arcade.only);
  const pool = ARCADE_GAMES.filter((g) => g.id !== run.arcade.lastGame);
  return rng.pick(pool);
}

// Call right before launching a game.
export function beginGame(game) {
  const A = run.arcade;
  A.lastGame = game.id;
  A.before = run.party.map((h) => h.gold);
  // solo games are played by the picker; the crawl code reads roomLeader
  run.roomLeader = A.picker;
  run.leader = A.picker;
}

// Call when the party comes back to the hub. Returns a list of things to show:
//   { type:'result', winner, loser, deltas }
//   { type:'pot', to, amt }
//   { type:'quip', who, line }
//   { type:'event', ...event }      (see EVENTS)
//   { type:'over', ranking }
export function finishGame() {
  const A = run.arcade;
  const out = [];
  if (!A.before) return out;
  const deltas = run.party.map((h, i) => h.gold - A.before[i]);
  A.before = null;
  A.round++;
  const order = deltas.map((d, i) => ({ d, i })).sort((a, b) => b.d - a.d);
  const winner = order[0].d > 0 ? order[0].i : null;
  const loser = order[order.length - 1].d < order[0].d ? order[order.length - 1].i : null;
  A.history.push({ game: A.lastGame, winner, deltas });
  if (winner !== null) run.party[winner].crowns++;
  out.push({ type: 'result', winner, loser, deltas });

  if (A.pot > 0 && winner !== null) {
    addGold(winner, A.pot);
    out.push({ type: 'pot', to: winner, amt: A.pot });
    A.pot = 0;
  }
  if (winner !== null) out.push({ type: 'quip', who: winner, line: say(winner, 'win') });
  if (loser !== null && loser !== winner && rng.chance(0.7)) out.push({ type: 'quip', who: loser, line: say(loser, 'lose') });

  const rot = A.seats || run.party.map((_, k) => k);
  A.picker = rot[(rot.indexOf(A.picker) + 1) % rot.length];

  if (A.round >= A.total) {
    out.push({ type: 'over', ranking: ranking() });
    return out;
  }
  // something dumb happens between most games
  if (rng.chance(0.25)) out.push({ type: 'chaos', id: pickChaos() });
  if (rng.chance(0.55)) out.push({ type: 'event', ...rollEvent() });
  return out;
}

// Final order: crowns (games won) first, then gold.
export function ranking() {
  return run.party.map((h, i) => ({ i, crowns: h.crowns, gold: h.gold }))
    .sort((a, b) => b.crowns - a.crowns || b.gold - a.gold);
}

// ------------------------------------------------------------------ quips
const seatOf = (race) => run.party.findIndex((h) => h.race === race);
const richest = () => run.party.reduce((b, h, i) => (h.gold > run.party[b].gold ? i : b), 0);
const poorest = () => run.party.reduce((b, h, i) => (h.gold < run.party[b].gold ? i : b), 0);
const others = (i) => run.party.map((_, k) => k).filter((k) => k !== i);

// Recently used lines are avoided so the same joke doesn't repeat back to back.
const recent = [];
function fresh(list) {
  const pool = list.filter((l) => !recent.includes(l));
  const line = rng.pick(pool.length ? pool : list);
  recent.push(line);
  if (recent.length > 40) recent.shift();
  return line;
}

export function say(i, kind) {
  const q = QUIPS[run.party[i].race];
  if (!q || !q[kind]) return '...';
  return fresh(q[kind]);
}

// Random hub chatter: idle lines, trash talk at a friend who's here, and
// broke/rich lines when they apply. Returns { who, line }.
export function chatter() {
  // only friends with lines of their own (goblin guests just listen)
  const talkers = (run.arcade?.seats || run.party.map((_, k) => k)).filter((k) => QUIPS[run.party[k]?.race]);
  const i = rng.pick(talkers);
  const h = run.party[i];
  const q = QUIPS[h.race];
  const roll = rng.next();
  if (h.gold <= 10 && roll < 0.5) return { who: i, line: fresh(q.broke) };
  if (i === richest() && h.gold >= 80 && roll < 0.3) return { who: i, line: fresh(q.rich) };
  const targets = Object.keys(q.roast).filter((r) => seatOf(r) >= 0);
  if (targets.length && roll < 0.45) return { who: i, line: fresh(q.roast[rng.pick(targets)]) };
  return { who: i, line: fresh(q.idle) };
}

export function daniLine() {
  return fresh(DANI_QUIPS);
}

// ------------------------------------------------------------------ events
// Each event mutates `run` and returns what happened:
//   { id, title, who?, line?, text, changes: [{ i, d }] }
// `who` + `line` = a friend says their AFK gag. changes drive the gold floaters.

function moveAll(list) {
  // list: [{ from, to, amt }] -> changes
  const ch = {};
  list.forEach(({ from, to, amt }) => {
    const m = steal(from, to, amt);
    ch[from] = (ch[from] || 0) - m;
    ch[to] = (ch[to] || 0) + m;
  });
  return Object.entries(ch).map(([i, d]) => ({ i: Number(i), d })).filter((c) => c.d);
}
function gain(i, n) {
  const d = addGold(i, n);
  return d ? [{ i, d }] : [];
}
const N = (i) => run.party[i].name;

// AFK gags: the friend steps away and everybody else cashes in on it.
const AFK = {
  haakon: (i) => {
    const r = richest();
    if (r !== i && run.party[r].gold > 0) {
      const amt = Math.min(20, Math.max(5, Math.round(run.party[r].gold * 0.2)));
      return { title: 'SUMO NIGHT', text: `Haakon warms up by shoving ${N(r)} out of the ring. ${N(r)} drops ${amt} gold.`, changes: moveAll([{ from: r, to: i, amt }]) };
    }
    const p = poorest();
    return { title: 'SUMO NIGHT', text: `Haakon slips on the sumo salt. ${N(p)} grabs the 10 gold that flew out of his pocket.`, changes: moveAll([{ from: i, to: p, amt: 10 }]) };
  },
  mike: (i) => ({
    title: 'TOWEL DUTY',
    text: "While Mike is folding towels, everyone loots 5 gold from his pile.",
    changes: moveAll(others(i).map((k) => ({ from: i, to: k, amt: 5 }))),
  }),
  josh: (i) => {
    if (rng.chance(0.3)) {
      return { title: 'SNACK RUN', text: 'Long Johnny loved the snack. He leaves Josh a 15 gold tip.', changes: gain(i, 15) };
    }
    const p = poorest() === i ? rng.pick(others(i)) : poorest();
    return { title: 'SNACK RUN', text: `Long Johnny eats 10 of Josh's gold and leaves the crumbs to ${N(p)}.`, changes: moveAll([{ from: i, to: p, amt: 10 }]) };
  },
  griffin: (i) => {
    if (rng.chance(0.5)) {
      return { title: 'CAT CALL', text: 'The cats knocked a coin jar off the shelf. Griffin +15 gold.', changes: gain(i, 15) };
    }
    const t = rng.pick(others(i));
    return { title: 'CAT CALL', text: `While Griffin talks cats, ${N(t)} picks his pocket for 10 gold.`, changes: moveAll([{ from: i, to: t, amt: 10 }]) };
  },
};

// Things the arcade does to everyone. weight = how often it comes up.
const WORLD = [
  {
    id: 'robin', w: 3, title: 'ROBIN HOOD',
    run: () => {
      const r = richest(), p = poorest();
      if (r === p) return null;
      return { text: `A goblin in a green hat robs ${N(r)} and gives 15 gold to ${N(p)}.`, changes: moveAll([{ from: r, to: p, amt: 15 }]) };
    },
  },
  {
    id: 'swap', w: 1, title: 'POCKET SWAP',
    run: () => {
      const [a, b] = rng.shuffle(run.party.map((_, k) => k));
      const ga = run.party[a].gold, gb = run.party[b].gold;
      run.party[a].gold = gb; run.party[b].gold = ga;
      return { text: `The lights flicker. ${N(a)} and ${N(b)} wake up holding each other's gold.`, changes: [{ i: a, d: gb - ga }, { i: b, d: ga - gb }].filter((c) => c.d) };
    },
  },
  {
    id: 'tax', w: 2, title: 'GOBLIN TAX', need: () => isArcade(),
    run: () => {
      const changes = [];
      run.party.forEach((h, k) => {
        const amt = Math.floor(h.gold * 0.1);
        if (!amt) return;
        h.gold -= amt; run.arcade.pot += amt;
        changes.push({ i: k, d: -amt });
      });
      return { text: `The goblins tax everyone 10%. The ${run.arcade.pot} gold pot goes to whoever wins the next game.`, changes };
    },
  },
  {
    id: 'cards', w: 2, title: 'DIRTY CARD DROP',
    run: () => {
      run.party.forEach((_, k) => giveCard(k));
      return { text: 'A goblin trips and spills a deck. Everyone grabs a dirty card. Play them from the hub.', changes: [] };
    },
  },
  {
    id: 'penny', w: 3, title: 'LUCKY PENNY',
    run: () => {
      const k = rng.int(0, run.party.length - 1);
      return { text: `${N(k)} finds 20 gold in the couch cushions.`, changes: gain(k, 20) };
    },
  },
  {
    id: 'pigeon', w: 2, title: 'PIGEON HEIST',
    run: () => {
      const r = richest();
      const amt = Math.min(run.party[r].gold, 12);
      run.party[r].gold -= amt;
      return { text: `A dungeon pigeon swoops in and steals ${amt} gold from ${N(r)}. Nobody chases it.`, changes: amt ? [{ i: r, d: -amt }] : [] };
    },
  },
  {
    id: 'rain', w: 1, title: 'JACKPOT RAIN',
    run: () => ({ text: 'The ceiling slot machine pays out. Everyone +10 gold.', changes: run.party.flatMap((_, k) => gain(k, 10)) }),
  },
  {
    id: 'dani', w: 1, title: 'DANI DROPS BY',
    need: () => seatOf('griffin') >= 0,
    run: () => {
      const g = seatOf('griffin');
      return { who: 'dani', line: daniLine(), text: 'Dani tips everyone 5 gold. Except Griffin.', changes: others(g).flatMap((k) => gain(k, 5)) };
    },
  },
];

// Event bookkeeping lives on run.arcade in the arcade and run.chaos in the dungeon.
function book() {
  if (run.arcade) return run.arcade;
  if (!run.chaos) run.chaos = { lastEvent: null, eventsSeen: {}, lastChaos: null };
  return run.chaos;
}

// Visual chaos (Oracle's Psychosis, Poop Time, Archie's Revenge). The scene
// plays it with ui/chaos.js; this only picks which one (seeded, no repeats).
export const CHAOS_POOL = ['psychosis', 'poop', 'archie'];
export function pickChaos() {
  const A = book();
  const id = rng.pick(CHAOS_POOL.filter((c) => c !== A.lastChaos));
  A.lastChaos = id;
  return id;
}

// Between rooms in the dungeon: maybe somebody talks, maybe something happens.
// Returns a list in the same shape as finishGame().
export function dungeonInterlude() {
  const out = [];
  if (rng.chance(0.12)) out.push({ type: 'chaos', id: pickChaos() });
  if (rng.chance(0.18)) out.push({ type: 'event', ...rollEvent() });
  else if (rng.chance(0.4)) {
    const c = rng.chance(0.25) ? (() => { const i = rng.int(0, run.party.length - 1); return { who: i, line: say(i, 'afk') }; })() : chatter();
    out.push({ type: 'quip', ...c });
  }
  return out;
}

export function rollEvent() {
  const A = book();
  // half the time it's a friend's AFK gag
  if (rng.chance(0.5)) {
    const i = rng.pick(run.arcade?.seats || run.party.map((_, k) => k));
    const race = run.party[i].race;
    if (AFK[race]) {
      const ev = AFK[race](i);
      A.lastEvent = 'afk_' + race;
      return { id: 'afk_' + race, who: i, line: say(i, 'afk'), ...ev };
    }
  }
  const pool = [];
  WORLD.filter((e) => e.id !== A.lastEvent && (!e.need || e.need())).forEach((e) => { for (let k = 0; k < e.w; k++) pool.push(e); });
  for (let tries = 0; tries < 6; tries++) {
    const e = rng.pick(pool);
    const res = e.run();
    if (!res) continue;
    A.lastEvent = e.id;
    A.eventsSeen[e.id] = (A.eventsSeen[e.id] || 0) + 1;
    return { id: e.id, title: e.title, ...res };
  }
  return { id: 'none', title: 'NOTHING HAPPENS', text: 'Suspiciously quiet. Too quiet.', changes: [] };
}
