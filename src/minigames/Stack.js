// STACK ATTACK: the card table. Rules live in systems/stack.js; this scene
// only draws the table, takes your taps, runs the bots and animates events.
//
// Everyone is a portrait (arcade rule: no full bodies). You are seat `me`,
// your hand is along the bottom, the other three sit across the top.
// Everyone antes 10 gold; the winner takes the pot.
//
// Three modes:
//   local  - you + bots on this phone
//   host   - online, this phone runs the rules, the bots and the clocks, and
//            broadcasts every move (events + state) to the room
//   client - online, this phone just draws what the host sends and sends the
//            host your taps. It never applies rules itself.
import { T, C } from '../config.js';
import { text, panel, button, fadeTo, fadeIn, dimmer, bubble } from '../ui/ui.js';
import { background, portraitActor, spawnDaniPortrait } from '../ui/stage.js';
import { run, rng, addGold } from '../systems/state.js';
import { hubScene } from '../systems/arcade.js';
import * as S from '../systems/stack.js';
import { CARD_QUIPS } from '../data/quips.js';
import { RACES } from '../data/races.js';
import { sfx } from '../audio/sfx.js';

const ANTE = 10;
const CARD_COL = { R: 0xd9473c, Y: 0xe8b830, G: 0x5aa83a, B: 0x3f7fd0 };
const CARD_TXT = { R: '#d9473c', Y: '#e8b830', G: '#6abe30', B: '#5fa0f0' };
const HAND_Y = 306; // centre of your cards
const CW = 40, CH = 56; // your cards (big enough to tap)
const PILE = { draw: { x: 262, y: 168 }, discard: { x: 334, y: 168 } };
const SEAT_SPOTS = [{ x: 120, y: 100 }, { x: 320, y: 100 }, { x: 520, y: 100 }]; // opponents, bottom of frame

export class StackScene extends Phaser.Scene {
  constructor() { super('Stack'); }

  create(data = {}) {
    fadeIn(this);
    window.__stack = this;
    this.returnTo = data.returnTo || hubScene();
    this.auto = !!data.auto; // test mode: a bot plays your seat too
    this.net = data.net || null;
    this.role = !this.net ? 'local' : this.net.isHost ? 'host' : 'client';
    this.me = this.net ? this.net.mySeat() : (data.me ?? run.me ?? 0);
    this.spectator = this.me < 0;
    if (this.spectator) this.me = 0;
    this.seq = 0;
    this.queue = [];
    this.finished = false;
    this.offs = [];
    this.events.once('shutdown', () => { this.offs.forEach((f) => f()); if (this.net?.isHost) this.net.snapshot = null; });
    background(this, 'bg_goblin_casino');
    this.add.rectangle(320, 180, 640, 360, C.ink, 0.35).setDepth(-5);
    // the table
    const t = this.add.graphics().setDepth(0);
    t.fillStyle(0x1f4a2a, 1).fillRoundedRect(150, 122, 340, 96, 14);
    t.lineStyle(3, 0x5a3a22, 1).strokeRoundedRect(150, 122, 340, 96, 14);

    const seats = run.party.map((_, i) => i);
    if (this.role === 'client') {
      // the host already dealt: take its state
      const m = data.init;
      this.st = m.st;
      this.pot = m.pot;
      this.seq = m.seq || 0;
      this.setGold(m.gold);
    } else {
      this.st = S.newGame(seats, rng);
      // the pot
      this.pot = 0;
      seats.forEach((s) => { this.pot += -addGold(s, -ANTE); });
    }

    // portraits: opponents in turn order after you, left to right
    const order = [];
    let s = this.me;
    for (let k = 1; k < seats.length; k++) { s = S.nextSeat({ ...this.st, dir: 1 }, s); order.push(s); }
    this.faces = {};
    order.forEach((seat, k) => {
      const p = SEAT_SPOTS[k];
      this.faces[seat] = portraitActor(this, run.party[seat].race, p.x, p.y, { depth: 20 });
    });
    this.faces[this.me] = portraitActor(this, run.party[this.me].race, 40, 352, { depth: 20, label: false });
    const g = run.party.findIndex((h) => h.race === 'griffin');
    if (g >= 0) this.dani = spawnDaniPortrait(this, this.faces[g]);

    // card counts + mini card backs next to each opponent
    this.counts = {};
    order.forEach((seat) => {
      const f = this.faces[seat];
      this.counts[seat] = this.add.container(f.x + 46, f.y - 34).setDepth(21);
    });

    // top info line
    panel(this, 150, 2, 340, 20, { alpha: 0.85 }).setDepth(30);
    this.info = text(this, 320, 12, '', { size: 8, ox: 0.5, oy: 0.5, depth: 31 });
    this.potText = text(this, 632, 8, '', { size: 8, ox: 1, color: T.gold, depth: 31 });

    this.pileLayer = this.add.container(0, 0).setDepth(40);
    this.handLayer = this.add.container(0, 0).setDepth(60);
    this.btnLayer = this.add.container(0, 0).setDepth(70);
    this.ring = this.add.graphics().setDepth(19);

    this.render();
    this.netSetup();
    this.time.delayedCall(500, () => (this.role === 'client' ? this.clientPrompt() : this.loop()));
  }

  // ------------------------------------------------------------------ network
  netSetup() {
    const n = this.net;
    if (!n) return;
    this.offs.push(n.on('lost', (e) => this.lost(e.reason)));
    if (this.role === 'host') {
      n.setGame('stack');
      n.snapshot = () => this.packet([]);
      n.send({ ...this.packet([]), t: 'start' });
      this.offs.push(n.on('act', (m) => {
        if (this.remoteWait && m.seat === this.remoteWait.seat) this.remoteWait.done(m.action);
      }));
      this.offs.push(n.on('last', (m) => {
        if (this.lastWait && m.seat === this.lastWait.seat) this.lastWait.done();
      }));
    } else {
      this.offs.push(n.on('ev', (m) => this.receive(m)));
      this.offs.push(n.on('snap', (m) => { this.seq = m.seq; this.st = m.st; this.pot = m.pot; this.setGold(m.gold); this.render(); this.clientPrompt(); }));
      this.offs.push(n.on('start', (m) => this.scene.restart({ net: n, init: m, returnTo: this.returnTo })));
      this.offs.push(n.on('tolobby', () => this.scene.start('Lobby')));
      this.offs.push(n.on('lobby', () => { const me = n.mySeat(); if (me >= 0 && me !== this.me && !this.spectator) this.me = me; }));
    }
  }

  packet(ev) {
    return { t: 'ev', seq: this.seq, ev, st: JSON.parse(JSON.stringify(this.st)), pot: this.pot, gold: run.party.map((h) => h.gold) };
  }

  // host: tell everyone what just happened
  broadcast(ev) {
    if (this.role !== 'host') return;
    this.seq++;
    this.net.send(this.packet(ev));
  }

  setGold(gold) { if (gold) gold.forEach((g, i) => { if (run.party[i]) run.party[i].gold = g; }); }

  // who drives a seat: 'me' (this phone), 'remote' (a friend's phone), 'bot'
  ctl(seat) {
    if (seat === this.me && !this.spectator) return this.auto ? 'bot' : 'me';
    if (this.role === 'host' && this.net.seats[seat]) return 'remote';
    return 'bot';
  }

  // client: play the host's packets one at a time, in order
  receive(m) {
    if (m.seq <= this.seq) return;
    this.queue.push(m);
    if (!this.draining) this.drain();
  }

  async drain() {
    this.draining = true;
    while (this.queue.length) {
      const m = this.queue.shift();
      if (m.seq !== this.seq + 1) {
        // missed something: ask for a fresh snapshot
        this.queue = [];
        this.net.send({ t: 'hello' });
        break;
      }
      this.seq = m.seq;
      this.awaiting = null;
      this.btnLayer.removeAll(true);
      this.overlay?.destroy();
      this.st = m.st;
      this.pot = m.pot;
      this.setGold(m.gold);
      await this.animate(m.ev);
      this.render();
    }
    this.draining = false;
    this.clientPrompt();
  }

  clientPrompt() {
    const st = this.st;
    if (this.draining) return;
    if (st.winner !== null) { this.finish(); return; }
    this.render();
    const seat = S.current(st);
    if (seat === this.me && !this.spectator) {
      this.humanAction().then((action) => {
        this.setInfo('...', T.grey);
        this.net.send({ t: 'act', seat: this.me, action });
      });
    } else {
      this.setInfo(st.pending ? `${this.name(seat).toUpperCase()} IS STARING AT +${st.pending.amount}...` : `${this.name(seat).toUpperCase()}'S TURN`, RACES[this.race(seat)].color);
    }
  }

  // host: wait for a friend's phone to send their move. null = they left or
  // fell asleep (40s), and a bot moves for them.
  remoteAction(seat) {
    this.setInfo(`${this.name(seat).toUpperCase()}'S TURN`, RACES[this.race(seat)].color);
    return new Promise((res) => {
      const check = this.time.addEvent({ delay: 500, loop: true, callback: () => { if (this.ctl(seat) !== 'remote') done(null); } });
      const nap = this.time.delayedCall(40000, () => done(null));
      const done = (a) => {
        if (!this.remoteWait) return;
        this.remoteWait = null;
        check.remove(); nap.remove();
        res(a);
      };
      this.remoteWait = { seat, done };
    });
  }

  lost(reason) {
    this.net?.close();
    const L = this.add.container(0, 0).setDepth(990);
    L.add(dimmer(this, 0.7, 0));
    L.add(text(this, 320, 150, reason || 'Connection lost.', { size: 12, ox: 0.5, color: T.red }));
    L.add(button(this, 245, 190, 150, 40, 'BACK', () => fadeTo(this, 'Lobby'), { size: 10 }));
  }

  // ------------------------------------------------------------------ drawing
  name(seat) { return run.party[seat].name; }
  race(seat) { return run.party[seat].race; }

  // One card as a container. faceUp=false draws the back.
  card(card, x, y, w = CW, h = CH, faceUp = true) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(C.ink, 1).fillRoundedRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2, 5);
    if (!faceUp) {
      g.fillStyle(0x6a2a3a, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 4);
      g.lineStyle(2, C.gold, 1).strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 3);
      c.add(g);
      c.add(text(this, 0, 0, '$', { size: Math.round(w / 3), ox: 0.5, oy: 0.5, color: T.gold }));
      return c;
    }
    const wild = card.c === null;
    if (wild) {
      // four-colour wild
      g.fillStyle(0x1a1222, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 4);
      const q = [CARD_COL.R, CARD_COL.Y, CARD_COL.G, CARD_COL.B];
      q.forEach((col, k) => { g.fillStyle(col, 1); g.fillRect(-w / 2 + 4 + (k % 2) * (w / 2 - 4), -h / 2 + 4 + Math.floor(k / 2) * (h / 2 - 4), w / 2 - 4, h / 2 - 4); });
    } else {
      g.fillStyle(CARD_COL[card.c], 1).fillRoundedRect(-w / 2, -h / 2, w, h, 4);
    }
    g.fillStyle(0xfff6e0, 1).fillEllipse(0, 0, w * 0.78, h * 0.6);
    c.add(g);
    const label = {
      skip: 'SKIP', rev: 'REV', '+2': '+2', wild: 'WILD', '+4': '+4', rbay: 'BACK\nAT YA', swap: 'SWAP', skipall: 'SKIP\nALL',
    }[card.v] || card.v;
    const big = /^\d$/.test(card.v) || card.v === '+2' || card.v === '+4';
    const size = big ? Math.round(w * 0.4) : 8;
    const col = wild ? T.ink : CARD_TXT[card.c];
    c.add(text(this, 0, 1, label, { size, ox: 0.5, oy: 0.5, color: col, align: 'center', lineSpacing: 2, strokeThickness: 0 }));
    return c;
  }

  render() {
    const st = this.st;
    // piles
    this.pileLayer.removeAll(true);
    const P = this.pileLayer;
    const d = PILE.draw, dc = PILE.discard;
    P.add(this.card(null, d.x + 2, d.y + 2, 44, 62, false));
    P.add(this.card(null, d.x, d.y, 44, 62, false));
    P.add(text(this, d.x, d.y + 40, `${st.draw.length}`, { size: 8, ox: 0.5, color: T.grey }));
    const topCard = S.top(st);
    const ring = this.add.graphics();
    ring.lineStyle(4, CARD_COL[st.color] || C.white, 1).strokeRoundedRect(dc.x - 26, dc.y - 35, 52, 70, 7);
    P.add(ring);
    P.add(this.card(topCard, dc.x, dc.y, 44, 62, true));
    P.add(text(this, dc.x, dc.y + 40, S.COLOR_NAMES[st.color] || '', { size: 8, ox: 0.5, color: CARD_TXT[st.color] || T.white }));
    // direction arrows
    P.add(text(this, 298, 132, st.dir === 1 ? '>>' : '<<', { size: 8, ox: 0.5, color: T.cream }));
    if (st.pending) {
      const pt = text(this, 430, 168, `+${st.pending.amount}`, { size: 24, ox: 0.5, oy: 0.5, color: T.red, strokeThickness: 6 });
      P.add(pt);
      this.tweens.add({ targets: pt, scale: 1.12, duration: 300, yoyo: true, repeat: -1 });
      P.add(text(this, 430, 196, 'STACK OR TAKE', { size: 8, ox: 0.5, color: T.red }));
    }

    // opponents' card counts
    Object.entries(this.counts).forEach(([seat, cont]) => {
      cont.removeAll(true);
      const n = st.hands[seat].length;
      cont.add(this.card(null, 3, 2, 24, 34, false));
      cont.add(this.card(null, 0, 0, 24, 34, false));
      cont.add(text(this, 18, 0, `x${n}`, { size: 10, oy: 0.5, color: n <= 2 ? T.red : T.white, strokeThickness: 4 }));
    });

    // turn ring around whoever is up
    this.ring.clear();
    const f = this.faces[S.current(st)];
    if (f && st.winner === null) {
      this.ring.lineStyle(3, C.gold, 1).strokeRect(f.x - f.h / 2 - 6, f.y - f.h - 6, f.h + 12, f.h + 12);
    }

    this.potText.setText(`POT ${this.pot}g`);
    this.renderHand();
  }

  renderHand(interactive = false) {
    this.handLayer.removeAll(true);
    if (this.spectator) return;
    const st = this.st;
    const hand = this.sortHand(st.hands[this.me]);
    const n = hand.length;
    const left = 84, right = 630;
    const step = n > 1 ? Math.min(CW + 4, (right - left - CW) / (n - 1)) : 0;
    const x0 = left + CW / 2 + Math.max(0, (right - left - CW - step * (n - 1)) / 2);
    this.cardViews = [];
    hand.forEach((cd, k) => {
      const ok = interactive && S.canPlay(st, this.me, cd);
      const v = this.card(cd, x0 + k * step, HAND_Y - (ok ? 8 : 0));
      if (interactive && !ok) v.setAlpha(0.5);
      if (ok) {
        v.setSize(Math.max(step, 24), CH).setInteractive({ useHandCursor: true });
        v.on('pointerup', () => this.tapCard(cd));
      }
      this.handLayer.add(v);
      this.cardViews.push({ card: cd, v });
    });
  }

  // your hand, grouped by colour then value, wilds at the end
  sortHand(hand) {
    const ord = { R: 0, Y: 1, G: 2, B: 3 };
    return hand.slice().sort((a, b) => (a.c === null) - (b.c === null) || (ord[a.c] ?? 9) - (ord[b.c] ?? 9) || String(a.v).localeCompare(String(b.v)));
  }

  setInfo(str, color = T.cream) { this.info.setText(str).setColor(color); }

  // ------------------------------------------------------------------ flow
  async loop() {
    const st = this.st;
    while (st.winner === null && this.sys.isActive()) {
      const seat = S.current(st);
      this.render();
      const who = this.ctl(seat);
      let action = null;
      if (who === 'me') action = await this.humanAction();
      else if (who === 'remote') action = await this.remoteAction(seat);
      if (!action) {
        this.setInfo(st.pending ? `${this.name(seat).toUpperCase()} IS STARING AT +${st.pending.amount}...` : `${this.name(seat).toUpperCase()} IS THINKING...`, RACES[this.race(seat)].color);
        await this.wait(st.drew ? 350 : 650 + Math.random() * 500);
        action = S.botMove(st, seat, rng);
      }
      await this.step(seat, action);
      await this.wait(220);
    }
    this.render();
    this.finish();
  }

  // apply one move, tell the room, animate it
  async step(seat, action) {
    let ev;
    try {
      ev = S.apply(this.st, seat, action, rng);
    } catch (e) {
      console.warn('illegal move ignored', seat, action, e.message);
      this.broadcast([]); // re-sync whoever sent it
      return false;
    }
    this.broadcast(ev);
    await this.animate(ev);
    return true;
  }

  humanAction() {
    return new Promise((resolve) => {
      this.awaiting = resolve;
      this.showControls();
    });
  }

  showControls() {
    const st = this.st;
    const me = this.me;
    this.renderHand(true);
    this.btnLayer.removeAll(true);
    const B = this.btnLayer;
    const can = S.playable(st, me);
    if (st.pending) {
      this.setInfo(can.length ? `+${st.pending.amount} AT YOU! STACK, BOUNCE OR TAKE` : `+${st.pending.amount} AT YOU. NOTHING TO STACK.`, T.red);
      B.add(button(this, 520, 214, 112, 46, `TAKE +${st.pending.amount}`, () => this.act({ type: 'take' }), { size: 10, fill: 0x6a2a3a }));
    } else if (st.drew) {
      this.setInfo(can.length ? 'PLAY THE CARD YOU DREW, OR PASS.' : 'NOTHING. PASS.', T.cream);
      B.add(button(this, 520, 214, 112, 46, 'PASS', () => this.act({ type: 'pass' }), { size: 10 }));
    } else {
      this.setInfo(can.length ? 'YOUR TURN. TAP A RAISED CARD.' : 'NOTHING TO PLAY. DRAW.', T.gold);
      B.add(button(this, 520, 214, 112, 46, 'DRAW', () => this.act({ type: 'draw' }), { size: 10, fill: can.length ? C.panelHi : 0x2a5a3a }));
      // tap the draw pile too
      const z = this.add.zone(PILE.draw.x, PILE.draw.y, 50, 70).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => this.act({ type: 'draw' }));
      B.add(z);
    }
  }

  tapCard(cd) {
    if (!this.awaiting) return;
    sfx('select');
    if (cd.v === 'wild' || cd.v === '+4' || cd.v === 'rbay') return this.pickColor((color) => this.act({ type: 'play', cardId: cd.id, color }));
    if (cd.v === 'swap') return this.pickColor((color) => this.pickTarget((target) => this.act({ type: 'play', cardId: cd.id, color, target })));
    this.act({ type: 'play', cardId: cd.id });
  }

  act(action) {
    if (!this.awaiting) return;
    const done = this.awaiting;
    this.awaiting = null;
    this.btnLayer.removeAll(true);
    this.overlay?.destroy();
    this.renderHand(false);
    done(action);
  }

  pickColor(cb) {
    this.overlay?.destroy();
    const L = this.add.container(0, 0).setDepth(900);
    this.overlay = L;
    L.add(dimmer(this, 0.6, 0));
    L.add(text(this, 320, 92, 'PICK A COLOUR', { size: 12, ox: 0.5, color: T.gold }));
    S.COLORS.forEach((c, k) => {
      const n = this.st.hands[this.me].filter((x) => x.c === c).length;
      L.add(button(this, 92 + k * 118, 120, 104, 90, S.COLOR_NAMES[c], () => { L.destroy(); this.overlay = null; cb(c); }, { size: 10, fill: CARD_COL[c], sub: `you have ${n}` }));
    });
    L.add(button(this, 260, 230, 120, 36, 'BACK', () => { L.destroy(); this.overlay = null; }, { size: 8 }));
  }

  pickTarget(cb) {
    const L = this.add.container(0, 0).setDepth(900);
    this.overlay = L;
    L.add(dimmer(this, 0.6, 0));
    L.add(text(this, 320, 92, 'SWAP HANDS WITH WHO?', { size: 12, ox: 0.5, color: T.gold }));
    const others = this.st.seats.filter((s) => s !== this.me);
    others.forEach((s, k) => {
      L.add(button(this, 92 + k * 160, 120, 140, 90, this.name(s).toUpperCase(), () => { L.destroy(); this.overlay = null; cb(s); }, {
        size: 10, sub: `${this.st.hands[s].length} cards`, fill: C.panelHi,
      }));
    });
    L.add(button(this, 260, 230, 120, 36, 'BACK', () => { L.destroy(); this.overlay = null; }, { size: 8 }));
  }

  // Down to one card: 3 seconds to tap LAST CARD! or draw 2.
  // You get a big button. Bots tap at a random speed (and sometimes forget).
  async lastCardClock(seat) {
    const st = this.st;
    const L = this.add.container(0, 0).setDepth(880);
    this.clockUI?.destroy();
    this.clockUI = L;
    const who = this.role === 'client' ? (seat === this.me && !this.spectator ? 'me' : 'watch') : this.ctl(seat);
    const mine = who === 'me';
    const MS = 3000;
    const col = RACES[this.race(seat)].color;
    L.add(text(this, 320, 228, mine ? 'ONE CARD LEFT!' : `${this.name(seat).toUpperCase()} HAS ONE CARD...`, { size: 10, ox: 0.5, color: col, strokeThickness: 4 }));
    const bar = this.add.graphics();
    L.add(bar);
    let result = null;
    const done = new Promise((res) => {
      const finish = (r) => { if (result === null) { result = r; res(r); } };
      if (mine) {
        const b = button(this, 236, 240, 168, 46, 'LAST CARD!', () => {
          if (this.role === 'client') { this.net.send({ t: 'last', seat: this.me }); b.setEnabled(false); } else finish('called');
        }, { size: 14, fill: 0x8a5a1a, border: C.gold });
        L.add(b);
        this.tweens.add({ targets: b, scale: 1.06, duration: 160, yoyo: true, repeat: -1 });
      } else if (who === 'bot') {
        const ms = S.botLastReaction(rng);
        if (ms !== null && ms <= MS) this.time.delayedCall(ms, () => finish('called'));
      } else if (who === 'remote') {
        this.lastWait = { seat, done: () => finish('called') };
      }
      // the host gives a friend's phone a little extra for the trip over the internet
      this.time.delayedCall(who === 'remote' ? MS + 400 : MS, () => finish('missed'));
    });
    // countdown bar
    const t0 = this.time.now;
    const tick = this.time.addEvent({
      delay: 30, loop: true,
      callback: () => {
        const left = Math.max(0, 1 - (this.time.now - t0) / MS);
        bar.clear();
        bar.fillStyle(C.ink, 1).fillRect(234, 290, 172, 10);
        bar.fillStyle(left > 0.34 ? C.gold : C.red, 1).fillRect(236, 292, 168 * left, 6);
      },
    });
    if (mine) sfx('select');
    if (this.role === 'client') {
      // the host decides; its next packet (lastcard / missed) closes this
      this.time.delayedCall(MS + 1500, () => { tick.remove(); if (this.clockUI === L) { L.destroy(); this.clockUI = null; } });
      return;
    }
    await done;
    this.lastWait = null;
    tick.remove();
    L.destroy();
    this.clockUI = null;
    const ev = result === 'called' ? S.callLast(st, seat) : S.missLast(st, seat, rng);
    this.broadcast(ev);
    await this.animate(ev);
  }

  // ------------------------------------------------------------------ events
  spot(seat) {
    const f = this.faces[seat];
    return seat === this.me ? { x: 330, y: HAND_Y } : { x: f.x, y: f.y - f.h / 2 };
  }

  say(seat, kind) {
    const q = CARD_QUIPS[this.race(seat)];
    if (!q || !q[kind]) return;
    const f = this.faces[seat];
    const y = seat === this.me ? f.y - f.h - 2 : f.y - f.h - 2;
    bubble(this, seat === this.me ? 96 : f.x, seat === this.me ? 270 : y + f.h + 40, rng.pick(q[kind]), 2000).setDepth(850);
  }

  banner(str, color = T.gold, ms = 900) {
    const t = text(this, 320, 236, str, { size: 14, ox: 0.5, oy: 0.5, color, strokeThickness: 6, depth: 860, wrap: 600, align: 'center' });
    t.setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.Out' });
    this.time.delayedCall(ms, () => this.tweens.add({ targets: t, alpha: 0, duration: 200, onComplete: () => t.destroy() }));
  }

  flyCard(card, from, to, faceUp = true, ms = 260) {
    return new Promise((res) => {
      const c = this.card(card, from.x, from.y, 44, 62, faceUp).setDepth(840);
      this.tweens.add({ targets: c, x: to.x, y: to.y, angle: Math.random() * 20 - 10, duration: ms, ease: 'Quad.Out', onComplete: () => { c.destroy(); res(); } });
    });
  }

  async drawFly(seat, n) {
    const to = this.spot(seat);
    for (let k = 0; k < Math.min(n, 8); k++) {
      this.flyCard(null, PILE.draw, to, false, 220);
      sfx('step');
      await this.wait(70);
    }
    await this.wait(200);
  }

  async animate(events) {
    for (const e of events) {
      switch (e.t) {
        case 'play': {
          sfx(S.isPlus(e.card) || e.card.v === 'rbay' ? 'whip' : 'select');
          await this.flyCard(e.card, this.spot(e.seat), PILE.discard);
          this.render();
          if (e.card.v === 'rbay') { /* bounce event handles it */ }
          break;
        }
        case 'color':
          break;
        case 'skip':
          this.banner(`${this.name(e.seat).toUpperCase()} SKIPPED`, T.grey, 800);
          this.faces[e.seat]?.setPose('downed');
          this.time.delayedCall(800, () => this.faces[e.seat]?.setPose('idle'));
          await this.wait(600);
          break;
        case 'reverse':
          this.banner('REVERSE!', T.blue, 700);
          await this.wait(400);
          break;
        case 'skipall':
          this.banner(`SKIP EVERYONE. ${this.name(e.seat).toUpperCase()} GOES AGAIN`, T.purple, 1100);
          await this.wait(800);
          break;
        case 'stack':
          this.cameras.main.shake(140, 0.004);
          this.banner(`+${e.amount}!`, T.red, 700);
          if (e.amount > 4 || rng.chance(0.3)) this.say(e.from, 'stack');
          await this.wait(500);
          break;
        case 'bounce': {
          sfx('crit');
          this.cameras.main.shake(260, 0.008);
          this.cameras.main.flash(120, 247, 197, 72);
          this.banner('RIGHT BACK AT YA!', T.gold, 1200);
          this.say(e.from, 'bounce');
          // the pile physically flies back
          const a = this.spot(e.from), b = this.spot(e.to);
          const chip = text(this, a.x, a.y, `+${e.amount}`, { size: 16, ox: 0.5, oy: 0.5, color: T.red, strokeThickness: 6, depth: 870 });
          await new Promise((res) => this.tweens.add({ targets: chip, x: b.x, y: b.y, duration: 500, ease: 'Back.In', onComplete: res }));
          chip.destroy();
          this.faces[e.to]?.setPose('hurt');
          this.time.delayedCall(700, () => this.faces[e.to]?.setPose('idle'));
          await this.wait(600);
          break;
        }
        case 'take':
          sfx('hit');
          this.faces[e.seat]?.setPose('hurt');
          await this.drawFly(e.seat, e.n);
          this.banner(`${this.name(e.seat).toUpperCase()} DRAWS ${e.n}`, T.red, 900);
          if (e.n >= 4) this.say(e.seat, 'hit');
          this.faces[e.seat]?.setPose('idle');
          this.render();
          await this.wait(500);
          break;
        case 'draw':
          await this.drawFly(e.seat, e.n);
          this.render();
          break;
        case 'swap': {
          sfx('magic');
          this.banner(`${this.name(e.a).toUpperCase()} SWAPS HANDS WITH ${this.name(e.b).toUpperCase()}`, T.purple, 1300);
          await this.wait(300);
          await Promise.all([this.flyCard(null, this.spot(e.a), this.spot(e.b), false, 420), this.flyCard(null, this.spot(e.b), this.spot(e.a), false, 420)]);
          this.render();
          await this.wait(500);
          break;
        }
        case 'lastdue':
          this.render();
          await this.lastCardClock(e.seat);
          break;
        case 'lastcard':
          this.clockUI?.destroy(); this.clockUI = null;
          sfx('coin');
          this.banner(`${this.name(e.seat).toUpperCase()}: LAST CARD!`, T.gold, 900);
          this.say(e.seat, 'last');
          await this.wait(400);
          break;
        case 'missed':
          this.clockUI?.destroy(); this.clockUI = null;
          sfx('whip');
          this.cameras.main.shake(160, 0.005);
          this.banner(`TOO SLOW! ${this.name(e.seat).toUpperCase()} DRAWS 2`, T.red, 1100);
          this.faces[e.seat]?.setPose('hurt');
          await this.drawFly(e.seat, 2);
          this.faces[e.seat]?.setPose('idle');
          this.render();
          break;
        case 'win':
          break;
        default:
      }
    }
  }

  // ------------------------------------------------------------------ results
  async finish() {
    if (this.finished) return;
    this.finished = true;
    const st = this.st;
    const w = st.winner;
    this.btnLayer.removeAll(true);
    this.setInfo(`${this.name(w).toUpperCase()} WINS`, RACES[this.race(w)].color);
    if (this.role !== 'client') addGold(w, this.pot);
    if (this.role === 'host') { this.broadcast([]); this.net.setGame(null); }
    this.faces[w].setPose('victory');
    sfx('jackpot');
    this.say(w, 'win');
    await this.wait(1400);
    const L = this.add.container(0, 0).setDepth(900);
    L.add(dimmer(this, 0.55, 0));
    L.add(panel(this, 150, 60, 340, 220, { border: C.gold }));
    L.add(text(this, 320, 74, 'STACK ATTACK: RESULTS', { size: 10, ox: 0.5, color: T.gold }));
    const rank = st.seats.slice().sort((a, b) => st.hands[a].length - st.hands[b].length);
    rank.forEach((s, k) => {
      const y = 100 + k * 34;
      const f = portraitActor(this, this.race(s), 190, y + 30, { label: false, depth: 905 });
      f.setScale(0.45);
      L.add(f);
      L.add(text(this, 216, y + 10, `${k + 1}. ${this.name(s)}`, { size: 10, color: RACES[this.race(s)].color }));
      L.add(text(this, 470, y + 10, s === w ? `+${this.pot - ANTE}g` : `${st.hands[s].length} left  -${ANTE}g`, { size: 8, ox: 1, color: s === w ? T.gold : T.red }));
    });
    if (this.role === 'host') {
      L.add(button(this, 160, 238, 150, 34, 'PLAY AGAIN', () => this.scene.restart({ net: this.net, returnTo: this.returnTo }), { size: 10, fill: 0x2a5a3a }));
      L.add(button(this, 330, 238, 150, 34, 'LOBBY', () => { this.net.send({ t: 'tolobby' }); this.scene.start('Lobby'); }, { size: 10 }));
    } else if (this.role === 'client') {
      L.add(text(this, 320, 246, 'Waiting for the host...', { size: 8, ox: 0.5, color: T.grey }));
      L.add(button(this, 245, 262, 150, 30, 'LEAVE', () => { this.net.close(); fadeTo(this, 'Lobby'); }, { size: 8 }));
    } else {
      L.add(button(this, 245, 238, 150, 34, 'CONTINUE', () => fadeTo(this, this.returnTo), { size: 10, fill: 0x2a5a3a }));
    }
  }

  wait(ms) { return new Promise((res) => this.time.delayedCall(ms, res)); }
}
