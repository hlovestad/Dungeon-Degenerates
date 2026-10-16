// STACK ATTACK: classic shedding card game (match colour or symbol, first to
// empty their hand wins) with our house rules. Pure logic, no Phaser.
// The scene calls these and animates the events they return; the future
// multiplayer host will run them and send each phone only its own hand.
//
// House rules
// - Plus cards STACK: +2 on any +2, +4 on any +4 (colour doesn't matter).
//   Whoever can't (or won't) stack draws the whole pile and loses their turn.
// - RIGHT BACK AT YA: play it when you're facing a plus pile. The whole pile
//   goes to whoever plused you last, you pick the colour (like a +4), and it
//   reverses the turn order (like a REVERSE).
//   They can bounce it back with their own.
// - SWAP HANDS (wild): pick a colour and swap hands with anyone.
// - SKIP EVERYONE: everybody else is skipped, you go again.
// - LAST CARD: the moment you go down to one card you have 3 seconds to tap
//   LAST CARD! or you automatically draw 2. (The scene / host runs the clock.)

export const COLORS = ['R', 'Y', 'G', 'B'];
export const COLOR_NAMES = { R: 'RED', Y: 'YELLOW', G: 'GREEN', B: 'BLUE' };

// Card values. Wild-type cards have c: null until played (then the chosen
// colour lives on the game state, not the card).
const WILDS = ['wild', '+4', 'rbay', 'swap'];
export const isWild = (card) => WILDS.includes(card.v);
export const isPlus = (card) => card.v === '+2' || card.v === '+4';

export const CARD_LABEL = {
  skip: 'SKIP', rev: 'REVERSE', '+2': '+2', wild: 'WILD', '+4': '+4',
  rbay: 'RIGHT BACK AT YA', swap: 'SWAP HANDS', skipall: 'SKIP EVERYONE',
};
export const CARD_HELP = {
  skip: 'Next player loses their turn.',
  rev: 'Turn order flips.',
  '+2': 'Next player draws 2, unless they stack a +2.',
  wild: 'Pick the colour.',
  '+4': 'Pick the colour. Next player draws 4, unless they stack a +4.',
  rbay: 'Play when plused: the whole pile goes back to whoever plused you. Pick the colour. Reverses the order.',
  swap: 'Pick the colour, then swap hands with anyone.',
  skipall: 'Everybody else is skipped. Go again.',
};

export function buildDeck({ extras = true } = {}) {
  const deck = [];
  let id = 0;
  const add = (c, v) => deck.push({ id: id++, c, v });
  COLORS.forEach((c) => {
    add(c, '0');
    for (let n = 1; n <= 9; n++) { add(c, String(n)); add(c, String(n)); }
    ['skip', 'rev', '+2'].forEach((v) => { add(c, v); add(c, v); });
    if (extras) add(c, 'skipall');
  });
  for (let k = 0; k < 4; k++) { add(null, 'wild'); add(null, '+4'); }
  if (extras) {
    for (let k = 0; k < 4; k++) add(null, 'rbay');
    for (let k = 0; k < 2; k++) add(null, 'swap');
  }
  return deck;
}

// ------------------------------------------------------------------ setup
export function newGame(seats, rng, { handSize = 7, extras = true } = {}) {
  const st = {
    seats: seats.slice(), // party seat numbers, in turn order
    hands: {}, // seat -> [card]
    draw: rng.shuffle(buildDeck({ extras })),
    discard: [],
    color: null, // colour in play
    dir: 1,
    turn: 0, // index into seats
    pending: null, // { amount, kind: '+2'|'+4', from: seat }
    drew: false, // current player already drew this turn
    lastDue: null, // seat that just hit one card and owes a LAST CARD tap
    winner: null,
    plays: 0,
  };
  seats.forEach((s) => { st.hands[s] = []; });
  for (let k = 0; k < handSize; k++) seats.forEach((s) => st.hands[s].push(st.draw.pop()));
  // flip a number card to start
  let top = st.draw.pop();
  while (!/^\d$/.test(top.v)) { st.draw.unshift(top); top = st.draw.pop(); }
  st.discard.push(top);
  st.color = top.c;
  st.turn = rng.int(0, seats.length - 1);
  return st;
}

export const top = (st) => st.discard[st.discard.length - 1];
export const current = (st) => st.seats[st.turn];
const idxOf = (st, seat) => st.seats.indexOf(seat);
function stepFrom(st, seat, n = 1) {
  const k = st.seats.length;
  return st.seats[(((idxOf(st, seat) + st.dir * n) % k) + k) % k];
}
export const nextSeat = (st, seat = current(st)) => stepFrom(st, seat, 1);

function setTurn(st, seat) {
  st.turn = idxOf(st, seat);
  st.drew = false;
}

function drawCards(st, seat, n, rng) {
  const got = [];
  for (let k = 0; k < n; k++) {
    if (!st.draw.length) {
      // reshuffle everything but the top card
      const t = st.discard.pop();
      st.draw = rng.shuffle(st.discard);
      st.discard = [t];
      if (!st.draw.length) break; // everything is in people's hands
    }
    got.push(st.draw.pop());
  }
  st.hands[seat].push(...got);
  if (st.lastDue === seat && st.hands[seat].length > 1) st.lastDue = null;
  return got;
}

// ------------------------------------------------------------------ rules
export function canPlay(st, seat, card) {
  if (st.winner !== null || current(st) !== seat) return false;
  if (st.pending) return card.v === st.pending.kind || card.v === 'rbay';
  if (card.v === 'rbay') return false; // only works as a comeback
  if (isWild(card)) return true;
  return card.c === st.color || card.v === top(st).v;
}

export const playable = (st, seat) => st.hands[seat].filter((c) => canPlay(st, seat, c));

// Play a card. opts: { color } for wild-type cards, { target } for SWAP HANDS.
// Returns events: [{ t: 'play'|'color'|'skip'|'reverse'|'stack'|'bounce'|'swap'|'skipall'|'win'|'lastcard', ... }]
export function play(st, seat, cardId, opts = {}) {
  const hand = st.hands[seat];
  const k = hand.findIndex((c) => c.id === cardId);
  if (k < 0) throw new Error('card not in hand');
  const card = hand[k];
  if (!canPlay(st, seat, card)) throw new Error('illegal play');
  hand.splice(k, 1);
  st.discard.push(card);
  st.plays++;
  const ev = [{ t: 'play', seat, card }];

  if (isWild(card)) {
    st.color = COLORS.includes(opts.color) ? opts.color : st.color || 'R';
    ev.push({ t: 'color', c: st.color });
  } else {
    st.color = card.c;
  }

  // down to one card: the LAST CARD clock starts
  if (hand.length === 1) {
    st.lastDue = seat;
    ev.push({ t: 'lastdue', seat });
  }
  if (hand.length === 0) {
    st.winner = seat;
    // a plus card still lands on the next player for the drama
    if (isPlus(card)) {
      const victim = nextSeat(st, seat);
      const amount = (st.pending ? st.pending.amount : 0) + (card.v === '+2' ? 2 : 4);
      drawCards(st, victim, amount, opts.rng || { shuffle: (a) => a });
      ev.push({ t: 'take', seat: victim, n: amount });
    }
    st.pending = null;
    ev.push({ t: 'win', seat });
    return ev;
  }

  switch (card.v) {
    case 'skip': {
      const skipped = nextSeat(st, seat);
      ev.push({ t: 'skip', seat: skipped });
      setTurn(st, stepFrom(st, seat, 2));
      break;
    }
    case 'rev':
      st.dir *= -1;
      ev.push({ t: 'reverse', dir: st.dir });
      // with two players a reverse is a skip
      setTurn(st, st.seats.length === 2 ? seat : nextSeat(st, seat));
      break;
    case '+2':
    case '+4': {
      const add = card.v === '+2' ? 2 : 4;
      st.pending = { amount: (st.pending ? st.pending.amount : 0) + add, kind: card.v, from: seat };
      ev.push({ t: 'stack', amount: st.pending.amount, from: seat, to: nextSeat(st, seat) });
      setTurn(st, nextSeat(st, seat));
      break;
    }
    case 'rbay': {
      // the pile goes back to whoever plused you, and it's also a REVERSE
      const back = st.pending.from;
      st.pending = { ...st.pending, from: seat };
      st.dir *= -1;
      ev.push({ t: 'bounce', from: seat, to: back, amount: st.pending.amount });
      ev.push({ t: 'reverse', dir: st.dir });
      setTurn(st, back);
      break;
    }
    case 'swap': {
      const target = opts.target !== undefined && opts.target !== seat && st.hands[opts.target] ? opts.target : null;
      if (target !== null) {
        const mine = st.hands[seat];
        st.hands[seat] = st.hands[target];
        st.hands[target] = mine;
        if (st.lastDue === seat || st.lastDue === target) st.lastDue = null;
        ev.push({ t: 'swap', a: seat, b: target });
      }
      setTurn(st, nextSeat(st, seat));
      break;
    }
    case 'skipall':
      ev.push({ t: 'skipall', seat });
      setTurn(st, seat);
      break;
    default:
      setTurn(st, nextSeat(st, seat));
  }
  return ev;
}

// Facing a plus pile and not stacking: draw it all, lose the turn.
export function takeHit(st, seat, rng) {
  if (!st.pending || current(st) !== seat) throw new Error('nothing to take');
  const n = st.pending.amount;
  drawCards(st, seat, n, rng);
  st.pending = null;
  setTurn(st, nextSeat(st, seat));
  return [{ t: 'take', seat, n }];
}

// No playable card (or you just want one): draw 1. You may then play it, or pass.
export function drawOne(st, seat, rng) {
  if (st.pending || current(st) !== seat || st.drew) throw new Error('cannot draw now');
  const [card] = drawCards(st, seat, 1, rng);
  st.drew = true;
  return [{ t: 'draw', seat, n: card ? 1 : 0, card }];
}

export function pass(st, seat) {
  if (current(st) !== seat || !st.drew) throw new Error('draw first');
  setTurn(st, nextSeat(st, seat));
  return [{ t: 'pass', seat }];
}

// LAST CARD: tapped in time. Returns [] if nobody owed a tap.
export function callLast(st, seat) {
  if (st.lastDue !== seat) return [];
  st.lastDue = null;
  return [{ t: 'lastcard', seat }];
}

// Too slow: the clock ran out, draw 2.
export function missLast(st, seat, rng) {
  if (st.lastDue !== seat) return [];
  st.lastDue = null;
  drawCards(st, seat, 2, rng);
  return [{ t: 'missed', seat, n: 2 }];
}

// How fast a bot taps LAST CARD (ms), or null if it forgets entirely.
export function botLastReaction(rng) {
  if (rng.chance(0.15)) return null;
  return 500 + Math.floor(rng.next() * 3000); // sometimes later than 3s too
}

// ------------------------------------------------------------------ bots
// Returns one action: { type: 'play', cardId, color?, target? } | { type: 'take' }
//                   | { type: 'draw' } | { type: 'pass' }
export function botMove(st, seat, rng) {
  const hand = st.hands[seat];
  const opts = playable(st, seat);
  const favColor = () => {
    const n = { R: 0, Y: 0, G: 0, B: 0 };
    hand.forEach((c) => { if (c.c) n[c.c]++; });
    return Object.entries(n).sort((a, b) => b[1] - a[1])[0][1] ? Object.entries(n).sort((a, b) => b[1] - a[1])[0][0] : rng.pick(COLORS);
  };
  const others = st.seats.filter((s) => s !== seat);
  const fewest = () => others.reduce((b, s) => (st.hands[s].length < st.hands[b].length ? s : b), others[0]);
  const withColor = (card) => ({ type: 'play', cardId: card.id, color: isWild(card) ? favColor() : undefined, target: card.v === 'swap' ? fewest() : undefined });

  if (st.pending) {
    const stack = opts.find((c) => c.v === st.pending.kind);
    const bounce = opts.find((c) => c.v === 'rbay');
    // bounce big piles, stack small ones
    if (bounce && (st.pending.amount >= 4 || !stack)) return withColor(bounce);
    if (stack) return withColor(stack);
    return { type: 'take' };
  }
  if (!opts.length) return st.drew ? { type: 'pass' } : { type: 'draw' };

  const nextN = st.hands[nextSeat(st, seat)].length;
  const score = (c) => {
    let s = 0;
    if (c.v === 'swap') s += hand.length > st.hands[fewest()].length + 2 ? 30 : -20;
    if (['+2', 'skip', 'skipall'].includes(c.v)) s += nextN <= 3 ? 12 : 3;
    if (c.v === '+4') s += nextN <= 3 ? 10 : -6; // save the big guns
    if (c.v === 'wild') s -= 8;
    if (/^\d$/.test(c.v)) s += 5 + Number(c.v) / 10;
    if (c.c && c.c === favColor()) s += 2;
    return s + rng.next();
  };
  const best = opts.slice().sort((a, b) => score(b) - score(a))[0];
  return withColor(best);
}

// Apply an action object (used by bots, tests, and the network host).
export function apply(st, seat, action, rng) {
  if (action.type === 'play') return play(st, seat, action.cardId, { color: action.color, target: action.target, rng });
  if (action.type === 'take') return takeHit(st, seat, rng);
  if (action.type === 'draw') return drawOne(st, seat, rng);
  if (action.type === 'pass') return pass(st, seat);
  return [];
}

// Sum of every card in the game (for tests).
export const cardCount = (st) => st.draw.length + st.discard.length + Object.values(st.hands).reduce((n, h) => n + h.length, 0);

// ------------------------------------------------------------------ matches
// A match is a run of rounds: first to 6 round wins, but you have to win by 2
// (6-4 wins; 6-5 keeps going, 7-5 wins). Then the scoreboard resets.
// Between rounds everyone READYs up, and can vote to SHUFFLE the seats:
// 60% of the human players voting yes = random new seating order.
export const MATCH_TARGET = 6;
export const MATCH_BY = 2;
export const SHUFFLE_SHARE = 0.6;

export function newMatch(seats) {
  return { order: seats.slice(), wins: Object.fromEntries(seats.map((s) => [s, 0])), round: 1, titles: {}, champion: null, final: null };
}

// Record a round win. Returns the match winner's seat, or null if it goes on.
export function recordWin(match, seat) {
  match.champion = null;
  match.final = null;
  match.wins[seat] = (match.wins[seat] || 0) + 1;
  const sorted = Object.values(match.wins).sort((a, b) => b - a);
  const best = match.wins[seat];
  const second = Object.entries(match.wins).filter(([s]) => Number(s) !== seat).reduce((m, [, w]) => Math.max(m, w), 0);
  if (best === sorted[0] && best >= MATCH_TARGET && best - second >= MATCH_BY) {
    match.champion = seat;
    match.final = { ...match.wins };
    match.titles[seat] = (match.titles[seat] || 0) + 1;
    return seat;
  }
  return null;
}

// Start the next round: bump the round, reset the board after a match win,
// and shuffle the seats if the vote passed.
export function nextRound(match, rng, shuffle) {
  if (match.champion !== null) {
    Object.keys(match.wins).forEach((s) => { match.wins[s] = 0; });
    match.round = 0;
    match.champion = null;
  }
  match.round++;
  if (shuffle && match.order.length > 2) {
    let o = match.order;
    for (let k = 0; k < 8 && o.join() === match.order.join(); k++) o = rng.shuffle(match.order);
    match.order = o;
  }
  return match;
}

// post-round ready / vote bookkeeping. humans: seats played by real people.
export function voteCount(post, humans) {
  const yes = humans.filter((s) => post.vote[s]).length;
  return { yes, of: humans.length, passes: humans.length > 0 && yes / humans.length >= SHUFFLE_SHARE - 1e-9 };
}
export const allReady = (post, humans) => humans.every((s) => post.ready[s]);
