// ONLINE PARTY GAMES: every arcade minigame, rewritten so each friend plays on
// their own phone. Pure rules, no Phaser. The HOST runs these: it sets a game
// up, feeds in each phone's input (and the bots'), and decides when a phase is
// over. Clients only draw `st` and send inputs.
//
// st (sent to every phone, minus st._h which is host-only secrets):
//   id, seats, humans, phase: 'intro' | 'play' | 'reveal' | 'done'
//   round, rounds   - for multi-round games (trivia)
//   inputs          - this round's input per seat
//   data            - public, game-specific
//   results         - [{ seat, gold, note }] once done (gold already applied)
//
// Game API (GAMES[id]):
//   name, rules, kind
//   playMs(st)          how long the play phase may run before the host forces it
//   setup(st, rng, P)   fill st.data / st._h; may take antes (P = party helpers)
//   input(st, seat, d, rng, P) -> bool   accept a phone's (or bot's) input
//   ready(st)           everyone required has played
//   bot(st, seat, rng)  -> { ms, d } a bot's move for this phase (or null)
//   resolve(st, rng, P) -> 'next' (another round) | 'done'; sets st.results when done
//   turnSeat(st)        turn-based games: whose move it is (else undefined)

import { RACES } from '../data/races.js';
import { questionPool, themeName } from '../data/trivia/index.js';

// ------------------------------------------------------------------ helpers
const N = (P, s) => P.party[s].name;
const others = (st, s) => st.seats.filter((x) => x !== s);
const rankPay = (pairs, pays) => pairs.map((p, k) => ({ ...p, gold: pays[k] || 0 }));

function gaussian(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng.next();
  while (v === 0) v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ------------------------------------------------------------------ games
export const GAMES = {
  // ---------------------------------------------------------------- reflex
  quickdraw: {
    name: 'QUICK DRAW', kind: 'reflex',
    rules: 'Wait for BONK!, then tap as fast as you can.\nTap too early and you are OUT.',
    playMs: (st) => st.data.delay + 3500,
    setup(st, rng) { st.data.delay = rng.int(1600, 4200); },
    input(st, seat, d) {
      if (st.inputs[seat]) return false;
      st.inputs[seat] = d.early ? { early: true } : { ms: Math.max(80, Math.min(5000, Math.round(d.ms))) };
      return true;
    },
    ready: (st) => st.seats.every((s) => st.inputs[s]),
    bot(st, seat, rng) {
      if (rng.chance(0.07)) return { ms: rng.int(400, st.data.delay - 100), d: { early: true } };
      const r = rng.int(230, 600);
      return { ms: st.data.delay + r, d: { ms: r } };
    },
    resolve(st) {
      const ok = st.seats.filter((s) => st.inputs[s]?.ms).sort((a, b) => st.inputs[a].ms - st.inputs[b].ms);
      const res = rankPay(ok.map((s) => ({ seat: s, note: `${st.inputs[s].ms}ms` })), [25, 10]);
      st.seats.filter((s) => !ok.includes(s)).forEach((s) => {
        res.push(st.inputs[s]?.early ? { seat: s, gold: -5, note: 'TOO EARLY' } : { seat: s, gold: 0, note: 'asleep' });
      });
      st.results = res;
      return 'done';
    },
  },

  mash: {
    name: 'MASH OFF', kind: 'reflex',
    rules: 'Mash the button as fast as you can for 5 seconds.',
    playMs: () => 5000 + 2500,
    setup(st) { st.data.ms = 5000; },
    input(st, seat, d) {
      if (st.inputs[seat]) return false;
      st.inputs[seat] = { n: Math.max(0, Math.min(150, Math.round(d.n))) };
      return true;
    },
    ready: (st) => st.seats.every((s) => st.inputs[s]),
    bot: (st, seat, rng) => ({ ms: 5300, d: { n: rng.int(22, 44) } }),
    resolve(st) {
      const order = st.seats.slice().sort((a, b) => (st.inputs[b]?.n || 0) - (st.inputs[a]?.n || 0));
      st.results = rankPay(order.map((s) => ({ seat: s, note: `${st.inputs[s]?.n || 0} taps` })), [25, 12, 5]);
      return 'done';
    },
  },

  clock: {
    name: 'STOP THE CLOCK', kind: 'reflex',
    rules: 'Tap at EXACTLY 5.00 seconds.\nThe clock disappears after 1.5 seconds.',
    playMs: () => 9500,
    setup(st) { st.data.target = 5000; st.data.hideAt = 1500; },
    input(st, seat, d) {
      if (st.inputs[seat]) return false;
      st.inputs[seat] = { ms: Math.max(0, Math.round(d.ms)) };
      return true;
    },
    ready: (st) => st.seats.every((s) => st.inputs[s]),
    bot(st, seat, rng) {
      const ms = Math.max(2500, Math.round(5000 + gaussian(rng) * 420));
      return { ms, d: { ms } };
    },
    resolve(st) {
      const off = (s) => (st.inputs[s] ? Math.abs(st.inputs[s].ms - 5000) : 1e9);
      const order = st.seats.slice().sort((a, b) => off(a) - off(b));
      st.results = rankPay(order.map((s) => ({
        seat: s, note: st.inputs[s] ? `${(st.inputs[s].ms / 1000).toFixed(2)}s` : 'never tapped',
      })), [25, 10]);
      return 'done';
    },
  },

  whack: {
    name: 'WHACK-A-GOB', kind: 'reflex',
    rules: 'Everyone gets the same goblins at the same time.\nGoblin +3, gold goblin +10, bomb -5, crowned (Mike\'s cousins) -5.',
    playMs: () => 20000 + 3000,
    setup(st, rng) {
      // the same schedule for every phone, so it's fair
      const spawns = [];
      let t = 600;
      while (t < 19200) {
        const r = rng.next();
        spawns.push({ t, hole: rng.int(0, 8), kind: r < 0.1 ? 'gold' : r < 0.22 ? 'bomb' : r < 0.32 ? 'crown' : 'gob', up: rng.int(700, 1100) });
        t += rng.int(260, 560);
      }
      st.data.spawns = spawns;
      st.data.ms = 20000;
    },
    input(st, seat, d) {
      if (st.inputs[seat]) return false;
      st.inputs[seat] = { score: Math.max(-200, Math.min(500, Math.round(d.score))) };
      return true;
    },
    ready: (st) => st.seats.every((s) => st.inputs[s]),
    bot: (st, seat, rng) => ({ ms: 20400, d: { score: rng.int(18, 70) } }),
    resolve(st) {
      const sc = (s) => st.inputs[s]?.score ?? 0;
      const order = st.seats.slice().sort((a, b) => sc(b) - sc(a));
      st.results = order.map((s, k) => ({ seat: s, gold: Math.max(-10, Math.min(30, Math.round(sc(s) / 2))) + (k === 0 ? 10 : 0), note: `${sc(s)} pts` }));
      return 'done';
    },
  },

  // ---------------------------------------------------------------- secret picks
  highcard: {
    name: 'HIGH CARD', kind: 'pick',
    rules: 'Everyone antes 10 gold. Tap to flip your card.\nHighest card takes the whole pot.',
    playMs: () => 9000,
    setup(st, rng, P) {
      st.data.pot = 0;
      st.seats.forEach((s) => { st.data.pot += -P.addGold(s, -10); });
      st._h.cards = Object.fromEntries(st.seats.map((s) => [s, rng.int(1, 13)]));
    },
    input(st, seat) {
      if (st.inputs[seat]) return false;
      st.inputs[seat] = { flip: true };
      return true;
    },
    ready: (st) => st.seats.every((s) => st.inputs[s]),
    bot: (st, seat, rng) => ({ ms: rng.int(700, 2600), d: { flip: true } }),
    resolve(st) {
      const c = st._h.cards;
      st.data.cards = c;
      const best = Math.max(...st.seats.map((s) => c[s]));
      const winners = st.seats.filter((s) => c[s] === best);
      const share = Math.floor(st.data.pot / winners.length);
      const face = (v) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[v] || String(v));
      st.data.face = Object.fromEntries(st.seats.map((s) => [s, face(c[s])]));
      st.results = st.seats.map((s) => ({ seat: s, gold: winners.includes(s) ? share : 0, note: `drew ${face(c[s])}${winners.includes(s) ? '' : ' (-10 ante)'}` }))
        .sort((a, b) => c[b.seat] - c[a.seat]);
      return 'done';
    },
  },

  chests: {
    name: 'PICK A CHEST', kind: 'pick',
    rules: 'Everyone secretly picks a chest. Gold, a bomb, or a heist.\nPick the same chest as someone? You split it.',
    playMs: () => 15000,
    setup(st, rng) {
      const n = st.seats.length + 1;
      const pool = [{ g: 40 }, { g: 25 }, { bomb: 15 }, { heist: 15 }, { g: 15 }, { g: 10 }, { g: 30 }, { g: 5 }];
      st._h.contents = rng.shuffle(pool.slice(0, n));
      st.data.n = n;
    },
    input(st, seat, d) {
      if (st.inputs[seat] || !(d.pick >= 0 && d.pick < st.data.n)) return false;
      st.inputs[seat] = { pick: d.pick };
      return true;
    },
    ready: (st) => st.seats.every((s) => st.inputs[s]),
    bot: (st, seat, rng) => ({ ms: rng.int(900, 4000), d: { pick: rng.int(0, st.data.n - 1) } }),
    resolve(st, rng, P) {
      const ct = st._h.contents;
      st.data.contents = ct;
      st.seats.forEach((s) => { if (!st.inputs[s]) st.inputs[s] = { pick: rng.int(0, st.data.n - 1) }; });
      const res = [];
      for (let k = 0; k < st.data.n; k++) {
        const who = st.seats.filter((s) => st.inputs[s].pick === k);
        if (!who.length) continue;
        const c = ct[k];
        if (c.g) {
          const share = Math.floor(c.g / who.length);
          who.forEach((s) => res.push({ seat: s, gold: share, note: `chest ${k + 1}: ${c.g}g${who.length > 1 ? ` split ${who.length} ways` : ''}` }));
        } else if (c.bomb) {
          who.forEach((s) => res.push({ seat: s, gold: -c.bomb, note: `chest ${k + 1}: BOMB` }));
        } else if (c.heist) {
          who.forEach((s) => {
            const victims = st.seats.filter((x) => !who.includes(x));
            const rich = victims.sort((a, b) => P.party[b].gold - P.party[a].gold)[0];
            const amt = rich !== undefined ? P.steal(rich, s, c.heist) : 0;
            res.push({ seat: s, gold: 0, raw: amt, note: rich !== undefined ? `chest ${k + 1}: HEIST on ${N(P, rich)} (+${amt})` : `chest ${k + 1}: an empty heist` });
          });
        }
      }
      st.results = res.sort((a, b) => (b.gold + (b.raw || 0)) - (a.gold + (a.raw || 0)));
      return 'done';
    },
  },

  split: {
    name: 'SPLIT OR STEAL', kind: 'pick',
    rules: 'Two players, one 40 gold pot. Each secretly picks SPLIT or STEAL.\nBoth split: 20 each. One steals: they take it all. Both steal: nobody.\nEveryone else guesses what happens for +10.',
    playMs: () => 16000,
    setup(st, rng) {
      // prefer real people in the hot seat
      const pool = rng.shuffle(st.humans.length >= 2 ? st.humans : st.seats);
      const rest = rng.shuffle(st.seats.filter((s) => !pool.slice(0, 2).includes(s)));
      st.data.duel = [...pool, ...rest].slice(0, 2);
      st.data.pot = 40;
    },
    input(st, seat, d) {
      if (st.inputs[seat]) return false;
      const duel = st.data.duel.includes(seat);
      if (duel && ['split', 'steal'].includes(d.choice)) st.inputs[seat] = { choice: d.choice };
      else if (!duel && ['split', 'one', 'both'].includes(d.guess)) st.inputs[seat] = { guess: d.guess };
      else return false;
      return true;
    },
    ready: (st) => st.seats.every((s) => st.inputs[s]),
    bot(st, seat, rng) {
      if (st.data.duel.includes(seat)) return { ms: rng.int(1500, 5000), d: { choice: rng.chance(0.45) ? 'steal' : 'split' } };
      return { ms: rng.int(1000, 4000), d: { guess: rng.pick(['split', 'one', 'both']) } };
    },
    resolve(st, rng) {
      const [a, b] = st.data.duel;
      const ca = st.inputs[a]?.choice || (rng.chance(0.5) ? 'steal' : 'split');
      const cb = st.inputs[b]?.choice || (rng.chance(0.5) ? 'steal' : 'split');
      st.data.choices = { [a]: ca, [b]: cb };
      const outcome = ca === 'split' && cb === 'split' ? 'split' : ca === 'steal' && cb === 'steal' ? 'both' : 'one';
      st.data.outcome = outcome;
      const pay = { [a]: 0, [b]: 0 };
      if (outcome === 'split') { pay[a] = 20; pay[b] = 20; } else if (outcome === 'one') { if (ca === 'steal') pay[a] = 40; else pay[b] = 40; }
      const res = [
        { seat: a, gold: pay[a], note: ca.toUpperCase() },
        { seat: b, gold: pay[b], note: cb.toUpperCase() },
      ];
      others(st, a).filter((s) => s !== b).forEach((s) => {
        const g = st.inputs[s]?.guess;
        res.push({ seat: s, gold: g === outcome ? 10 : 0, note: g ? `guessed ${{ split: 'both split', one: 'a steal', both: 'both steal' }[g]}` : 'no guess' });
      });
      st.results = res.sort((x, y) => y.gold - x.gold);
      return 'done';
    },
  },

  derby: {
    name: 'GOBLIN DERBY', kind: 'pick',
    rules: 'Bet on a racer. Long shots pay big.\nThe slime is not a goblin. Nobody cares.',
    playMs: () => 15000,
    setup(st) {
      st.data.racers = [
        { name: 'Speedy Gonk', key: 'goblin_grunt_idle', odds: 2, w: 0.42 },
        { name: 'Sir Slime', key: 'slime_blob_idle', odds: 3, w: 0.28 },
        { name: 'Drunk Gary', key: 'goblin_archer_idle', odds: 4, w: 0.2, tint: 0xffb0b0 },
        { name: 'Grandpa Grib', key: 'goblin_grunt_idle', odds: 7, w: 0.1, tint: 0x9a9aa8 },
      ];
    },
    input(st, seat, d, rng, P) {
      if (st.inputs[seat] || !(d.k >= 0 && d.k < 4)) return false;
      const amt = Math.max(0, Math.min(P.party[seat].gold, d.amt === 25 ? 25 : 10));
      st.inputs[seat] = { k: d.k, amt };
      return true;
    },
    ready: (st) => st.seats.every((s) => st.inputs[s]),
    bot: (st, seat, rng) => ({ ms: rng.int(1000, 5000), d: { k: rng.pick([0, 0, 1, 1, 2, 3]), amt: rng.chance(0.5) ? 25 : 10 } }),
    resolve(st, rng, P) {
      const R = st.data.racers;
      let r = rng.next(), win = 0;
      for (let k = 0; k < R.length; k++) { if ((r -= R[k].w) <= 0) { win = k; break; } }
      // a race that ends with the winner in front
      const frames = [];
      const pos = [0, 0, 0, 0];
      for (let f = 0; f < 22; f++) {
        for (let k = 0; k < 4; k++) pos[k] += rng.next() * 5 + (k === win ? 1.2 : 0.6);
        frames.push(pos.slice());
      }
      const lead = Math.max(...pos.filter((_, k) => k !== win));
      if (pos[win] <= lead) frames[frames.length - 1][win] = lead + 3;
      st.data.win = win;
      st.data.frames = frames;
      st.results = st.seats.map((s) => {
        const b = st.inputs[s];
        if (!b || !b.amt) return { seat: s, gold: 0, note: 'no bet' };
        const won = b.k === win;
        return { seat: s, gold: won ? b.amt * (R[b.k].odds - 1) : -b.amt, note: `${b.amt}g on ${R[b.k].name}${won ? ` x${R[b.k].odds}` : ''}` };
      }).sort((x, y) => y.gold - x.gold);
      return 'done';
    },
  },

  trivia: {
    name: 'SKULL TRIVIA', kind: 'pick',
    rules: 'Everyone answers on their own phone.\nRight: +10 points. Fastest right answer: +5 more. Josh can open his third eye once.\nAfter each answer, the host taps NEXT when you are done arguing.',
    playMs: (st) => (st.data.secs || 20) * 1000,
    setup(st, rng, P) {
      // the picker chose a theme and a length (P.opts); questions don't repeat in a night
      const opts = P.opts || {};
      const count = [10, 15, 20, 30].includes(opts.count) ? opts.count : 10;
      st.data.secs = [15, 20, 30].includes(opts.secs) ? opts.secs : 20; // time to answer
      const used = new Set(P.used || []);
      let pool = questionPool(opts.theme || 'mixed');
      let fresh = pool.filter((t) => !used.has(t.id));
      if (fresh.length < count) fresh = pool; // ran out: allow repeats rather than stop
      st.data.theme = themeName(opts.theme || 'mixed');
      const picked = rng.shuffle(fresh).slice(0, count);
      (P.used || []).push(...picked.map((t) => t.id));
      st.rounds = picked.length;
      const qs = picked.map((t) => {
        const opts = rng.shuffle(t.a.slice(0, 4));
        const correct = opts.indexOf(t.a[0]);
        const wrong = opts.map((_, k) => k).filter((k) => k !== correct);
        return { q: t.q, opts, correct, eye: rng.shuffle(wrong).slice(0, 2), theme: t.theme };
      });
      st._h.correct = qs.map((q) => q.correct);
      st.data.qs = qs.map(({ q, opts, eye, theme }) => ({ q, opts, eye, theme })); // the answers stay on the host
      st.data.score = Object.fromEntries(st.seats.map((s) => [s, 0]));
      st.data.reveal = null;
    },
    input(st, seat, d) {
      if (st.inputs[seat] || !(d.a >= 0 && d.a < 4)) return false;
      st.inputs[seat] = { a: d.a, ms: Math.max(0, Math.round(d.ms || 0)) };
      return true;
    },
    ready: (st) => st.seats.every((s) => st.inputs[s]),
    bot(st, seat, rng) {
      const c = st._h.correct[st.round];
      const a = rng.chance(0.55) ? c : rng.int(0, 3);
      const ms = rng.int(2000, Math.min(12000, (st.data.secs || 20) * 600));
      return { ms, d: { a, ms } };
    },
    resolve(st) {
      const c = st._h.correct[st.round];
      const right = st.seats.filter((s) => st.inputs[s]?.a === c).sort((a, b) => st.inputs[a].ms - st.inputs[b].ms);
      right.forEach((s, k) => { st.data.score[s] += 10 + (k === 0 ? 5 : 0); });
      st.data.reveal = { round: st.round, correct: c, right, fastest: right[0] ?? null, picks: Object.fromEntries(st.seats.map((s) => [s, st.inputs[s]?.a ?? null])) };
      if (st.round + 1 < st.rounds) return 'next';
      st.results = st.seats.slice().sort((a, b) => st.data.score[b] - st.data.score[a])
        .map((s) => ({ seat: s, gold: Math.ceil(st.data.score[s] / 3), note: `${st.data.score[s]} pts` }));
      return 'done';
    },
  },

  // ---------------------------------------------------------------- turns
  potato: {
    name: 'HOT POTATO', kind: 'turns',
    rules: 'The bomb goes around. On your turn: HOLD for +10, or BANK and get out.\nEvery hold makes it more likely to blow up in your hands.',
    playMs: () => 120000,
    turnMs: 12000,
    setup(st, rng) {
      st.data.order = rng.shuffle(st.seats);
      st.data.turn = 0;
      st.data.active = st.data.order.slice();
      st.data.stash = Object.fromEntries(st.seats.map((s) => [s, 0]));
      st.data.banked = {};
      st.data.holds = 0;
      st.data.boom = null;
      st.data.last = null;
    },
    turnSeat: (st) => (st.data.boom === null && st.data.active.length ? st.data.active[st.data.turn % st.data.active.length] : undefined),
    input(st, seat, d, rng) {
      const D = st.data;
      if (GAMES.potato.turnSeat(st) !== seat) return false;
      if (d.bank) {
        D.banked[seat] = D.stash[seat];
        D.active = D.active.filter((s) => s !== seat);
        D.last = { seat, did: 'bank', amt: D.stash[seat] };
        if (D.active.length) D.turn %= D.active.length;
      } else {
        D.holds++;
        const p = Math.min(0.85, 0.1 + 0.08 * D.holds);
        if (rng.next() < p) {
          D.boom = seat;
          D.last = { seat, did: 'boom', amt: D.stash[seat] };
          D.stash[seat] = 0;
        } else {
          D.stash[seat] += 10;
          D.last = { seat, did: 'hold', amt: D.stash[seat] };
          D.turn = (D.turn + 1) % D.active.length;
        }
      }
      D.risk = Math.round(Math.min(0.85, 0.1 + 0.08 * (D.holds + 1)) * 100);
      return true;
    },
    ready: (st) => st.data.boom !== null || st.data.active.length === 0,
    bot(st, seat, rng) {
      const p = Math.min(0.85, 0.1 + 0.08 * (st.data.holds + 1));
      return { ms: rng.int(900, 2200), d: p < 0.32 || (st.data.stash[seat] === 0 && p < 0.5) ? { hold: true } : { bank: true } };
    },
    resolve(st) {
      const D = st.data;
      st.results = st.seats.map((s) => {
        if (D.boom === s) return { seat: s, gold: -10, note: 'BLEW UP' };
        if (s in D.banked) return { seat: s, gold: D.banked[s], note: `banked ${D.banked[s]}` };
        return { seat: s, gold: D.stash[s], note: `survived with ${D.stash[s]}` };
      }).sort((a, b) => b.gold - a.gold);
      return 'done';
    },
  },

  wheel: {
    name: 'WHEEL OF MISFORTUNE', kind: 'turns',
    rules: 'The spinner spins the wheel. Then it picks who it happens to.\nIt might not even be about the spinner.',
    playMs: () => 12000,
    setup(st, rng, P) {
      st.data.spinner = st.seats.includes(P.picker) ? P.picker : st.seats[0];
      st.data.slices = WHEEL.map((w) => ({ id: w.id, label: w.label, color: w.color }));
    },
    turnSeat: (st) => (st.inputs[st.data.spinner] ? undefined : st.data.spinner),
    input(st, seat) {
      if (seat !== st.data.spinner || st.inputs[seat]) return false;
      st.inputs[seat] = { spin: true };
      return true;
    },
    ready: (st) => !!st.inputs[st.data.spinner],
    bot: (st, seat, rng) => (seat === st.data.spinner ? { ms: rng.int(1200, 2400), d: { spin: true } } : null),
    resolve(st, rng, P) {
      const k = rng.int(0, WHEEL.length - 1);
      const w = WHEEL[k];
      const pick = (not) => rng.pick(st.seats.filter((s) => s !== not));
      const A = pick(null);
      const B = w.pair ? pick(A) : null;
      const before = st.seats.map((s) => P.party[s].gold);
      const lines = w.apply(P, A, B, st, rng);
      st.data.slice = k;
      st.data.A = A; st.data.B = B;
      st.data.lines = lines;
      st.results = st.seats.map((s, i) => ({ seat: s, gold: 0, raw: P.party[s].gold - before[i], note: s === A ? 'picked' : s === B ? 'picked too' : '' }))
        .sort((x, y) => y.raw - x.raw);
      return 'done';
    },
  },

  // ---------------------------------------------------------------- free for all
  casino: {
    name: 'GOBLIN CASINO', kind: 'casino',
    rules: '30 seconds. Gamble your own gold as often as you like.\nCoin flip x2, long shot x8, moonshot x22.',
    playMs: () => 30000,
    setup(st, rng, P) {
      st.data.log = [];
      st.data.net = Object.fromEntries(st.seats.map((s) => [s, 0]));
      st.data.ms = 30000;
    },
    // casino takes many inputs: every bet is resolved the moment it arrives
    input(st, seat, d, rng, P) {
      const g = CASINO.find((x) => x.id === d.game);
      if (!g) return false;
      const amt = Math.min(P.party[seat].gold, [10, 25, 50].includes(d.amt) ? d.amt : 10);
      if (amt <= 0) return false;
      const win = rng.next() < g.p;
      const delta = win ? amt * (g.pay - 1) : -amt;
      P.addGold(seat, delta);
      st.data.net[seat] += delta;
      st.data.log.unshift({ seat, game: g.name, amt, win, delta });
      st.data.log = st.data.log.slice(0, 7);
      return true;
    },
    ready: () => false, // runs the full 30 seconds
    bot: (st, seat, rng) => ({ ms: rng.int(2500, 6000), d: { game: rng.pick(['flip', 'flip', 'long', 'moon']), amt: rng.pick([10, 10, 25]) }, repeat: true }),
    resolve(st) {
      st.results = st.seats.map((s) => ({ seat: s, gold: 0, raw: st.data.net[s], note: st.data.net[s] >= 0 ? `up ${st.data.net[s]}` : `down ${-st.data.net[s]}` }))
        .sort((a, b) => b.raw - a.raw);
      return 'done';
    },
  },
};

export const CASINO = [
  { id: 'flip', name: 'COIN FLIP', p: 0.5, pay: 2 },
  { id: 'long', name: 'LONG SHOT', p: 0.1, pay: 8 },
  { id: 'moon', name: 'MOONSHOT', p: 0.04, pay: 22 },
];

const WHEEL = [
  { id: 'swapgold', label: 'SWAP\nGOLD', color: 0xc99a3a, pair: true, apply(P, A, B) {
    const a = P.party[A], b = P.party[B]; const g = a.gold; a.gold = b.gold; b.gold = g;
    return [`${a.name} and ${b.name} SWAP GOLD.`];
  } },
  { id: 'gift', label: 'GIFT\n30G', color: 0x2a6a3a, pair: true, apply(P, A, B) {
    const n = P.steal(A, B, 30); return [`${P.party[A].name} gives ${P.party[B].name} ${n} gold.`];
  } },
  { id: 'bankrupt', label: 'BANK-\nRUPT', color: 0x2a2a34, pair: false, apply(P, A) {
    const a = P.party[A]; const lost = Math.floor(a.gold / 2); a.gold -= lost;
    return [`BANKRUPT! ${a.name} loses half their gold: -${lost}g.`];
  } },
  { id: 'jackpot', label: 'JACK-\nPOT', color: 0xd9a020, pair: false, apply(P, A) {
    P.addGold(A, 50); return [`JACKPOT! ${P.party[A].name} gets 50 gold.`];
  } },
  { id: 'swapcrown', label: 'SWAP\nCROWNS', color: 0x8a1c2b, pair: true, apply(P, A, B) {
    const a = P.party[A], b = P.party[B]; const c = a.crowns; a.crowns = b.crowns; b.crowns = c;
    return [`${a.name} and ${b.name} SWAP CROWNS.`];
  } },
  { id: 'taxday', label: 'TAX\nDAY', color: 0x3a5a8a, pair: false, apply(P, A, B, st) {
    let t = 0; st.seats.forEach((s) => { if (s !== A) t += P.steal(A, s, 10); });
    return [`TAX DAY! ${P.party[A].name} pays everyone 10 gold (${t}g total).`];
  } },
  { id: 'robin', label: 'ROBIN\nHOOD', color: 0x3a7a3a, pair: false, apply(P, A, B, st) {
    const s = st.seats.slice().sort((x, y) => P.party[y].gold - P.party[x].gold);
    const n = P.steal(s[0], s[s.length - 1], 25);
    return [`ROBIN HOOD! ${P.party[s[0]].name} pays ${P.party[s[s.length - 1]].name} ${n} gold.`];
  } },
  { id: 'rain', label: 'GOLD\nRAIN', color: 0x2a8a8a, pair: false, apply(P, A, B, st) {
    st.seats.forEach((s) => P.addGold(s, 15)); return ['GOLD RAIN! Everyone gets 15 gold.'];
  } },
];

// ------------------------------------------------------------------ engine
// Every game id the online arcade can play (STACK ATTACK has its own scene).
export const PARTY_IDS = Object.keys(GAMES);

export function newGame(id, seats, humans, rng, P) {
  const st = { id, seats: seats.slice(), humans: humans.slice(), phase: 'intro', round: 0, rounds: 1, inputs: {}, data: {}, results: null, _h: {} };
  GAMES[id].setup(st, rng, P);
  return st;
}

// What gets broadcast: everything but the host's secrets.
export function publicState(st) {
  const { _h, ...rest } = st;
  return JSON.parse(JSON.stringify(rest));
}

export function startPlay(st) {
  st.phase = 'play';
  st.inputs = {};
}

// Apply results: gold changes for anything not already paid during the game.
// Trivia: stop now and pay out the scores so far (the host's END ROUND).
export function endTriviaEarly(st) {
  st.results = st.seats.slice().sort((a, b) => st.data.score[b] - st.data.score[a])
    .map((s) => ({ seat: s, gold: Math.ceil(st.data.score[s] / 3), note: `${st.data.score[s]} pts` }));
  st.data.ended = st.round + 1;
}

export function payOut(st, P) {
  st.results.forEach((r) => {
    if (r.gold) r.gold = P.addGold(r.seat, r.gold);
    r.delta = (r.gold || 0) + (r.raw || 0);
  });
}

export const nameOf = (P, s) => P.party[s]?.name || '?';
export const colorOf = (P, s) => RACES[P.party[s]?.race]?.color || '#ffffff';
