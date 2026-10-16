// SHOWDOWN: the free-for-all minigame after every room (Mario Party style).
// One phone, four friends. "Corner" games: each friend owns a quarter of the
// screen and smacks it. "Turn" games: pass the phone around.
// Winners get gold (and a dirty card). Mostly luck, a little reflex.
import { T, C, FONT } from '../config.js';
import { RACES } from '../data/races.js';
import { text, panel, button, bubble, floater, fadeTo, fadeIn, drawPanel } from '../ui/ui.js';
import { background } from '../ui/stage.js';
import { run, rng, addGold, steal, giveCard } from '../systems/state.js';
import { CARDS } from '../systems/cards.js';
import { hubScene } from '../systems/arcade.js';
import { sfx } from '../audio/sfx.js';
import { fitHeight, poseKey, faceKey } from '../art/assets.js';

export const SHOWDOWNS = {
  quickdraw: { name: 'QUICK DRAW', rules: 'Wait for BONK!, then smack your corner first.\nTap too early and you are OUT.', kind: 'corners' },
  mash: { name: 'MASH OFF', rules: 'Mash your corner as fast as you can for 5 seconds.', kind: 'corners' },
  highcard: { name: 'HIGH CARD', rules: 'Everyone antes 10 gold. Tap your corner to flip.\nHighest card takes the whole pot.', kind: 'corners' },
  chests: { name: 'PICK A CHEST', rules: 'Pass the phone. Poorest picks first.\nGold, a heist, or a bomb. Pure luck.', kind: 'turns' },
  potato: { name: 'HOT POTATO', rules: 'Pass the phone. HOLD the bomb for +10 gold, or BANK and get out.\nEvery hold makes it more likely to blow up.', kind: 'turns' },
  split: { name: 'SPLIT OR STEAL', rules: 'Two friends, one pot. Each secretly picks SPLIT or STEAL.\nBoth split: share it. One steals: they take it all.\nBoth steal: the goblins keep it. Everyone else bets.', kind: 'turns' },
  derby: { name: 'GOBLIN DERBY', rules: 'Pass the phone and bet on a racer.\nLong shots pay big. The slime is not a goblin. Nobody cares.', kind: 'turns' },
  clock: { name: 'STOP THE CLOCK', rules: 'Tap your corner at EXACTLY 5.00 seconds.\nThe clock disappears after 1.5 seconds. Good luck.', kind: 'corners' },
};
const IDS = Object.keys(SHOWDOWNS);

// Corner layout: seat 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right.
const CORNER = [
  { x: 0, y: 0 }, { x: 320, y: 0 }, { x: 0, y: 180 }, { x: 320, y: 180 },
];
const SEAT_COLORS = [0xe8a25a, 0xc97b4a, 0x7fe0f0, 0xc58cff];

export class ShowdownScene extends Phaser.Scene {
  constructor() { super('Showdown'); }

  create(data = {}) {
    fadeIn(this);
    background(this, 'bg_title').setAlpha(0.45);
    this.add.rectangle(320, 180, 2000, 360, C.ink, 0.55).setDepth(-5);
    this.returnTo = data.returnTo || hubScene();
    let id = data.game;
    if (!id) {
      const pool = IDS.filter((g) => g !== run.lastShowdown);
      id = rng.pick(pool);
    }
    run.lastShowdown = id;
    this.id = id;
    this.def = SHOWDOWNS[id];
    this.results = [];
    this.layer = this.add.container(0, 0).setDepth(100);

    // who's in? SKIP cards bench people for one showdown.
    this.players = [];
    this.skipped = [];
    run.party.forEach((h, i) => {
      if (h.skipNext) { this.skipped.push(i); h.skipNext = false; } else this.players.push(i);
      h.st.showdowns++;
    });
    this.intro();
  }

  // ---------------------------------------------------------------- intro card
  intro() {
    const L = this.layer;
    const t1 = text(this, 320, 70, 'SHOWDOWN!', { size: 24, ox: 0.5, color: T.gold, strokeThickness: 6 });
    t1.setScale(0.2);
    this.tweens.add({ targets: t1, scale: 1, duration: 350, ease: 'Back.Out' });
    sfx('jackpot');
    L.add(t1);
    L.add(panel(this, 90, 110, 460, 130));
    L.add(text(this, 320, 124, this.def.name, { size: 16, ox: 0.5, color: T.red }));
    L.add(text(this, 320, 154, this.def.rules, { size: 8, ox: 0.5, align: 'center', lineSpacing: 6, wrap: 430 }));
    const sk = this.skipped.map((i) => run.party[i].name).join(', ');
    if (sk) L.add(text(this, 320, 200, `${sk} got SKIPPED. Sit there and think about it.`, { size: 8, ox: 0.5, color: T.grey }));
    const dbl = this.players.filter((i) => run.party[i].doubleNext).map((i) => run.party[i].name).join(', ');
    if (dbl) L.add(text(this, 320, 216, `DOUBLE DOWN: ${dbl}`, { size: 8, ox: 0.5, color: T.green }));
    L.add(button(this, 245, 256, 150, 40, 'READY', () => { L.removeAll(true); this.start(); }, { size: 12, fill: 0x2a5a3a }));
    if (this.players.length < 2) {
      L.removeAll(true);
      L.add(text(this, 320, 160, 'Not enough players. The showdown is cancelled.', { size: 10, ox: 0.5 }));
      L.add(button(this, 245, 200, 150, 40, 'CONTINUE', () => fadeTo(this, this.returnTo), { size: 10 }));
    }
  }

  start() {
    this[this.id]();
  }

  // ---------------------------------------------------------------- helpers
  name(i) { return run.party[i].name; }
  color(i) { return RACES[run.party[i].race].color; }

  // Draw the 4 corners; returns per-seat info texts.
  corners(label = '') {
    this.cornerViews = [0, 1, 2, 3].map((i) => {
      const c = CORNER[i];
      const active = this.players.includes(i);
      const g = this.add.graphics();
      g.fillStyle(SEAT_COLORS[i], active ? 0.18 : 0.05);
      g.fillRect(c.x + 3, c.y + 3, 314, 174);
      g.lineStyle(2, SEAT_COLORS[i], active ? 0.8 : 0.2);
      g.strokeRect(c.x + 3, c.y + 3, 314, 174);
      const left = i % 2 === 0;
      const sx = left ? c.x + 40 : c.x + 280;
      const spr = this.add.image(sx, c.y + 160, faceKey(this, run.party[i].race)).setOrigin(0.5, 1);
      fitHeight(spr, 64);
      spr.setFlipX(!left);
      if (!active) spr.setAlpha(0.3);
      const nm = text(this, left ? c.x + 12 : c.x + 308, c.y + 10, this.name(i).toUpperCase(), { size: 10, ox: left ? 0 : 1, color: this.color(i) });
      const big = text(this, c.x + 160, c.y + 90, active ? label : 'SKIPPED', { size: 16, ox: 0.5, oy: 0.5, color: active ? T.white : T.grey, align: 'center' });
      this.layer.add([g, spr, nm, big]);
      return { g, spr, big, c };
    });
    this.input.on('pointerdown', (p) => {
      const seat = (p.x >= 320 ? 1 : 0) + (p.y >= 180 ? 2 : 0);
      if (this.players.includes(seat) && this.onCorner) this.onCorner(seat);
    });
  }

  centerText(str, size = 16, color = T.gold) {
    this.center?.destroy();
    this.center = text(this, 320, 180, str, { size, ox: 0.5, oy: 0.5, color, strokeThickness: 6, depth: 200 });
    this.center.setScale(0.5);
    this.tweens.add({ targets: this.center, scale: 1, duration: 180, ease: 'Back.Out' });
    return this.center;
  }

  wait(ms) { return new Promise((r) => this.time.delayedCall(ms, r)); }

  // Pay out house money (doubled by DOUBLE DOWN).
  pay(i, n) {
    const h = run.party[i];
    const amt = n > 0 && h.doubleNext ? n * 2 : n;
    addGold(i, amt);
    return amt;
  }

  // ---------------------------------------------------------------- QUICK DRAW
  async quickdraw() {
    this.corners('WAIT...');
    const order = [];
    const out = new Set();
    let live = false;
    this.onCorner = (seat) => {
      if (out.has(seat) || order.includes(seat)) return;
      const v = this.cornerViews[seat];
      if (!live) {
        out.add(seat);
        v.big.setText('TOO EARLY!\nOUT').setColor(T.red);
        sfx('miss');
        return;
      }
      order.push(seat);
      v.big.setText(['1ST!', '2ND', '3RD', '4TH'][order.length - 1]).setColor(order.length === 1 ? T.gold : T.cream);
      sfx(order.length === 1 ? 'jackpot' : 'select');
    };
    // fake-outs to bait early taps
    const delay = rng.int(1500, 4200);
    if (rng.chance(0.5)) {
      this.time.delayedCall(delay * 0.5, () => {
        if (!live) { this.centerText('BONG?', 16, T.grey); sfx('step'); this.time.delayedCall(400, () => this.center?.destroy()); }
      });
    }
    await this.wait(delay);
    live = true;
    this.centerText('BONK!', 24, T.red);
    sfx('crit');
    this.cameras.main.shake(150, 0.01);
    await this.wait(1800);
    this.onCorner = null;
    const pays = [25, 10];
    const res = order.map((seat, k) => ({ seat, gold: pays[k] || 0 }));
    this.players.filter((s) => !order.includes(s)).forEach((seat) => res.push({ seat, gold: 0, note: out.has(seat) ? 'jumped the gun' : 'asleep' }));
    this.finish(res);
  }

  // ---------------------------------------------------------------- MASH OFF
  async mash() {
    this.corners('0');
    const counts = {};
    this.players.forEach((s) => { counts[s] = 0; });
    let live = false;
    this.onCorner = (seat) => {
      if (!live) return;
      counts[seat]++;
      const v = this.cornerViews[seat];
      v.big.setText(String(counts[seat]));
      v.spr.y = v.c.y + 160 - (counts[seat] % 2) * 3;
      if (counts[seat] % 5 === 0) sfx('step');
    };
    for (const n of ['3', '2', '1']) { this.centerText(n, 24, T.cream); sfx('select'); await this.wait(600); }
    this.centerText('MASH!', 24, T.red);
    sfx('crit');
    live = true;
    this.time.delayedCall(500, () => this.center?.destroy());
    await this.wait(5000);
    live = false;
    this.onCorner = null;
    this.centerText('STOP!', 24, T.gold);
    sfx('win');
    await this.wait(900);
    const ranked = this.players.slice().sort((a, b) => counts[b] - counts[a]);
    const pays = [25, 12, 5];
    this.finish(ranked.map((seat, k) => ({ seat, gold: counts[seat] ? (pays[k] || 0) : 0, note: `${counts[seat]} taps` })));
  }

  // ---------------------------------------------------------------- HIGH CARD
  async highcard() {
    this.corners('TAP TO\nFLIP');
    const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let pot = 10; // the house sweetens it
    const antes = {};
    this.players.forEach((s) => { const a = Math.min(10, run.party[s].gold); run.party[s].gold -= a; antes[s] = a; pot += a; });
    const potT = text(this, 320, 180, `POT ${pot}g`, { size: 12, ox: 0.5, oy: 0.5, color: T.gold, depth: 200 });
    this.layer.add(potT);
    const cards = {};
    const flipped = new Set();
    await new Promise((done) => {
      this.onCorner = (seat) => {
        if (flipped.has(seat)) return;
        flipped.add(seat);
        let r = rng.int(0, 12);
        // Griffin's long-shot luck: a terrible card gets one secret redraw.
        let redraw = false;
        if (run.party[seat].race === 'griffin' && r <= 2 && rng.chance(0.5)) { r = rng.int(0, 12); redraw = true; }
        cards[seat] = r;
        const v = this.cornerViews[seat];
        v.big.setText(RANKS[r] + (redraw ? '\n(redraw!)' : '')).setColor(r >= 11 ? T.gold : r <= 2 ? T.red : T.white);
        v.big.setFontSize(r >= 11 ? 24 : 16);
        sfx('dice');
        if (flipped.size === this.players.length) done();
      };
    });
    this.onCorner = null;
    await this.wait(900);
    const best = Math.max(...this.players.map((s) => cards[s]));
    const winners = this.players.filter((s) => cards[s] === best);
    const share = Math.floor(pot / winners.length);
    winners.forEach((s) => this.cornerViews[s].big.setColor(T.gold));
    const res = this.players.map((s) => ({ seat: s, gold: winners.includes(s) ? share : 0, raw: true, note: winners.includes(s) ? `${RANKS[cards[s]]} takes the pot` : `${RANKS[cards[s]]}, lost ${antes[s]}g` }))
      .sort((a, b) => cards[b.seat] - cards[a.seat]);
    this.finish(res);
  }

  // ---------------------------------------------------------------- PICK A CHEST
  async chests() {
    const contents = rng.shuffle([
      { label: '+50g', kind: 'gold', n: 50 },
      { label: '+25g', kind: 'gold', n: 25 },
      { label: '+10g', kind: 'gold', n: 10 },
      { label: 'HEIST!', kind: 'heist', n: 20 },
      { label: 'BOMB!', kind: 'bomb', n: -20 },
    ]);
    // poorest picks first (Mario Party catch-up)
    const order = this.players.slice().sort((a, b) => run.party[a].gold - run.party[b].gold);
    const res = {};
    const chestImgs = contents.map((c, k) => {
      const x = 96 + k * 112;
      const img = this.add.image(x, 230, 'prop_chest').setOrigin(0.5, 1);
      fitHeight(img, 64);
      this.layer.add(img);
      return { img, x, open: false };
    });
    const banner = text(this, 320, 60, '', { size: 12, ox: 0.5, color: T.gold, depth: 200 });
    const sub = text(this, 320, 84, '', { size: 8, ox: 0.5, color: T.grey, depth: 200 });
    this.layer.add([banner, sub]);
    for (const seat of order) {
      banner.setText(`${this.name(seat).toUpperCase()}: PICK A CHEST`).setColor(this.color(seat));
      sub.setText(`(${run.party[seat].gold} gold) Pass the phone!`);
      const pick = await new Promise((resolve) => {
        chestImgs.forEach((ch, k) => {
          if (ch.open) return;
          ch.zone = this.add.zone(ch.x, 200, 90, 90).setInteractive({ useHandCursor: true });
          ch.zone.once('pointerup', () => resolve(k));
          this.tweens.add({ targets: ch.img, y: 226, duration: 300, yoyo: true, repeat: -1, ease: 'Stepped' });
        });
      });
      chestImgs.forEach((ch) => { ch.zone?.destroy(); ch.zone = null; this.tweens.killTweensOf(ch.img); ch.img.y = 230; });
      const ch = chestImgs[pick];
      ch.open = true;
      const c = contents[pick];
      this.tweens.add({ targets: ch.img, scaleX: ch.img.scaleX * 1.2, duration: 90, yoyo: true, repeat: 2 });
      sfx('dice');
      await this.wait(500);
      let note = c.label;
      let gold = 0;
      if (c.kind === 'gold') { gold = this.pay(seat, c.n); sfx('coin'); }
      if (c.kind === 'bomb') {
        gold = -Math.min(run.party[seat].gold, 20);
        run.party[seat].gold += gold;
        sfx('crit'); this.cameras.main.shake(250, 0.012);
        note = 'BOMB! -20g';
      }
      if (c.kind === 'heist') {
        const rich = this.players.filter((s) => s !== seat).sort((a, b) => run.party[b].gold - run.party[a].gold)[0];
        const n = steal(rich, seat, c.n);
        gold = n;
        note = `HEIST! stole ${n}g from ${this.name(rich)}`;
        sfx('whip');
      }
      floater(this, ch.x, 150, c.label, c.kind === 'bomb' ? T.red : c.kind === 'heist' ? T.purple : T.gold, 12, true);
      const lab = text(this, ch.x, 240, `${this.name(seat)}\n${c.label}`, { size: 8, ox: 0.5, align: 'center', color: this.color(seat) });
      this.layer.add(lab);
      ch.img.setAlpha(0.5);
      res[seat] = { seat, gold, raw: true, note };
      await this.wait(900);
    }
    const left = chestImgs.findIndex((ch) => !ch.open);
    if (left >= 0) {
      banner.setText(`The last chest had: ${contents[left].label}`).setColor(T.grey);
      sub.setText('');
      await this.wait(1200);
    }
    this.finish(Object.values(res).sort((a, b) => b.gold - a.gold));
  }

  // ---------------------------------------------------------------- HOT POTATO
  async potato() {
    const pending = {};
    const done = new Set();
    this.players.forEach((s) => { pending[s] = 0; });
    let p = 0.1;
    let boomSeat = null;
    const g = this.add.graphics();
    const fuse = this.add.rectangle(342, 112, 6, 6, 0xf7e048);
    this.layer.add([g, fuse]);
    const drawBomb = (scale = 1) => {
      g.clear();
      g.fillStyle(0x2a2a34, 1); g.fillCircle(320, 150, 36 * scale);
      g.fillStyle(0x4a4a58, 1); g.fillCircle(308, 138, 10 * scale);
      g.fillStyle(0x8a5a2a, 1); g.fillRect(330, 112, 6, 14);
    };
    drawBomb();
    this.tweens.add({ targets: fuse, alpha: 0.2, duration: 120, yoyo: true, repeat: -1 });
    const banner = text(this, 320, 40, '', { size: 12, ox: 0.5, color: T.gold, depth: 200 });
    const odds = text(this, 320, 206, '', { size: 8, ox: 0.5, color: T.red, depth: 200 });
    const board = text(this, 320, 226, '', { size: 8, ox: 0.5, align: 'center', lineSpacing: 5, depth: 200 });
    this.layer.add([banner, odds, board]);
    const refresh = () => {
      board.setText(this.players.map((s) => `${this.name(s)}: ${pending[s]}g${done.has(s) ? ' (banked)' : ''}`).join('   '));
      odds.setText(`Boom chance on the next hold: ${Math.round(p * 100)}%`);
    };
    let turn = 0;
    let holds = 0;
    while (boomSeat === null && done.size < this.players.length && holds < 14) {
      const seat = this.players[turn % this.players.length];
      turn++;
      if (done.has(seat)) continue;
      banner.setText(`${this.name(seat).toUpperCase()}'S TURN. PASS THE PHONE.`).setColor(this.color(seat));
      refresh();
      const choice = await new Promise((resolve) => {
        const hb = button(this, 170, 280, 140, 50, 'HOLD', () => resolve('hold'), { size: 12, fill: 0x6a2a3a, sub: '+10g, risky' });
        const bb = button(this, 330, 280, 140, 50, 'BANK', () => resolve('bank'), { size: 12, fill: 0x2a5a3a, sub: `keep ${pending[seat]}g` });
        this.layer.add([hb, bb]);
        this.tmpBtns = [hb, bb];
      });
      this.tmpBtns.forEach((b) => b.destroy());
      if (choice === 'bank') {
        done.add(seat);
        sfx('coin');
        floater(this, 320, 110, `${this.name(seat)} banks ${pending[seat]}g`, T.green, 10);
      } else {
        holds++;
        drawBomb(1.15); this.time.delayedCall(120, () => drawBomb(1 + holds * 0.04));
        sfx('step');
        if (rng.chance(p)) {
          boomSeat = seat;
        } else {
          pending[seat] += 10;
          floater(this, 320, 110, `${this.name(seat)} holds. +10g`, T.gold, 10);
          p = Math.min(0.9, p + 0.1);
        }
      }
      refresh();
      await this.wait(500);
    }
    let res;
    if (boomSeat !== null) {
      g.clear(); fuse.destroy();
      this.cameras.main.shake(400, 0.02);
      this.cameras.main.flash(200, 255, 120, 40);
      sfx('crit');
      this.centerText(`KABOOM! ${this.name(boomSeat).toUpperCase()}`, 16, T.red);
      const fine = Math.min(run.party[boomSeat].gold, 10);
      run.party[boomSeat].gold -= fine;
      pending[boomSeat] = 0;
      await this.wait(1400);
      res = this.players.map((s) => (s === boomSeat
        ? { seat: s, gold: -fine, raw: true, note: 'blew up, lost it all' }
        : { seat: s, gold: this.pay(s, pending[s]), raw: true, note: 'survived' }));
    } else {
      res = this.players.map((s) => ({ seat: s, gold: this.pay(s, pending[s]), raw: true, note: 'banked' }));
    }
    this.finish(res.sort((a, b) => b.gold - a.gold));
  }

  // ---------------------------------------------------------------- STOP THE CLOCK
  async clock() {
    this.corners('TAP AT\n5.00');
    const times = {};
    let t0 = 0;
    let live = false;
    const clockT = text(this, 320, 180, '0.00', { size: 24, ox: 0.5, oy: 0.5, color: T.gold, strokeThickness: 6, depth: 200 });
    this.layer.add(clockT);
    this.onCorner = (seat) => {
      if (!live || times[seat] !== undefined) return;
      times[seat] = (this.time.now - t0) / 1000;
      this.cornerViews[seat].big.setText('LOCKED').setColor(T.cream);
      sfx('select');
    };
    for (const n of ['3', '2', '1']) { clockT.setText(n); sfx('select'); await this.wait(600); }
    sfx('crit');
    t0 = this.time.now;
    live = true;
    const tick = this.time.addEvent({ delay: 30, loop: true, callback: () => {
      const e = (this.time.now - t0) / 1000;
      clockT.setText(e < 1.5 ? e.toFixed(2) : '?.??');
      if (Object.keys(times).length === this.players.length || e > 9) tick.remove();
    } });
    while (Object.keys(times).length < this.players.length && (this.time.now - t0) < 9000) await this.wait(100);
    live = false;
    this.onCorner = null;
    tick.remove();
    clockT.setText('5.00');
    this.players.forEach((s) => {
      const v = this.cornerViews[s];
      const t = times[s];
      v.big.setText(t === undefined ? 'NEVER\nTAPPED' : t.toFixed(2)).setColor(t !== undefined && Math.abs(t - 5) < 0.15 ? T.gold : T.white);
    });
    sfx('dice');
    await this.wait(1600);
    const off = (s) => (times[s] === undefined ? 99 : Math.abs(times[s] - 5));
    const ranked = this.players.slice().sort((a, b) => off(a) - off(b));
    const pays = [25, 10];
    this.finish(ranked.map((s, k) => ({
      seat: s, gold: off(s) < 99 ? (pays[k] || 0) : 0,
      note: times[s] === undefined ? 'fell asleep' : `${times[s].toFixed(2)}s (off by ${off(s).toFixed(2)})`,
    })));
  }

  // Full-screen "pass the phone" curtain so secret picks stay secret.
  passTo(seat, msg = 'Everyone else, look away.') {
    return new Promise((resolve) => {
      const c = this.add.container(0, 0).setDepth(800);
      c.add(this.add.rectangle(320, 180, 2000, 360, C.ink, 1).setInteractive());
      c.add(text(this, 320, 110, `PASS THE PHONE TO`, { size: 12, ox: 0.5, color: T.grey }));
      c.add(text(this, 320, 140, this.name(seat).toUpperCase(), { size: 24, ox: 0.5, color: this.color(seat), strokeThickness: 6 }));
      c.add(text(this, 320, 180, msg, { size: 8, ox: 0.5, color: T.grey }));
      c.add(button(this, 220, 220, 200, 44, `I'M ${this.name(seat).toUpperCase()}`, () => { c.destroy(); resolve(); }, { size: 10, fill: 0x2a5a3a }));
    });
  }

  // ---------------------------------------------------------------- SPLIT OR STEAL
  async split() {
    const pair = rng.shuffle(this.players).slice(0, 2);
    const [a, b] = pair;
    const others = this.players.filter((s) => !pair.includes(s));
    let pot = 40;
    pair.forEach((s) => { const n = Math.min(10, run.party[s].gold); run.party[s].gold -= n; pot += n; });
    const banner = text(this, 320, 40, `${this.name(a).toUpperCase()} vs ${this.name(b).toUpperCase()}`, { size: 16, ox: 0.5, color: T.gold, depth: 200 });
    const potT = text(this, 320, 70, `POT: ${pot}g`, { size: 12, ox: 0.5, color: T.cream, depth: 200 });
    this.layer.add([banner, potT]);
    [a, b].forEach((s, k) => {
      const img = this.add.image(200 + k * 240, 230, faceKey(this, run.party[s].race)).setOrigin(0.5, 1);
      fitHeight(img, 90);
      img.setFlipX(k === 1);
      this.layer.add(img);
    });
    await this.wait(1200);

    // spectators bet on betrayal
    const bets = {};
    for (const s of others) {
      await this.passTo(s, 'Side bet: will anyone STEAL?');
      bets[s] = await new Promise((resolve) => {
        const c = this.add.container(0, 0).setDepth(800);
        c.add(this.add.rectangle(320, 180, 2000, 360, C.ink, 0.92).setInteractive());
        c.add(text(this, 320, 100, `${this.name(s).toUpperCase()}: WILL ANYONE STEAL?`, { size: 12, ox: 0.5, color: this.color(s) }));
        c.add(text(this, 320, 124, 'Right guess pays 15g.', { size: 8, ox: 0.5, color: T.grey }));
        c.add(button(this, 150, 160, 160, 60, 'YES', () => { c.destroy(); resolve(true); }, { size: 16, fill: 0x6a2a3a, sub: 'they are snakes' }));
        c.add(button(this, 330, 160, 160, 60, 'NO', () => { c.destroy(); resolve(false); }, { size: 16, fill: 0x2a5a3a, sub: 'trust the bros' }));
      });
    }

    // secret picks
    const pick = {};
    for (const s of pair) {
      await this.passTo(s);
      pick[s] = await new Promise((resolve) => {
        const c = this.add.container(0, 0).setDepth(800);
        c.add(this.add.rectangle(320, 180, 2000, 360, C.ink, 1).setInteractive());
        c.add(text(this, 320, 80, `${this.name(s).toUpperCase()}, ${pot}g IS ON THE TABLE`, { size: 12, ox: 0.5, color: this.color(s) }));
        c.add(button(this, 120, 130, 190, 90, 'SPLIT', () => { c.destroy(); resolve('split'); }, { size: 16, fill: 0x2a5a3a, sub: 'be a good friend' }));
        c.add(button(this, 330, 130, 190, 90, 'STEAL', () => { c.destroy(); resolve('steal'); }, { size: 16, fill: 0x8a1c2b, sub: 'be yourself' }));
      });
      sfx('select');
    }
    await this.passTo(a, 'Everyone look. Reveal time.');

    // reveal
    for (const [k, s] of [a, b].entries()) {
      this.centerText('...', 16, T.grey);
      sfx('dice');
      await this.wait(900);
      const lbl = text(this, 200 + k * 240, 120, pick[s].toUpperCase(), { size: 24, ox: 0.5, color: pick[s] === 'steal' ? T.red : T.green, strokeThickness: 6, depth: 300 });
      lbl.setScale(0.3);
      this.tweens.add({ targets: lbl, scale: 1, duration: 260, ease: 'Back.Out' });
      this.layer.add(lbl);
      sfx(pick[s] === 'steal' ? 'whip' : 'heal');
      this.center?.destroy();
      await this.wait(900);
    }
    const steals = pair.filter((s) => pick[s] === 'steal');
    const res = [];
    if (steals.length === 0) {
      this.centerText('THEY SPLIT IT!', 16, T.green);
      pair.forEach((s) => res.push({ seat: s, gold: this.pay(s, Math.floor(pot / 2)), raw: true, note: 'split' }));
    } else if (steals.length === 1) {
      const thief = steals[0], victim = pair.find((s) => s !== thief);
      this.centerText(`${this.name(thief).toUpperCase()} BETRAYED ${this.name(victim).toUpperCase()}`, 12, T.red);
      this.cameras.main.shake(300, 0.01);
      res.push({ seat: thief, gold: this.pay(thief, pot), raw: true, note: 'STOLE IT ALL' });
      res.push({ seat: victim, gold: -10, raw: true, note: 'got played' });
      run.party[thief].st.stolen += Math.floor(pot / 2);
      run.party[victim].st.robbed += Math.floor(pot / 2);
    } else {
      this.centerText('BOTH STOLE. THE GOBLINS KEEP IT.', 12, T.red);
      sfx('lose');
      pair.forEach((s) => res.push({ seat: s, gold: -10, raw: true, note: 'greedy' }));
    }
    const anySteal = steals.length > 0;
    others.forEach((s) => {
      const right = bets[s] === anySteal;
      res.push({ seat: s, gold: right ? this.pay(s, 15) : 0, raw: true, note: right ? 'called it' : 'bad read' });
    });
    await this.wait(1800);
    this.finish(res.sort((x, y) => y.gold - x.gold));
  }

  // ---------------------------------------------------------------- GOBLIN DERBY
  async derby() {
    const RACERS = [
      { name: 'Speedy Gonk', key: 'goblin_grunt_idle', odds: 2, w: 0.42, tint: null },
      { name: 'Sir Slime', key: 'slime_blob_idle', odds: 3, w: 0.28, tint: null },
      { name: 'Drunk Gary', key: 'goblin_archer_idle', odds: 4, w: 0.20, tint: 0xffb0b0 },
      { name: 'Grandpa Grib', key: 'goblin_grunt_idle', odds: 7, w: 0.10, tint: 0x9a9aa8 },
    ];
    const EVENTS = {
      'Grandpa Grib': ['*stops to nap*', 'My hip!', 'Back in my day...'],
      'Drunk Gary': ['*hic*', 'Which way is the finish?', 'I love you guys.'],
      'Sir Slime': ['*blorp*', '*found a shortcut*'],
      'Speedy Gonk': ['ZOOM', 'Eat my dust!'],
    };
    const BET = 15;
    // bets (visible, it's a party)
    const bets = {};
    for (const s of this.players) {
      bets[s] = await new Promise((resolve) => {
        const c = this.add.container(0, 0).setDepth(800);
        c.add(this.add.rectangle(320, 180, 2000, 360, C.ink, 0.92).setInteractive());
        const amt = Math.min(BET, run.party[s].gold);
        c.add(text(this, 320, 50, `${this.name(s).toUpperCase()}: PICK A RACER (${amt}g bet)`, { size: 12, ox: 0.5, color: this.color(s) }));
        RACERS.forEach((r, k) => {
          const b = button(this, 40 + k * 142, 90, 134, 120, r.name.toUpperCase(), () => { c.destroy(); resolve(k); }, { size: 8, sub: `pays x${r.odds}`, subColor: T.gold });
          c.add(b);
          const img = this.add.image(40 + k * 142 + 67, 190, r.key).setOrigin(0.5, 1);
          fitHeight(img, 40); img.setFlipX(true); if (r.tint) img.setTint(r.tint);
          c.add(img);
        });
        const taken = Object.entries(bets).map(([p, b]) => `${this.name(Number(p))}: ${RACERS[b.k].name}`).join('   ');
        c.add(text(this, 320, 240, taken, { size: 8, ox: 0.5, color: T.grey }));
      });
      const amt = Math.min(BET, run.party[s].gold);
      run.party[s].gold -= amt;
      run.party[s].st.gambled += amt;
      bets[s] = { k: bets[s], amt };
      sfx('coin');
    }
    // pre-roll finishing order (weighted), then animate a race that ends that way
    const order = [];
    let pool = RACERS.map((r, k) => k);
    while (pool.length) {
      const tot = pool.reduce((t, k) => t + RACERS[k].w, 0);
      let r = rng.next() * tot;
      let pickK = pool[0];
      for (const k of pool) { r -= RACERS[k].w; if (r <= 0) { pickK = k; break; } }
      order.push(pickK);
      pool = pool.filter((k) => k !== pickK);
    }
    const finishT = {};
    order.forEach((k, place) => { finishT[k] = 5200 + place * rng.int(250, 600); });
    const startX = 60, endX = 580;
    const g = this.add.graphics();
    this.layer.add(g);
    g.fillStyle(0x3a2a20, 1); g.fillRect(0, 110, 640, 200);
    for (let k = 0; k < 4; k++) { g.fillStyle(k % 2 ? 0x4a3628 : 0x54402e, 1); g.fillRect(0, 120 + k * 46, 640, 44); }
    g.fillStyle(0xf4f0e0, 1); for (let y = 120; y < 304; y += 8) { g.fillRect(endX + 12, y, 4, 4); g.fillRect(endX + 16, y + 4, 4, 4); }
    const title = text(this, 320, 70, 'AND THEY\'RE OFF!', { size: 16, ox: 0.5, color: T.gold, depth: 200 });
    this.layer.add(title);
    const runners = RACERS.map((r, k) => {
      const y = 160 + k * 46;
      const img = this.add.image(startX, y, r.key).setOrigin(0.5, 1).setDepth(150 + k);
      fitHeight(img, 38); img.setFlipX(false); if (r.tint) img.setTint(r.tint);
      const tag = text(this, 8, y - 30, r.name, { size: 8, color: T.cream, depth: 160 });
      const backers = Object.entries(bets).filter(([, b]) => b.k === k).map(([p]) => this.name(p)).join(', ');
      const bk = text(this, 8, y - 18, backers, { size: 8, color: T.gold, depth: 160 });
      this.layer.add([img, tag, bk]);
      return { img, k, y, base: img.y };
    });
    sfx('crit');
    const t0 = this.time.now;
    const napAt = rng.int(1500, 3000);
    let spoken = 0;
    await new Promise((resolve) => {
      const ev = this.time.addEvent({ delay: 40, loop: true, callback: () => {
        const t = this.time.now - t0;
        runners.forEach((r) => {
          const T_ = finishT[r.k];
          // wobbly progress that still lands on the pre-rolled finish time
          let p = Math.min(1, t / T_);
          p = p + Math.sin(t / 300 + r.k * 2) * 0.04 * (1 - p) * p * 4;
          if (RACERS[r.k].name === 'Grandpa Grib' && t > napAt && t < napAt + 700) p -= 0.02;
          r.img.x = startX + (endX - startX) * Math.max(0, Math.min(1, p));
          r.img.y = r.base - (Math.floor(t / 120 + r.k) % 2) * 2;
        });
        if (t > 900 + spoken * 1300 && spoken < 3) {
          const r = rng.pick(runners);
          bubble(this, r.img.x, r.y - 40, rng.pick(EVENTS[RACERS[r.k].name]), 900);
          spoken++;
        }
        if (t > Math.max(...Object.values(finishT)) + 200) { ev.remove(); resolve(); }
      } });
    });
    const win = order[0];
    title.setText(`${RACERS[win].name.toUpperCase()} WINS!`);
    sfx('jackpot');
    this.cameras.main.flash(150, 247, 197, 72);
    await this.wait(1500);
    const res = this.players.map((s) => {
      const b = bets[s];
      const won = b.k === win;
      return { seat: s, gold: won ? this.pay(s, b.amt * RACERS[b.k].odds) : -b.amt, raw: true, note: `bet on ${RACERS[b.k].name}${won ? ' x' + RACERS[b.k].odds : ''}` };
    });
    this.finish(res.sort((x, y) => y.gold - x.gold));
  }

  // ---------------------------------------------------------------- results
  // res: [{ seat, gold, raw?, note? }] in finishing order. `raw` = already paid.
  async finish(res) {
    await this.wait(400);
    this.input.off('pointerdown');
    this.layer.removeAll(true);
    this.center?.destroy();
    res.forEach((r) => { if (!r.raw && r.gold) r.gold = this.pay(r.seat, r.gold); });
    const top = res[0];
    const winner = top && top.gold > 0 ? top.seat : null;
    let card = null;
    if (winner !== null) card = giveCard(winner);
    this.players.forEach((s) => { run.party[s].doubleNext = false; });

    this.layer.add(panel(this, 120, 40, 400, 280));
    this.layer.add(text(this, 320, 54, `${this.def.name}: RESULTS`, { size: 12, ox: 0.5, color: T.gold }));
    res.forEach((r, k) => {
      const y = 86 + k * 40;
      const s = this.add.image(150, y + 28, faceKey(this, run.party[r.seat].race)).setOrigin(0.5, 1);
      fitHeight(s, 34);
      this.layer.add(s);
      this.layer.add(text(this, 176, y + 4, `${k + 1}. ${this.name(r.seat)}`, { size: 10, color: this.color(r.seat) }));
      if (r.note) this.layer.add(text(this, 176, y + 20, r.note, { size: 8, color: T.grey }));
      const col = r.gold > 0 ? T.gold : r.gold < 0 ? T.red : T.grey;
      this.layer.add(text(this, 500, y + 10, `${r.gold > 0 ? '+' : ''}${r.gold}g`, { size: 12, ox: 1, color: col }));
    });
    if (winner !== null) {
      this.layer.add(text(this, 320, 252, `${this.name(winner)} wins a dirty card: ${CARDS[card].name}`, { size: 8, ox: 0.5, color: T.purple }));
      sfx('win');
    }
    this.layer.add(button(this, 245, 270, 150, 40, 'CONTINUE', () => fadeTo(this, this.returnTo), { size: 10, fill: 0x2a5a3a }));
  }
}
