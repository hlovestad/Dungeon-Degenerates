// Universal classes. Stat mods are added to the race base stats.
// Each class has one ability (cooldown in turns). If the race's signature
// class is chosen, `sigBonus` describes the extra effect (handled in combat.js).

export const CLASSES = {
  juggernaut: {
    id: 'juggernaut',
    short: 'Juggernaut',
    name: 'Juggernaut',
    mods: { hp: 8, atk: 1, def: 2, spd: -1 },
    ability: {
      id: 'skull_crack', short: 'Big hit. Might stun.', name: 'Skull Crack', cooldown: 2, target: 'enemy',
      desc: 'Heavy hit (160%). 35% chance to stun.',
    },
    sigBonus: 'Haakon: stun chance 70%.',
  },
  goblin_king: {
    id: 'goblin_king',
    short: 'Gob. King',
    name: 'Goblin King',
    mods: { hp: 2, atk: 1, def: 1, spd: 0 },
    ability: {
      id: 'royal_decree', short: 'Enemies hit softer. Goblins kneel.', name: 'Royal Decree', cooldown: 3, target: 'none',
      desc: 'All enemies deal 30% less damage for 2 turns. Goblins are stunned.',
    },
    sigBonus: 'Mike: also heals the party 5 HP.',
  },
  cosmic_oracle: {
    id: 'cosmic_oracle',
    short: 'Oracle',
    name: 'Cosmic Oracle',
    mods: { hp: 0, atk: 2, def: 0, spd: 1 },
    ability: {
      id: 'third_eye_beam', short: 'Zap ALL enemies.', name: 'Cosmic Beam', cooldown: 2, target: 'none',
      desc: 'Magic beam hits every enemy for 70%, ignoring defense.',
    },
    sigBonus: 'Josh: beam hits for 100% and marks a new weakness.',
  },
  hellbound_gambler: {
    id: 'hellbound_gambler',
    short: 'Gambler',
    name: 'Hellbound Gambler',
    mods: { hp: 0, atk: 1, def: 0, spd: 2 },
    ability: {
      id: 'long_shot', short: 'Tiny odds. HUGE hit.', name: 'Long Shot', cooldown: 1, target: 'enemy',
      desc: '8% chance to deal 600% damage. Otherwise a sad 50% poke.',
    },
    sigBonus: 'Griffin: base chance 10% (doubled to 20% by his race).',
  },
  cleric: {
    id: 'cleric',
    short: 'Cleric',
    name: 'Cleric',
    mods: { hp: 4, atk: -1, def: 1, spd: 0 },
    ability: {
      id: 'mend', short: 'Heal the whole party.', name: 'Mend', cooldown: 2, target: 'none',
      desc: 'Heal every ally for 30% of their max HP.',
    },
    sigBonus: null,
  },
  rogue: {
    id: 'rogue',
    short: 'Rogue',
    name: 'Rogue',
    mods: { hp: -2, atk: 2, def: 0, spd: 3 },
    ability: {
      id: 'backstab', short: 'Likely crit. Steal gold.', name: 'Backstab', cooldown: 2, target: 'enemy',
      desc: '100% hit with a 45% crit chance. Steals 5-15 gold.',
    },
    sigBonus: null,
  },
};

export const CLASS_ORDER = ['juggernaut', 'goblin_king', 'cosmic_oracle', 'hellbound_gambler', 'cleric', 'rogue'];
