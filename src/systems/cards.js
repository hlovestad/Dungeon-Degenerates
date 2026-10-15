// Dirty cards: the screw-your-friends layer. Pure rules, no Phaser.
// Cards are played from the map between rooms.
import { run, rng, steal } from './state.js';

export const CARDS = {
  tax: { name: 'TAX +15', desc: 'Target pays you 15 gold.', hostile: true, color: 0x8a1c2b },
  pickpocket: { name: 'PICKPOCKET', desc: 'Steal 5 to 30 gold. Luck of the draw.', hostile: true, color: 0x6a2a6a },
  swap: { name: 'SWAP', desc: 'Swap ALL your gold with the target.', hostile: true, color: 0x2a3a8a },
  skip: { name: 'SKIP', desc: 'Target sits out the next showdown.', hostile: true, color: 0x5a5a6a },
  double: { name: 'DOUBLE DOWN', desc: 'Your next showdown winnings are doubled.', hostile: false, color: 0x2a6a3a },
  reverse: { name: 'REVERSE', desc: 'Held. Bounces the next card played on you back at the sender.', hostile: false, passive: true, color: 0x8a6a1a },
};

// Play card `cardId` from seat `from` on seat `to`. Returns a list of lines to announce.
export function playCard(from, cardId, to) {
  const a = run.party[from];
  const idx = a.cards.indexOf(cardId);
  if (idx < 0) return ["You don't have that card."];
  a.cards.splice(idx, 1);
  run.stats.cardsPlayed++;
  const lines = [];
  const c = CARDS[cardId];
  if (!c.hostile) return applyCard(from, cardId, from, lines);

  let target = to;
  let source = from;
  const t = run.party[to];
  if (t.cards.includes('reverse')) {
    t.cards.splice(t.cards.indexOf('reverse'), 1);
    lines.push(`${a.name} plays ${c.name} on ${t.name}...`);
    lines.push(`REVERSE! ${t.name} bounces it right back!`);
    target = from; source = to;
  } else {
    lines.push(`${a.name} plays ${c.name} on ${t.name}!`);
  }
  return applyCard(source, cardId, target, lines);
}

function applyCard(from, cardId, to, lines) {
  const a = run.party[from], t = run.party[to];
  switch (cardId) {
    case 'tax': {
      const n = steal(to, from, 15);
      lines.push(n ? `${t.name} pays ${n} gold to ${a.name}.` : `${t.name} is broke. Nothing to tax.`);
      break;
    }
    case 'pickpocket': {
      const n = steal(to, from, rng.int(5, 30));
      lines.push(n ? `${a.name} lifts ${n} gold off ${t.name}.` : `${t.name}'s pockets are empty. Awkward.`);
      break;
    }
    case 'swap': {
      const ga = a.gold, gt = t.gold;
      a.gold = gt; t.gold = ga;
      if (gt > ga) { a.st.stolen += gt - ga; t.st.robbed += gt - ga; } else { t.st.stolen += ga - gt; a.st.robbed += ga - gt; }
      lines.push(`${a.name} and ${t.name} swap purses. ${a.name} now has ${a.gold}, ${t.name} has ${t.gold}.`);
      break;
    }
    case 'skip':
      t.skipNext = true;
      lines.push(`${t.name} has to sit out the next showdown.`);
      break;
    case 'double':
      a.doubleNext = true;
      lines.push(`${a.name} goes DOUBLE DOWN on the next showdown.`);
      break;
  }
  return lines;
}
