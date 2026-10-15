// WHACK-A-GOBLIN: 20 seconds, goblins pop out of holes, tap to bonk.
// Gold goblins pay big, bomb goblins cost you. If Mike is in the party some
// goblins are his cousins (wearing his rusty crown) and bonking them costs gold.
// Mode 'crawl' pays out gold to the run; mode 'arcade' just keeps a high score.
import { T, C, SPRITE_HEIGHT } from '../config.js';
import { text, panel, button, bubble, floater, fadeTo, fadeIn } from '../ui/ui.js';
import { background, spawnParty } from '../ui/stage.js';
import { run, rng, addGold } from '../systems/state.js';
import { SCENE_SLOTS } from '../scenes/Event.js';
import { sfx } from '../audio/sfx.js';
import { fitHeight } from '../art/assets.js';

const DURATION = 20;
const HOLES = [
  { x: 330, y: 226 }, { x: 440, y: 226 }, { x: 550, y: 226 },
  { x: 330, y: 300 }, { x: 440, y: 300 }, { x: 550, y: 300 },
];

export class WhackScene extends Phaser.Scene {
  constructor() { super('Whack'); }

  create(data = {}) {
    fadeIn(this);
    this.mode = data.mode || 'crawl';
    this.returnTo = data.returnTo || (this.mode === 'crawl' ? 'Map' : 'Title');
    this.crawl = this.mode === 'crawl' && run;
    background(this, 'bg_goblin_market');
    this.mike = this.crawl && run.party.some((h) => h.race === 'mike' && h.hp > 0);
    if (this.crawl) {
      this.party = spawnParty(this, { slots: SCENE_SLOTS.map((s) => ({ x: s.x - 22, y: s.y + 10 })) });
    }
    this.score = 0;
    this.left = DURATION;
    this.busy = new Set();
    this.active = false;

    // holes
    this.holes = HOLES.map((h, i) => {
      const back = this.add.ellipse(h.x, h.y, 70, 20, 0x140c1c).setDepth(h.y - 40);
      const lip = this.add.ellipse(h.x, h.y + 4, 74, 14, 0x3a2a20).setDepth(h.y + 2);
      const inner = this.add.ellipse(h.x, h.y + 1, 64, 10, 0x0a0610).setDepth(h.y + 3);
      // goblins get masked to the hole so they rise out of it
      const maskShape = this.make.graphics({ add: false });
      maskShape.fillStyle(0xffffff).fillRect(h.x - 40, h.y - 90, 80, 92);
      return { ...h, i, back, lip, inner, mask: maskShape.createGeometryMask() };
    });

    this.hud = text(this, 320, 8, '', { size: 10, ox: 0.5, color: T.gold, depth: 600 });
    this.drawHud();
    this.ui = this.add.container(0, 0).setDepth(700);
    this.ui.add(panel(this, 150, 90, 340, 110));
    this.ui.add(text(this, 320, 102, 'WHACK-A-GOBLIN', { size: 16, ox: 0.5, color: T.gold }));
    this.ui.add(text(this, 320, 128, `Tap goblins: +3g.  Gold ones: +10g.\nBomb goblins: -5g.${this.mike ? "\nCrowned ones are Mike's cousins: -5g!" : ''}`, { size: 8, ox: 0.5, align: 'center', lineSpacing: 5 }));
    this.ui.add(button(this, 250, 162 + (this.mike ? 10 : 0), 140, 30, 'START', () => this.start(), { size: 10, fill: 0x2a5a3a }));
  }

  drawHud() {
    this.hud.setText(`SCORE ${this.score}g     TIME ${Math.max(0, Math.ceil(this.left))}`);
  }

  start() {
    this.ui.removeAll(true);
    this.active = true;
    sfx('win');
    this.clock = this.time.addEvent({ delay: 100, loop: true, callback: () => {
      this.left -= 0.1;
      this.drawHud();
      if (this.left <= 0) this.end();
    } });
    this.spawnLoop();
  }

  spawnLoop() {
    if (!this.active) return;
    // speeds up as time runs out
    const speed = 0.55 + 0.45 * (this.left / DURATION);
    this.spawn();
    if (rng.chance(0.25)) this.time.delayedCall(140, () => this.spawn());
    this.time.delayedCall(rng.int(420, 700) * speed, () => this.spawnLoop());
  }

  spawn() {
    const free = this.holes.filter((h) => !this.busy.has(h.i));
    if (!free.length) return;
    const h = rng.pick(free);
    this.busy.add(h.i);
    const r = rng.next();
    let kind = 'normal';
    if (r < 0.08) kind = 'gold';
    else if (r < 0.2) kind = 'bomb';
    else if (this.mike && r < 0.32) kind = 'cousin';

    const g = this.add.image(h.x, h.y + 60, 'goblin_grunt_idle').setOrigin(0.5, 1).setDepth(h.y);
    fitHeight(g, SPRITE_HEIGHT.enemy * 0.9);
    g.setFlipX(rng.chance(0.5));
    g.setMask(h.mask);
    if (kind === 'gold') g.setTint(0xffd84a);
    const extras = [];
    if (kind === 'bomb') {
      const bomb = this.add.circle(h.x + 16, h.y + 60 - 30, 7, 0x2a2a34).setDepth(h.y + 1).setMask(h.mask);
      const fuse = this.add.rectangle(h.x + 18, h.y + 60 - 39, 2, 5, 0xf7a038).setDepth(h.y + 1).setMask(h.mask);
      extras.push(bomb, fuse);
    }
    if (kind === 'cousin') {
      const crown = this.add.rectangle(h.x, h.y + 60 - 56, 20, 6, 0xc99a3a).setDepth(h.y + 1).setMask(h.mask);
      extras.push(crown);
    }
    const all = [g, ...extras];
    const up = 60;
    const stay = rng.int(650, 1050) * (0.6 + 0.4 * (this.left / DURATION));
    let hit = false;
    this.tweens.add({ targets: all, y: `-=${up}`, duration: 130, ease: 'Quad.Out' });
    const zone = this.add.zone(h.x, h.y - 30, 70, 72).setInteractive({ useHandCursor: true }).setDepth(650);
    const cleanup = () => {
      zone.destroy();
      this.tweens.add({ targets: all, y: `+=${up}`, duration: 120, onComplete: () => { all.forEach((o) => o.destroy()); this.busy.delete(h.i); } });
    };
    const timer = this.time.delayedCall(stay, () => { if (!hit) cleanup(); });
    zone.on('pointerdown', () => {
      if (hit || !this.active) return;
      hit = true;
      timer.remove();
      this.bonk(h, g, kind);
      cleanup();
    });
  }

  bonk(h, g, kind) {
    const mallet = this.add.image(h.x + 26, h.y - 70, 'prop_mallet').setDepth(800).setAngle(-40);
    fitHeight(mallet, 34);
    this.tweens.add({ targets: mallet, angle: 20, duration: 70, yoyo: true, onComplete: () => mallet.destroy() });
    g.setTintFill(0xffffff);
    const pts = { normal: 3, gold: 10, bomb: -5, cousin: -5 }[kind];
    this.score = Math.max(0, this.score + pts);
    this.drawHud();
    if (kind === 'bomb') {
      sfx('crit'); this.cameras.main.shake(180, 0.008);
      floater(this, h.x, h.y - 70, 'BOOM -5g', T.red, 10);
    } else if (kind === 'cousin') {
      sfx('miss');
      floater(this, h.x, h.y - 70, 'COUSIN! -5g', T.red, 10);
      const i = run.party.findIndex((p) => p.race === 'mike');
      if (rng.chance(0.6)) bubble(this, this.party.heroes[i].x, 140, rng.pick(["THAT'S MY COUSIN!", 'Not Uncle Grib!', "I'm telling grandma."]), 1200);
    } else {
      sfx(kind === 'gold' ? 'jackpot' : 'hit');
      floater(this, h.x, h.y - 70, `+${pts}g`, kind === 'gold' ? T.gold : T.cream, kind === 'gold' ? 12 : 10);
    }
  }

  end() {
    if (!this.active) return;
    this.active = false;
    this.clock.remove();
    sfx('win');
    let best = 0;
    try {
      best = Number(localStorage.getItem('dd_whack_best') || 0);
      if (this.score > best) { localStorage.setItem('dd_whack_best', String(this.score)); }
    } catch (e) { /* storage blocked */ }
    // In a run the payout is capped so spam-tapping can't break the economy.
    const payout = Math.min(this.score, 45);
    if (this.crawl) addGold(payout);
    this.time.delayedCall(500, () => {
      this.ui.add(panel(this, 150, 90, 340, 120));
      this.ui.add(text(this, 320, 104, "TIME'S UP!", { size: 16, ox: 0.5, color: T.gold }));
      this.ui.add(text(this, 320, 132, this.crawl && payout < this.score ? `You bonked ${this.score}g of goblins. The bank pays ${payout}g.` : `You bonked ${this.score} gold worth of goblins.`, { size: 8, ox: 0.5 }));
      this.ui.add(text(this, 320, 148, this.score > best ? 'NEW BEST!' : `Best: ${Math.max(best, this.score)}g`, { size: 8, ox: 0.5, color: this.score > best ? T.green : T.grey }));
      if (this.mode === 'arcade') {
        this.ui.add(button(this, 160, 168, 150, 32, 'PLAY AGAIN', () => this.scene.restart({ mode: 'arcade', returnTo: this.returnTo }), { size: 8, fill: 0x2a5a3a }));
        this.ui.add(button(this, 330, 168, 150, 32, 'BACK', () => fadeTo(this, this.returnTo), { size: 8 }));
      } else {
        this.ui.add(button(this, 230, 168, 180, 32, 'CONTINUE', () => fadeTo(this, this.returnTo), { size: 10, fill: 0x2a5a3a }));
      }
    });
  }
}
