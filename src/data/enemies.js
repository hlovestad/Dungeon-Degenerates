// Enemy definitions. `sprite` is the texture key prefix (sprite_idle etc.),
// `size` picks the on-screen height from SPRITE_HEIGHT, `faction` drives the
// Mike / Josh racial rules.

export const ENEMIES = {
  goblin_grunt: {
    name: 'Goblin Grunt', faction: 'goblin', size: 'enemy',
    hp: 30, atk: 9, def: 1, spd: 5, gold: [6, 12],
    lines: ['Oi!', 'Shiny!', 'Stab stab!'],
  },
  goblin_archer: {
    name: 'Goblin Archer', faction: 'goblin', size: 'enemy',
    hp: 24, atk: 10, def: 0, spd: 7, gold: [6, 12],
    lines: ['Pew!', 'Hold still!'],
  },
  dire_wolf: {
    name: 'Dire Wolf', faction: 'beast', size: 'enemy',
    hp: 32, atk: 10, def: 1, spd: 8, gold: [3, 8],
    lines: ['Grrr.', '*sniffs Haakon*'],
  },
  skeleton_auditor: {
    name: 'Skeleton Auditor', faction: 'undead', size: 'enemy',
    hp: 38, atk: 9, def: 3, spd: 3, gold: [8, 16],
    lines: ['Receipts?', 'This is a write-off.', 'Audit time.'],
  },
  slime_blob: {
    name: 'Slime', faction: 'beast', size: 'enemy',
    hp: 44, atk: 8, def: 0, spd: 2, gold: [4, 10],
    lines: ['*blorp*', '*squelch*'],
  },
  grey_alien: {
    name: 'Grey Alien', faction: 'alien', size: 'enemy',
    hp: 28, atk: 10, def: 1, spd: 6, gold: [10, 18],
    lines: ['Specimen located.', 'Hold. Still.', 'Fascinating.'],
  },
  alien_probe_drone: {
    name: 'Probe Drone', faction: 'alien', size: 'enemy',
    hp: 26, atk: 9, def: 2, spd: 7, gold: [10, 18],
    lines: ['BEEP.', 'SCANNING.'],
  },
  mimic_chest: {
    name: 'Mimic', faction: 'beast', size: 'enemy',
    hp: 60, atk: 12, def: 2, spd: 4, gold: [30, 50],
    lines: ['*chomp*', 'Surprise!'],
  },
  goblin_brute: {
    name: 'Goblin Brute', faction: 'goblin', size: 'large',
    hp: 56, atk: 12, def: 2, spd: 3, gold: [15, 25],
    lines: ['SMASH.', 'Me big.'],
  },
  boss_dungeon_landlord: {
    name: 'The Dungeon Landlord', faction: 'demon', size: 'boss', boss: true,
    hp: 380, atk: 16, def: 3, spd: 5, gold: [0, 0],
    lines: ['Rent is DUE.', 'That is coming out of your deposit.', 'No pets. No heroes.', 'I am raising the rent.'],
  },
};

// Encounter formations by node type. One is picked at random.
export const FORMATIONS = {
  fight: [
    ['goblin_grunt', 'goblin_archer', 'goblin_grunt'],
    ['dire_wolf', 'dire_wolf', 'dire_wolf'],
    ['skeleton_auditor', 'skeleton_auditor'],
    ['slime_blob', 'goblin_grunt', 'slime_blob'],
  ],
  elite: [
    ['goblin_brute', 'goblin_archer', 'goblin_grunt'],
    ['skeleton_auditor', 'dire_wolf', 'skeleton_auditor'],
  ],
  alien: [
    ['grey_alien', 'alien_probe_drone', 'grey_alien'],
    ['alien_probe_drone', 'grey_alien'],
  ],
  mimic: [['mimic_chest']],
  boss: [['boss_dungeon_landlord']],
};

// Which background each fight type uses.
export const FIGHT_BG = {
  fight: ['bg_dungeon_crypt', 'bg_dungeon_cave'],
  elite: ['bg_dungeon_crypt'],
  alien: ['bg_alien_crash_site'],
  mimic: ['bg_treasure_vault'],
  boss: ['bg_landlord_office'],
};
