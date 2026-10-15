import { T, C, SPRITE_HEIGHT } from '../config.js';
import { text, panel, button, bubble, floater, fadeTo, fadeIn, dimmer } from '../ui/ui.js';
import { background, actor, spawnParty } from '../ui/stage.js';
import { run, rng, addGold } from '../systems/state.js';
import { SCENE_SLOTS } from './Event.js';
import { sfx } from '../audio/sfx.js';
import { fitHeight } from '../art/assets.js';

// Goblin Casino: quick 10-second gambling overlay. Griffin doubles long-shot
// odds (10% or less). Mike gets one spin on the house.
const GAMES = [
  { id: 'flip', name: 'COIN FLIP', p: 0.5, pay: 2 },
  { id: 'long', name: 'LONG SHOT', p: 0.10, pay: 8 },
  { id: 'moon', name: 'MOONSHOT', p: 0.04, pay: 22 },
];
const BETS = [10, 25, 50];
const MAX_PLAYS = 3;
const REEL_ICONS = ['icon_gold_coin', 'node_casino', 'icon_mystery_meat', 'node_elite', 'icon_potion_health'];

export class CasinoScene extends Phaser.Scene {
  constructor() { super('Casino'); }

  create() {
    fadeIn(this);
    background(this, 'bg_goblin_casino');
    this.party = spawnParty(this, { slots: SCENE_SLOTS });
    this.griffin = run.party.some((h) => h.race === 'griffin' && h.hp > 0);
    this.mike = run.party.some((h) => h.race === 'mike' && h.hp > 0);
    this.freeSpin = this.mike;
    this.plays = 0;
    this.bet = 10;

    actor(this, 'npc_goblin_dealer', 440, 214, SPRITE_HEIGHT.npc, { flip: true });
    const slots = this.add.image(526, 212, 'prop_slots').setOrigin(0.5, 1).setDepth(212);
    fitHeight(slots, 80);
    this.time.delayedCall(600, () => bubble(this, 440, 132,
      this.mike ? 'Cousin Mike! First spin is on the house.' : 'Place your bets, tall-folk.', 2400));
    if (this.griffin) this.time.delayedCall(2200, () => bubble(this, SCENE_SLOTS[run.party.findIndex((h) => h.race === 'griffin')].x, 120, 'Long shots are my love language.', 2000));

    this.ui = this.add.container(0, 0).setDepth(500);
    this.goldLabel = text(this, 632, 8, '', { size: 10, color: T.gold, ox: 1, depth: 600 });
    this.draw();
  }

  odds(g) { return this.griffin && g.p <= 0.10 ? g.p * 2 : g.p; }

  draw(msg) {
    this.ui.removeAll(true);
    this.goldLabel.setText(`${run.gold}g`);
    this.ui.add(panel(this, 8, 244, 624, 110));
    const left = MAX_PLAYS - this.plays;
    this.ui.add(text(this, 22, 252, msg || `GOBLIN CASINO  -  ${left} play${left === 1 ? '' : 's'} left${this.freeSpin ? '  -  next one FREE (Mike)' : ''}`, { size: 8, color: T.gold, wrap: 596 }));
    this.ui.add(text(this, 22, 276, 'BET', { size: 8, color: T.grey }));
    BETS.forEach((b, i) => {
      const btn = button(this, 22 + i * 54, 290, 50, 32, b + 'g', () => { this.bet = b; this.draw(msg); }, { size: 8, selected: this.bet === b });
      this.ui.add(btn);
    });
    GAMES.forEach((g, i) => {
      const p = this.odds(g);
      const boosted = p !== g.p;
      const can = left > 0 && (this.freeSpin || run.gold >= this.bet);
      const btn = button(this, 196 + i * 110, 272, 104, 72, g.name, () => this.spin(g), {
        size: 8, sub: `${Math.round(p * 100)}%  x${g.pay}`, fill: boosted ? 0x4a2a6a : C.panelHi,
      });
      btn.setEnabled(can);
      this.ui.add(btn);
    });
    this.ui.add(button(this, 530, 272, 92, 72, 'LEAVE', () => fadeTo(this, 'Map'), { size: 10, fill: 0x6a2a3a }));
    if (this.griffin) this.ui.add(text(this, 22, 332, 'Griffin doubles odds of 10% or less', { size: 8, color: T.purple }));
  }

  async spin(g) {
    const free = this.freeSpin;
    this.freeSpin = false;
    this.plays++;
    if (!free) run.gold -= this.bet;
    run.stats.goldGambled += this.bet;
    this.ui.removeAll(true);
    const p = this.odds(g);
    const win = rng.chance(p);

    // Reels overlay
    const dim = dimmer(this, 0.5, 700);
    const box = panel(this, 200, 90, 240, 120, { fill: 0x5a1a28 }).setDepth(701);
    const title = text(this, 320, 104, `${g.name}  ${Math.round(p * 100)}%`, { size: 8, ox: 0.5, color: T.gold, depth: 702 });
    const reels = [0, 1, 2].map((i) => {
      const bg = this.add.rectangle(250 + i * 70, 158, 54, 54, 0xf4f0e0).setDepth(702);
      const img = this.add.image(250 + i * 70, 158, rng.pick(REEL_ICONS)).setDepth(703);
      fitHeight(img, 32);
      return { bg, img };
    });
    sfx('dice');
    const final = win ? Array(3).fill('icon_gold_coin') : (() => {
      const a = [rng.pick(REEL_ICONS), rng.pick(REEL_ICONS), rng.pick(REEL_ICONS)];
      if (a[0] === a[1] && a[1] === a[2]) a[2] = REEL_ICONS[(REEL_ICONS.indexOf(a[2]) + 1) % REEL_ICONS.length];
      return a;
    })();
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 8 + i * 5; k++) {
        reels.forEach((r, j) => { if (j >= i) { r.img.setTexture(rng.pick(REEL_ICONS)); fitHeight(r.img, 32); } });
        sfx('step');
        await new Promise((res) => this.time.delayedCall(60, res));
      }
      reels[i].img.setTexture(final[i]); fitHeight(reels[i].img, 32);
      this.tweens.add({ targets: reels[i].img, scale: reels[i].img.scale * 1.25, duration: 80, yoyo: true });
    }
    const payout = win ? this.bet * g.pay : 0;
    let msg;
    if (win) {
      addGold(payout);
      sfx(g.p <= 0.1 ? 'jackpot' : 'coin');
      floater(this, 320, 220, `+${payout}g`, T.gold, 16, true);
      if (g.p <= 0.1) this.cameras.main.shake(300, 0.006);
      msg = `WIN! +${payout} gold.${free ? ' (On the house!)' : ''}`;
      if (this.griffin && g.p <= 0.1) bubble(this, 320, 70, 'Never tell me the odds.', 1600);
    } else {
      sfx('miss');
      msg = free ? 'Lost the free spin. The house always wins.' : `Lost ${this.bet} gold. The dealer smiles with all 9 teeth.`;
    }
    await new Promise((res) => this.time.delayedCall(900, res));
    [dim, box, title].forEach((o) => o.destroy());
    reels.forEach((r) => { r.bg.destroy(); r.img.destroy(); });
    this.draw(msg);
  }
}
