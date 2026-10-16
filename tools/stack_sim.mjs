// Bot-vs-bot stress test for STACK ATTACK. Run: node tools/stack_sim.mjs
import { Rng } from '../src/systems/rng.js';
import * as S from '../src/systems/stack.js';

const GAMES = 3000;
const rng = new Rng(12345);
let plays = 0, longest = 0, bounces = 0, maxStack = 0, swaps = 0, caught = 0, stalls = 0;
const wins = {};
const total = S.buildDeck().length;
for (let g = 0; g < GAMES; g++) {
  const st = S.newGame([0, 1, 2, 3], rng);
  let steps = 0;
  while (st.winner === null && steps < 3000) {
    const seat = S.current(st);
    const ev = S.apply(st, seat, S.botMove(st, seat, rng), rng);
    ev.forEach((e) => {
      if (e.t === 'bounce') bounces++;
      if (e.t === 'stack') maxStack = Math.max(maxStack, e.amount);
      if (e.t === 'swap') swaps++;
    });
    if (st.lastDue !== null) {
      const ms = S.botLastReaction(rng);
      if (ms !== null && ms <= 3000) S.callLast(st, st.lastDue);
      else if (S.missLast(st, st.lastDue, rng).length) caught++;
    }
    if (S.cardCount(st) !== total) throw new Error(`card count ${S.cardCount(st)} != ${total} in game ${g}`);
    steps++;
  }
  if (st.winner === null) stalls++;
  else wins[st.winner] = (wins[st.winner] || 0) + 1;
  plays += steps; longest = Math.max(longest, steps);
}
console.log(`${GAMES} games, ${total}-card deck`);
console.log(`avg moves ${(plays / GAMES).toFixed(1)}, longest ${longest}, stalled ${stalls}`);
console.log(`bounces ${bounces}, biggest stack +${maxStack}, swaps ${swaps}, missed LAST CARD ${caught}`);
console.log('wins by seat', wins);
