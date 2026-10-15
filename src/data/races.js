// The four locked-in races. Any race can take any class; each race has a
// signature class that gets an extra bonus (see classes.js).
// Numbers are first-pass and meant to be tuned.

export const RACES = {
  haakon: {
    id: 'haakon',
    name: 'Haakon',
    race: 'Haakonian',
    signature: 'juggernaut',
    color: '#e8a25a',
    base: { hp: 34, atk: 9, def: 3, spd: 4 },
    perk: 'Physically dominant. +30% physical damage, takes 15% less physical damage, first hit each fight +25%.',
    flaw: 'Ego: too proud to Defend. He can only Flex, which makes every enemy target him.',
    tagline: 'Strongest man in the dungeon. Ask him.',
  },
  mike: {
    id: 'mike',
    name: 'Mike',
    race: 'Mikanite',
    signature: 'goblin_king',
    color: '#c97b4a',
    base: { hp: 28, atk: 7, def: 2, spd: 6 },
    perk: 'Goblin kin. Goblins sometimes refuse to hit him, and goblin shops give him 30% off.',
    flaw: 'Everyone else hates goblins. Non-goblins hit him 12% harder and other shops mark up 20%.',
    tagline: 'The nose knows. So do the goblins.',
  },
  josh: {
    id: 'josh',
    name: 'Josh',
    race: 'Joshian',
    signature: 'cosmic_oracle',
    color: '#7fe0f0',
    base: { hp: 24, atk: 6, def: 1, spd: 5 },
    perk: 'Third eye. Reveals rooms further ahead on the map and exposes one enemy weakness every fight.',
    flaw: 'Aliens find him fascinating. In every alien fight he gets probed and his accuracy tanks.',
    tagline: 'He has seen things. Things have also seen him.',
  },
  griffin: {
    id: 'griffin',
    name: 'Griffin',
    race: 'Griffinite',
    signature: 'hellbound_gambler',
    color: '#c58cff',
    base: { hp: 26, atk: 6, def: 2, spd: 7 },
    perk: 'Long shots. Any chance of 10% or less is doubled. Dani sometimes heals the party or blasts enemies.',
    flaw: 'Dani sometimes needs him RIGHT NOW. Pussywhipped: he loses his turn.',
    tagline: 'Never tell him the odds. Dani will.',
  },
};

export const RACE_ORDER = ['haakon', 'mike', 'josh', 'griffin'];
