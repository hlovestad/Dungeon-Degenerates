// ARCADE: party night. The friends hang out in the goblin arcade (always on
// screen), spin for a minigame, play it, and come back here. Between games
// they talk trash, wander off for their running gags, and the arcade does
// something stupid. Most games won after the last one wins the night.
//
// Local (one phone, bots) or ONLINE: the host phone runs the night (spins,
// events, chatter, scores) and every phone sees the same thing. Whoever's turn
// it is to pick spins from their own phone; bots pick for themselves.
import { T, C } from '../config.js';
import { text, panel, button, iconButton, fadeTo, fadeIn, dimmer, bubble } from '../ui/ui.js';
import { background, portraitActor, spawnDaniPortrait } from '../ui/stage.js';
import { run, rng, ensureGuest } from '../systems/state.js';
import * as A from '../systems/arcade.js';
import { RACES, GUESTS } from '../data/races.js';
import { fitHeight, faceKey } from '../art/assets.js';
import { sfx, toggleMute, isMuted, unlockAudio } from '../audio/sfx.js';
import { playInterlude, speak } from '../ui/interlude.js';
import { playChaos } from '../ui/chaos.js';
import { openCardMenu } from '../ui/cardMenu.js';
import { THEMES, COUNTS, questionPool } from '../data/trivia/index.js';

export const ARCADE_PICKS = ['haakon', 'mike', 'josh', 'griffin'].map((race) => ({
  race, cls: { haakon: 'juggernaut', mike: 'goblin_king', josh: 'cosmic_oracle', griffin: 'hellbound_gambler' }[race],
}));

export class ArcadeScene extends Phaser.Scene {
  constructor() { super('Arcade'); }

  create(data = {}) {
    window.__arcade = this;
    this.net = data.net || null;
    this.role = !this.net ? 'local' : this.net.isHost ? 'host' : 'client';
    this.offs = [];
    this.over = false; // (Phaser reuses this object: reset per visit)
    this.menu = null;
    this.spinBox = null;
    this.triviaWait = null;
    this.idle = 0;
    this.busy = false;
    this.events.once('shutdown', () => { this.offs.forEach((f) => f()); if (this.role === 'host') this.net.snapshot = null; });
    let items = [];

    if (this.role === 'client') {
      this.applyHub(data.init.hub);
      items = data.init.items || [];
    } else {
      if (data.fresh || !A.isArcade()) A.startArcade(data.picks || ARCADE_PICKS, { games: data.games || 8, only: data.only || null });
      // online: goblin guests who joined the room play the whole night too
      const guests = this.net ? GUESTS.map((_, k) => 4 + k).filter((g) => this.net.seats[g]) : [];
      guests.forEach((g) => ensureGuest(g, GUESTS[g - 4]));
      run.arcade.seats = run.arcade.seats && !data.fresh ? run.arcade.seats : [0, 1, 2, 3, ...guests];
      items = A.finishGame(); // coming back from a game? settle it
    }
    this.me = this.net ? this.net.mySeat() : 0;
    this.seats = run.arcade.seats || [0, 1, 2, 3];

    fadeIn(this);
    background(this, 'bg_goblin_casino');
    this.busy = false;

    // the friends: big framed portraits (the arcade never uses full bodies)
    const n = this.seats.length;
    const scale = n > 4 ? 1 : 2;
    const gap = n > 4 ? 600 / n : 154;
    this.actors = {};
    this.seats.forEach((s, k) => {
      const x = Math.round(320 - (gap * (n - 1)) / 2 + k * gap);
      this.actors[s] = portraitActor(this, run.party[s].race, x, n > 4 ? 200 : 236, { scale, depth: 40 + k });
      if (s === this.me && this.net) this.add.text(x, (n > 4 ? 200 : 236) + 22, 'YOU', { fontFamily: 'PressStart', fontSize: '8px', color: T.gold }).setOrigin(0.5, 0).setDepth(41);
    });
    const g = this.seats.find((s) => run.party[s].race === 'griffin');
    if (g !== undefined) this.dani = spawnDaniPortrait(this, this.actors[g], scale === 2 ? 1 : 0.5);

    this.hud = this.add.container(0, 0).setDepth(25);
    this.drawHud();
    panel(this, 150, 49, 340, 20, { alpha: 0.85 }).setDepth(25);
    this.info = text(this, 320, 59, '', { size: 8, ox: 0.5, oy: 0.5, color: T.cream, depth: 26 });
    this.refreshInfo();

    this.bar = this.add.container(0, 0).setDepth(60);
    this.drawBar();
    const mute = iconButton(this, 604, 312, isMuted() ? 'x' : '♪', () => { unlockAudio(); mute.setLabel(toggleMute() ? 'x' : '♪'); }, 61);

    if (this.role === 'host') this.hostSetup(items);
    if (this.role === 'client') this.clientSetup();

    if (items.length) this.time.delayedCall(450, () => this.settle(items));
    else this.time.delayedCall(700, () => this.greet());

    // random chatter while nobody's doing anything (the host decides for everyone)
    if (this.role !== 'client') this.chatTimer = this.time.addEvent({ delay: 6500, loop: true, callback: () => this.chatter() });
  }

  // ------------------------------------------------------------ online plumbing
  hubState() {
    return {
      arcade: JSON.parse(JSON.stringify(run.arcade)),
      party: run.party.map((h) => ({ race: h.race, gold: h.gold, crowns: h.crowns, cards: h.cards.slice() })),
    };
  }

  applyHub(hub) {
    if (!run || run.mode !== 'arcade') A.startArcade(ARCADE_PICKS);
    run.arcade = hub.arcade;
    hub.party.forEach((p, i) => {
      if (!p) return;
      if (!run.party[i]) ensureGuest(i, p.race);
      Object.assign(run.party[i], { gold: p.gold, crowns: p.crowns, cards: p.cards });
    });
  }

  hostSetup(items) {
    const n = this.net;
    n.setGame('arcade');
    n.snapshot = () => ({ scene: 'Arcade', init: { hub: this.hubState(), items: [] } });
    n.send({ t: 'go', scene: 'Arcade', init: { hub: this.hubState(), items } });
    this.offs.push(n.on('hubact', (m) => {
      if (m.kind === 'trivia' && this.triviaWait && m.seat === run.arcade.picker) { this.triviaWait({ theme: m.theme, count: m.count }); return; }
      if (this.busy || m.seat !== run.arcade.picker) return;
      if (m.kind === 'spin') this.spin();
      else if (m.kind === 'pick') { const g = A.gameById(m.game); if (g) this.choose(g); }
    }));
    this.offs.push(n.on('lost', (e) => this.lost(e.reason)));
    // a bot's turn to pick: it spins by itself after a moment
    this.autoTimer = this.time.addEvent({ delay: 1000, loop: true, callback: () => this.autoPick() });
  }

  clientSetup() {
    const n = this.net;
    this.offs.push(n.on('say', (m) => {
      if (m.chaos) this.chaos(m.chaos);
      else speak(this, m.who, m.line, this.iopts());
    }));
    this.offs.push(n.on('hubspin', (m) => this.showSpin(A.gameById(m.game), m.picked)));
    this.offs.push(n.on('hubtrivia', () => {
      if (run.arcade.picker === this.me) this.triviaMenu((o) => this.net.send({ t: 'hubact', seat: this.me, kind: 'trivia', ...o }));
      else this.waitNote(`${run.party[run.arcade.picker].name.toUpperCase()} IS PICKING A TRIVIA THEME...`);
    }));
    this.offs.push(n.on('lost', (e) => this.lost(e.reason)));
  }

  isHuman(seat) { return this.net ? !!this.net.seats[seat] : seat === 0; }
  myTurn() { return this.net ? run.arcade.picker === this.me : true; }

  autoPick() {
    if (this.busy || this.over || this.isHuman(run.arcade.picker)) { this.idle = 0; return; }
    this.idle = (this.idle || 0) + 1;
    if (this.idle >= 3) { this.idle = 0; this.spin(); }
  }

  lost(reason) {
    const L = this.add.container(0, 0).setDepth(990);
    L.add(dimmer(this, 0.7, 0));
    L.add(text(this, 320, 150, reason || 'Connection lost.', { size: 12, ox: 0.5, color: T.red }));
    L.add(button(this, 245, 190, 150, 40, 'BACK', () => { this.net.close(); this.scene.start('Lobby'); }, { size: 10 }));
  }

  // ------------------------------------------------------------ HUD
  drawHud() {
    this.hud.removeAll(true);
    const L = this.hud;
    const lead = A.ranking()[0];
    const n = this.seats.length;
    const w = Math.min(152, Math.floor(628 / n) - 5);
    this.seats.forEach((i, k) => {
      const h = run.party[i];
      const x = 6 + k * (w + 5);
      const top = lead && lead.i === i && h.crowns > 0;
      L.add(panel(this, x, 4, w, 42, { alpha: 0.92, border: top ? C.gold : C.border, fill: top ? 0x3b2a52 : C.panel }));
      const s = this.add.image(x + 15, 43, faceKey(this, h.race)).setOrigin(0.5, 1);
      fitHeight(s, 36);
      L.add(s);
      L.add(text(this, x + 32, 9, h.name.toUpperCase() + (run.arcade.picker === i ? ' *' : ''), { size: 8, color: RACES[h.race].color }));
      L.add(this.add.image(x + 38, 31, 'icon_gold_coin').setScale(0.75));
      L.add(text(this, x + 48, 26, String(h.gold), { size: 8, color: T.gold }));
      if (w >= 110) {
        L.add(this.add.image(x + 92, 31, 'icon_crown').setScale(0.75));
        L.add(text(this, x + 102, 26, String(h.crowns), { size: 8, color: T.white }));
        if (!this.net) L.add(text(this, x + 128, 26, `C${h.cards.length}`, { size: 8, color: T.purple }));
      } else {
        L.add(text(this, x + w - 6, 26, `${h.crowns}W`, { size: 8, ox: 1, color: T.white }));
      }
    });
  }

  refreshInfo() {
    const a = run.arcade;
    const n = Math.min(a.round + 1, a.total);
    const pot = a.pot ? `   POT ${a.pot}g` : '';
    const what = a.only === 'trivia' ? 'TRIVIA ROUND' : 'GAME';
    this.info.setText(a.round >= a.total ? 'THAT WAS THE LAST ONE' : `${what} ${n} OF ${a.total}   ${run.party[a.picker].name.toUpperCase()} PICKS${pot}`);
  }

  drawBar() {
    this.bar.removeAll(true);
    const B = this.bar;
    B.add(panel(this, -200, 296, 1040, 64, { alpha: 0.9 }));
    const over = run.arcade.round >= run.arcade.total;
    if (over) return;
    const who = run.party[run.arcade.picker].name.toUpperCase();
    if (this.myTurn() && run.arcade.only === 'trivia') {
      B.add(button(this, 8, 302, 356, 52, 'PICK THE TRIVIA THEME', () => this.tapSpin(), { size: 12, fill: 0x2a3a6a, sub: 'and how many questions' }));
    } else if (this.myTurn()) {
      B.add(button(this, 8, 302, 200, 52, 'SPIN', () => this.tapSpin(), { size: 14, fill: 0x6a2a3a, sub: this.net ? 'your pick: spin for it' : `${who} spins the wheel` }));
      B.add(button(this, 214, 302, 150, 52, 'PICK GAME', () => this.pickMenu(), { size: 10, fill: 0x2a3a6a, sub: this.net ? 'or choose one' : `${who} chooses` }));
    } else {
      B.add(text(this, 20, 328, this.isHuman(run.arcade.picker) ? `${who} IS PICKING THE NEXT GAME...` : `${who} (BOT) IS PICKING...`, { size: 10, oy: 0.5, color: RACES[run.party[run.arcade.picker].race].color }));
    }
    if (!this.net) {
      const n = run.party.reduce((k, h) => k + h.cards.length, 0);
      B.add(button(this, 370, 302, 150, 52, 'DIRTY CARDS', () => this.cards(), { size: 10, fill: 0x4a2a5a, sub: `${n} in play` }));
    }
    if (this.role !== 'client') B.add(button(this, 526, 302, 68, 52, this.net ? 'END' : 'QUIT', () => this.quit(), { size: 8 }));
    else B.add(button(this, 526, 302, 68, 52, 'LEAVE', () => { this.net.close(); this.scene.start('Lobby'); }, { size: 8 }));
  }

  quit() {
    if (this.net) { this.net.send({ t: 'tolobby' }); this.net.setGame(null); this.scene.start('Lobby'); }
    else fadeTo(this, 'Title');
  }

  setBusy(b) {
    this.busy = b;
    this.bar.setVisible(!b);
  }

  // ------------------------------------------------------------ chatter
  greet() {
    if (run.arcade.round === 0 && this.role !== 'client') {
      this.say(this.seats[0], rng.pick(['Welcome to the goblin arcade, degenerates.', 'Eight games. Winner gets bragging rights forever.', "Who's ready to lose?"]));
    }
  }

  // host/local: say something, and tell the other phones
  say(who, line) {
    speak(this, who, line, this.iopts());
    if (this.role === 'host') this.net.send({ t: 'say', who, line });
  }

  chatter() {
    if (this.busy || this.chaosRunning || this.over) return;
    if (this.dani && rng.chance(0.08)) { this.say('dani', A.daniLine()); return; }
    if (rng.chance(0.65)) {
      const c = A.chatter();
      if (this.seats.includes(c.who)) this.say(c.who, c.line);
    }
    // very rarely, chaos just happens on its own
    if (rng.chance(0.04)) {
      const id = A.pickChaos();
      if (this.role === 'host') this.net.send({ t: 'say', chaos: id });
      this.chaos(id);
    }
  }

  iopts() {
    return {
      actorOf: (i) => this.actors[i],
      actors: [...Object.values(this.actors), this.dani].filter(Boolean),
      dani: this.dani,
      onGold: () => { this.drawHud(); this.refreshInfo(); },
    };
  }

  async chaos(id) {
    this.setBusy(true);
    await playChaos(this, id, { actors: this.iopts().actors });
    this.setBusy(false);
  }

  // ------------------------------------------------------------ after a game
  async settle(items) {
    this.setBusy(true);
    const res = items.find((x) => x.type === 'result');
    if (res) await this.showResult(res);
    const pot = items.find((x) => x.type === 'pot');
    if (pot && this.actors[pot.to]) {
      bubble(this, this.actors[pot.to].x, 100, `+${pot.amt}g from the goblin pot!`, 1800);
      await this.wait(1200);
    }
    await playInterlude(this, items.filter((x) => ['quip', 'event', 'chaos'].includes(x.type)), this.iopts());
    this.drawHud();
    this.refreshInfo();
    const over = items.find((x) => x.type === 'over');
    if (over) { this.final(over.ranking); return; }
    this.drawBar();
    this.setBusy(false);
  }

  async showResult(r) {
    const game = A.gameById(run.arcade.lastGame);
    const L = this.add.container(0, 0).setDepth(850);
    if (r.winner !== null && run.party[r.winner]) {
      const w = run.party[r.winner];
      sfx('win');
      const t = text(this, 320, 120, `${w.name.toUpperCase()} WINS ${game ? game.name : ''}!`, { size: 14, ox: 0.5, color: RACES[w.race].color, strokeThickness: 6, wrap: 600, align: 'center' });
      t.setScale(0.3);
      this.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.Out' });
      L.add(t);
      L.add(text(this, 320, 146, '+1 CROWN', { size: 10, ox: 0.5, color: T.gold, strokeThickness: 4 }));
      const a = this.actors[r.winner];
      if (a) {
        a.setPose('victory');
        this.tweens.add({ targets: a, y: a.y - 8, duration: 160, yoyo: true, repeat: 2, ease: 'Quad.Out' });
      }
      if (r.loser !== null && r.loser !== r.winner) this.actors[r.loser]?.setPose('hurt');
    } else {
      L.add(text(this, 320, 130, 'NOBODY WON. THE GOBLINS KEEP IT ALL.', { size: 10, ox: 0.5, color: T.grey, strokeThickness: 4 }));
      sfx('lose');
    }
    // everyone's take from that game
    r.deltas.forEach((d, i) => {
      const a = this.actors[i];
      if (!d || !a) return;
      const f = text(this, a.x, a.y - a.h - 8, `${d > 0 ? '+' : ''}${d}g`, { size: 10, ox: 0.5, oy: 1, color: d > 0 ? T.gold : T.red, strokeThickness: 4 });
      L.add(f);
    });
    this.drawHud();
    await this.wait(2200);
    Object.values(this.actors).forEach((a) => a.setPose('idle'));
    this.tweens.add({ targets: L, alpha: 0, duration: 250, onComplete: () => L.destroy() });
    await this.wait(260);
  }

  // ------------------------------------------------------------ picking a game
  tapSpin() {
    if (this.busy) return;
    unlockAudio();
    if (run.arcade.only === 'trivia' && this.role === 'host') { this.choose(A.gameById('trivia')); return; }
    if (this.role === 'client') { this.net.send({ t: 'hubact', seat: this.me, kind: 'spin' }); this.bar.setVisible(false); return; }
    this.spin();
  }

  // host / local: decide the game, show the spin everywhere, then go
  spin() {
    if (this.busy) return;
    const pick = A.spinGame();
    if (this.role === 'host') this.net.send({ t: 'hubspin', game: pick.id });
    this.showSpin(pick, false).then(() => this.prelaunch(pick));
  }

  choose(game) {
    if (this.busy) return;
    if (this.role === 'host') this.net.send({ t: 'hubspin', game: game.id, picked: true });
    this.showSpin(game, true).then(() => this.prelaunch(game));
  }

  // Trivia needs a theme + length first, chosen by whoever's picking.
  prelaunch(game) {
    if (game.id !== 'trivia' || !this.net) { this.launch(game); return; }
    const picker = run.arcade.picker;
    const go = (o) => { this.triviaWait = null; this.closeMenu(); this.launch(game, o); };
    if (!this.isHuman(picker)) {
      // a bot picks: usually everything, sometimes a theme
      const themed = THEMES.filter((t) => t.qs && t.qs.length >= 10);
      go({ theme: rng.chance(0.5) ? 'mixed' : rng.pick(themed).id, count: rng.pick([10, 10, 15]) });
      return;
    }
    this.triviaWait = go;
    this.net.send({ t: 'hubtrivia' });
    if (picker === this.me) this.triviaMenu(go);
    else this.waitNote(`${run.party[picker].name.toUpperCase()} IS PICKING A TRIVIA THEME...`);
    // nobody answers in 30s: everything, 10 questions
    this.time.delayedCall(30000, () => { if (this.triviaWait === go) go({ theme: 'mixed', count: 10 }); });
  }

  waitNote(str) {
    this.closeMenu();
    const L = (this.menu = this.add.container(0, 0).setDepth(900));
    L.add(panel(this, 120, 140, 400, 60, { border: C.gold }));
    L.add(text(this, 320, 170, str, { size: 8, ox: 0.5, oy: 0.5, color: T.cream, wrap: 380, align: 'center' }));
  }

  closeMenu() { this.menu?.destroy(); this.menu = null; this.spinBox?.destroy(); this.spinBox = null; }

  triviaMenu(cb) {
    this.closeMenu();
    this.setBusy(true);
    const L = (this.menu = this.add.container(0, 0).setDepth(900));
    let theme = this.lastTheme || 'mixed', count = this.lastCount || 10;
    const draw = () => {
      L.removeAll(true);
      L.add(dimmer(this, 0.75, 0));
      L.add(panel(this, 8, 8, 624, 344));
      L.add(text(this, 320, 20, 'SKULL TRIVIA: PICK A THEME', { size: 12, ox: 0.5, color: T.gold }));
      THEMES.forEach((t, i) => {
        const col = i % 5, row = Math.floor(i / 5);
        const n = t.qs ? t.qs.length : questionPool('mixed').length;
        L.add(button(this, 18 + col * 122, 40 + row * 54, 116, 48, t.name, () => { theme = t.id; sfx('select'); draw(); }, {
          size: 8, sub: `${n} questions`, fill: theme === t.id ? 0x5a3f7a : C.panelHi,
        }));
      });
      L.add(text(this, 18, 270, 'QUESTIONS:', { size: 8, oy: 0.5, color: T.cream }));
      COUNTS.forEach((c, k) => {
        L.add(button(this, 110 + k * 66, 252, 60, 36, String(c), () => { count = c; sfx('select'); draw(); }, { size: 10, fill: count === c ? 0x2a5a3a : C.panelHi }));
      });
      L.add(button(this, 400, 300, 220, 44, 'START TRIVIA', () => {
        this.lastTheme = theme; this.lastCount = count;
        this.closeMenu();
        cb({ theme, count });
      }, { size: 10, fill: 0x2a5a3a }));
    };
    draw();
  }

  showSpin(pick, picked) {
    this.setBusy(true);
    return new Promise((done) => {
      this.spinBox?.destroy();
      const L = (this.spinBox = this.add.container(0, 0).setDepth(850));
      L.add(panel(this, 150, 110, 340, 80, { border: C.gold }));
      L.add(text(this, 320, 122, `${run.party[run.arcade.picker].name.toUpperCase()} ${picked ? 'PICKS' : 'SPINS'}...`, { size: 8, ox: 0.5, color: T.grey }));
      const name = text(this, 320, 154, '', { size: 14, ox: 0.5, oy: 0.5, color: T.gold });
      L.add(name);
      const names = A.ARCADE_GAMES.map((g) => g.name);
      let k = Math.floor(Math.random() * names.length);
      const steps = picked ? 1 : 18;
      let n = 0;
      const tick = () => {
        n++;
        name.setText(n >= steps ? pick.name : names[k++ % names.length]);
        sfx(n >= steps ? 'jackpot' : 'step');
        if (n < steps) this.time.delayedCall(50 + n * n * 1.1, tick);
        else {
          this.tweens.add({ targets: name, scale: 1.25, duration: 160, yoyo: true });
          this.time.delayedCall(1100, done);
        }
      };
      tick();
    });
  }

  pickMenu() {
    if (this.busy) return;
    this.setBusy(true);
    sfx('select');
    const L = this.add.container(0, 0).setDepth(900);
    L.add(dimmer(this, 0.7, 0));
    L.add(panel(this, 16, 16, 608, 328));
    L.add(text(this, 320, 28, `${run.party[run.arcade.picker].name.toUpperCase()} PICKS THE GAME`, { size: 12, ox: 0.5, color: T.gold }));
    A.ARCADE_GAMES.forEach((g, i) => {
      const col = i % 5, row = Math.floor(i / 5);
      const b = button(this, 24 + col * 120, 52 + row * 76, 112, 68, g.name, () => {
        L.destroy();
        if (this.role === 'client') { this.net.send({ t: 'hubact', seat: this.me, kind: 'pick', game: g.id }); return; }
        this.setBusy(false);
        this.choose(g);
      }, {
        size: 8, sub: this.net ? (g.id === 'wheel' ? 'picker spins' : 'everyone plays') : g.solo ? `${run.party[run.arcade.picker].name} plays` : 'everyone plays',
        fill: g.id === run.arcade.lastGame ? 0x2a2a3a : C.panelHi,
      });
      L.add(b);
    });
    L.add(button(this, 250, 286, 140, 40, 'BACK', () => { L.destroy(); this.setBusy(false); }, { size: 10 }));
  }

  launch(game, opts) {
    A.beginGame(game);
    sfx('select');
    if (this.role === 'host') {
      // everyone's phone follows the host into the game
      if (game.id === 'stack') this.scene.start('Stack', { net: this.net, arcade: true, returnTo: 'Arcade' });
      else this.scene.start('PartyGame', { net: this.net, game: game.id, seats: this.seats, opts });
      return;
    }
    if (this.role === 'client') return; // the host moves us
    fadeTo(this, game.scene, { ...game.data, returnTo: 'Arcade' });
  }

  cards() {
    if (this.busy) return;
    openCardMenu(this, () => this.scene.restart({}));
  }

  // ------------------------------------------------------------ end of the night
  final(ranking) {
    this.over = true;
    this.chatTimer?.remove();
    const L = this.add.container(0, 0).setDepth(900);
    L.add(dimmer(this, 0.6, 0));
    L.add(panel(this, 110, 40, 420, 268, { border: C.gold }));
    const rk = ranking.filter((r) => this.seats.includes(r.i));
    const champ = run.party[rk[0].i];
    L.add(text(this, 320, 52, 'END OF THE NIGHT', { size: 12, ox: 0.5, color: T.gold }));
    L.add(text(this, 320, 72, `${champ.name.toUpperCase()} IS THE BIGGEST DEGENERATE`, { size: 8, ox: 0.5, color: RACES[champ.race].color }));
    rk.forEach((r, k) => {
      const h = run.party[r.i];
      const y = 88 + k * (rk.length > 4 ? 32 : 40);
      const s = this.add.image(150, y + 30, faceKey(this, h.race)).setOrigin(0.5, 1);
      fitHeight(s, 28);
      L.add(s);
      L.add(text(this, 176, y + 10, `${k + 1}. ${h.name}`, { size: 10, color: RACES[h.race].color }));
      L.add(text(this, 500, y + 10, `${r.crowns} crowns  ${r.gold}g`, { size: 8, ox: 1, color: T.gold }));
    });
    this.actors[rk[0].i]?.setPose('victory');
    sfx('jackpot');
    if (this.role !== 'client') this.say(rk[0].i, A.say(rk[0].i, 'win'));
    if (this.role === 'client') {
      L.add(text(this, 320, 322, 'Waiting for the host...', { size: 8, ox: 0.5, color: T.grey }));
    } else {
      L.add(button(this, 160, 312, 150, 40, 'PLAY AGAIN', () => (this.net ? this.scene.start('Arcade', { net: this.net, fresh: true }) : fadeTo(this, 'Arcade', { fresh: true })), { size: 10, fill: 0x2a5a3a }));
      L.add(button(this, 330, 312, 150, 40, this.net ? 'LOBBY' : 'TITLE', () => this.quit(), { size: 10 }));
    }
  }

  wait(ms) { return new Promise((res) => this.time.delayedCall(ms, res)); }
}
