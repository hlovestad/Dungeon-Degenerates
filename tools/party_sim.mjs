// Bot-only stress test for the online party games. Run: node tools/party_sim.mjs
// Plays every game many times the way the host does (bots on a simulated clock)
// and checks nothing throws, gold never goes negative, and every game finishes.
import { Rng } from '../src/systems/rng.js';
import * as G from '../src/systems/partygames.js';

const rng = new Rng(99);
const RUNS = 400;
const party = () => ['Haakon', 'Mike', 'Josh', 'Griffin', 'Grub'].map((name, i) => ({ name, race: ['haakon', 'mike', 'josh', 'griffin', 'grub'][i], gold: 50, crowns: 0 }));

function play(id, nSeats) {
  const P = { party: party(), picker: 0 };
  P.addGold = (i, n) => { const b = P.party[i].gold; P.party[i].gold = Math.max(0, b + n); return P.party[i].gold - b; };
  P.steal = (a, b, n) => { const m = Math.min(P.party[a].gold, Math.max(0, Math.round(n))); P.party[a].gold -= m; P.party[b].gold += m; return m; };
  const seats = [...Array(nSeats).keys()];
  const def = G.GAMES[id];
  const st = G.newGame(id, seats, [], rng, P);
  let guard = 0;
  for (;;) {
    G.startPlay(st);
    let t = 0;
    const limit = def.playMs(st);
    // schedule
    const queue = [];
    const sched = (s, now) => { const b = def.bot(st, s, rng); if (b) queue.push({ at: now + (def.turnSeat ? b.ms : b.ms), s, b }); };
    if (def.turnSeat) { const s = def.turnSeat(st); if (s !== undefined) sched(s, 0); } else seats.forEach((s) => sched(s, 0));
    while (queue.length && !def.ready(st)) {
      queue.sort((a, b) => a.at - b.at);
      const q = queue.shift();
      if (q.at > limit) break;
      t = q.at;
      def.input(st, q.s, q.b.d, rng, P);
      if (q.b.repeat) sched(q.s, t);
      if (def.turnSeat) { const s = def.turnSeat(st); if (s !== undefined) sched(s, t); }
      if (++guard > 5000) throw new Error('runaway ' + id);
    }
    const r = def.resolve(st, rng, P);
    if (r === 'next') { st.round++; continue; }
    break;
  }
  G.payOut(st, P);
  if (!st.results || st.results.length !== nSeats) throw new Error(`${id}: results for ${st.results?.length} of ${nSeats}`);
  P.party.forEach((h) => { if (h.gold < 0) throw new Error(`${id}: negative gold`); });
  return st;
}

for (const id of G.PARTY_IDS) {
  let sum = 0;
  for (let k = 0; k < RUNS; k++) {
    const st = play(id, 3 + (k % 3));
    sum += st.results.reduce((n, r) => n + r.delta, 0);
  }
  console.log(`${id.padEnd(10)} ok  avg gold into the party per game: ${(sum / RUNS).toFixed(1)}`);
}
