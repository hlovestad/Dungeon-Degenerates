// ONLINE LOBBY: host a room (get a 4-digit code + a link to text the group),
// or join one. Everyone taps the friend they're playing as; empty seats are
// bots. The host taps START.
//
// ?net=local switches to the same-browser test transport (open more tabs).
// ?room=1234 in the URL joins that room straight away (that's the share link).
import { T, C } from '../config.js';
import { text, panel, button, fadeTo, fadeIn } from '../ui/ui.js';
import { background, portraitActor } from '../ui/stage.js';
import { run } from '../systems/state.js';
import { startArcade } from '../systems/arcade.js';
import { ARCADE_PICKS } from './Arcade.js';
import { RACES, GUESTS } from '../data/races.js';
import { session, hostRoom, joinRoom } from '../net/session.js';
import { sfx, unlockAudio } from '../audio/sfx.js';

const SPOTS = [89, 243, 397, 551];
const netKind = () => (new URLSearchParams(location.search).get('net') === 'local' ? 'local' : 'online');

export class LobbyScene extends Phaser.Scene {
  constructor() { super('Lobby'); }

  create(data = {}) {
    fadeIn(this);
    window.__lobby = this;
    background(this, 'bg_goblin_casino');
    this.add.rectangle(320, 180, 2000, 360, C.ink, 0.55).setDepth(-5);
    this.ui = this.add.container(0, 0).setDepth(10);
    this.offs = [];
    this.events.once('shutdown', () => this.offs.forEach((f) => f()));
    // everyone needs the same party to draw names and portraits
    if (!run || run.mode !== 'arcade') startArcade(ARCADE_PICKS);

    if (session && !session.closed) this.room();
    else if (data.join) this.connect(() => joinRoom(String(data.join), netKind()));
    else this.menu();
  }

  clear() {
    this.ui.removeAll(true);
    this.offs.forEach((f) => f());
    this.offs = [];
  }

  title(str, sub) {
    this.ui.add(text(this, 320, 22, str, { size: 16, ox: 0.5, color: T.gold, strokeThickness: 6 }));
    if (sub) this.ui.add(text(this, 320, 48, sub, { size: 8, ox: 0.5, color: T.grey, align: 'center', wrap: 560 }));
  }

  // ------------------------------------------------------------ menu
  menu(error) {
    this.clear();
    this.title('PLAY ONLINE', 'Everyone on their own phone. Bots fill empty seats.');
    this.ui.add(button(this, 110, 110, 200, 80, 'HOST A ROOM', () => { unlockAudio(); this.connect(() => hostRoom(netKind())); }, {
      size: 12, fill: 0x6a2a3a, sub: 'Get a code to text the group',
    }));
    this.ui.add(button(this, 330, 110, 200, 80, 'JOIN A ROOM', () => { unlockAudio(); this.keypad(); }, {
      size: 12, fill: 0x2a3a6a, sub: 'Type the host\'s code',
    }));
    if (netKind() === 'local') this.ui.add(text(this, 320, 210, 'LOCAL TEST MODE: open more tabs of this page to add players.', { size: 8, ox: 0.5, color: T.blue }));
    if (error) {
      this.ui.add(text(this, 320, 232, error, { size: 8, ox: 0.5, color: T.red, align: 'center', wrap: 560 }));
      if (netKind() !== 'local') {
        this.ui.add(button(this, 220, 262, 200, 34, 'TRY LOCAL TEST MODE', () => { location.search = '?net=local'; }, { size: 8 }));
      }
    }
    this.ui.add(button(this, 12, 312, 100, 36, 'BACK', () => fadeTo(this, 'Title'), { size: 10 }));
  }

  keypad() {
    this.clear();
    this.title('JOIN A ROOM', 'Type the 4-digit code from the host.');
    let code = '';
    const boxes = [0, 1, 2, 3].map((k) => {
      this.ui.add(panel(this, 236 + k * 44, 66, 36, 44, { alpha: 1 }));
      const t = text(this, 254 + k * 44, 88, '', { size: 16, ox: 0.5, oy: 0.5, color: T.gold });
      this.ui.add(t);
      return t;
    });
    const show = () => boxes.forEach((b, k) => b.setText(code[k] || ''));
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'JOIN'];
    keys.forEach((key, k) => {
      const col = k % 3, row = Math.floor(k / 3);
      const b = button(this, 206 + col * 78, 122 + row * 48, 72, 42, key, () => {
        if (key === 'DEL') code = code.slice(0, -1);
        else if (key === 'JOIN') { if (code.length === 4) this.connect(() => joinRoom(code, netKind())); return; }
        else if (code.length < 4) code += key;
        show();
      }, { size: key.length > 1 ? 8 : 14, fill: key === 'JOIN' ? 0x2a5a3a : C.panelHi });
      this.ui.add(b);
    });
    this.ui.add(button(this, 12, 312, 100, 36, 'BACK', () => this.menu(), { size: 10 }));
  }

  async connect(fn) {
    this.clear();
    this.title('CONNECTING...', netKind() === 'local' ? 'Local test mode' : 'Reaching the server');
    try {
      await fn();
      sfx('coin');
      // went straight into a game already running? join it
      this.room();
    } catch (e) {
      console.warn(e);
      this.menu(e.message || 'Could not connect.');
    }
  }

  // ------------------------------------------------------------ the room
  room() {
    this.clear();
    const s = session;
    this.ui.add(text(this, 320, 18, `ROOM ${s.code}`, { size: 20, ox: 0.5, color: T.gold, strokeThickness: 6 }));
    this.ui.add(text(this, 320, 42, s.kind === 'local' ? 'LOCAL TEST MODE (tabs in this browser)' : 'ONLINE', { size: 8, ox: 0.5, color: s.kind === 'local' ? T.blue : T.green }));
    this.ui.add(button(this, 520, 8, 112, 34, 'SHARE LINK', () => this.share(), { size: 8, fill: 0x2a3a6a }));
    this.seatLayer = this.add.container(0, 0).setDepth(20);
    this.ui.add(this.seatLayer);
    this.bottom = this.add.container(0, 0).setDepth(30);
    this.ui.add(this.bottom);
    this.drawSeats();

    this.offs.push(s.on('lobby', () => this.drawSeats()));
    this.offs.push(s.on('lost', (e) => this.lost(e.reason)));
    // client: the host started a game (or one is already running)
    if (!s.isHost && s.game) s.send({ t: 'hello' }); // ask for a snapshot
  }

  drawSeats() {
    const s = session;
    if (!s || !this.seatLayer) return;
    this.seatLayer.removeAll(true);
    const L = this.seatLayer;
    const mine = s.mySeat();
    const friendsFull = s.seats.slice(0, 4).every(Boolean);
    const allFull = s.seats.every(Boolean);
    const msg = mine >= 0 ? 'TAP ANOTHER SEAT TO SWITCH'
      : allFull ? 'EVERY SEAT IS TAKEN. YOU CAN WATCH.'
      : friendsFull ? 'FRIENDS ARE TAKEN. GRAB A GOBLIN SEAT BELOW.'
      : 'TAP THE FRIEND YOU ARE PLAYING AS';
    L.add(text(this, 320, 60, msg, { size: 8, ox: 0.5, color: mine < 0 && friendsFull ? T.gold : T.cream }));
    run.party.slice(0, 4).forEach((h, i) => {
      const p = portraitActor(this, h.race, SPOTS[i], 214, { scale: 2, depth: 21 });
      L.add(p);
      const owner = s.seats[i];
      const label = owner === s.id ? 'YOU' : owner ? 'PLAYER' : 'BOT';
      const col = owner === s.id ? T.gold : owner ? T.green : T.grey;
      L.add(text(this, SPOTS[i], 232, label, { size: 10, ox: 0.5, color: col, strokeThickness: 4 }));
      if (owner === s.id) p.setPose('victory');
      if (owner && owner !== s.id) p.sprite.setAlpha(0.85);
      if (!owner || owner === s.id) {
        const z = this.add.zone(SPOTS[i], 214 - 67, 134, 140).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => { sfx('select'); s.claim(i); });
        L.add(z);
      }
    });
    // goblin guest seats: extra players (5th, 6th). Only in the game if taken.
    L.add(text(this, 150, 268, 'EXTRA\nPLAYERS:', { size: 8, ox: 1, oy: 0.5, color: T.grey, align: 'right', lineSpacing: 4 }));
    GUESTS.forEach((race, k) => {
      const seat = 4 + k;
      const x = 186 + k * 170;
      const p = portraitActor(this, race, x, 286, { scale: 0.5, depth: 21, label: false });
      L.add(p);
      const owner = s.seats[seat];
      const status = owner === s.id ? 'YOU' : owner ? 'PLAYER' : 'OPEN';
      L.add(text(this, x + 24, 262, RACES[race].name.toUpperCase(), { size: 8, color: RACES[race].color }));
      L.add(text(this, x + 24, 276, status, { size: 8, color: owner === s.id ? T.gold : owner ? T.green : T.grey }));
      if (owner === s.id) p.setPose('victory');
      if (!owner || owner === s.id) {
        const z = this.add.zone(x + 50, 268, 130, 40).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => { sfx('select'); s.claim(seat); });
        L.add(z);
      }
    });
    this.drawBottom();
  }

  drawBottom() {
    const s = session;
    const B = this.bottom;
    B.removeAll(true);
    B.add(panel(this, 0, 296, 640, 64, { alpha: 0.9 }));
    const humans = s.humans();
    const bots = s.seats.slice(0, 4).filter((x) => !x).length; // empty friends become bots; empty goblin seats just sit out
    B.add(text(this, 132, 312, `${humans} PLAYER${humans === 1 ? '' : 'S'} + ${bots} BOT${bots === 1 ? '' : 'S'}`, { size: 8, color: T.cream }));
    B.add(button(this, 12, 304, 104, 48, 'LEAVE', () => { s.close(); this.menu(); }, { size: 10 }));
    if (s.isHost) {
      const ok = s.mySeat() >= 0;
      const a = button(this, 312, 302, 162, 52, 'ARCADE NIGHT', () => this.start('arcade'), { size: 10, fill: 0x6a2a3a, sub: ok ? '8 games, all of them' : 'Pick your friend first' });
      const b = button(this, 480, 302, 154, 52, 'STACK ATTACK', () => this.start('stack'), { size: 10, fill: 0x2a5a3a, sub: ok ? 'just cards' : 'Pick your friend first' });
      a.setEnabled(ok);
      b.setEnabled(ok);
      B.add([a, b]);
      B.add(text(this, 132, 332, 'Then pick a mode.', { size: 8, color: T.grey }));
    } else {
      B.add(text(this, 132, 332, s.mySeat() < 0 ? 'Pick your friend.' : 'Waiting for the host to start...', { size: 8, color: T.grey }));
    }
  }

  start(what) {
    sfx('jackpot');
    run.stackMatch = null; // fresh scoreboard
    if (what === 'arcade') this.scene.start('Arcade', { net: session, fresh: true });
    else this.scene.start('Stack', { net: session });
  }

  share() {
    const s = session;
    const url = `${location.origin}${location.pathname}?room=${s.code}${s.kind === 'local' ? '&net=local' : ''}`;
    const msg = `Dungeon Degenerates room ${s.code}: ${url}`;
    const done = (str) => {
      const t = text(this, 576, 50, str, { size: 8, ox: 0.5, color: T.green, depth: 40 });
      this.time.delayedCall(1800, () => t.destroy());
    };
    if (navigator.share) navigator.share({ title: 'Dungeon Degenerates', text: msg, url }).then(() => done('SHARED'), () => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => done('LINK COPIED'), () => done(url));
    else done(url);
  }

  lost(reason) {
    session?.close();
    this.menu(reason);
  }
}
