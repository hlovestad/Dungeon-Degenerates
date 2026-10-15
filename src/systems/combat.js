// Pure turn-based combat rules. Nothing here touches Phaser.
// Every function mutates the battle object and returns a list of "events"
// that the Battle scene plays back as animations. A future multiplayer host
// would run these functions and broadcast the events to every phone.

import { ENEMIES } from '../data/enemies.js';
import { CLASSES } from '../data/classes.js';
import { run, rng } from './state.js';
import { HERO_QUIPS, BUSH_LINES, BUSH_OUT, DEATH_LINES, MODIFIERS } from '../data/banter.js';

const HIT_CHANCE = 0.92;
const BASE_CRIT = 0.08;

// Griffin's racial rule: any chance of 10% or less is doubled.
export function luck(p, unit) {
  return unit && unit.race === 'griffin' && p <= 0.10 ? p * 2 : p;
}

export function createBattle(enemyIds, type, depth = 1) {
  // Enemies get tougher the deeper the party goes (map row 1..7).
  const hpM = 1 + 0.12 * Math.max(0, depth - 1);
  const atkM = 1 + 0.06 * Math.max(0, depth - 1);
  const units = [];
  run.party.forEach((h, i) => {
    units.push({
      uid: 'h' + i, side: 'hero', key: h.race, race: h.race, cls: h.cls, signature: h.signature,
      name: h.name, hp: Math.max(0, h.hp), maxHp: h.maxHp, atk: h.atk, def: h.def, spd: h.spd,
      alive: h.hp > 0, slot: i, cd: 0, st: {}, firstHit: true, heroIndex: i,
    });
  });
  enemyIds.forEach((id, i) => {
    const e = ENEMIES[id];
    units.push({
      uid: 'e' + i, side: 'enemy', key: id, name: e.name, faction: e.faction, boss: !!e.boss,
      hp: Math.round(e.hp * (e.boss ? 1 : hpM)), maxHp: Math.round(e.hp * (e.boss ? 1 : hpM)),
      atk: Math.round(e.atk * (e.boss ? 1 : atkM)), def: e.def, spd: e.spd, alive: true, slot: i,
      cd: 0, st: {}, turns: 0,
    });
  });
  const b = { type, depth, units, order: [], turn: 0, round: 0, over: null, daniCd: 1, daniForced: !!run.flags.daniAngry, pending: [], quipped: {} };
  b.mod = pickModifier(b);
  return b;
}

// A silly rule for this fight (not for bosses). Roughly 60% of fights get one.
function pickModifier(b) {
  if (b.type === 'boss' || !rng.chance(0.6)) return null;
  const ok = Object.entries(MODIFIERS).filter(([, m]) => !m.needs || heroes(b).some((h) => h.race === m.needs && h.alive));
  return ok.length ? rng.pick(ok)[0] : null;
}

// Heroes only crack jokes some of the time, and never twice in a row about the same thing.
function quip(b, u, kind, ev, chance = 0.4) {
  if (!u || u.side !== 'hero') return;
  const lines = HERO_QUIPS[u.race]?.[kind];
  if (!lines || !rng.chance(chance)) return;
  const key = u.uid + kind;
  if (b.quipped[key] === b.round) return;
  b.quipped[key] = b.round;
  ev.push({ t: 'say', uid: u.uid, text: rng.pick(lines) });
}

export const unit = (b, uid) => b.units.find((u) => u.uid === uid);
export const heroes = (b) => b.units.filter((u) => u.side === 'hero');
export const enemies = (b) => b.units.filter((u) => u.side === 'enemy');
const aliveOf = (list) => list.filter((u) => u.alive);
export const current = (b) => unit(b, b.order[b.turn]);

function newRound(b) {
  b.round++;
  b.order = aliveOf(b.units)
    .map((u) => ({ u, k: u.spd + rng.next() * 2 }))
    .sort((a, c) => c.k - a.k)
    .map((x) => x.u.uid);
  b.turn = 0;
  if (b.mod === 'cheese' && b.round > 1) {
    b.pending.push({ t: 'log', text: 'Cursed cheese kicks in. Everyone heals 4.' });
    aliveOf(b.units).forEach((u) => healUnit(u, 4, b.pending));
  }
}

// Units that can be hit right now (Josh in the bush can't).
const targetable = (list) => list.filter((u) => u.alive && !u.st.bush);

// ---------- Battle start ----------
export function startBattle(b) {
  const ev = [];
  run.stats.fights++;
  const josh = heroes(b).find((u) => u.race === 'josh' && u.alive);
  const isAlien = b.type === 'alien';
  if (b.mod) {
    const m = MODIFIERS[b.mod];
    ev.push({ t: 'modifier', name: m.name, desc: m.desc });
    if (b.mod === 'mom') {
      const h = heroes(b).find((u) => u.race === 'haakon');
      ev.push({ t: 'say', uid: h.uid, text: 'Hi Mom!' });
    }
  }

  if (isAlien && josh) {
    ev.push({ t: 'say', uid: josh.uid, text: 'Oh no. Not again.' });
    ev.push({ t: 'probe', uid: josh.uid });
    josh.st.probed = 2;
    run.stats.probes++;
    ev.push({ t: 'status', uid: josh.uid, text: 'PROBED', color: 'purple' });
    ev.push({ t: 'log', text: 'The aliens probed Josh. His aim is shot for 2 turns.' });
  }
  if (josh) {
    const target = rng.pick(aliveOf(enemies(b)));
    target.st.weak = 99;
    ev.push({ t: 'reveal', uid: target.uid, from: josh.uid });
    ev.push({ t: 'log', text: `Josh's third eye spots a weak point on the ${target.name}. It takes +25% damage.` });
  }
  // Josh does not do dogs. He watches from a bush until half of them are down.
  const dogs = enemies(b).filter((e) => e.key === 'dire_wolf').length;
  if (josh && dogs) {
    josh.st.bush = true;
    b.bushNeed = Math.ceil(dogs / 2);
    ev.push({ t: 'bush', uid: josh.uid, action: 'in' });
    ev.push({ t: 'say', uid: josh.uid, text: "I'm not gonna get in the middle of that." });
    ev.push({ t: 'log', text: `Josh dives into a bush. He'll come out once ${b.bushNeed} dog${b.bushNeed > 1 ? 's are' : ' is'} down.` });
  }
  const griffin = heroes(b).find((u) => u.race === 'griffin' && u.alive);
  if (griffin && run.flags.daniDate) {
    run.flags.daniDate = false;
    ev.push({ t: 'dani', action: 'heal', uid: griffin.uid });
    aliveOf(heroes(b)).forEach((h) => healUnit(h, 6, ev));
    ev.push({ t: 'log', text: 'Dani is still glowing from date night. She heals everyone 6 HP.' });
  }
  if (run.flags.daniAngry && griffin) {
    ev.push({ t: 'log', text: 'Dani is still mad you skipped date night...' });
  }
  newRound(b);
  return ev;
}

// ---------- Turn flow ----------
// Called at the start of whoever's turn it is. Returns { events, skip }.
export function beginTurn(b) {
  const u = current(b);
  const ev = b.pending.splice(0);
  if (!u || !u.alive) return { events: ev, skip: true };
  if (u.st.bush) {
    const dogsDown = enemies(b).filter((e) => e.key === 'dire_wolf' && !e.alive).length;
    const othersUp = heroes(b).some((h) => h !== u && h.alive);
    if (dogsDown >= b.bushNeed || !othersUp) {
      delete u.st.bush;
      ev.push({ t: 'bush', uid: u.uid, action: 'out' });
      ev.push({ t: 'say', uid: u.uid, text: othersUp ? rng.pick(BUSH_OUT) : 'Fine. FINE. I am coming.' });
    } else {
      ev.push({ t: 'say', uid: u.uid, text: rng.pick(BUSH_LINES), bush: true });
      return { events: ev, skip: true };
    }
  }
  delete u.st.defend;
  delete u.st.taunt;
  if (u.cd > 0) u.cd--;
  if (u.st.decree) { u.st.decree--; if (!u.st.decree) delete u.st.decree; }

  if (u.st.stun) {
    u.st.stun--;
    if (!u.st.stun) delete u.st.stun;
    ev.push({ t: 'status', uid: u.uid, text: 'STUNNED', color: 'grey' });
    return { events: ev, skip: true };
  }
  if (b.mod === 'naptime' && u.side === 'enemy' && rng.chance(0.2)) {
    ev.push({ t: 'say', uid: u.uid, text: '*snore*' });
    ev.push({ t: 'status', uid: u.uid, text: 'DOZED OFF', color: 'grey' });
    return { events: ev, skip: true };
  }

  // Dani acts at the start of Griffin's turn.
  if (u.race === 'griffin') {
    const res = daniCheck(b, u, ev);
    checkOver(b);
    if (res === 'whip' || b.over) return { events: ev, skip: true };
  }
  return { events: ev, skip: false };
}

function daniCheck(b, griffin, ev) {
  if (b.daniForced) {
    b.daniForced = false;
    run.flags.daniAngry = false;
    return whip(griffin, ev);
  }
  if (b.daniCd > 0) { b.daniCd--; return null; }
  if (!rng.chance(0.32)) return null;
  b.daniCd = 2;
  const roll = rng.next();
  if (roll < 0.4) {
    const hurt = aliveOf(heroes(b)).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
    ev.push({ t: 'dani', action: 'heal', uid: griffin.uid, target: hurt.uid });
    healUnit(hurt, 9, ev);
    ev.push({ t: 'log', text: `Dani patches up ${hurt.name}. "You're welcome."` });
    return 'heal';
  }
  if (roll < 0.8) {
    const foe = rng.pick(aliveOf(enemies(b)));
    if (!foe) return null;
    ev.push({ t: 'dani', action: 'bolt', uid: griffin.uid, target: foe.uid });
    dealDamage(b, null, foe, 10, { magic: true, ev, credit: griffin });
    ev.push({ t: 'log', text: `Dani blasts the ${foe.name}. Nobody touches her man.` });
    return 'bolt';
  }
  return whip(griffin, ev);
}

function whip(griffin, ev) {
  run.stats.whipped++;
  ev.push({ t: 'dani', action: 'whip', uid: griffin.uid });
  ev.push({ t: 'status', uid: griffin.uid, text: 'PUSSYWHIPPED', color: 'red' });
  ev.push({ t: 'log', text: 'Dani needs Griffin RIGHT NOW. He loses his turn.' });
  return 'whip';
}

export function endTurn(b) {
  checkOver(b);
  if (b.over) return;
  b.turn++;
  while (b.turn < b.order.length && !unit(b, b.order[b.turn])?.alive) b.turn++;
  if (b.turn >= b.order.length) newRound(b);
}

function checkOver(b) {
  if (!aliveOf(enemies(b)).length) b.over = 'win';
  else if (!aliveOf(heroes(b)).length) b.over = 'lose';
}

// ---------- Damage / healing ----------
function healUnit(u, amount, ev) {
  if (!u.alive) return;
  const before = u.hp;
  u.hp = Math.min(u.maxHp, u.hp + Math.round(amount));
  ev.push({ t: 'heal', uid: u.uid, amount: u.hp - before });
}

function dealDamage(b, attacker, target, raw, opts = {}) {
  const ev = opts.ev;
  let dmg = raw;
  if (!opts.magic) dmg -= target.def * 0.6;
  // Haakon's physical dominance
  if (attacker && attacker.race === 'haakon' && !opts.magic) dmg *= 1.3;
  if (target.race === 'haakon' && !opts.magic) dmg *= 0.85;
  // Mike: non-goblins hit him harder
  if (target.race === 'mike' && attacker && attacker.side === 'enemy' && attacker.faction !== 'goblin') dmg *= 1.12;
  if (target.st.weak) dmg *= 1.25;
  if (attacker && attacker.st.decree) dmg *= 0.7;
  if (b.mod === 'mom' && attacker && attacker.race === 'haakon') dmg *= 1.4;
  if (attacker && attacker.pm) dmg *= attacker.pm;
  if (target.st.defend) dmg *= 0.5;
  dmg *= 0.88 + rng.next() * 0.24;
  if (opts.crit) dmg *= 2;
  dmg = Math.max(1, Math.round(dmg));
  const dealt = Math.min(target.hp, dmg);
  target.hp = Math.max(0, target.hp - dmg);
  const credit = attacker || opts.credit;
  if (credit && credit.side === 'hero' && target.side === 'enemy') {
    credit.dmgDealt = (credit.dmgDealt || 0) + dealt;
    run.party[credit.heroIndex].st.dmg += dealt;
  }
  ev.push({ t: 'damage', uid: target.uid, amount: dmg, crit: !!opts.crit, big: !!opts.big });
  if (target.hp <= 0) {
    target.alive = false;
    if (target.side === 'enemy' && rng.chance(0.45)) ev.push({ t: 'say', uid: target.uid, text: rng.pick(DEATH_LINES[target.faction] || ['Ugh.']) });
    ev.push({ t: 'die', uid: target.uid });
    if (target.side === 'enemy') {
      run.stats.kills++;
      // Kill bounty: the gold goes to whoever landed the last hit. Steal kills.
      if (credit && credit.side === 'hero') {
        const [lo, hi] = ENEMIES[target.key].gold;
        const bounty = Math.round(rng.int(lo, hi) * (1 + 0.08 * (b.depth || 1)));
        run.party[credit.heroIndex].gold += bounty;
        run.party[credit.heroIndex].st.kills++;
        run.stats.goldEarned += bounty;
        ev.push({ t: 'gold', uid: credit.uid, amount: bounty, label: 'BOUNTY' });
      }
      if (attacker && attacker.race === 'mike' && target.faction === 'goblin') quip(b, attacker, 'killGoblin', ev, 0.7);
      else quip(b, attacker, 'kill', ev, 0.35);
    } else { run.stats.deaths++; ev.push({ t: 'log', text: `${target.name} is down!` }); }
  } else if (target.side === 'hero' && target.hp / target.maxHp < 0.35) {
    quip(b, target, 'hurt', ev, 0.35);
  }
  return dmg;
}

function rollHit(b, attacker) {
  let p = HIT_CHANCE;
  if (attacker.st.probed) p -= 0.4;
  if (b.mod === 'greased') p -= 0.15;
  return rng.chance(p);
}

function basicStrike(b, a, target, mult, ev, opts = {}) {
  ev.push({ t: 'attack', uid: a.uid, target: target.uid, kind: opts.kind || 'melee' });
  if (!opts.noMiss && !rollHit(b, a)) {
    ev.push({ t: 'damage', uid: target.uid, miss: true });
    if (a.st.probed) ev.push({ t: 'log', text: `${a.name} is still seeing stars from the probe. Miss!` });
    else if (b.mod === 'greased' && rng.chance(0.4)) ev.push({ t: 'log', text: `${a.name} slips on the butter.` });
    quip(b, a, 'miss', ev);
    return 0;
  }
  let m = mult;
  if (a.firstHit && a.race === 'haakon') {
    m *= 1.25;
    ev.push({ t: 'status', uid: a.uid, text: 'OPENING BLOW', color: 'gold' });
  }
  a.firstHit = false;
  const crit = opts.crit ?? rng.chance(luck(BASE_CRIT * (b.mod === 'hype' ? 3 : 1), a));
  const dmg = dealDamage(b, a, target, a.atk * m, { crit, ev, big: opts.big });
  if (crit && target.alive) quip(b, a, 'crit', ev, 0.5);
  return dmg;
}

// ---------- Hero actions ----------
// action: { type: 'attack'|'ability'|'defend'|'flex'|'potion', target: uid }
export function heroAction(b, actorUid, action) {
  const a = unit(b, actorUid);
  const ev = [];
  const target = action.target ? unit(b, action.target) : null;
  const sig = a.signature;

  if (a.st.probed) { a.st.probed--; if (!a.st.probed) delete a.st.probed; }

  switch (action.type) {
    case 'attack':
      basicStrike(b, a, target, 1, ev);
      break;

    case 'defend':
      a.st.defend = 1;
      ev.push({ t: 'status', uid: a.uid, text: 'DEFENDING', color: 'blue' });
      break;

    case 'flex':
      a.st.taunt = 1;
      a.st.defend = 0;
      ev.push({ t: 'flex', uid: a.uid });
      ev.push({ t: 'status', uid: a.uid, text: 'FLEXING', color: 'gold' });
      ev.push({ t: 'log', text: 'Haakon flexes. Every enemy now wants a piece of him.' });
      break;

    case 'potion': {
      run.potions--;
      ev.push({ t: 'potion', uid: a.uid, target: target.uid });
      healUnit(target, 15, ev);
      break;
    }

    case 'ability': {
      const ab = CLASSES[a.cls].ability;
      a.cd = ab.cooldown + 1;
      // Power meter result from the timing minigame: perfect / good / weak.
      a.pm = POWER[action.quality] ?? 1;
      ev.push({ t: 'ability', uid: a.uid, name: ab.name, quality: action.quality });
      doAbility(b, a, ab.id, target, sig, ev, action.quality);
      delete a.pm;
      break;
    }
  }
  checkOver(b);
  return ev;
}

export const POWER = { perfect: 1.5, good: 1, weak: 0.7 };

function doAbility(b, a, id, target, sig, ev, quality) {
  const foes = aliveOf(enemies(b));
  const pals = aliveOf(heroes(b));
  switch (id) {
    case 'skull_crack': {
      const dmg = basicStrike(b, a, target, 1.6, ev, { big: true });
      if (dmg && target.alive && rng.chance((sig ? 0.7 : 0.35) + (quality === 'perfect' ? 0.25 : 0))) {
        target.st.stun = 1;
        ev.push({ t: 'status', uid: target.uid, text: 'STUNNED', color: 'grey' });
      }
      break;
    }
    case 'royal_decree': {
      ev.push({ t: 'shout', uid: a.uid, text: 'BY ROYAL DECREE!' });
      foes.forEach((f) => {
        f.st.decree = quality === 'perfect' ? 3 : 2;
        if (f.faction === 'goblin') {
          f.st.stun = 1;
          ev.push({ t: 'status', uid: f.uid, text: 'BOWS', color: 'gold' });
        } else ev.push({ t: 'status', uid: f.uid, text: 'WEAKENED', color: 'grey' });
      });
      if (sig) pals.forEach((p) => healUnit(p, 5, ev));
      ev.push({ t: 'log', text: sig ? 'The Goblin King commands. Goblins kneel, the party is refreshed.' : 'A royal decree! Enemies hit softer for 2 turns.' });
      break;
    }
    case 'third_eye_beam': {
      ev.push({ t: 'beam', uid: a.uid });
      const mult = sig ? 1.0 : 0.7;
      foes.forEach((f) => {
        if (!f.alive) return;
        dealDamage(b, a, f, a.atk * mult + 2, { magic: true, ev });
      });
      if (sig) {
        const t = rng.pick(aliveOf(enemies(b)));
        if (t && !t.st.weak) { t.st.weak = 99; ev.push({ t: 'reveal', uid: t.uid, from: a.uid }); }
      }
      break;
    }
    case 'long_shot': {
      run.stats.longShots++;
      const p = luck((sig ? 0.10 : 0.08) + (quality === 'perfect' ? 0.04 : 0), a);
      ev.push({ t: 'odds', uid: a.uid, pct: Math.round(p * 100) });
      if (rng.chance(p)) {
        ev.push({ t: 'shout', uid: a.uid, text: 'JACKPOT!' });
        a.pm = 1; // the jackpot is big enough already
        basicStrike(b, a, target, 6, ev, { noMiss: true, crit: false, big: true });
        ev.push({ t: 'log', text: `${a.name} hit the long shot at ${Math.round(p * 100)}%!` });
      } else {
        basicStrike(b, a, target, 0.5, ev);
        ev.push({ t: 'log', text: `The long shot (${Math.round(p * 100)}%) did not hit. Sad poke.` });
      }
      break;
    }
    case 'mend':
      ev.push({ t: 'glow', uid: a.uid });
      pals.forEach((p) => healUnit(p, p.maxHp * 0.3 * (POWER[quality] ?? 1), ev));
      break;
    case 'backstab': {
      const crit = rng.chance(luck(quality === 'perfect' ? 0.8 : 0.45, a));
      basicStrike(b, a, target, 1.0, ev, { crit });
      const g = rng.int(5, 15);
      run.party[a.heroIndex].gold += g;
      run.stats.goldEarned += g;
      ev.push({ t: 'gold', uid: a.uid, amount: g });
      break;
    }
  }
}

// ---------- Enemy AI ----------
// True if the current enemy is about to use its big special (UI shows a dodge prompt).
export function bossSpecialNext(b) {
  const a = current(b);
  return !!a && a.key === 'boss_dungeon_landlord' && (a.turns + 1) % 3 === 0;
}

// opts.dodged: the players nailed the dodge prompt, specials do half damage.
export function enemyTurn(b, opts = {}) {
  const a = current(b);
  const ev = [];
  a.turns++;
  const targets = targetable(heroes(b));
  if (!targets.length) {
    ev.push({ t: 'say', uid: a.uid, text: 'Where did the blond one go?' });
    return ev;
  }

  const taunter = targets.find((t) => t.st.taunt);
  let target = taunter;
  if (!target) {
    // Prefer wounded heroes a little.
    const weights = targets.map((t) => 1.4 - t.hp / t.maxHp);
    let r = rng.next() * weights.reduce((s, w) => s + w, 0);
    target = targets[0];
    for (let i = 0; i < targets.length; i++) { r -= weights[i]; if (r <= 0) { target = targets[i]; break; } }
  }

  if (rng.chance(0.3)) ev.push({ t: 'say', uid: a.uid, text: rng.pick(ENEMIES[a.key].lines) });

  // Boss special: rent collection every 3rd turn.
  if (a.key === 'boss_dungeon_landlord' && a.turns % 3 === 0) {
    ev.push({ t: 'shout', uid: a.uid, text: 'RENT IS DUE!' });
    ev.push({ t: 'attack', uid: a.uid, target: target.uid, kind: 'magic' });
    if (opts.dodged) ev.push({ t: 'log', text: 'DODGED! The party ducks behind Haakon. Half damage.' });
    targets.forEach((h) => dealDamage(b, a, h, a.atk * (opts.dodged ? 0.32 : 0.65), { magic: true, ev }));
    let stolen = 0;
    targets.forEach((h) => {
      const p = run.party[h.heroIndex];
      const fee = Math.min(p.gold, opts.dodged ? 5 : 10);
      p.gold -= fee; stolen += fee;
      if (fee) ev.push({ t: 'gold', uid: h.uid, amount: -fee, label: 'RENT' });
    });
    ev.push({ t: 'log', text: `The Landlord collects rent: damage to everyone${stolen ? ` and ${stolen} gold total` : ''}.` });
    checkOver(b);
    return ev;
  }

  // Mike's goblin kin: goblins sometimes refuse to hit their cousin.
  if (target.race === 'mike' && a.faction === 'goblin' && !taunter && rng.chance(0.35)) {
    ev.push({ t: 'say', uid: a.uid, text: "Can't hit a cousin." });
    ev.push({ t: 'log', text: `The ${a.name} refuses to attack Mike. Goblin solidarity.` });
    return ev;
  }

  const kind = a.key.includes('archer') || a.faction === 'alien' ? 'ranged' : 'melee';
  basicStrike(b, a, target, 1, ev, { kind });
  checkOver(b);
  return ev;
}

// ---------- After the fight ----------
export function finishBattle(b) {
  // Copy HP back to the persistent party. Downed heroes get back up at 25%.
  heroes(b).forEach((u) => {
    const h = run.party[u.heroIndex];
    h.hp = u.alive ? u.hp : (b.over === 'win' ? Math.ceil(h.maxHp * 0.25) : 0);
  });
  // MVP: most damage this fight gets a bonus (and bragging rights).
  let mvp = null;
  if (b.over === 'win') {
    const best = heroes(b).filter((u) => u.dmgDealt).sort((x, y) => y.dmgDealt - x.dmgDealt)[0];
    if (best) {
      const bonus = b.type === 'elite' ? 30 : b.type === 'boss' ? 0 : 15;
      run.party[best.heroIndex].gold += bonus;
      run.stats.goldEarned += bonus;
      mvp = { heroIndex: best.heroIndex, name: best.name, dmg: best.dmgDealt, bonus };
    }
    // Beating the boss: the MVP gets a Crown.
    if (b.type === 'boss' && best) { run.party[best.heroIndex].crowns += 1; mvp.crown = true; }
  }
  const dmgTable = heroes(b).map((u) => ({ heroIndex: u.heroIndex, name: u.name, dmg: u.dmgDealt || 0 }));
  return { mvp, dmgTable };
}
