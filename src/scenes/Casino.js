import { T, C, SPRITE_HEIGHT } from '../config.js';
import { text, panel, button, bubble, floater, fadeTo, fadeIn, dimmer } from '../ui/ui.js';
import { hubScene } from '../systems/arcade.js';
import { background, actor, spawnParty } from '../ui/stage.js';
import { run, rng } from '../systems/state.js';
import { SCENE_SLOTS } from './Event.js';
import { sfx } from '../audio/sfx.js';
import { fitHeight } from '../art/assets.js';

// Goblin Casino: blow your hard-earned (or stolen) gold. Everyone gambles with
// their own purse. Griffin doubles long-shot odds when HE plays. Mike gets one
// free spin per visit. The Crown Counter sells crowns, which win the game.
const GAMES = [
  { id: 'flip', name: 'COIN FLIP', p: 0.5, pay: 2 },
  { id: 'long', name: 'LONG SHOT', p: 0.10, pay: 8 },
  { id: 'moon', name: 'MOONSHOT', p: 0.04, pay: 22 },
];
const BETS = [10, 25, 50, 'ALL'];
const REEL_ICONS = ['icon_gold_coin', 'node_casino', 'icon_mystery_meat', 'node_elite', 'icon_potion_health', 'icon_crown'];
const DEALER_WIN = ['The house thanks you.', 'Ooh. Unlucky, tall-folk.', 'Again? Again!', 'I love this guy.'];
const DEALER_LOSE = ['WHAT. Security!', 'Lucky. LUCKY.', 'Nobody wins that. NOBODY.'];

export class CasinoScene extends Phaser.Scene {
  constructor() { super('Casino'); }

  create(data = {}) {
    fadeIn(this);
    this.returnTo = data.returnTo || hubScene();
    background(this, 'bg_goblin_casino');
    this.party = spawnParty(this, { slots: SCENE_SLOTS });
    this.dealer = actor(this, 'npc_goblin_dealer', 440, 214, SPRITE_HEIGHT.npc, { flip: true });
    const slots = this.add.image(526, 212, 'prop_slots').setOrigin(0.5, 1).setDepth(212);
    fitHeight(slots, 80);
    this.freeSpin = run.party.some((h) => h.race === 'mike');
    this.player = run.roomLeader ?? 0;
    this.bet = 10;
    this.time.delayedCall(600, () => bubble(this, 440, 132, 'Place your bets. Crowns at the counter. No refunds.', 2400));
    this.ui = this.add.container(0, 0).setDepth(500);
    this.draw();
  }

  odds(g) {
    const h = run.party[this.player];
    return h.race === 'griffin' && g.p <= 0.10 ? g.p * 2 : g.p;
  }

  betAmount() {
    const h = run.party[this.player];
    return this.bet === 'ALL' ? h.gold : Math.min(this.bet, h.gold);
  }

  draw(msg) {
    this.ui.removeAll(true);
    const h = run.party[this.player];
    this.ui.add(panel(this, 8, 234, 624, 120));
    const freeNote = h.race === 'mike' && this.freeSpin ? '  -  Mike: next spin is FREE' : '';
    const grifNote = h.race === 'griffin' ? '  -  Griffin: long shots doubled' : '';
    this.ui.add(text(this, 14, 218, msg || `WHO'S GAMBLING?${freeNote}${grifNote}`, { size: 8, color: T.gold, wrap: 610 }));
    run.party.forEach((p, i) => {
      this.ui.add(button(this, 18 + i * 128, 242, 122, 26, `${p.name.toUpperCase()} ${p.gold}g`, () => { this.player = i; this.draw(); }, { size: 8, selected: i === this.player }));
    });
    // bet size
    BETS.forEach((b, i) => {
      const label = b === 'ALL' ? 'ALL IN' : b + 'g';
      this.ui.add(button(this, 18 + i * 62, 276, 58, 26, label, () => { this.bet = b; this.draw(msg); }, { size: 8, selected: this.bet === b, fill: b === 'ALL' ? 0x6a2a3a : C.panelHi }));
    });
    const amt = this.betAmount();
    this.ui.add(text(this, 18, 312, `Bet: ${amt}g`, { size: 8, color: T.cream }));
    this.ui.add(text(this, 18, 328, 'Pays: bet x payout', { size: 8, color: T.grey }));
    // games
    GAMES.forEach((g, i) => {
      const p = this.odds(g);
      const boosted = p !== g.p;
      const can = h.gold > 0 && (amt > 0 || (h.race === 'mike' && this.freeSpin));
      const btn = button(this, 270 + i * 90, 276, 86, 70, g.name, () => this.spin(g), {
        size: 8, sub: `${Math.round(p * 100)}% x${g.pay}`, fill: boosted ? 0x4a2a6a : 0x2a3a6a, subColor: boosted ? T.gold : T.grey,
      });
      btn.setEnabled(can || (h.race === 'mike' && this.freeSpin));
      this.ui.add(btn);
    });
    // crown counter
    const crown = button(this, 542, 276, 82, 70, 'BUY CROWN', () => this.buyCrown(), { size: 8, sub: `${run.crownPrice}g`, fill: 0x6a5a1a, subColor: T.gold });
    crown.setEnabled(h.gold >= run.crownPrice);
    this.ui.add(crown);
    this.ui.add(button(this, 542, 242, 82, 26, 'LEAVE', () => fadeTo(this, this.returnTo), { size: 8, fill: 0x6a2a3a }));
  }

  buyCrown() {
    const h = run.party[this.player];
    h.gold -= run.crownPrice;
    h.crowns++;
    const paid = run.crownPrice;
    run.crownPrice += 15;
    sfx('jackpot');
    this.cameras.main.flash(200, 247, 197, 72);
    const i = this.player;
    floater(this, this.party.heroes[i].x, 120, '+1 CROWN', T.gold, 16, true);
    bubble(this, 440, 132, `A crown for ${h.name}! Price just went up. Supply and demand.`, 2000);
    this.draw(`${h.name} buys a CROWN for ${paid}g. Next one costs ${run.crownPrice}g.`);
  }

  async spin(g) {
    const h = run.party[this.player];
    const free = h.race === 'mike' && this.freeSpin;
    const bet = free ? 10 : this.betAmount();
    if (free) this.freeSpin = false; else h.gold -= bet;
    h.st.gambled += bet;
    run.stats.goldGambled += bet;
    this.ui.removeAll(true);
    const p = this.odds(g);
    const win = rng.chance(p);

    const dim = dimmer(this, 0.5, 700);
    const box = panel(this, 200, 80, 240, 130, { fill: 0x5a1a28 }).setDepth(701);
    const title = text(this, 320, 92, `${h.name.toUpperCase()}: ${g.name} ${Math.round(p * 100)}%`, { size: 8, ox: 0.5, color: T.gold, depth: 702 });
    const betT = text(this, 320, 196, `${bet}g on the line${free ? ' (free spin)' : ''}`, { size: 8, ox: 0.5, color: T.cream, depth: 702 });
    const reels = [0, 1, 2].map((i) => {
      const bg = this.add.rectangle(250 + i * 70, 148, 54, 54, 0xf4f0e0).setDepth(702);
      const img = this.add.image(250 + i * 70, 148, rng.pick(REEL_ICONS)).setDepth(703);
      fitHeight(img, 32);
      return { bg, img };
    });
    sfx('dice');
    const final = win ? Array(3).fill(g.p <= 0.1 ? 'icon_crown' : 'icon_gold_coin') : (() => {
      const a = [rng.pick(REEL_ICONS), rng.pick(REEL_ICONS), rng.pick(REEL_ICONS)];
      // near misses are funnier
      if (rng.chance(0.4)) { a[0] = a[1] = 'icon_gold_coin'; a[2] = 'icon_mystery_meat'; }
      if (a[0] === a[1] && a[1] === a[2]) a[2] = REEL_ICONS[(REEL_ICONS.indexOf(a[2]) + 1) % REEL_ICONS.length];
      return a;
    })();
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 6 + i * 4; k++) {
        reels.forEach((r, j) => { if (j >= i) { r.img.setTexture(rng.pick(REEL_ICONS)); fitHeight(r.img, 32); } });
        sfx('step');
        await new Promise((res) => this.time.delayedCall(55, res));
      }
      reels[i].img.setTexture(final[i]); fitHeight(reels[i].img, 32);
      this.tweens.add({ targets: reels[i].img, scale: reels[i].img.scale * 1.25, duration: 80, yoyo: true });
    }
    const payout = win ? bet * g.pay : 0;
    let msg;
    if (win) {
      h.gold += payout;
      h.st.won += payout;
      run.stats.goldEarned += payout;
      sfx(g.p <= 0.1 ? 'jackpot' : 'coin');
      floater(this, 320, 230, `+${payout}g`, T.gold, 16, true);
      if (g.p <= 0.1) this.cameras.main.shake(300, 0.008);
      msg = `${h.name} WINS ${payout}g!`;
      bubble(this, 440, 132, rng.pick(DEALER_LOSE), 1400);
      if (h.race === 'griffin' && g.p <= 0.1) bubble(this, this.party.heroes[this.player].x, 120, 'Never tell me the odds.', 1600);
    } else {
      sfx('miss');
      msg = `${h.name} loses ${bet}g.${bet && bet === h.gold + bet ? ' Totally broke.' : ''}`;
      bubble(this, 440, 132, rng.pick(DEALER_WIN), 1400);
    }
    await new Promise((res) => this.time.delayedCall(900, res));
    [dim, box, title, betT].forEach((o) => o.destroy());
    reels.forEach((r) => { r.bg.destroy(); r.img.destroy(); });
    this.draw(msg);
  }
}
