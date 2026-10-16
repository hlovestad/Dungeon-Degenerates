// All the jokes live here so they're easy to add to.
// Combat logic picks from these with the seeded rng.

// Hero one-liners. Triggered by combat.js with a chance so they don't spam.
export const HERO_QUIPS = {
  haakon: {
    crit: ['Open wide!', 'Say ahh!', 'Did everyone see that? Look at me.', 'Somebody film that. From my good side.'],
    miss: ['That was a warning shot.', 'I let him live. Out of pity.', 'The floor moved. Sue the floor.'],
    kill: ['Next victim, step up.', 'Open wide, who is next?', 'Who else wants some?', 'Lie down. Good.'],
    hurt: ['RUDE.', "I'm fine. I'm gorgeous and I'm fine.", 'You will regret touching this face.'],
  },
  mike: {
    crit: ['Goblin power! Oy, my wrist.', 'The nose knows.', 'Finally something goes right.'],
    miss: ['Of course I missed. Of COURSE.', 'My nose blocked my view. As usual.', 'Oy veyyyyy.'],
    kill: ['Smell ya later.', 'Get sniffed.', 'Good. Now I need to sit down.'],
    killGoblin: ['Sorry, cousin.', "I'll tell your mom.", 'Family reunion cancelled. Oy.'],
    hurt: ['My NOSE!', 'Oy! My back! My everything!', 'This is a disgrace. Ow.'],
  },
  josh: {
    crit: ['Manifested!', 'The universe provides!', 'That was SO meant to be.'],
    miss: ['Mercury is in retrograde.', "It's giving bad energy.", 'Not my fault, my moon is in Pisces.'],
    kill: ['Love and light, buddy.', 'I released you back to the universe.', 'Namaste. Bye.'],
    hurt: ['Ow! My chakras!', 'Rude. That was so Scorpio of you.', 'I am NOT in the space for that.'],
  },
  griffin: {
    crit: ['Let it ride!', 'House always loses!', 'Read em and weep.'],
    miss: ['Double or nothing?', 'Bad beat.', 'The dice hate me.'],
    kill: ['Cash out!', 'Paid in full.', 'Called it.'],
    hurt: ['Babe? Little help?', 'Ow. Dani?', 'I want a refund.'],
  },
};

// What Josh says from the bush during dog fights.
export const BUSH_LINES = [
  "I'm not gonna get in the middle of that.",
  'Those are big dogs, man.',
  "I'll take the next one.",
  "Nope. I'm good here.",
  "You guys got this. I'm watching the rear.",
  'Is it over? Tell me when it is over.',
  'This bush has great energy.',
];
export const BUSH_OUT = ["Okay, it's safe. I was guarding the rear.", 'Alright, I warmed up. Let me in.', 'I was doing recon. In the bush.'];

// Funny fight intros, keyed by the first enemy in the formation.
export const INTROS = {
  goblin_grunt: [
    'A goblin bachelor party stumbles into you. They are not happy about it.',
    'Goblins! They were mid-argument about whose turn it is to stab.',
    'Three goblins in a trench coat. The coat falls off.',
  ],
  dire_wolf: [
    'Dire wolves! One of them is wearing a tiny hat.',
    'A pack of dire wolves. They have clearly never been to obedience school.',
    'Big dogs. VERY big dogs. Somebody check where Josh went.',
  ],
  skeleton_auditor: [
    'Skeleton Auditors want receipts for everything you have ever looted.',
    'The IRS of the dead has arrived. Bring your paperwork.',
  ],
  slime_blob: [
    'A slime is eating a goblin. The goblin seems fine with it.',
    'Slimes. They smell like a gym bag left in a hot car.',
  ],
  goblin_brute: [
    'A Goblin Brute bursts through the wall. He was looking for the bathroom.',
    'The goblins brought their big cousin. He is mostly forearm.',
  ],
  grey_alien: [
    'A flying saucer parallel parks badly. Greys climb out. Josh goes pale.',
    'Aliens! They are holding very specific instruments. Josh knows why.',
  ],
  alien_probe_drone: [
    'A probe drone hums in. It has a little scanner arm. Josh knows that arm.',
  ],
  mimic_chest: ['The chest has teeth. And a tongue. And opinions.'],
};

// Dying enemy last words.
export const DEATH_LINES = {
  goblin: ['Tell my mum...', 'Worth it.', 'I had TWO days till retirement!'],
  beast: ['*sad yip*', '*dramatic whimper*', '*blorp*'],
  undead: ["I'm filing a complaint.", 'This will be audited.', 'Not again...'],
  alien: ['Abort mission!', 'Tell the mothership...', 'Beep... boop...'],
  demon: ['My deposit...'],
};

export const MISS_WORDS = ['MISS', 'WHIFF', 'NOPE', 'SWING AND A MISS', 'AIRBALL'];
export const CRIT_WORDS = ['CRIT!', 'YEOWCH!', 'BONK!', 'OOF!', 'DEVASTATING!'];

// Battle modifiers: random silly rule for the fight. `needs` = race that must be alive.
export const MODIFIERS = {
  greased: { name: 'GREASED FLOOR', desc: 'Someone spilled butter. Everybody misses more.' },
  hype: { name: 'HYPE MAN', desc: 'A bard is hyping the fight. Crits are 3x as likely.' },
  mom: { name: "HAAKON'S MOM IS WATCHING", desc: "Haakon hits 40% harder. Don't embarrass him.", needs: 'haakon' },
  cheese: { name: 'CURSED CHEESE', desc: 'Everyone ate it. Everyone heals 4 HP every round.' },
  naptime: { name: 'NAP TIME', desc: 'The enemies are sleepy. Sometimes they doze off.' },
};
