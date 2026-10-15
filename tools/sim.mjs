// Headless balance sim: runs many battles with a simple AI to catch bugs and
// eyeball difficulty. Usage: node tools/sim.mjs
import * as S from '../src/systems/state.js';
import * as K from '../src/systems/combat.js';
import { FORMATIONS } from '../src/data/enemies.js';
import { CLASSES } from '../src/data/classes.js';

function heroAI(b, u) {
  const foes = K.enemies(b).filter((e) => e.alive);
  const pals = K.heroes(b).filter((h) => h.alive);
  const low = pals.find((p) => p.hp / p.maxHp < 0.35);
  if (low && S.run.potions > 0 && Math.random() < 0.5) return { type: 'potion', target: low.uid };
  const ab = CLASSES[u.cls].ability;
  if (u.cd === 0 && Math.random() < 0.7) return { type: 'ability', target: foes[0].uid };
  return { type: 'attack', target: foes[Math.floor(Math.random() * foes.length)].uid };
}

const DEPTH = { fight: 2, fight5: 5, elite: 4, alien: 3, alien5: 5, mimic: 3, boss: 7 };
function battle(type, enemies) {
  const b = K.createBattle(enemies, type.replace('5', ''), DEPTH[type] || 4);
  K.startBattle(b);
  let guard = 0;
  while (!b.over && guard++ < 500) {
    const u = K.current(b);
    if (u && u.alive) {
      const { skip } = K.beginTurn(b);
      if (!skip && !b.over) {
        if (u.side === 'hero') K.heroAction(b, u.uid, heroAI(b, u));
        else K.enemyTurn(b);
      }
    }
    K.endTurn(b);
  }
  if (guard >= 500) throw new Error('battle did not end');
  const res = K.finishBattle(b);
  const hpPct = S.run.party.reduce((s, h) => s + h.hp, 0) / S.run.party.reduce((s, h) => s + h.maxHp, 0);
  return { over: b.over, rounds: b.round, gold: res.gold, hpPct };
}

const picks = [
  { race: 'haakon', cls: 'juggernaut' }, { race: 'mike', cls: 'goblin_king' },
  { race: 'josh', cls: 'cosmic_oracle' }, { race: 'griffin', cls: 'hellbound_gambler' },
];
for (const type of ['fight', 'fight5', 'elite', 'alien', 'alien5', 'mimic', 'boss']) {
  let wins = 0, rounds = 0, hp = 0, N = 400;
  for (let i = 0; i < N; i++) {
    S.newRun(picks, i + 1);
    if (type === 'boss') S.run.party.forEach((h) => { h.maxHp += 8; h.hp = h.maxHp; h.atk += 2; }); // rough mid-run power
    const r = battle(type, S.rng.pick(FORMATIONS[type.replace('5', '')]));
    if (r.over === 'win') { wins++; hp += r.hpPct; }
    rounds += r.rounds;
  }
  console.log(type.padEnd(6), 'win%', (wins / N * 100).toFixed(0), 'avg rounds', (rounds / N).toFixed(1), 'hp left on win', (hp / Math.max(1, wins) * 100).toFixed(0) + '%');
}
// Random class combos
let w = 0;
const CL = Object.keys(CLASSES);
for (let i = 0; i < 400; i++) {
  S.newRun(picks.map((p) => ({ race: p.race, cls: CL[i * 7 % 6 + 0 === 0 ? 0 : Math.floor(Math.random() * 6)] })), 1000 + i);
  if (battle('elite', S.rng.pick(FORMATIONS.elite)).over === 'win') w++;
}
console.log('elite random classes win%', (w / 4).toFixed(0));
console.log('map sample nodes:', S.generateMap().nodes.map((n) => n.type).join(','));
