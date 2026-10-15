// Pure turn-based combat rules. Nothing here touches Phaser.
// Every function mutates the battle object and returns a list of "events"
// that the Battle scene plays back as animations. A future multiplayer host
// would run these functions and broadcast the events to every phone.

import { ENEMIES } from '../data/enemies.js';
import { CLASSES } from '../data/classes.js';
import { run, rng } from './state.js';

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
  return { type, units, order: [], turn: 0, round: 0, over: null, daniCd: 1, daniForced: !!run.flags.daniAngry };
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
}

// ---------- Battle start ----------
export function startBattle(b) {
  const ev = [];
  run.stats.fights++;
  const josh = heroes(b).find((u) => u.race === 'josh' && u.alive);
  const isAlien = b.type === 'alien';

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
  const ev = [];
  if (!u || !u.alive) return { events: ev, skip: true };
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
    dealDamage(b, null, foe, 10, { magic: true, ev });
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
  if (target.st.defend) dmg *= 0.5;
  dmg *= 0.88 + rng.next() * 0.24;
  if (opts.crit) dmg *= 2;
  dmg = Math.max(1, Math.round(dmg));
  target.hp = Math.max(0, target.hp - dmg);
  ev.push({ t: 'damage', uid: target.uid, amount: dmg, crit: !!opts.crit, big: !!opts.big });
  if (target.hp <= 0) {
    target.alive = false;
    ev.push({ t: 'die', uid: target.uid });
    if (target.side === 'enemy') run.stats.kills++;
    else { run.stats.deaths++; ev.push({ t: 'log', text: `${target.name} is down!` }); }
  }
  return dmg;
}

function rollHit(attacker) {
  let p = HIT_CHANCE;
  if (attacker.st.probed) p -= 0.4;
  return rng.chance(p);
}

function basicStrike(b, a, target, mult, ev, opts = {}) {
  ev.push({ t: 'attack', uid: a.uid, target: target.uid, kind: opts.kind || 'melee' });
  if (!opts.noMiss && !rollHit(a)) {
    ev.push({ t: 'damage', uid: target.uid, miss: true });
    if (a.st.probed) ev.push({ t: 'log', text: `${a.name} is still seeing stars from the probe. Miss!` });
    return 0;
  }
  let m = mult;
  if (a.firstHit && a.race === 'haakon') {
    m *= 1.25;
    ev.push({ t: 'status', uid: a.uid, text: 'OPENING BLOW', color: 'gold' });
  }
  a.firstHit = false;
  const crit = opts.crit ?? rng.chance(luck(BASE_CRIT, a));
  return dealDamage(b, a, target, a.atk * m, { crit, ev, big: opts.big });
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
      ev.push({ t: 'ability', uid: a.uid, name: ab.name });
      doAbility(b, a, ab.id, target, sig, ev);
      break;
    }
  }
  checkOver(b);
  return ev;
}

function doAbility(b, a, id, target, sig, ev) {
  const foes = aliveOf(enemies(b));
  const pals = aliveOf(heroes(b));
  switch (id) {
    case 'skull_crack': {
      const dmg = basicStrike(b, a, target, 1.6, ev, { big: true });
      if (dmg && target.alive && rng.chance(sig ? 0.7 : 0.35)) {
        target.st.stun = 1;
        ev.push({ t: 'status', uid: target.uid, text: 'STUNNED', color: 'grey' });
      }
      break;
    }
    case 'royal_decree': {
      ev.push({ t: 'shout', uid: a.uid, text: 'BY ROYAL DECREE!' });
      foes.forEach((f) => {
        f.st.decree = 2;
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
      const p = luck(sig ? 0.10 : 0.08, a);
      ev.push({ t: 'odds', uid: a.uid, pct: Math.round(p * 100) });
      if (rng.chance(p)) {
        ev.push({ t: 'shout', uid: a.uid, text: 'JACKPOT!' });
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
      pals.forEach((p) => healUnit(p, p.maxHp * 0.3, ev));
      break;
    case 'backstab': {
      const crit = rng.chance(luck(0.45, a));
      basicStrike(b, a, target, 1.0, ev, { crit });
      const g = rng.int(5, 15);
      run.gold += g;
      run.stats.goldEarned += g;
      ev.push({ t: 'gold', uid: target.uid, amount: g });
      break;
    }
  }
}

// ---------- Enemy AI ----------
export function enemyTurn(b) {
  const a = current(b);
  const ev = [];
  a.turns++;
  const targets = aliveOf(heroes(b));
  if (!targets.length) return ev;

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
    targets.forEach((h) => dealDamage(b, a, h, a.atk * 0.65, { magic: true, ev }));
    const stolen = Math.min(run.gold, 15);
    if (stolen) { run.gold -= stolen; ev.push({ t: 'gold', uid: a.uid, amount: -stolen }); }
    ev.push({ t: 'log', text: `The Landlord collects rent: damage to everyone${stolen ? ` and ${stolen} gold` : ''}.` });
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
  let gold = 0;
  if (b.over === 'win') {
    enemies(b).forEach((e) => {
      const [lo, hi] = ENEMIES[e.key].gold;
      gold += rng.int(lo, hi);
    });
    if (b.type === 'elite') gold += 20;
    run.gold += gold;
    run.stats.goldEarned += gold;
  }
  return { gold };
}
