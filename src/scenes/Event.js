import { T, SPRITE_HEIGHT } from '../config.js';
import { text, panel, button, bubble, floater, fadeTo, fadeIn } from '../ui/ui.js';
import { background, actor, spawnParty } from '../ui/stage.js';
import { run, rng, hasRace, addGold } from '../systems/state.js';
import { sfx } from '../audio/sfx.js';
import { fitHeight } from '../art/assets.js';

// Non-combat encounters. Each is a little scene: the party is physically
// there, something is in the room with them, and the choice plays out.

export const SCENE_SLOTS = [
  { x: 206, y: 210 },
  { x: 156, y: 194 },
  { x: 116, y: 218 },
  { x: 66, y: 200 },
];

const alive = (id) => run.party.find((h) => h.race === id && h.hp > 0);
const livingParty = () => run.party.filter((h) => h.hp > 0);
const hurt = (h, n) => { h.hp = Math.max(1, h.hp - n); };
const heal = (h, n) => { if (h.hp > 0) h.hp = Math.min(h.maxHp, h.hp + Math.round(n)); };

export function pickEvent() {
  run.seenEvents = run.seenEvents || [];
  const pool = [];
  const add = (id, w) => { if (!run.seenEvents.includes(id)) for (let i = 0; i < w; i++) pool.push(id); };
  add('boulder', alive('haakon') ? 3 : 1);
  if (alive('griffin')) add('dani_date', 3);
  add('devil', 2);
  add('goblin_toll', alive('mike') ? 3 : 1);
  const id = pool.length ? rng.pick(pool) : 'treasure';
  run.seenEvents.push(id);
  return id;
}

// ---------------------------------------------------------------- events
// Each event: bg, setup(scene) to place props/NPCs, title, body(), choices().
// A choice returns { text, battle? } after mutating run state.
const EVENTS = {
  treasure: {
    bg: 'bg_treasure_vault',
    setup: (s) => s.prop('prop_chest', 450, 214, 40),
    title: 'TREASURE',
    body: () => 'A chest. It has not bitten anyone. Yet.',
    choices: () => [
      {
        label: 'OPEN IT', run: () => {
          let g = rng.int(30, 60);
          let msg = `Inside: ${g} gold`;
          if (run.party.some((h) => h.cls === 'rogue' && h.hp > 0)) { g += 20; msg += ' (+20 from the Rogue checking for false bottoms)'; }
          addGold(g);
          if (rng.chance(0.45)) { run.potions++; msg += ' and a Health Potion'; }
          sfx('coin');
          return { text: msg + '.', gold: true };
        },
      },
      { label: 'LEAVE IT', run: () => ({ text: 'You leave a perfectly good chest alone. Growth.' }) },
    ],
  },

  rest: {
    bg: 'bg_rest_campfire',
    setup: (s) => s.prop('prop_campfire', 440, 214, 42, true),
    title: 'CAMPFIRE',
    body: () => 'A quiet campfire. Nobody is trying to eat you. Weird.',
    choices: () => [
      {
        label: 'REST', sub: 'heal 40%, revive downed', run: () => {
          run.party.forEach((h) => { if (h.hp <= 0) h.hp = Math.ceil(h.maxHp * 0.4); else heal(h, h.maxHp * 0.4); });
          sfx('heal');
          return { text: 'Everyone naps. Haakon snores like a war drum. Party healed.' };
        },
      },
      {
        label: 'TRAIN', sub: '+1 ATK everyone', run: () => {
          run.party.forEach((h) => { h.atk += 1; heal(h, h.maxHp * 0.1); });
          return { text: 'Push-ups by firelight. Everyone gains +1 ATK.' };
        },
      },
    ],
  },

  boulder: {
    bg: 'bg_boulder_pass',
    setup: (s) => s.prop('prop_boulder', 470, 220, 74),
    title: 'THE BOULDER OF PRIDE',
    body: () => alive('haakon')
      ? 'A huge boulder blocks a stash of gold. Haakon is already cracking his knuckles.'
      : 'A huge boulder blocks a stash of gold. If only someone strong were here.',
    choices: () => {
      const h = alive('haakon');
      if (h) {
        const lift = (odds, prefix) => {
          if (rng.chance(odds)) {
            addGold(50); h.atk += 2; sfx('coin');
            return { text: `${prefix}Haakon lifts it alone. +50 gold, and Haakon gains +2 ATK. He will mention this later.` };
          }
          hurt(h, 12); sfx('hit');
          return { text: `${prefix}The boulder wins. Haakon takes 12 damage and insists that was on purpose.` };
        };
        return [
          { label: 'HAAKON LIFTS IT', sub: '75% success', run: () => lift(0.75, '') },
          { label: 'WALK AWAY', sub: 'Haakon may disagree', run: () => lift(0.6, '"We are NOT walking away." ') },
        ];
      }
      return [
        {
          label: 'PUSH TOGETHER', sub: '55% success', run: () => {
            if (rng.chance(0.55)) { addGold(35); sfx('coin'); return { text: 'Teamwork! +35 gold.' }; }
            livingParty().forEach((p) => hurt(p, 4));
            return { text: 'Everyone pulls a muscle. -4 HP each.' };
          },
        },
        { label: 'WALK AWAY', run: () => ({ text: 'The boulder remains undefeated.' }) },
      ];
    },
  },

  dani_date: {
    bg: 'bg_rest_campfire',
    setup: (s) => {
      s.prop('prop_campfire', 470, 214, 36, true);
      const d = s.party.dani;
      if (d) s.time.delayedCall(900, () => s.tweens.add({ targets: d, x: 300, y: 196, duration: 500, ease: 'Quad.Out' }));
    },
    title: 'DANI NEEDS TO TALK',
    body: () => 'Dani crosses her arms. "You said this dungeon would be romantic, Griffin."',
    choices: () => [
      {
        label: 'DATE NIGHT', sub: '-30 gold', enabled: () => run.gold >= 30, run: () => {
          run.gold -= 30; run.flags.daniDate = true; sfx('heal');
          return { text: 'Candlelit dinner in a crypt. Dani is happy. She will heal everyone at the start of the next fight.' };
        },
      },
      {
        label: 'GIFT A POTION', sub: '-1 potion', enabled: () => run.potions > 0, run: () => {
          run.potions--; run.flags.daniDate = true;
          return { text: 'She drinks it immediately. Romantic? Close enough. She will help next fight.' };
        },
      },
      {
        label: 'NOT NOW, BABE', run: () => {
          run.flags.daniAngry = true; addGold(15);
          return { text: 'Griffin keeps looting (+15 gold). Dani will remember this. Next fight, she will make him pay.' };
        },
      },
    ],
  },

  devil: {
    bg: 'bg_devil_shrine',
    setup: (s) => s.npc('npc_devil_dealer', 460, 214, 'Standard terms. Totally fair.'),
    title: "THE DEVIL'S OFFER",
    body: () => 'A devil in a nice suit slides a contract across the floor. 120 gold for "a little life force."',
    choices: () => [
      {
        label: 'SIGN IT', sub: '+120g, lose max HP', run: () => {
          const signer = livingParty().sort((a, b) => b.maxHp - a.maxHp)[0];
          const loss = Math.round(signer.maxHp * 0.25);
          signer.maxHp -= loss; signer.hp = Math.min(signer.hp, signer.maxHp);
          addGold(120); sfx('coin');
          return { text: `${signer.name} signs it without reading. +120 gold. ${signer.name} loses ${loss} max HP forever.` };
        },
      },
      {
        label: 'HAGGLE', sub: '50/50', run: () => {
          if (rng.chance(0.5)) { addGold(60); sfx('coin'); return { text: 'The devil respects the hustle. 60 gold, no strings.' }; }
          livingParty().forEach((p) => hurt(p, 6)); sfx('hit');
          return { text: 'He charges a consultation fee. In blood. -6 HP each.' };
        },
      },
      { label: 'LEAVE', run: () => ({ text: '"My door is always open," he says. It is not a door. It is a pit.' }) },
    ],
  },

  goblin_toll: {
    bg: 'bg_goblin_market',
    setup: (s) => {
      s.npc('goblin_grunt', 440, 214, alive('mike') ? '...Cousin Mike?' : 'TOLL. Pay up.');
      s.npc('goblin_archer', 500, 200);
    },
    title: 'GOBLIN TOLL',
    body: () => alive('mike')
      ? 'Goblins block the way and demand a toll. Then they squint at Mike. And his nose.'
      : 'Goblins block the way and demand a 25 gold toll.',
    choices: () => {
      const c = [];
      if (alive('mike')) {
        c.push({
          label: 'MIKE SPEAKS GOBLIN', run: () => {
            addGold(20); sfx('coin');
            return { text: 'Mike grunts something. The goblins weep with pride and hand over a "family refund." +20 gold.' };
          },
        });
      }
      c.push({
        label: 'PAY 25 GOLD', enabled: () => run.gold >= 25,
        run: () => { run.gold -= 25; return { text: 'You pay. The goblins bite every coin to check it.' }; },
      });
      c.push({
        label: 'FIGHT', run: () => ({
          text: 'Toll THIS.',
          battle: { type: 'fight', enemies: ['goblin_grunt', 'goblin_archer', 'goblin_grunt'], bg: 'bg_goblin_market', intro: 'The goblins take the toll personally.', depth: 3 },
        }),
      });
      return c;
    },
  },
};

export class EventScene extends Phaser.Scene {
  constructor() { super('Event'); }

  create({ id }) {
    fadeIn(this);
    const ev = EVENTS[id] || EVENTS.treasure;
    this.ev = ev;
    background(this, ev.bg);
    this.party = spawnParty(this, { slots: SCENE_SLOTS });
    ev.setup(this);

    this.dialog = this.add.container(0, 0).setDepth(500);
    this.time.delayedCall(700, () => this.showChoices());
    this.goldLabel = text(this, 632, 8, '', { size: 8, color: T.gold, ox: 1, depth: 501 });
    this.refreshGold();
  }

  refreshGold() { this.goldLabel.setText(`${run.gold}g  potions ${run.potions}`); }

  prop(key, x, y, h, glow) {
    const img = this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
    fitHeight(img, h);
    this.add.ellipse(x, y, h * 0.9, 8, 0x140c1c, 0.45).setDepth(y - 1);
    if (glow) this.tweens.add({ targets: img, scaleY: img.scaleY * 1.04, duration: 180, yoyo: true, repeat: -1, ease: 'Stepped' });
    return img;
  }

  npc(base, x, y, line) {
    const a = actor(this, base, x, y, SPRITE_HEIGHT.npc, { flip: true });
    const tx = a.x; a.x += 200;
    this.tweens.add({ targets: a, x: tx, duration: 700, ease: 'Quad.Out' });
    if (line) this.time.delayedCall(800, () => bubble(this, tx, y - SPRITE_HEIGHT.npc - 4, line, 1800));
    return a;
  }

  showChoices() {
    this.dialog.removeAll(true);
    const ev = this.ev;
    this.dialog.add(panel(this, 8, 244, 624, 110));
    this.dialog.add(text(this, 22, 251, ev.title, { size: 12, color: T.gold }));
    this.dialog.add(text(this, 22, 268, ev.body(), { size: 8, wrap: 596, lineSpacing: 4 }));
    const choices = ev.choices();
    const w = Math.floor((600 - (choices.length - 1) * 8) / choices.length);
    choices.forEach((c, i) => {
      const b = button(this, 20 + i * (w + 8), 306, w, 40, c.label, () => this.choose(c), { size: 8, sub: c.sub });
      if (c.enabled && !c.enabled()) b.setEnabled(false);
      this.dialog.add(b);
    });
  }

  choose(c) {
    const res = c.run();
    this.refreshGold();
    this.dialog.removeAll(true);
    this.dialog.add(panel(this, 8, 244, 624, 110));
    this.dialog.add(text(this, 22, 256, res.text, { size: 8, wrap: 596, lineSpacing: 6 }));
    if (res.gold) floater(this, 320, 200, 'KA-CHING', T.gold, 12);
    this.dialog.add(button(this, 440, 304, 180, 42, res.battle ? 'FIGHT!' : 'CONTINUE', () => {
      if (res.battle) fadeTo(this, 'Battle', res.battle);
      else fadeTo(this, 'Map');
    }, { size: 10, fill: res.battle ? 0x6a2a3a : 0x2a5a3a }));
  }
}
