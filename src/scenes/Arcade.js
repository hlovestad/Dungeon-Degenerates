// ARCADE: party night. The four friends hang out in the goblin arcade (always
// on screen), spin for a minigame, play it, and come back here. Between games
// they talk trash, wander off for their running gags, and the arcade does
// something stupid. Most games won after the last one wins the night.
import { T, C, SPRITE_HEIGHT } from '../config.js';
import { text, panel, button, iconButton, fadeTo, fadeIn, dimmer, bubble } from '../ui/ui.js';
import { background, actor } from '../ui/stage.js';
import { run, rng } from '../systems/state.js';
import * as A from '../systems/arcade.js';
import { RACES } from '../data/races.js';
import { fitHeight, poseKey, isReal } from '../art/assets.js';
import { sfx, toggleMute, isMuted, unlockAudio } from '../audio/sfx.js';
import { playInterlude, speak } from '../ui/interlude.js';
import { playChaos } from '../ui/chaos.js';
import { openCardMenu } from '../ui/cardMenu.js';

// Where each seat stands. The two on the right turn to face the room.
const SPOTS = [
  { x: 105, y: 272 },
  { x: 245, y: 252 },
  { x: 395, y: 252, flip: true },
  { x: 535, y: 272, flip: true },
];
export const ARCADE_PICKS = ['haakon', 'mike', 'josh', 'griffin'].map((race) => ({
  race, cls: { haakon: 'juggernaut', mike: 'goblin_king', josh: 'cosmic_oracle', griffin: 'hellbound_gambler' }[race],
}));

export class ArcadeScene extends Phaser.Scene {
  constructor() { super('Arcade'); }

  create(data = {}) {
    if (data.fresh || !A.isArcade()) A.startArcade(data.picks || ARCADE_PICKS, { games: data.games || 8 });
    window.__arcade = this;
    fadeIn(this);
    background(this, 'bg_goblin_casino');
    this.busy = false;

    // the friends, standing around
    this.actors = run.party.map((h, i) => {
      const s = SPOTS[i];
      const a = actor(this, h.race, s.x, s.y, SPRITE_HEIGHT.hero, { flip: !!s.flip });
      return a;
    });
    const g = run.party.findIndex((h) => h.race === 'griffin');
    if (g >= 0) {
      const ga = this.actors[g];
      const side = SPOTS[g].flip ? 1 : -1; // Dani hovers behind him
      const hover = isReal('dani_idle') ? 16 : 14;
      this.dani = actor(this, 'dani', ga.x + side * Math.max(30, ga.sprite.displayWidth * 0.45), ga.y - 6, SPRITE_HEIGHT.companion, { flip: !!SPOTS[g].flip, float: hover, depth: ga.y - 7 });
    }

    this.hud = this.add.container(0, 0).setDepth(25);
    this.drawHud();
    panel(this, 150, 49, 340, 20, { alpha: 0.85 }).setDepth(25);
    this.info = text(this, 320, 59, '', { size: 8, ox: 0.5, oy: 0.5, color: T.cream, depth: 26 });
    this.refreshInfo();

    this.bar = this.add.container(0, 0).setDepth(60);
    this.drawBar();
    const mute = iconButton(this, 604, 312, isMuted() ? 'x' : '♪', () => { unlockAudio(); mute.setLabel(toggleMute() ? 'x' : '♪'); }, 61);

    // coming back from a game? settle it, then let the chaos happen
    const items = A.finishGame();
    if (items.length) this.time.delayedCall(450, () => this.settle(items));
    else this.time.delayedCall(700, () => this.greet());

    // random chatter while nobody's doing anything
    this.chatTimer = this.time.addEvent({ delay: 6500, loop: true, callback: () => this.chatter() });
  }

  // ------------------------------------------------------------ HUD
  drawHud() {
    this.hud.removeAll(true);
    const L = this.hud;
    const lead = A.ranking()[0];
    run.party.forEach((h, i) => {
      const x = 6 + i * 157, w = 152;
      const top = lead && lead.i === i && h.crowns > 0;
      L.add(panel(this, x, 4, w, 42, { alpha: 0.92, border: top ? C.gold : C.border, fill: top ? 0x3b2a52 : C.panel }));
      const pk = isReal(`${h.race}_portrait`) ? `${h.race}_portrait` : poseKey(this, h.race, 'idle');
      const s = this.add.image(x + 15, 43, pk).setOrigin(0.5, 1);
      fitHeight(s, 36);
      L.add(s);
      L.add(text(this, x + 32, 9, h.name.toUpperCase() + (run.arcade.picker === i ? ' *' : ''), { size: 8, color: RACES[h.race].color }));
      L.add(this.add.image(x + 38, 31, 'icon_gold_coin').setScale(0.75));
      L.add(text(this, x + 48, 26, String(h.gold), { size: 8, color: T.gold }));
      L.add(this.add.image(x + 92, 31, 'icon_crown').setScale(0.75));
      L.add(text(this, x + 102, 26, String(h.crowns), { size: 8, color: T.white }));
      L.add(text(this, x + 128, 26, `C${h.cards.length}`, { size: 8, color: T.purple }));
    });
  }

  refreshInfo() {
    const a = run.arcade;
    const n = Math.min(a.round + 1, a.total);
    const pot = a.pot ? `   POT ${a.pot}g` : '';
    this.info.setText(a.round >= a.total ? 'THAT WAS THE LAST GAME' : `GAME ${n} OF ${a.total}   ${run.party[a.picker].name.toUpperCase()} SPINS${pot}`);
  }

  drawBar() {
    this.bar.removeAll(true);
    const B = this.bar;
    B.add(panel(this, 0, 296, 640, 64, { alpha: 0.9 }));
    const over = run.arcade.round >= run.arcade.total;
    if (over) return;
    const who = run.party[run.arcade.picker].name.toUpperCase();
    B.add(button(this, 8, 302, 200, 52, 'SPIN', () => this.spin(), { size: 14, fill: 0x6a2a3a, sub: `${who} spins the wheel` }));
    B.add(button(this, 214, 302, 150, 52, 'PICK GAME', () => this.pickMenu(), { size: 10, fill: 0x2a3a6a, sub: `${who} chooses` }));
    const n = run.party.reduce((k, h) => k + h.cards.length, 0);
    B.add(button(this, 370, 302, 150, 52, 'DIRTY CARDS', () => this.cards(), { size: 10, fill: 0x4a2a5a, sub: `${n} in play` }));
    B.add(button(this, 526, 302, 68, 52, 'QUIT', () => fadeTo(this, 'Title'), { size: 8 }));
  }

  setBusy(b) {
    this.busy = b;
    this.bar.setVisible(!b);
  }

  // ------------------------------------------------------------ chatter
  greet() {
    if (run.arcade.round === 0) {
      speak(this, 0, rng.pick(['Welcome to the goblin arcade, degenerates.', 'Eight games. Winner gets bragging rights forever.', "Who's ready to lose?"]), this.iopts());
    }
  }

  chatter() {
    if (this.busy || this.chaosRunning) return;
    if (this.dani && rng.chance(0.08)) { speak(this, 'dani', A.daniLine(), this.iopts()); return; }
    if (rng.chance(0.65)) {
      const c = A.chatter();
      speak(this, c.who, c.line, this.iopts());
    }
    // very rarely, chaos just happens on its own
    if (rng.chance(0.04)) this.chaos(A.pickChaos());
  }

  iopts() {
    return {
      actorOf: (i) => this.actors[i],
      actors: [...this.actors, this.dani].filter(Boolean),
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
    if (pot) {
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
    if (r.winner !== null) {
      const w = run.party[r.winner];
      sfx('win');
      const t = text(this, 320, 120, `${w.name.toUpperCase()} WINS ${game ? game.name : ''}!`, { size: 14, ox: 0.5, color: RACES[w.race].color, strokeThickness: 6, wrap: 600, align: 'center' });
      t.setScale(0.3);
      this.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.Out' });
      L.add(t);
      L.add(text(this, 320, 146, '+1 CROWN', { size: 10, ox: 0.5, color: T.gold, strokeThickness: 4 }));
      const a = this.actors[r.winner];
      a.setPose('victory');
      this.tweens.add({ targets: a, y: a.y - 12, duration: 160, yoyo: true, repeat: 2, ease: 'Quad.Out' });
      if (r.loser !== null && r.loser !== r.winner) this.actors[r.loser].setPose('hurt');
    } else {
      L.add(text(this, 320, 130, 'NOBODY WON. THE GOBLINS KEEP IT ALL.', { size: 10, ox: 0.5, color: T.grey, strokeThickness: 4 }));
      sfx('lose');
    }
    // everyone's take from that game
    r.deltas.forEach((d, i) => {
      if (!d) return;
      const a = this.actors[i];
      const f = text(this, a.x, a.y - a.h - 8, `${d > 0 ? '+' : ''}${d}g`, { size: 10, ox: 0.5, oy: 1, color: d > 0 ? T.gold : T.red, strokeThickness: 4 });
      L.add(f);
    });
    this.drawHud();
    await this.wait(2200);
    this.actors.forEach((a) => a.setPose('idle'));
    this.tweens.add({ targets: L, alpha: 0, duration: 250, onComplete: () => L.destroy() });
    await this.wait(260);
  }

  // ------------------------------------------------------------ picking a game
  spin() {
    if (this.busy) return;
    this.setBusy(true);
    unlockAudio();
    const pick = A.spinGame();
    const L = this.add.container(0, 0).setDepth(850);
    L.add(panel(this, 150, 110, 340, 80, { border: C.gold }));
    L.add(text(this, 320, 122, `${run.party[run.arcade.picker].name.toUpperCase()} SPINS...`, { size: 8, ox: 0.5, color: T.grey }));
    const name = text(this, 320, 154, '', { size: 14, ox: 0.5, oy: 0.5, color: T.gold });
    L.add(name);
    const names = A.ARCADE_GAMES.map((g) => g.name);
    let k = rng.int(0, names.length - 1);
    const steps = 18;
    let n = 0;
    const tick = () => {
      n++;
      name.setText(n >= steps ? pick.name : names[k++ % names.length]);
      sfx(n >= steps ? 'jackpot' : 'step');
      if (n < steps) this.time.delayedCall(50 + n * n * 1.1, tick);
      else {
        this.tweens.add({ targets: name, scale: 1.25, duration: 160, yoyo: true });
        this.time.delayedCall(1100, () => this.launch(pick));
      }
    };
    tick();
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
      const col = i % 4, row = Math.floor(i / 4);
      const b = button(this, 28 + col * 148, 52 + row * 74, 140, 66, g.name, () => { L.destroy(); this.launch(g); }, {
        size: 8, sub: g.solo ? `${run.party[run.arcade.picker].name} plays` : 'everyone plays',
        fill: g.id === run.arcade.lastGame ? 0x2a2a3a : C.panelHi,
      });
      L.add(b);
    });
    L.add(button(this, 250, 286, 140, 40, 'BACK', () => { L.destroy(); this.setBusy(false); }, { size: 10 }));
  }

  launch(game) {
    A.beginGame(game);
    sfx('select');
    fadeTo(this, game.scene, { ...game.data, returnTo: 'Arcade' });
  }

  cards() {
    if (this.busy) return;
    openCardMenu(this, () => this.scene.restart({}));
  }

  // ------------------------------------------------------------ end of the night
  final(ranking) {
    this.chatTimer.remove();
    const L = this.add.container(0, 0).setDepth(900);
    L.add(dimmer(this, 0.6, 0));
    L.add(panel(this, 110, 50, 420, 246, { border: C.gold }));
    const champ = run.party[ranking[0].i];
    L.add(text(this, 320, 62, 'END OF THE NIGHT', { size: 12, ox: 0.5, color: T.gold }));
    L.add(text(this, 320, 82, `${champ.name.toUpperCase()} IS THE BIGGEST DEGENERATE`, { size: 8, ox: 0.5, color: RACES[champ.race].color }));
    ranking.forEach((r, k) => {
      const h = run.party[r.i];
      const y = 104 + k * 40;
      const pk = isReal(`${h.race}_portrait`) ? `${h.race}_portrait` : poseKey(this, h.race, 'idle');
      const s = this.add.image(150, y + 34, pk).setOrigin(0.5, 1);
      fitHeight(s, 34);
      L.add(s);
      L.add(text(this, 176, y + 10, `${k + 1}. ${h.name}`, { size: 10, color: RACES[h.race].color }));
      L.add(text(this, 500, y + 10, `${r.crowns} crowns  ${r.gold}g`, { size: 8, ox: 1, color: T.gold }));
    });
    this.actors[ranking[0].i].setPose('victory');
    sfx('jackpot');
    speak(this, ranking[0].i, A.say(ranking[0].i, 'win'), this.iopts(), 4000);
    L.add(button(this, 160, 302, 150, 44, 'PLAY AGAIN', () => fadeTo(this, 'Arcade', { fresh: true }), { size: 10, fill: 0x2a5a3a }));
    L.add(button(this, 330, 302, 150, 44, 'TITLE', () => fadeTo(this, 'Title'), { size: 10 }));
  }

  wait(ms) { return new Promise((res) => this.time.delayedCall(ms, res)); }
}
