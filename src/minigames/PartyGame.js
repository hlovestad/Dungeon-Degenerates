// ONLINE PARTY GAMES: the screen every phone sees for the arcade minigames
// when playing online. Rules live in systems/partygames.js.
//
// HOST: sets the game up, runs the clock and the bots, takes everyone's input
//       ('pin' messages), and broadcasts the state ('pg') after every change.
// CLIENT: draws the state and sends its own taps. Reflex games (quick draw,
//       mash, clock, whack) are timed on each phone itself, so lag is fair.
//
// Portraits only (arcade rule). Landscape.
import { T, C } from '../config.js';
import { text, panel, button, fadeIn, dimmer, bubble } from '../ui/ui.js';
import { background, portraitActor } from '../ui/stage.js';
import { run, rng, addGold, steal, ensureGuest } from '../systems/state.js';
import * as G from '../systems/partygames.js';
import { RACES, GUESTS } from '../data/races.js';
import { fitHeight } from '../art/assets.js';
import { sfx } from '../audio/sfx.js';

const INTRO_MS = 3200;
const REVEAL_MS = { derby: 5600, trivia: 3200, potato: 2600, wheel: 4200 };
const RESULTS_MS = 11000; // then the host takes everyone back to the arcade

export class PartyGameScene extends Phaser.Scene {
  constructor() { super('PartyGame'); }

  create(data = {}) {
    fadeIn(this);
    window.__pg = this;
    this.net = data.net;
    this.role = this.net.isHost ? 'host' : 'client';
    this.me = this.net.mySeat();
    this.spectator = this.me < 0;
    // Phaser reuses this object for every game: reset everything per game
    this.offs = [];
    this.timers = [];
    this.leaving = false;
    this.turnNo = 0;
    this.eyeUsed = false;
    this.eyeOn = false;
    this.betAmt = 10;
    this.casinoAmt = 10;
    this.casinoT0 = 0;
    this._pk = null;
    this.lastShown = null;
    this.bonkAt = 0;
    this.mine = {}; // what this phone has submitted this round
    this.phaseSeen = null;
    this.seq = 0;
    this.events.once('shutdown', () => { this.offs.forEach((f) => f()); if (this.role === 'host') this.net.snapshot = null; });

    if (this.role === 'host') {
      const seats = data.seats;
      seats.forEach((s) => { if (s >= 4) ensureGuest(s, GUESTS[s - 4]); });
      const humans = seats.filter((s) => this.net.seats[s]);
      if (run.arcade && !run.arcade.usedQ) run.arcade.usedQ = [];
      this.P = { party: run.party, addGold, steal, picker: run.arcade?.picker ?? 0, opts: data.opts || {}, used: run.arcade?.usedQ };
      this.st = G.newGame(data.game, seats, humans, rng, this.P);
      this.def = G.GAMES[this.st.id];
      this.net.snapshot = () => ({ scene: 'PartyGame', init: this.packet() });
      this.net.setGame('arcade');
      this.offs.push(this.net.on('pin', (m) => this.onInput(m.seat, m.d)));
      this.net.send({ t: 'go', scene: 'PartyGame', init: this.packet() });
    } else {
      const m = data.init;
      (m.st.seats || []).forEach((s) => { if (s >= 4) ensureGuest(s, GUESTS[s - 4]); });
      this.st = m.st;
      this.seq = m.seq || 0;
      this.setGold(m.gold);
      this.def = G.GAMES[this.st.id];
      this.offs.push(this.net.on('pg', (pm) => this.onPacket(pm)));
    }
    this.offs.push(this.net.on('lost', (e) => this.lost(e.reason)));

    // stage
    background(this, 'bg_goblin_casino');
    this.add.rectangle(320, 180, 2000, 360, C.ink, 0.55).setDepth(-5);
    this.title = text(this, 320, 10, this.st.id === 'trivia' && this.st.data.theme ? `${this.def.name}: ${this.st.data.theme}` : this.def.name, { size: 12, ox: 0.5, color: T.gold, strokeThickness: 5, depth: 50 });
    this.faces = {};
    this.status = {};
    const n = this.st.seats.length;
    const gap = Math.min(110, 600 / n);
    this.st.seats.forEach((s, k) => {
      const x = Math.round(320 - (gap * (n - 1)) / 2 + k * gap);
      const f = portraitActor(this, run.party[s].race, x, 82, { depth: 20 });
      f.setScale(0.75); f.h *= 0.75;
      if (s === this.me) f.setPose('victory');
      this.faces[s] = f;
      this.status[s] = text(this, x, 104, '', { size: 8, ox: 0.5, color: T.grey, depth: 21, strokeThickness: 3 });
    });
    this.layer = this.add.container(0, 0).setDepth(30);
    this.ctl = this.add.container(0, 0).setDepth(40);

    this.enterPhase();
    if (this.role === 'host') this.after(INTRO_MS, () => this.hostPlay());
  }

  // ------------------------------------------------------------------ net
  packet() {
    return { seq: this.seq, st: G.publicState(this.st), gold: run.party.map((h) => h.gold) };
  }

  broadcast() {
    if (this.role !== 'host') return;
    this.seq++;
    this.net.send({ t: 'pg', ...this.packet() });
    this.enterPhase();
  }

  onPacket(m) {
    if (m.seq <= this.seq) return;
    this.seq = m.seq;
    this.st = m.st;
    this.setGold(m.gold);
    this.enterPhase();
  }

  setGold(gold) { if (gold) gold.forEach((g, i) => { if (run.party[i]) run.party[i].gold = g; }); }

  // a tap on this phone
  send(d) {
    if (this.spectator) return;
    if (this.role === 'host') this.onInput(this.me, d);
    else this.net.send({ t: 'pin', seat: this.me, d });
  }

  after(ms, fn) {
    const t = this.time.delayedCall(ms, fn);
    this.timers.push(t);
    return t;
  }

  clearTimers() { this.timers.forEach((t) => t.remove()); this.timers = []; }

  lost(reason) {
    const L = this.add.container(0, 0).setDepth(990);
    L.add(dimmer(this, 0.7, 0));
    L.add(text(this, 320, 150, reason || 'Connection lost.', { size: 12, ox: 0.5, color: T.red }));
    L.add(button(this, 245, 190, 150, 40, 'BACK', () => { this.net.close(); this.scene.start('Lobby'); }, { size: 10 }));
  }

  // ------------------------------------------------------------------ host flow
  hostPlay() {
    G.startPlay(this.st);
    this.mine = {};
    this.broadcast();
    const def = this.def;
    const st = this.st;
    // bots (and anybody who isn't really here) move for the empty seats
    const bots = st.seats.filter((s) => !this.net.seats[s]);
    if (def.turnSeat) this.scheduleTurn();
    else {
      bots.forEach((s) => this.scheduleBot(s));
    }
    // the clock: everyone gets the play time (+ a little for the internet)
    this.playTimer = this.after(def.playMs(st) + 900, () => this.hostResolve());
  }

  scheduleBot(seat) {
    const b = this.def.bot(this.st, seat, rng);
    if (!b) return;
    this.after(b.ms, () => {
      if (this.st.phase !== 'play') return;
      this.onInput(seat, b.d);
      if (b.repeat) this.scheduleBot(seat);
    });
  }

  // turn games: the bot (or a friend who's away) takes their turn
  scheduleTurn() {
    const seat = this.def.turnSeat(this.st);
    if (seat === undefined) return;
    const human = !!this.net.seats[seat];
    const turnNo = (this.turnNo = (this.turnNo || 0) + 1);
    if (!human) { this.scheduleBot(seat); return; }
    // a friend's turn: they get turnMs, then a bot moves for them
    this.after(this.def.turnMs || 12000, () => {
      if (this.st.phase !== 'play' || this.turnNo !== turnNo || this.def.turnSeat(this.st) !== seat) return;
      const b = this.def.bot(this.st, seat, rng);
      if (b) this.onInput(seat, b.d);
    });
  }

  onInput(seat, d) {
    if (this.role !== 'host' || this.st.phase !== 'play' || !this.st.seats.includes(seat)) return;
    const ok = this.def.input(this.st, seat, d || {}, rng, this.P);
    if (!ok) return;
    if (this.def.ready(this.st)) { this.hostResolve(); return; }
    this.broadcast();
    if (this.def.turnSeat) this.scheduleTurn();
  }

  hostResolve() {
    if (this.st.phase !== 'play') return;
    this.clearTimers();
    const r = this.def.resolve(this.st, rng, this.P);
    this.st.phase = 'reveal';
    if (r === 'done') G.payOut(this.st, this.P);
    this.broadcast();
    this.after(REVEAL_MS[this.st.id] || 2600, () => {
      if (r === 'next') {
        this.st.round++;
        this.hostPlay();
      } else {
        this.st.phase = 'done';
        this.broadcast();
        this.after(RESULTS_MS, () => this.backToArcade());
      }
    });
  }

  backToArcade() {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('Arcade', { net: this.net, back: true });
  }

  // ------------------------------------------------------------------ drawing
  enterPhase() {
    const st = this.st;
    const key = `${st.phase}:${st.round}`;
    const fresh = key !== this.phaseSeen;
    this.phaseSeen = key;
    if (fresh && st.phase === 'play') { this.t0 = this.time.now; this.mine = {}; this.localDone = false; }
    this.drawStatus();
    if (st.phase === 'intro') { if (fresh) this.drawIntro(); return; }
    if (st.phase === 'done') { if (fresh) this.drawResults(); return; }
    // play / reveal: each game draws itself (fresh = the phase just started)
    const fn = this[`draw_${st.id}`];
    if (fn) fn.call(this, fresh);
  }

  clear() {
    this.layer.removeAll(true);
    this.ctl.removeAll(true);
  }

  name(s) { return run.party[s]?.name || '?'; }
  col(s) { return RACES[run.party[s]?.race]?.color || T.white; }

  drawStatus() {
    const st = this.st;
    st.seats.forEach((s) => {
      let str = '', color = T.grey;
      const inp = st.inputs?.[s];
      if (st.phase === 'play') {
        if (st.id === 'potato') {
          str = s in st.data.banked ? `BANKED ${st.data.banked[s]}` : `${st.data.stash[s]}g`;
          color = s in st.data.banked ? T.green : T.gold;
        } else if (st.id === 'casino') {
          const n = st.data.net[s]; str = `${n >= 0 ? '+' : ''}${n}`; color = n >= 0 ? T.gold : T.red;
        } else if (st.id === 'trivia') {
          str = `${st.data.score[s]} ${inp || this.mine.done && s === this.me ? 'OK' : ''}`; color = T.gold;
        } else if (inp || (s === this.me && this.mine.done)) { str = 'IN'; color = T.green; } else str = '...';
      } else if (st.phase === 'reveal' || st.phase === 'done') {
        const r = st.results?.find((x) => x.seat === s);
        if (r) { str = `${r.delta >= 0 ? '+' : ''}${r.delta}g`; color = r.delta >= 0 ? T.gold : T.red; }
        if (st.id === 'trivia' && st.phase === 'reveal') { str = `${st.data.score[s]} pts`; color = T.gold; }
      }
      if (!this.net.seats[s] && st.phase !== 'done') str = (str ? str + ' ' : '') + '(bot)';
      this.status[s].setText(str).setColor(color);
    });
  }

  drawIntro() {
    this.clear();
    const L = this.layer;
    L.add(panel(this, 90, 122, 460, 150, { border: C.gold }));
    L.add(text(this, 320, 136, this.def.name, { size: 16, ox: 0.5, color: T.red }));
    L.add(text(this, 320, 168, this.def.rules, { size: 8, ox: 0.5, align: 'center', lineSpacing: 6, wrap: 430 }));
    const bar = this.add.graphics();
    L.add(bar);
    const t0 = this.time.now;
    const tick = this.time.addEvent({ delay: 40, loop: true, callback: () => {
      if (!bar.active) { tick.remove(); return; }
      const k = Math.min(1, (this.time.now - t0) / INTRO_MS);
      bar.clear().fillStyle(C.gold, 1).fillRect(110, 258, 420 * (1 - k), 4);
    } });
    sfx('jackpot');
  }

  // big round result line under the title
  headline(str, color = T.gold) {
    this.layer.add(text(this, 320, 124, str, { size: 12, ox: 0.5, color, strokeThickness: 5, wrap: 600, align: 'center' }));
  }

  // ------------------------------------------------------------------ QUICK DRAW
  draw_quickdraw(fresh) {
    const st = this.st;
    if (st.phase === 'play' && fresh) {
      this.clear();
      const L = this.layer;
      const box = this.add.rectangle(320, 210, 520, 170, 0x6a1a24, 1).setStrokeStyle(4, C.border);
      const label = text(this, 320, 210, 'WAIT...', { size: 24, ox: 0.5, oy: 0.5, color: T.red, strokeThickness: 6 });
      L.add([box, label]);
      let bonked = false;
      this.after(st.data.delay, () => {
        if (this.mine.done) return;
        bonked = true;
        this.bonkAt = this.time.now;
        box.setFillStyle(0x2a6a3a, 1);
        label.setText('BONK!').setColor(T.green);
        sfx('crit');
        this.cameras.main.flash(80, 255, 255, 255);
      });
      if (this.spectator) return;
      box.setInteractive();
      box.on('pointerdown', () => {
        if (this.mine.done) return;
        this.mine.done = true;
        if (!bonked) { this.send({ early: true }); label.setText('TOO EARLY!').setColor(T.grey); sfx('lose'); }
        else { const ms = Math.round(this.time.now - this.bonkAt); this.send({ ms }); label.setText(`${ms}ms`).setColor(T.gold); sfx('hit'); }
        this.drawStatus();
      });
    }
    if (st.phase === 'reveal') this.revealList();
  }

  // ------------------------------------------------------------------ MASH
  draw_mash(fresh) {
    const st = this.st;
    if (st.phase === 'play' && fresh) {
      this.clear();
      const L = this.layer;
      let n = 0;
      const count = text(this, 320, 150, '0', { size: 24, ox: 0.5, oy: 0.5, color: T.gold, strokeThickness: 6 });
      const timer = text(this, 320, 186, '5.0', { size: 10, ox: 0.5, color: T.cream });
      L.add([count, timer]);
      if (!this.spectator) {
        const b = button(this, 170, 206, 300, 100, 'MASH!', () => {}, { size: 24, fill: 0x8a1c2b });
        b.list.find((o) => o.type === 'Zone')?.removeAllListeners();
        const z = this.add.zone(320, 256, 300, 100).setInteractive();
        z.on('pointerdown', () => {
          if (this.mine.done) return;
          n++; count.setText(String(n)); sfx('step');
          this.tweens.add({ targets: b, scale: 0.97, duration: 40, yoyo: true });
        });
        L.add([b, z]);
      }
      const t0 = this.time.now;
      const tick = this.time.addEvent({ delay: 50, loop: true, callback: () => {
        const left = Math.max(0, 5000 - (this.time.now - t0));
        if (timer.active) timer.setText((left / 1000).toFixed(1));
        if (left <= 0) {
          tick.remove();
          if (!this.mine.done && !this.spectator) { this.mine.done = true; this.send({ n }); }
          if (timer.active) timer.setText("TIME'S UP");
        }
      } });
    }
    if (st.phase === 'reveal') this.revealList();
  }

  // ------------------------------------------------------------------ STOP THE CLOCK
  draw_clock(fresh) {
    const st = this.st;
    if (st.phase === 'play' && fresh) {
      this.clear();
      const L = this.layer;
      const clock = text(this, 320, 160, '0.00', { size: 24, ox: 0.5, oy: 0.5, color: T.gold, strokeThickness: 6 });
      L.add(clock);
      L.add(text(this, 320, 190, 'TAP AT EXACTLY 5.00', { size: 8, ox: 0.5, color: T.cream }));
      const t0 = this.time.now;
      const tick = this.time.addEvent({ delay: 20, loop: true, callback: () => {
        const ms = this.time.now - t0;
        if (!clock.active) { tick.remove(); return; }
        if (this.mine.done) { tick.remove(); return; }
        clock.setText(ms < st.data.hideAt ? (ms / 1000).toFixed(2) : '?.??');
        if (ms > 9000) tick.remove();
      } });
      if (!this.spectator) {
        L.add(button(this, 200, 212, 240, 84, 'STOP!', () => {
          if (this.mine.done) return;
          this.mine.done = true;
          const ms = Math.round(this.time.now - t0);
          this.send({ ms });
          clock.setText((ms / 1000).toFixed(2));
          sfx('hit');
          this.drawStatus();
        }, { size: 20, fill: 0x2a5a3a }));
      }
    }
    if (st.phase === 'reveal') this.revealList();
  }

  // ------------------------------------------------------------------ WHACK
  draw_whack(fresh) {
    const st = this.st;
    if (st.phase === 'play' && fresh) {
      this.clear();
      const L = this.layer;
      let score = 0;
      const sc = text(this, 320, 122, 'SCORE 0', { size: 10, ox: 0.5, color: T.gold });
      const tm = text(this, 600, 122, '20', { size: 10, ox: 1, color: T.cream });
      L.add([sc, tm]);
      const holes = [];
      for (let k = 0; k < 9; k++) {
        const x = 200 + (k % 3) * 120, y = 166 + Math.floor(k / 3) * 66;
        L.add(this.add.ellipse(x, y + 18, 70, 18, 0x140c1c, 1));
        holes.push({ x, y });
      }
      const t0 = this.time.now;
      st.data.spawns.forEach((sp) => {
        this.after(sp.t, () => {
          if (this.mine.done) return;
          const h = holes[sp.hole];
          const g = this.add.image(h.x, h.y + 18, 'goblin_grunt_idle').setOrigin(0.5, 1);
          fitHeight(g, 44);
          if (sp.kind === 'gold') g.setTint(0xf7c548);
          if (sp.kind === 'bomb') { g.setTexture('prop_poop'); fitHeight(g, 30); }
          const extra = sp.kind === 'crown' ? this.add.image(h.x, h.y - 26, 'icon_crown').setScale(1.1) : null;
          L.add(g); if (extra) L.add(extra);
          g.setInteractive();
          const gone = () => { g.destroy(); extra?.destroy(); };
          g.on('pointerdown', () => {
            const pts = { gob: 3, gold: 10, bomb: -5, crown: -5 }[sp.kind];
            score += pts;
            sc.setText(`SCORE ${score}`);
            sfx(pts > 0 ? 'hit' : 'whip');
            const f = text(this, h.x, h.y - 20, `${pts > 0 ? '+' : ''}${pts}`, { size: 10, ox: 0.5, color: pts > 0 ? T.gold : T.red, strokeThickness: 4 });
            L.add(f);
            this.tweens.add({ targets: f, y: f.y - 20, alpha: 0, duration: 500, onComplete: () => f.destroy() });
            gone();
          });
          this.time.delayedCall(sp.up, () => { if (g.active) gone(); });
        });
      });
      const tick = this.time.addEvent({ delay: 200, loop: true, callback: () => {
        const left = Math.max(0, 20000 - (this.time.now - t0));
        if (tm.active) tm.setText(String(Math.ceil(left / 1000)));
        if (left <= 0) {
          tick.remove();
          if (!this.mine.done && !this.spectator) { this.mine.done = true; this.send({ score }); }
        }
      } });
    }
    if (st.phase === 'reveal') this.revealList();
  }

  // ------------------------------------------------------------------ HIGH CARD
  draw_highcard(fresh) {
    const st = this.st;
    this.clear();
    const L = this.layer;
    L.add(text(this, 320, 124, `POT ${st.data.pot}g`, { size: 12, ox: 0.5, color: T.gold }));
    st.seats.forEach((s) => {
      const f = this.faces[s];
      const shown = st.phase !== 'play' && st.data.face;
      const c = this.add.rectangle(f.x, 196, 52, 72, shown ? 0xfff6e0 : 0x6a2a3a, 1).setStrokeStyle(3, C.ink);
      L.add(c);
      if (shown) L.add(text(this, f.x, 196, st.data.face[s], { size: 20, ox: 0.5, oy: 0.5, color: T.ink, strokeThickness: 0 }));
      else L.add(text(this, f.x, 196, st.inputs[s] ? 'OK' : '$', { size: 12, ox: 0.5, oy: 0.5, color: T.gold }));
    });
    if (st.phase === 'play' && !this.spectator && !this.mine.done && !st.inputs[this.me]) {
      this.ctl.add(button(this, 245, 270, 150, 46, 'FLIP!', () => { this.mine.done = true; this.send({ flip: true }); this.draw_highcard(false); }, { size: 14, fill: 0x2a5a3a }));
    }
    if (st.phase === 'reveal') { sfx('jackpot'); this.winnerLine(); }
  }

  // ------------------------------------------------------------------ CHESTS
  draw_chests(fresh) {
    const st = this.st;
    this.clear();
    const L = this.layer;
    const n = st.data.n;
    const gap = Math.min(110, 560 / n);
    for (let k = 0; k < n; k++) {
      const x = Math.round(320 - (gap * (n - 1)) / 2 + k * gap);
      const img = this.add.image(x, 232, 'prop_chest').setOrigin(0.5, 1);
      fitHeight(img, 52);
      L.add(img);
      L.add(text(this, x, 240, String(k + 1), { size: 10, ox: 0.5, color: T.cream }));
      const mine = (this.mine.pick ?? st.inputs[this.me]?.pick) === k;
      if (mine) L.add(this.add.rectangle(x, 206, 60, 64).setStrokeStyle(3, C.gold));
      if (st.phase === 'reveal') {
        const c = st.data.contents[k];
        L.add(text(this, x, 150, c.g ? `${c.g}g` : c.bomb ? 'BOMB' : 'HEIST', { size: 10, ox: 0.5, color: c.g ? T.gold : T.red, strokeThickness: 4 }));
        const who = st.seats.filter((s) => st.inputs[s]?.pick === k).map((s) => this.name(s)).join('\n');
        L.add(text(this, x, 258, who, { size: 8, ox: 0.5, align: 'center', color: T.cream, lineSpacing: 3 }));
      } else if (!this.spectator && this.mine.pick === undefined && !st.inputs[this.me]) {
        const z = this.add.zone(x, 206, gap - 6, 80).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => { this.mine.pick = k; this.mine.done = true; sfx('select'); this.send({ pick: k }); this.draw_chests(false); this.drawStatus(); });
        L.add(z);
      }
    }
    if (st.phase === 'play') L.add(text(this, 320, 124, this.mine.pick !== undefined ? `YOU PICKED CHEST ${this.mine.pick + 1}` : 'PICK A CHEST', { size: 10, ox: 0.5, color: T.gold }));
    if (st.phase === 'reveal' && fresh) sfx('coin');
  }

  // ------------------------------------------------------------------ SPLIT OR STEAL
  draw_split(fresh) {
    const st = this.st;
    this.clear();
    const L = this.layer;
    const [a, b] = st.data.duel;
    const duel = st.data.duel.includes(this.me);
    L.add(text(this, 320, 124, `${this.name(a).toUpperCase()} VS ${this.name(b).toUpperCase()} FOR ${st.data.pot}g`, { size: 10, ox: 0.5, color: T.gold }));
    if (st.phase === 'play') {
      const done = this.mine.done || st.inputs[this.me];
      if (this.spectator) L.add(text(this, 320, 200, 'Watching...', { size: 10, ox: 0.5, color: T.grey }));
      else if (done) L.add(text(this, 320, 200, duel ? `You chose ${(this.mine.choice || st.inputs[this.me]?.choice || '').toUpperCase()}. Wait for it...` : 'Guess locked in.', { size: 10, ox: 0.5, color: T.cream }));
      else if (duel) {
        L.add(text(this, 320, 150, 'SECRETLY PICK:', { size: 8, ox: 0.5, color: T.cream }));
        L.add(button(this, 130, 172, 180, 90, 'SPLIT', () => { this.mine.done = true; this.mine.choice = 'split'; this.send({ choice: 'split' }); this.draw_split(false); }, { size: 16, fill: 0x2a5a3a }));
        L.add(button(this, 330, 172, 180, 90, 'STEAL', () => { this.mine.done = true; this.mine.choice = 'steal'; this.send({ choice: 'steal' }); this.draw_split(false); }, { size: 16, fill: 0x8a1c2b }));
      } else {
        L.add(text(this, 320, 150, 'WHAT HAPPENS? RIGHT GUESS = +10', { size: 8, ox: 0.5, color: T.cream }));
        [['split', 'BOTH SPLIT'], ['one', 'SOMEONE\nSTEALS'], ['both', 'BOTH STEAL']].forEach(([g, lab], k) => {
          L.add(button(this, 90 + k * 156, 172, 148, 80, lab, () => { this.mine.done = true; this.send({ guess: g }); this.draw_split(false); }, { size: 10 }));
        });
      }
    } else {
      const ch = st.data.choices;
      [a, b].forEach((s, k) => {
        L.add(text(this, 220 + k * 200, 190, `${this.name(s).toUpperCase()}\n${ch[s].toUpperCase()}`, { size: 14, ox: 0.5, align: 'center', color: ch[s] === 'steal' ? T.red : T.green, strokeThickness: 5, lineSpacing: 8 }));
      });
      const o = { split: 'THEY BOTH SPLIT. AWW.', one: 'BETRAYAL!', both: 'BOTH STOLE. THE GOBLINS KEEP IT.' }[st.data.outcome];
      L.add(text(this, 320, 252, o, { size: 10, ox: 0.5, color: T.gold, strokeThickness: 4 }));
      if (fresh) { sfx(st.data.outcome === 'split' ? 'win' : 'whip'); this.cameras.main.shake(200, 0.005); }
    }
  }

  // ------------------------------------------------------------------ DERBY
  draw_derby(fresh) {
    const st = this.st;
    this.clear();
    const L = this.layer;
    const R = st.data.racers;
    const lanes = R.map((r, k) => 142 + k * 36);
    const startX = 120, endX = 560;
    L.add(this.add.rectangle(endX + 14, 196, 4, 150, 0xfff6e0, 1));
    const runners = R.map((r, k) => {
      L.add(text(this, 20, lanes[k], `${r.name}\nx${r.odds}`, { size: 8, oy: 0.5, color: T.cream, lineSpacing: 2 }));
      const img = this.add.image(startX, lanes[k] + 14, r.key).setOrigin(0.5, 1);
      fitHeight(img, 30);
      if (r.tint) img.setTint(r.tint);
      L.add(img);
      return img;
    });
    if (st.phase === 'play') {
      const bet = st.inputs[this.me] || (this.mine.k !== undefined ? this.mine : null);
      this.betAmt = this.betAmt || 10;
      if (this.spectator) return;
      if (bet) {
        L.add(text(this, 320, 124, `YOUR BET: ${bet.amt || this.betAmt}g ON ${R[bet.k].name.toUpperCase()}`, { size: 8, ox: 0.5, color: T.gold }));
        return;
      }
      L.add(text(this, 320, 124, 'TAP A RACER TO BET', { size: 8, ox: 0.5, color: T.gold }));
      R.forEach((r, k) => {
        const z = this.add.zone(320, lanes[k], 600, 34).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => { this.mine.k = k; this.mine.amt = this.betAmt; this.mine.done = true; sfx('coin'); this.send({ k, amt: this.betAmt }); this.draw_derby(false); this.drawStatus(); });
        L.add(z);
      });
      [10, 25].forEach((a, k) => {
        this.ctl.add(button(this, 220 + k * 106, 300, 96, 40, `BET ${a}g`, () => { this.betAmt = a; this.draw_derby(false); }, { size: 8, fill: this.betAmt === a ? 0x2a5a3a : C.panelHi }));
      });
    } else if (fresh) {
      // run the race the host already decided
      const F = st.data.frames;
      const max = Math.max(...F[F.length - 1]);
      F.forEach((fr, i) => {
        this.time.delayedCall(i * 200, () => {
          runners.forEach((img, k) => { if (img.active) this.tweens.add({ targets: img, x: startX + ((endX - startX) * fr[k]) / max, duration: 200 }); });
          sfx('step');
        });
      });
      this.time.delayedCall(F.length * 200 + 200, () => {
        if (!this.layer.active) return;
        this.layer.add(text(this, 320, 124, `${R[st.data.win].name.toUpperCase()} WINS!`, { size: 12, ox: 0.5, color: T.gold, strokeThickness: 5 }));
        sfx('jackpot');
      });
    }
  }

  // ------------------------------------------------------------------ TRIVIA
  draw_trivia(fresh) {
    const st = this.st;
    const q = st.data.qs[st.round];
    this.clear();
    const L = this.layer;
    L.add(panel(this, 40, 116, 560, 50, { alpha: 0.95 }));
    L.add(text(this, 52, 122, `QUESTION ${st.round + 1} OF ${st.rounds}   ${q.theme || st.data.theme || ''}`, { size: 8, color: T.gold }));
    L.add(text(this, 52, 138, q.q, { size: 8, wrap: 536, color: T.cream, lineSpacing: 4 }));
    const rev = st.phase === 'reveal' ? st.data.reveal : null;
    const pick = this.mine.a ?? st.inputs[this.me]?.a;
    if (st.phase === 'play' && fresh) { this.eyeOn = false; }
    q.opts.forEach((o, k) => {
      const x = 40 + (k % 2) * 284, y = 176 + Math.floor(k / 2) * 58;
      const dead = this.eyeOn && q.eye.includes(k);
      let fill = C.panelHi;
      if (rev) fill = k === rev.correct ? 0x2a6a3a : k === pick ? 0x6a2a3a : C.panel;
      else if (pick === k) fill = 0x5a3f7a;
      const b = button(this, x, y, 276, 50, o, () => {
        if (this.spectator || pick !== undefined || st.phase !== 'play') return;
        this.mine.a = k; this.mine.done = true;
        this.send({ a: k, ms: Math.round(this.time.now - this.t0) });
        sfx('select');
        this.draw_trivia(false); this.drawStatus();
      }, { size: 8, fill });
      if (dead || (pick !== undefined && pick !== k && !rev)) b.setEnabled(false);
      L.add(b);
      if (rev) {
        const who = st.seats.filter((s) => rev.picks[s] === k).map((s) => this.name(s)).join(', ');
        if (who) L.add(text(this, x + 270, y + 40, who, { size: 8, ox: 1, color: T.cream }));
      }
    });
    if (st.phase === 'play') {
      // time bar
      const bar = this.add.graphics();
      L.add(bar);
      const tick = this.time.addEvent({ delay: 60, loop: true, callback: () => {
        if (!bar.active) { tick.remove(); return; }
        const left = Math.max(0, 1 - (this.time.now - this.t0) / 12000);
        bar.clear().fillStyle(left > 0.3 ? C.gold : C.red, 1).fillRect(40, 294, 560 * left, 5);
      } });
      const josh = !this.spectator && run.party[this.me]?.race === 'josh';
      if (josh && !this.eyeUsed && pick === undefined) {
        this.ctl.add(button(this, 250, 306, 140, 44, 'THIRD EYE', () => { this.eyeUsed = true; this.eyeOn = true; sfx('magic'); this.draw_trivia(false); }, { size: 8, fill: 0x2a3a6a, sub: 'once per game' }));
      }
    }
    if (rev && fresh) {
      sfx(rev.right.includes(this.me) ? 'coin' : 'miss');
      if (rev.fastest !== null) L.add(text(this, 320, 304, `FASTEST: ${this.name(rev.fastest).toUpperCase()} (+5)`, { size: 8, ox: 0.5, color: T.gold }));
    }
  }

  // ------------------------------------------------------------------ HOT POTATO
  draw_potato(fresh) {
    const st = this.st;
    const D = st.data;
    this.clear();
    const L = this.layer;
    const turn = this.def.turnSeat(st);
    // the bomb sits over whoever holds it
    const holder = D.boom ?? turn ?? D.last?.seat;
    const f = holder !== undefined ? this.faces[holder] : null;
    const bx = f ? f.x : 320;
    const bomb = this.add.circle(bx, 160, 22, 0x1a1222).setStrokeStyle(3, C.red);
    L.add(bomb);
    L.add(text(this, bx, 160, 'BOMB', { size: 8, ox: 0.5, oy: 0.5, color: T.red }));
    this.tweens.add({ targets: bomb, scale: 1.08, duration: Math.max(90, 400 - D.holds * 30), yoyo: true, repeat: -1 });
    if (D.last) {
      const l = D.last;
      const msg = l.did === 'hold' ? `${this.name(l.seat)} HOLDS (+10, now ${l.amt})` : l.did === 'bank' ? `${this.name(l.seat)} BANKS ${l.amt}` : `BOOM! ${this.name(l.seat).toUpperCase()} BLEW UP`;
      L.add(text(this, 320, 206, msg, { size: 10, ox: 0.5, color: l.did === 'boom' ? T.red : T.cream, strokeThickness: 4 }));
      if (fresh || this.lastShown !== JSON.stringify(l)) {
        this.lastShown = JSON.stringify(l);
        if (l.did === 'boom') { sfx('crit'); this.cameras.main.shake(400, 0.012); this.cameras.main.flash(200, 255, 120, 60); }
        else sfx(l.did === 'bank' ? 'coin' : 'step');
      }
    }
    if (st.phase === 'play' && turn !== undefined) {
      L.add(text(this, 320, 228, `${this.name(turn).toUpperCase()}'S TURN   BLOW-UP CHANCE ${D.risk ?? 18}%`, { size: 8, ox: 0.5, color: this.col(turn) }));
      if (turn === this.me && !this.spectator) {
        this.ctl.add(button(this, 150, 252, 160, 70, 'HOLD', () => { this.send({ hold: true }); this.ctl.removeAll(true); }, { size: 16, fill: 0x8a1c2b, sub: '+10 gold' }));
        this.ctl.add(button(this, 330, 252, 160, 70, 'BANK', () => { this.send({ bank: true }); this.ctl.removeAll(true); }, { size: 16, fill: 0x2a5a3a, sub: `keep ${D.stash[this.me]}g` }));
      }
    }
  }

  // ------------------------------------------------------------------ WHEEL
  draw_wheel(fresh) {
    const st = this.st;
    const D = st.data;
    this.clear();
    const L = this.layer;
    const sp = D.spinner;
    if (st.phase === 'play') {
      L.add(text(this, 320, 130, `${this.name(sp).toUpperCase()} SPINS THE WHEEL`, { size: 12, ox: 0.5, color: this.col(sp) }));
      const labels = D.slices.map((s) => s.label.replace('\n', ' ')).join('   ');
      L.add(text(this, 320, 176, labels, { size: 8, ox: 0.5, color: T.cream, wrap: 580, align: 'center', lineSpacing: 6 }));
      if (sp === this.me && !this.spectator && !st.inputs[sp]) this.ctl.add(button(this, 220, 240, 200, 70, 'SPIN!', () => { this.send({ spin: true }); this.ctl.removeAll(true); }, { size: 18, fill: 0x8a1c2b }));
      return;
    }
    if (st.phase === 'reveal' && fresh) {
      // the wheel "spins" through the slices and lands on the host's pick
      const name = text(this, 320, 160, '', { size: 16, ox: 0.5, oy: 0.5, color: T.gold, strokeThickness: 6 });
      L.add(name);
      let k = 0;
      const steps = 18;
      const tick = () => {
        if (!name.active) return;
        k++;
        const sl = k >= steps ? D.slices[D.slice] : D.slices[k % D.slices.length];
        name.setText(sl.label.replace('\n', ' '));
        sfx(k >= steps ? 'jackpot' : 'step');
        if (k < steps) this.time.delayedCall(40 + k * k, tick);
        else {
          const who = [D.A, D.B].filter((x) => x !== null && x !== undefined).map((s) => this.name(s).toUpperCase()).join(' + ');
          L.add(text(this, 320, 196, who, { size: 12, ox: 0.5, color: T.cream, strokeThickness: 4 }));
          (D.lines || []).forEach((ln, i) => L.add(text(this, 320, 230 + i * 16, ln, { size: 8, ox: 0.5, color: T.cream, wrap: 580, align: 'center' })));
        }
      };
      tick();
    }
  }

  // ------------------------------------------------------------------ CASINO
  draw_casino(fresh) {
    const st = this.st;
    const D = st.data;
    this.clear();
    const L = this.layer;
    if (st.phase === 'play' && fresh) this.casinoT0 = this.time.now;
    const left = Math.max(0, Math.ceil((30000 - (this.time.now - (this.casinoT0 || this.time.now))) / 1000));
    L.add(text(this, 600, 116, `${left}s`, { size: 10, ox: 1, color: T.cream }));
    // the room's bets
    (D.log || []).forEach((l, k) => {
      L.add(text(this, 40, 120 + k * 14, `${this.name(l.seat)}: ${l.amt}g on ${l.game} ${l.win ? `WON +${l.delta}` : 'lost'}`, { size: 8, color: l.win ? T.gold : T.grey }));
    });
    if (st.phase !== 'play' || this.spectator) return;
    this.casinoAmt = this.casinoAmt || 10;
    const gold = run.party[this.me].gold;
    L.add(text(this, 600, 134, `YOU: ${gold}g`, { size: 8, ox: 1, color: T.gold }));
    G.CASINO.forEach((g, k) => {
      this.ctl.add(button(this, 30 + k * 150, 228, 142, 60, g.name, () => {
        if (run.party[this.me].gold <= 0) return;
        sfx('dice');
        this.send({ game: g.id, amt: this.casinoAmt });
      }, { size: 8, fill: 0x6a2a3a, sub: `${Math.round(g.p * 100)}% x${g.pay}` }));
    });
    [10, 25, 50].forEach((a, k) => {
      this.ctl.add(button(this, 480 + (k % 2) * 76, 214 + Math.floor(k / 2) * 46, 70, 40, `${a}g`, () => { this.casinoAmt = a; this.draw_casino(false); }, { size: 8, fill: this.casinoAmt === a ? 0x2a5a3a : C.panelHi }));
    });
    // keep the countdown moving
    if (fresh) {
      const tick = this.time.addEvent({ delay: 1000, loop: true, callback: () => {
        if (this.st.phase !== 'play' || this.st.id !== 'casino') { tick.remove(); return; }
        this.draw_casino(false);
      } });
    }
  }

  // ------------------------------------------------------------------ shared reveals
  revealList() {
    this.clear();
    const L = this.layer;
    const r = this.st.results || [];
    if (r[0]) this.headline(`${this.name(r[0].seat).toUpperCase()}: ${r[0].note}`, this.col(r[0].seat));
    r.slice(1).forEach((x, k) => L.add(text(this, 320, 160 + k * 18, `${this.name(x.seat)}: ${x.note}`, { size: 8, ox: 0.5, color: T.cream })));
    sfx('jackpot');
  }

  winnerLine() {
    const r = this.st.results || [];
    const top = r[0];
    if (top) this.layer.add(text(this, 320, 290, `${this.name(top.seat).toUpperCase()} WINS ${top.delta > 0 ? `${top.delta}g` : ''}`, { size: 10, ox: 0.5, color: this.col(top.seat), strokeThickness: 4 }));
  }

  drawResults() {
    this.clear();
    const L = this.layer;
    const st = this.st;
    L.add(panel(this, 110, 116, 420, 236, { border: C.gold }));
    L.add(text(this, 320, 126, `${this.def.name}: RESULTS`, { size: 10, ox: 0.5, color: T.gold }));
    (st.results || []).forEach((r, k) => {
      const y = 146 + k * 26;
      L.add(text(this, 130, y, `${k + 1}. ${this.name(r.seat)}`, { size: 8, color: this.col(r.seat) }));
      L.add(text(this, 250, y, r.note || '', { size: 8, color: T.grey }));
      L.add(text(this, 510, y, `${r.delta > 0 ? '+' : ''}${r.delta}g`, { size: 10, ox: 1, color: r.delta > 0 ? T.gold : r.delta < 0 ? T.red : T.grey }));
    });
    const top = st.results?.[0];
    if (top && top.delta > 0) { this.faces[top.seat]?.setPose('victory'); sfx('win'); }
    if (this.role === 'host') {
      L.add(button(this, 220, 312, 200, 34, 'BACK TO THE ARCADE', () => this.backToArcade(), { size: 8, fill: 0x2a5a3a }));
    } else {
      L.add(text(this, 320, 326, 'Back to the arcade in a moment...', { size: 8, ox: 0.5, color: T.grey }));
    }
  }
}
