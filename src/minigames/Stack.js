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
import { portraitActor } from '../ui/stage.js';
import { run, rng, addGold } from '../systems/state.js';
import { hubScene } from '../systems/arcade.js';
import * as S from '../systems/stack.js';
import { CARD_QUIPS } from '../data/quips.js';
import { RACES } from '../data/races.js';
import { sfx } from '../audio/sfx.js';
import { enterTall } from '../ui/orientation.js';

const ANTE = 10;
const CARD_COL = { R: 0xd9473c, Y: 0xe8b830, G: 0x5aa83a, B: 0x3f7fd0 };
const CARD_TXT = { R: '#d9473c', Y: '#e8b830', G: '#6abe30', B: '#5fa0f0' };
// Played UPRIGHT: the canvas is TALL_W wide and as tall as the phone allows
// (ui/orientation.js). Every position comes from layout(), so the table fits
// any screen and re-lays itself out when the screen changes size.

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
    // scene.restart() reuses this object: clear everything from the last round
    this.seq = 0;
    this.queue = [];
    this.finished = false;
    this.resultsReady = false;
    this.starting = false;
    this.results = null;
    this.awaiting = null;
    this.remoteWait = null;
    this.lastWait = null;
    this.early = {}; // host: moves that arrived before we were listening, by seat
    this.earlyLast = {}; // host: LAST CARD taps that beat the clock starting
    this.draining = false;
    this.animating = false;
    this.pendingBuild = false;
    this.infoStr = '';
    this.offs = [];
    this.events.once('shutdown', () => { this.offs.forEach((f) => f()); if (this.net?.isHost) this.net.snapshot = null; });
    const seats = run.party.map((_, i) => i);
    this.post = null; // between rounds: { ready: {seat: bool}, vote: {seat: bool} }
    if (this.role === 'client') {
      // the host already dealt: take its state
      const m = data.init;
      this.st = m.st;
      this.pot = m.pot;
      this.seq = m.seq || 0;
      this.match = m.match;
      this.post = m.post || null;
      this.shuffled = !!m.shuffled;
      this.setGold(m.gold);
    } else {
      // the match (scoreboard + seating order) carries over between rounds
      if (!run.stackMatch || run.stackMatch.order.length !== seats.length) run.stackMatch = S.newMatch(seats);
      this.match = run.stackMatch;
      this.shuffled = !!data.shuffled;
      this.st = S.newGame(this.match.order, rng);
      // the pot
      this.pot = 0;
      seats.forEach((s) => { this.pot += -addGold(s, -ANTE); });
    }

    // opponents around the table in turn order: left, across, right
    this.order = [];
    let s = this.me;
    for (let k = 1; k < this.st.seats.length; k++) { s = S.nextSeat({ ...this.st, dir: 1 }, s); this.order.push(s); }

    enterTall(this, () => (this.animating ? (this.pendingBuild = true) : this.build()));
    this.build();
    this.netSetup();
    if (this.shuffled) this.time.delayedCall(350, () => { sfx('dice'); this.banner('SEATS SHUFFLED!', T.purple, 1500); });
    this.time.delayedCall(this.shuffled ? 1200 : 500, () => (this.role === 'client' ? this.clientPrompt() : this.loop()));
  }

  // ------------------------------------------------------------------ layout
  layout() {
    const W = this.scale.width, H = this.scale.height;
    const cw = H >= 580 ? 46 : 40; // your cards: big enough to tap, bigger on tall phones
    const ch = Math.round(cw * 1.45);
    const rows = 2; // hand rows we leave room for (more cards just squeeze tighter)
    const top = 22; // info bar
    const oppY = top + 76; // bottom of the across-the-table opponent's frame
    const countY = oppY + 22;
    const handBottom = H - 8;
    const handTop = handBottom - rows * ch - (rows - 1) * 6;
    const ctrlY = handTop - 48; // top of the button row
    const t0 = countY + 14, t1 = ctrlY - 8;
    const cy = Math.round((t0 + t1) / 2);
    const sideY = Math.min(t0 + 88, cy + 24); // bottom of the side opponents' frames
    return {
      W, H, cw, ch, rows, top, oppY, countY, handBottom, handTop, ctrlY, t0, t1, cy,
      // left, across, right (you're at the bottom)
      opp: [{ x: 42, y: sideY }, { x: Math.round(W / 2), y: oppY }, { x: W - 42, y: sideY }],
      draw: { x: Math.round(W / 2 - 30), y: cy + 6 },
      discard: { x: Math.round(W / 2 + 30), y: cy + 6 },
      mid: { x: Math.round(W / 2), y: cy },
    };
  }

  // Everything on screen that depends on its size. Called again on resize.
  build() {
    this.children.removeAll(true);
    this.clockUI = null;
    this.overlay = null;
    const L = (this.L = this.layout());
    // background, cropped to fill the tall screen
    const bg = this.add.image(L.W / 2, L.H / 2, 'bg_goblin_casino').setDepth(-10);
    bg.setScale(Math.max(L.W / bg.width, L.H / bg.height));
    this.add.rectangle(L.W / 2, L.H / 2, L.W, L.H, C.ink, 0.45).setDepth(-5);
    // the table
    const t = this.add.graphics().setDepth(0);
    t.fillStyle(0x1f4a2a, 1).fillRoundedRect(8, L.t0, L.W - 16, L.t1 - L.t0, 14);
    t.lineStyle(3, 0x5a3a22, 1).strokeRoundedRect(8, L.t0, L.W - 16, L.t1 - L.t0, 14);

    this.faces = {};
    this.counts = {};
    this.order.forEach((seat, k) => {
      const p = L.opp[k];
      this.faces[seat] = portraitActor(this, this.race(seat), p.x, p.y, { depth: 20 });
      this.counts[seat] = this.add.container(p.x - 22, p.y + 22).setDepth(21);
    });
    // you: a small portrait at the left of the button row
    this.faces[this.me] = portraitActor(this, this.race(this.me), 26, L.ctrlY + 42, { depth: 20, label: false });
    this.faces[this.me].setScale(0.6);
    this.faces[this.me].h *= 0.6;
    this.myWins = text(this, 50, L.ctrlY + 22, '', { size: 8, oy: 0.5, color: T.gold, depth: 21 });
    // Dani: a little portrait on the bottom corner of Griffin's frame
    const g = run.party.findIndex((h) => h.race === 'griffin');
    if (g >= 0 && g !== this.me) {
      const f = this.faces[g];
      this.dani = portraitActor(this, 'dani', f.x + f.h / 2 - 8, f.y + 2, { scale: 0.5, depth: 22, label: false });
    }

    panel(this, 4, 2, L.W - 8, 20, { alpha: 0.85 }).setDepth(30);
    this.info = text(this, 10, 12, this.infoStr || '', { size: 8, oy: 0.5, depth: 31, color: this.infoCol || T.cream });
    this.potText = text(this, L.mid.x, L.t1 - 12, '', { size: 8, ox: 0.5, oy: 0.5, color: T.gold, depth: 31 });

    this.pileLayer = this.add.container(0, 0).setDepth(40);
    this.handLayer = this.add.container(0, 0).setDepth(60);
    this.btnLayer = this.add.container(0, 0).setDepth(70);
    this.ring = this.add.graphics().setDepth(19);
    this.render();
    if (this.awaiting) this.showControls();
    if (this.resultsReady) this.drawResults();
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
      // A fast phone can answer before this phone has finished animating, so
      // early moves are kept (tagged with the state they answered) until used.
      this.offs.push(n.on('act', (m) => {
        if (m.seq !== undefined && m.seq !== this.seq) return; // answered an old state
        if (this.remoteWait && m.seat === this.remoteWait.seat) this.remoteWait.done(m.action);
        else this.early[m.seat] = { seq: this.seq, action: m.action };
      }));
      this.offs.push(n.on('last', (m) => {
        if (this.lastWait && m.seat === this.lastWait.seat) this.lastWait.done();
        else this.earlyLast[m.seat] = m.seq ?? this.seq;
      }));
      this.offs.push(n.on('ready', (m) => this.setPost('ready', m.seat, m.on)));
      this.offs.push(n.on('vote', (m) => this.setPost('vote', m.seat, m.on)));
    } else {
      this.offs.push(n.on('ev', (m) => this.receive(m)));
      this.offs.push(n.on('snap', (m) => { this.seq = m.seq; this.st = m.st; this.pot = m.pot; this.setGold(m.gold); this.render(); this.clientPrompt(); }));
      this.offs.push(n.on('start', (m) => this.scene.restart({ net: n, init: m, returnTo: this.returnTo })));
      this.offs.push(n.on('tolobby', () => this.scene.start('Lobby')));
      this.offs.push(n.on('post', (m) => { this.post = m.post; this.match = m.match; this.drawResults(); }));
      this.offs.push(n.on('lobby', () => { const me = n.mySeat(); if (me >= 0 && me !== this.me && !this.spectator) this.me = me; }));
    }
  }

  packet(ev) {
    return {
      t: 'ev', seq: this.seq, ev, st: JSON.parse(JSON.stringify(this.st)), pot: this.pot, gold: run.party.map((h) => h.gold),
      match: this.match, post: this.post, shuffled: this.shuffled,
    };
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
      if (m.match) this.match = m.match;
      if (m.post !== undefined) this.post = m.post;
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
        this.net.send({ t: 'act', seat: this.me, action, seq: this.seq });
      });
    } else {
      this.setInfo(st.pending ? `${this.name(seat).toUpperCase()} IS STARING AT +${st.pending.amount}...` : `${this.name(seat).toUpperCase()}'S TURN`, RACES[this.race(seat)].color);
    }
  }

  // host: wait for a friend's phone to send their move. null = they left or
  // fell asleep (40s), and a bot moves for them.
  remoteAction(seat) {
    this.setInfo(`${this.name(seat).toUpperCase()}'S TURN`, RACES[this.race(seat)].color);
    const e = this.early[seat];
    delete this.early[seat];
    if (e && e.seq === this.seq) return Promise.resolve(e.action);
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
    const { W, H } = this.L;
    const O = this.add.container(0, 0).setDepth(990);
    O.add(dimmer(this, 0.7, 0));
    O.add(text(this, W / 2, H / 2 - 30, reason || 'Connection lost.', { size: 10, ox: 0.5, color: T.red, wrap: W - 30, align: 'center' }));
    O.add(button(this, W / 2 - 70, H / 2, 140, 40, 'BACK', () => fadeTo(this, 'Lobby'), { size: 10 }));
  }

  // ------------------------------------------------------------------ drawing
  name(seat) { return run.party[seat].name; }
  race(seat) { return run.party[seat].race; }

  // One card as a container. faceUp=false draws the back.
  card(card, x, y, w = this.L.cw, h = this.L.ch, faceUp = true) {
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
    const L = this.L;
    // piles
    this.pileLayer.removeAll(true);
    const P = this.pileLayer;
    const d = L.draw, dc = L.discard;
    P.add(this.card(null, d.x + 2, d.y + 2, 44, 62, false));
    P.add(this.card(null, d.x, d.y, 44, 62, false));
    P.add(text(this, d.x, d.y + 40, `${st.draw.length} LEFT`, { size: 8, ox: 0.5, color: T.grey }));
    const topCard = S.top(st);
    const ring = this.add.graphics();
    ring.lineStyle(4, CARD_COL[st.color] || C.white, 1).strokeRoundedRect(dc.x - 26, dc.y - 35, 52, 70, 7);
    P.add(ring);
    P.add(this.card(topCard, dc.x, dc.y, 44, 62, true));
    P.add(text(this, dc.x, dc.y + 40, S.COLOR_NAMES[st.color] || '', { size: 8, ox: 0.5, color: CARD_TXT[st.color] || T.white }));
    // direction, between the piles
    P.add(text(this, L.mid.x, d.y, st.dir === 1 ? '>>' : '<<', { size: 8, ox: 0.5, oy: 0.5, color: T.cream }));
    if (st.pending) {
      const pt = text(this, L.mid.x, Math.max(L.t0 + 14, d.y - 52), `+${st.pending.amount}`, { size: 20, ox: 0.5, oy: 0.5, color: T.red, strokeThickness: 6 });
      P.add(pt);
      this.tweens.add({ targets: pt, scale: 1.12, duration: 300, yoyo: true, repeat: -1 });
    }

    // opponents' card counts
    Object.entries(this.counts).forEach(([seat, cont]) => {
      cont.removeAll(true);
      const n = st.hands[seat].length;
      cont.add(this.card(null, 2, 1, 16, 22, false));
      cont.add(this.card(null, 0, 0, 16, 22, false));
      cont.add(text(this, 12, 0, `x${n}`, { size: 8, oy: 0.5, color: n <= 2 ? T.red : T.white, strokeThickness: 4 }));
      cont.add(text(this, 40, 0, `W${this.match?.wins?.[seat] ?? 0}`, { size: 8, oy: 0.5, color: T.gold, strokeThickness: 4 }));
    });
    this.myWins?.setText(this.spectator ? 'WATCHING' : `W${this.match?.wins?.[this.me] ?? 0}`);

    // turn ring around whoever is up
    this.ring.clear();
    const f = this.faces[S.current(st)];
    if (f && st.winner === null) {
      const sz = f.h * (f.scale || 1) + 10;
      this.ring.lineStyle(3, C.gold, 1).strokeRect(f.x - sz / 2, f.y - f.h - 6, sz, f.h + 12);
    }

    this.potText.setText(`POT ${this.pot}g`);
    this.renderHand();
  }

  renderHand(interactive = false) {
    this.handLayer.removeAll(true);
    if (this.spectator) return;
    const st = this.st;
    const L = this.L;
    const hand = this.sortHand(st.hands[this.me]);
    const n = hand.length;
    const span = L.W - 12 - L.cw;
    const perRowMax = Math.floor(span / 26) + 1; // keep at least 26px of every card showing
    const rows = Math.max(1, Math.min(L.rows, Math.ceil(n / perRowMax)));
    const per = Math.ceil(n / rows);
    this.cardViews = [];
    for (let r = 0; r < rows; r++) {
      const row = hand.slice(r * per, (r + 1) * per);
      const cnt = row.length;
      const step = cnt > 1 ? Math.min(L.cw + 4, span / (cnt - 1)) : 0;
      const x0 = L.W / 2 - (step * (cnt - 1)) / 2;
      const y = L.handBottom - L.ch / 2 - (rows - 1 - r) * (L.ch + 6);
      row.forEach((cd, k) => {
        const ok = interactive && S.canPlay(st, this.me, cd);
        const v = this.card(cd, x0 + k * step, y - (ok ? 6 : 0));
        if (interactive && !ok) v.setAlpha(0.5);
        if (ok) {
          v.setSize(L.cw, L.ch).setInteractive({ useHandCursor: true });
          v.on('pointerup', () => this.tapCard(cd));
        }
        this.handLayer.add(v);
        this.cardViews.push({ card: cd, v });
      });
    }
  }

  sortHand(hand) {
    const ord = { R: 0, Y: 1, G: 2, B: 3 };
    return hand.slice().sort((a, b) => (a.c === null) - (b.c === null) || (ord[a.c] ?? 9) - (ord[b.c] ?? 9) || String(a.v).localeCompare(String(b.v)));
  }

  setInfo(str, color = T.cream) {
    this.infoStr = str; this.infoCol = color;
    this.info.setText(str).setColor(color);
  }

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
      this.setInfo(can.length ? `+${st.pending.amount} AT YOU! STACK/BOUNCE/TAKE` : `+${st.pending.amount} AT YOU. NOTHING TO STACK.`, T.red);
      B.add(button(this, this.L.W - 136, this.L.ctrlY, 128, 42, `TAKE +${st.pending.amount}`, () => this.act({ type: 'take' }), { size: 10, fill: 0x6a2a3a }));
    } else if (st.drew) {
      this.setInfo(can.length ? 'PLAY IT OR PASS.' : 'NOTHING. PASS.', T.cream);
      B.add(button(this, this.L.W - 136, this.L.ctrlY, 128, 42, 'PASS', () => this.act({ type: 'pass' }), { size: 10 }));
    } else {
      this.setInfo(can.length ? 'YOUR TURN. TAP A CARD.' : 'NOTHING TO PLAY. DRAW.', T.gold);
      B.add(button(this, this.L.W - 136, this.L.ctrlY, 128, 42, 'DRAW', () => this.act({ type: 'draw' }), { size: 10, fill: can.length ? C.panelHi : 0x2a5a3a }));
      // tap the draw pile too
      const z = this.add.zone(this.L.draw.x, this.L.draw.y, 50, 70).setInteractive({ useHandCursor: true });
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
    const L = this.L;
    const O = this.add.container(0, 0).setDepth(900);
    this.overlay = O;
    O.add(dimmer(this, 0.6, 0));
    O.add(text(this, L.W / 2, L.cy - 104, 'PICK A COLOUR', { size: 12, ox: 0.5, color: T.gold }));
    S.COLORS.forEach((c, k) => {
      const n = this.st.hands[this.me].filter((x) => x.c === c).length;
      const x = L.W / 2 - 128 + (k % 2) * 132, y = L.cy - 84 + Math.floor(k / 2) * 84;
      O.add(button(this, x, y, 124, 76, S.COLOR_NAMES[c], () => { O.destroy(); this.overlay = null; cb(c); }, { size: 10, fill: CARD_COL[c], sub: `you have ${n}` }));
    });
    O.add(button(this, L.W / 2 - 60, L.cy + 92, 120, 36, 'BACK', () => { O.destroy(); this.overlay = null; }, { size: 8 }));
  }

  pickTarget(cb) {
    const L = this.L;
    const O = this.add.container(0, 0).setDepth(900);
    this.overlay = O;
    O.add(dimmer(this, 0.6, 0));
    O.add(text(this, L.W / 2, L.cy - 110, 'SWAP HANDS WITH WHO?', { size: 10, ox: 0.5, color: T.gold }));
    const others = this.st.seats.filter((s) => s !== this.me);
    others.forEach((s, k) => {
      O.add(button(this, 20, L.cy - 92 + k * 58, L.W - 40, 52, this.name(s).toUpperCase(), () => { O.destroy(); this.overlay = null; cb(s); }, {
        size: 10, sub: `${this.st.hands[s].length} cards`, fill: C.panelHi,
      }));
    });
    O.add(button(this, L.W / 2 - 60, L.cy + 86, 120, 36, 'BACK', () => { O.destroy(); this.overlay = null; }, { size: 8 }));
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
    L.add(this.add.rectangle(this.L.W / 2, this.L.cy, this.L.W - 24, 116, C.ink, 0.8));
    L.add(text(this, this.L.W / 2, this.L.cy - 44, mine ? 'ONE CARD LEFT!' : `${this.name(seat).toUpperCase()} HAS ONE CARD...`, { size: 10, ox: 0.5, color: col, strokeThickness: 4 }));
    const bar = this.add.graphics();
    L.add(bar);
    let result = null;
    const done = new Promise((res) => {
      const finish = (r) => { if (result === null) { result = r; res(r); } };
      if (mine) {
        const b = button(this, this.L.W / 2 - 90, this.L.cy - 28, 180, 56, 'LAST CARD!', () => {
          if (this.role === 'client') { this.net.send({ t: 'last', seat: this.me, seq: this.seq }); b.setEnabled(false); } else finish('called');
        }, { size: 14, fill: 0x8a5a1a, border: C.gold });
        L.add(b);
        this.tweens.add({ targets: b, scale: 1.06, duration: 160, yoyo: true, repeat: -1 });
      } else if (who === 'bot') {
        const ms = S.botLastReaction(rng);
        if (ms !== null && ms <= MS) this.time.delayedCall(ms, () => finish('called'));
      } else if (who === 'remote') {
        if (this.earlyLast[seat] === this.seq) { delete this.earlyLast[seat]; finish('called'); }
        else this.lastWait = { seat, done: () => finish('called') };
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
        bar.fillStyle(C.ink, 1).fillRect(this.L.W / 2 - 92, this.L.cy + 34, 184, 10);
        bar.fillStyle(left > 0.34 ? C.gold : C.red, 1).fillRect(this.L.W / 2 - 90, this.L.cy + 36, 180 * left, 6);
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
    return seat === this.me ? { x: this.L.W / 2, y: this.L.handBottom - this.L.ch / 2 } : { x: f.x, y: f.y - f.h / 2 };
  }

  say(seat, kind) {
    const q = CARD_QUIPS[this.race(seat)];
    if (!q || !q[kind]) return;
    const f = this.faces[seat];
    const x = seat === this.me ? 90 : f.x;
    const y = seat === this.me ? this.L.ctrlY - 4 : f.y + 64;
    bubble(this, x, y, rng.pick(q[kind]), 2000).setDepth(850);
  }

    banner(str, color = T.gold, ms = 900) {
    const t = text(this, this.L.W / 2, this.L.cy + 60, str, { size: 10, ox: 0.5, oy: 0.5, color, strokeThickness: 6, depth: 860, wrap: this.L.W - 20, align: 'center' });
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
      this.flyCard(null, this.L.draw, to, false, 220);
      sfx('step');
      await this.wait(70);
    }
    await this.wait(200);
  }

  async animate(events) {
    this.animating = true;
    try {
      await this.animateAll(events);
    } finally {
      this.animating = false;
      if (this.pendingBuild) { this.pendingBuild = false; this.build(); }
    }
  }

  async animateAll(events) {
    for (const e of events) {
      switch (e.t) {
        case 'play': {
          sfx(S.isPlus(e.card) || e.card.v === 'rbay' ? 'whip' : 'select');
          await this.flyCard(e.card, this.spot(e.seat), this.L.discard);
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
    if (this.role !== 'client') {
      addGold(w, this.pot);
      S.recordWin(this.match, w);
      this.post = { ready: {}, vote: {} };
    }
    if (this.role === 'host') { this.broadcast([]); this.net.setGame(null); }
    this.render();
    this.faces[w].setPose('victory');
    sfx('jackpot');
    this.say(w, 'win');
    await this.wait(1400);
    this.resultsReady = true;
    this.drawResults();
    if (this.role !== 'client') {
      // keep checking: someone might drop out instead of readying up
      this.readyTimer = this.time.addEvent({ delay: 1000, loop: true, callback: () => this.checkReady() });
      if (this.auto) this.time.delayedCall(2500, () => this.setPost('ready', this.me, true));
    }
  }

  // seats played by real people (they ready up and vote; bots don't)
  humans() {
    if (this.role === 'local') return this.auto || this.spectator ? [] : [this.me];
    return this.st.seats.filter((s) => this.net.seats[s]);
  }

  // a tap on READY or SHUFFLE (yours, or a friend's arriving at the host)
  setPost(kind, seat, on) {
    if (!this.post) return;
    if (this.role === 'client') {
      this.net.send({ t: kind, seat, on });
      this.post[kind][seat] = on; // show it straight away; the host confirms
      this.drawResults();
      return;
    }
    this.post[kind][seat] = !!on;
    if (this.role === 'host') this.net.send({ t: 'post', post: this.post, match: this.match });
    this.drawResults();
    this.checkReady();
  }

  checkReady() {
    if (!this.post || this.starting) return;
    const humans = this.humans();
    if (humans.length && !S.allReady(this.post, humans)) return;
    if (!humans.length && !this.auto && this.role !== 'local') return;
    this.starting = true;
    const v = S.voteCount(this.post, humans);
    S.nextRound(this.match, rng, v.passes);
    run.stackMatch = this.match;
    this.time.delayedCall(400, () => this.scene.restart({ net: this.net, returnTo: this.returnTo, shuffled: v.passes, auto: this.auto }));
  }

  drawResults() {
    if (!this.resultsReady) return;
    const st = this.st;
    const w = st.winner;
    const m = this.match;
    const post = this.post || { ready: {}, vote: {} };
    const { W, H } = this.L;
    const humans = this.role === 'client' ? st.seats.filter((x) => this.net.seats[x]) : this.humans();
    this.results?.destroy();
    const R = (this.results = this.add.container(0, 0).setDepth(900));
    const top = Math.max(26, Math.round(H / 2 - 168));
    R.add(dimmer(this, 0.6, 0));
    R.add(panel(this, 8, top, W - 16, 330, { border: C.gold }));
    const champ = m.champion;
    if (champ !== null && champ !== undefined) {
      const f = m.final || m.wins;
      const others = Object.entries(f).filter(([x]) => Number(x) !== champ).map(([, n]) => n);
      R.add(text(this, W / 2, top + 12, `${this.name(champ).toUpperCase()} WINS THE MATCH`, { size: 10, ox: 0.5, color: RACES[this.race(champ)].color, strokeThickness: 4 }));
      R.add(text(this, W / 2, top + 28, `${f[champ]}-${Math.max(...others)}. SCOREBOARD RESETS.`, { size: 8, ox: 0.5, color: T.gold }));
    } else {
      R.add(text(this, W / 2, top + 12, `ROUND ${m.round}: ${this.name(w).toUpperCase()} WINS`, { size: 10, ox: 0.5, color: RACES[this.race(w)].color }));
      R.add(text(this, W / 2, top + 28, `FIRST TO ${S.MATCH_TARGET} WINS, WIN BY ${S.MATCH_BY}`, { size: 8, ox: 0.5, color: T.grey }));
    }
    // scoreboard, best first
    const board = champ !== null && champ !== undefined ? (m.final || m.wins) : m.wins;
    const rank = st.seats.slice().sort((a, b) => (board[b] || 0) - (board[a] || 0) || st.hands[a].length - st.hands[b].length);
    rank.forEach((x, k) => {
      const y = top + 44 + k * 38;
      const f = portraitActor(this, this.race(x), 30, y + 34, { label: false, depth: 905 });
      f.setScale(0.5);
      R.add(f);
      R.add(text(this, 52, y + 8, `${this.name(x)}${x === this.me && !this.spectator ? ' (YOU)' : ''}`, { size: 8, color: RACES[this.race(x)].color }));
      R.add(text(this, 52, y + 22, x === w ? `won the round +${this.pot - ANTE}g` : `${st.hands[x].length} left -${ANTE}g`, { size: 8, color: x === w ? T.gold : T.grey }));
      R.add(text(this, W - 20, y + 8, `${board[x] || 0}`, { size: 14, ox: 1, color: T.gold, strokeThickness: 4 }));
      const isHuman = humans.includes(x);
      const status = !isHuman ? 'BOT' : post.ready[x] ? 'READY' : '...';
      R.add(text(this, W - 20, y + 26, status, { size: 8, ox: 1, color: status === 'READY' ? T.green : T.grey }));
    });
    // ready + shuffle vote
    const by = top + 202;
    const v = S.voteCount(post, humans);
    R.add(text(this, W / 2, by, `SHUFFLE SEATS? ${v.yes}/${v.of} YES (NEED 60%)`, { size: 8, ox: 0.5, color: v.passes ? T.purple : T.cream }));
    if (!this.spectator) {
      const meReady = !!post.ready[this.me], meVote = !!post.vote[this.me];
      R.add(button(this, 18, by + 12, (W - 46) / 2, 44, meVote ? 'SHUFFLE: YES' : 'SHUFFLE: NO', () => this.setPost('vote', this.me, !meVote), {
        size: 8, fill: meVote ? 0x5a2a7a : C.panelHi,
      }));
      R.add(button(this, 28 + (W - 46) / 2, by + 12, (W - 46) / 2, 44, meReady ? 'READY!' : 'READY UP', () => this.setPost('ready', this.me, !meReady), {
        size: 10, fill: meReady ? 0x2a5a3a : 0x6a5a1a,
      }));
    } else {
      R.add(text(this, W / 2, by + 30, 'You are watching this one.', { size: 8, ox: 0.5, color: T.grey }));
    }
    const ly = by + 66;
    if (this.role === 'host') {
      R.add(button(this, W / 2 - 60, ly, 120, 32, 'BACK TO LOBBY', () => { this.net.send({ t: 'tolobby' }); this.scene.start('Lobby'); }, { size: 8 }));
    } else if (this.role === 'client') {
      R.add(button(this, W / 2 - 60, ly, 120, 32, 'LEAVE', () => { this.net.close(); fadeTo(this, 'Lobby'); }, { size: 8 }));
    } else {
      R.add(button(this, W / 2 - 60, ly, 120, 32, 'DONE', () => { run.stackMatch = null; fadeTo(this, this.returnTo); }, { size: 8 }));
    }
  }

  wait(ms) { return new Promise((res) => this.time.delayedCall(ms, res)); }
}
