import { T, C, SPRITE_HEIGHT, HERO_SLOTS, ENEMY_SLOTS, BOSS_SLOT, BUSH_SPOT } from '../config.js';
import { INTROS, MISS_WORDS, CRIT_WORDS } from '../data/banter.js';
import { powerMeter, dodgePrompt } from '../ui/quicktime.js';
import { fitHeight } from '../art/assets.js';
import { ENEMIES } from '../data/enemies.js';
import { CLASSES } from '../data/classes.js';
import { RACES } from '../data/races.js';
import { text, panel, button, floater, bubble, hpBar, fadeTo, fadeIn, dimmer } from '../ui/ui.js';
import { background, actor } from '../ui/stage.js';
import { run, rng } from '../systems/state.js';
import * as K from '../systems/combat.js';
import { sfx } from '../audio/sfx.js';

const DANI_LINES = {
  heal: ['Hold still, idiot.', "You're welcome.", 'Ugh. Fine.'],
  bolt: ['Back off.', 'Nobody touches him but me.', 'Bye.'],
  whip: ['Griffin. Now.', 'We need to talk.', 'Are you even listening?', 'Who is SHE?'],
};

export class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }

  create(data) {
    fadeIn(this);
    this.data_ = data;
    this.b = K.createBattle(data.enemies, data.type, data.depth ?? 3);
    background(this, data.bg || 'bg_dungeon_crypt');
    this.views = {};
    this.targeting = null;

    // --- units in the world
    K.heroes(this.b).forEach((u) => {
      const s = HERO_SLOTS[u.slot];
      const a = actor(this, u.race, s.x, s.y, SPRITE_HEIGHT.hero);
      if (!u.alive) this.layDown(a, true);
      this.addView(u, a);
      if (u.race === 'griffin') {
        this.dani = actor(this, 'dani', s.x - 34, s.y - 16, SPRITE_HEIGHT.companion, { float: 14, depth: s.y - 17 });
        this.daniHome = { x: this.dani.x, y: this.dani.y };
      }
    });
    K.enemies(this.b).forEach((u) => {
      const def = ENEMIES[u.key];
      const s = def.boss ? BOSS_SLOT : ENEMY_SLOTS[u.slot];
      const a = actor(this, u.key, s.x, s.y, SPRITE_HEIGHT[def.size], { flip: true, float: u.key === 'alien_probe_drone' ? 16 : 0 });
      this.addView(u, a);
    });

    // --- UI
    panel(this, 96, 4, 448, 34, { alpha: 0.88 }).setDepth(90);
    this.logText = text(this, 320, 21, '', { size: 8, ox: 0.5, oy: 0.5, wrap: 430, align: 'center', depth: 91, lineSpacing: 4 });
    this.roundText = text(this, 8, 8, '', { size: 8, color: T.grey, depth: 91 });
    this.goldText = text(this, 632, 8, '', { size: 8, color: T.gold, ox: 1, depth: 91 });
    this.arrow = text(this, 0, 0, 'v', { size: 12, ox: 0.5, oy: 1, color: T.gold, depth: 95 }).setVisible(false);
    this.tweens.add({ targets: this.arrow, y: '+=3', duration: 260, yoyo: true, repeat: -1, ease: 'Stepped' });
    this.bar = this.add.container(0, 0).setDepth(100);
    this.refreshTop();

    this.intro().then(() => this.loop());
  }

  addView(u, a) {
    const bar = hpBar(this, u.boss ? 70 : 36).setDepth(200);
    const st = text(this, 0, 0, '', { size: 8, ox: 0.5, depth: 201, color: T.blue });
    const view = { u, a, bar, st };
    this.views[u.uid] = view;
    const zw = Math.max(52, a.h * 0.7);
    view.zone = this.add.zone(a.x, a.y - a.h / 2, zw, a.h + 16).setInteractive({ useHandCursor: true }).setDepth(150);
    view.zone.on('pointerup', () => this.onTargetTap(u.uid));
    this.placeBar(view);
    bar.draw(u.hp, u.maxHp);
  }

  placeBar(v) {
    const top = v.a.y - v.a.h - v.a.float - 8;
    v.bar.setPosition(v.a.x, top);
    v.st.setPosition(v.a.x, top - 12);
    v.bar.setVisible(v.u.alive && !v.u.st.bush);
  }

  head(uid) {
    const v = this.views[uid];
    return { x: v.a.x, y: v.a.y - v.a.h - v.a.float };
  }

  // ------------------------------------------------------------ flow
  async intro() {
    const heroes = Object.values(this.views).filter((v) => v.u.side === 'hero');
    const foes = Object.values(this.views).filter((v) => v.u.side === 'enemy');
    [...heroes.map((v) => v.a), this.dani].filter(Boolean).forEach((a, i) => {
      const tx = a.x; a.x -= 240;
      this.tweens.add({ targets: a, x: tx, duration: 700, delay: i * 60, ease: 'Quad.Out' });
    });
    foes.forEach((v, i) => {
      const tx = v.a.x; v.a.x += 220;
      this.tweens.add({ targets: v.a, x: tx, duration: 700, delay: 150 + i * 80, ease: 'Quad.Out' });
    });
    Object.values(this.views).forEach((v) => v.bar.setVisible(false));
    await this.wait(950);
    Object.values(this.views).forEach((v) => this.placeBar(v));

    const names = {};
    foes.forEach((v) => { names[v.u.name] = (names[v.u.name] || 0) + 1; });
    const desc = Object.entries(names).map(([n, c]) => (c > 1 ? `${c} ${n}s` : `a ${n}`)).join(', ');
    const joke = INTROS[this.b.units.find((u) => u.side === 'enemy').key];
    this.setLog(this.data_.intro || (this.b.type === 'boss' ? 'The Dungeon Landlord demands rent.' : joke ? rng.pick(joke) : `You run into ${desc}!`));

    if (this.b.type === 'boss') {
      this.cameras.main.shake(300, 0.006);
      bubble(this, foes[0].a.x - 20, foes[0].a.y - foes[0].a.h - 4, 'Rent is due. ALL of it.', 1800);
      await this.wait(1300);
    }
    const mike = heroes.find((v) => v.u.race === 'mike' && v.u.alive);
    const gob = foes.find((v) => v.u.faction === 'goblin');
    if (mike && gob) {
      const h = this.head(gob.u.uid);
      bubble(this, h.x, h.y - 2, 'Wait... cousin Mike??', 1500);
      await this.wait(900);
    }
    const evs = K.startBattle(this.b);
    await this.play(evs);
  }

  async loop() {
    const b = this.b;
    while (!b.over) {
      const u = K.current(b);
      this.refreshTop();
      if (u && u.alive) {
        this.pointAt(u.uid);
        const { events, skip } = K.beginTurn(b);
        await this.play(events);
        if (!skip && !b.over) {
          if (u.side === 'hero') {
            const action = await this.chooseAction(u);
            this.arrow.setVisible(false);
            if (action.type === 'ability') action.quality = await powerMeter(this, `${CLASSES[u.cls].ability.name.toUpperCase()}: TAP THE GOLD!`);
            await this.play(K.heroAction(b, u.uid, action));
          } else {
            await this.wait(380);
            let dodged = false;
            if (K.bossSpecialNext(b)) {
              const h = this.head(u.uid);
              bubble(this, h.x, h.y - 4, 'Rent... is... DUE...', 1500, '#8a1c2b');
              await this.wait(500);
              dodged = await dodgePrompt(this, 'THE LANDLORD WINDS UP...');
            }
            await this.play(K.enemyTurn(b, { dodged }));
          }
        }
      }
      this.refreshStatuses();
      K.endTurn(b);
      await this.wait(120);
    }
    this.arrow.setVisible(false);
    this.finish();
  }

  pointAt(uid) {
    const h = this.head(uid);
    this.arrow.setPosition(h.x, h.y - 14).setVisible(true);
  }

  refreshTop() {
    this.roundText.setText('ROUND ' + Math.max(1, this.b.round));
    this.goldText.setText(run.gold + 'g');
  }

  refreshStatuses() {
    Object.values(this.views).forEach((v) => {
      const s = v.u.st;
      const tags = [];
      if (s.stun) tags.push('STUN');
      if (s.probed) tags.push('PROBED');
      if (s.weak) tags.push('WEAK');
      if (s.defend) tags.push('DEF');
      if (s.taunt) tags.push('FLEX');
      if (s.decree) tags.push('SOFT');
      v.st.setText(v.u.alive ? tags.join(' ') : '');
      v.st.setColor(s.weak ? T.blue : T.cream);
      v.bar.draw(v.u.hp, v.u.maxHp);
      v.bar.setVisible(v.u.alive && !s.bush);
      if (s.bush) v.st.setText('');
    });
  }

  setLog(str) { this.logText.setText(str); }

  // ------------------------------------------------------------ player input
  chooseAction(u) {
    return new Promise((resolve) => {
      this.resolveAction = (a) => { this.clearBar(); this.targeting = null; this.highlightTargets(null); resolve(a); };
      this.showActionBar(u);
    });
  }

  clearBar() { this.bar.removeAll(true); }

  showActionBar(u) {
    this.clearBar();
    const race = RACES[u.race];
    const cls = CLASSES[u.cls];
    const g = panel(this, 4, 284, 632, 72, { alpha: 0.94 });
    this.bar.add(g);
    this.bar.add(text(this, 14, 294, u.name.toUpperCase(), { size: 10, color: race.color }));
    this.bar.add(text(this, 14, 312, `${cls.short}${u.signature ? '*' : ''}`, { size: 8, color: u.signature ? T.gold : T.grey }));
    this.bar.add(text(this, 14, 330, `HP ${u.hp}/${u.maxHp}`, { size: 8, color: T.green }));
    this.setLog(`${u.name}'s turn. What's the move?`);

    // Every move says what it does.
    const bx = [140, 264, 388, 512], bw = 118, by = 290, bh = 60;
    const isHaakon = u.race === 'haakon';
    const atkDesc = u.st.probed ? 'Hit one enemy. Aim is shot.' : isHaakon ? 'Hit one enemy. HARD.' : 'Hit one enemy.';
    const atk = button(this, bx[0], by, bw, bh, 'ATTACK', () => this.beginTarget(u, { type: 'attack' }, 'enemy'), { size: 10, fill: 0x6a2a3a, sub: atkDesc });
    const ready = u.cd === 0;
    let abDesc = cls.ability.short;
    if (cls.ability.id === 'long_shot') {
      const pct = Math.round(K.luck(u.signature ? 0.10 : 0.08, u) * 100);
      abDesc = `${pct}% odds. 6x damage.`;
    }
    const abil = button(this, bx[1], by, bw, bh, cls.ability.name.toUpperCase(), () => {
      if (cls.ability.target === 'enemy') this.beginTarget(u, { type: 'ability' }, 'enemy');
      else this.resolveAction({ type: 'ability' });
    }, { size: 8, fill: 0x2a3a6a, sub: ready ? abDesc : `Recharging. Ready in ${u.cd}.`, subColor: ready && u.signature ? T.gold : T.grey });
    abil.setEnabled(ready);
    const def = button(this, bx[2], by, bw, bh, isHaakon ? 'FLEX' : 'DEFEND', () => this.resolveAction({ type: isHaakon ? 'flex' : 'defend' }), {
      size: 10, sub: isHaakon ? 'Every enemy hits YOU.' : 'Take half damage.',
    });
    const pot = button(this, bx[3], by, bw, bh, `POTION x${run.potions}`, () => this.beginTarget(u, { type: 'potion' }, 'hero'), { size: 8, sub: 'Heal a friend 15 HP.' });
    pot.setEnabled(run.potions > 0);
    this.bar.add([atk, abil, def, pot]);
  }

  beginTarget(u, action, side) {
    const pool = (side === 'enemy' ? K.enemies(this.b) : K.heroes(this.b)).filter((x) => x.alive);
    if (side === 'enemy' && pool.length === 1) {
      this.resolveAction({ ...action, target: pool[0].uid });
      return;
    }
    this.targeting = { action, side };
    this.clearBar();
    const g = panel(this, 4, 284, 632, 72, { alpha: 0.94 });
    this.bar.add(g);
    this.bar.add(text(this, 20, 320, side === 'enemy' ? 'TAP AN ENEMY' : 'TAP A HERO TO HEAL', { size: 12, color: T.gold, oy: 0.5 }));
    this.bar.add(button(this, 512, 290, 118, 60, 'BACK', () => {
      this.targeting = null;
      this.highlightTargets(null);
      this.showActionBar(u);
    }, { size: 10 }));
    this.highlightTargets(pool.map((x) => x.uid));
  }

  highlightTargets(uids) {
    if (this.hlTweens) this.hlTweens.forEach((t) => t.stop());
    this.hlTweens = [];
    (this.hlUids || []).forEach((uid) => {
      const v = this.views[uid];
      if (v.u.alive) v.a.sprite.clearTint();
    });
    this.hlUids = uids || [];
    if (!uids) return;
    uids.forEach((uid) => {
      const v = this.views[uid];
      const tw = this.tweens.addCounter({
        from: 0, to: 1, duration: 300, yoyo: true, repeat: -1,
        onUpdate: (t) => { if (t.getValue() > 0.5) v.a.sprite.setTint(0xffe888); else v.a.sprite.clearTint(); },
      });
      this.hlTweens.push(tw);
    });
  }

  onTargetTap(uid) {
    if (!this.targeting) return;
    const u = K.unit(this.b, uid);
    if (!u || !u.alive || (this.targeting.side === 'enemy') !== (u.side === 'enemy')) return;
    sfx('select');
    this.resolveAction({ ...this.targeting.action, target: uid });
  }

  // ------------------------------------------------------------ event playback
  async play(events) {
    for (const ev of events) await this.animate(ev);
    this.refreshStatuses();
    this.refreshTop();
  }

  wait(ms) { return new Promise((r) => this.time.delayedCall(ms, r)); }
  tween(cfg) { return new Promise((r) => this.tweens.add({ ...cfg, onComplete: r })); }

  async animate(ev) {
    const v = ev.uid ? this.views[ev.uid] : null;
    switch (ev.t) {
      case 'log': this.setLog(ev.text); return this.wait(260);
      case 'say': {
        const h = this.head(ev.uid);
        bubble(this, h.x, h.y - 4, ev.text, 1200);
        return this.wait(500);
      }
      case 'shout': {
        const h = this.head(ev.uid);
        bubble(this, h.x, h.y - 4, ev.text, 1100, '#8a1c2b');
        this.cameras.main.shake(120, 0.004);
        return this.wait(550);
      }
      case 'ability': {
        const h = this.head(ev.uid);
        floater(this, h.x, h.y - 6, ev.name + (ev.quality === 'perfect' ? '!!' : ''), ev.quality === 'perfect' ? T.gold : T.blue, 10);
        v.a.setPose('cast');
        this.time.delayedCall(500, () => v.a.setPose('idle'));
        return this.wait(320);
      }
      case 'odds': {
        const h = this.head(ev.uid);
        floater(this, h.x, h.y - 20, `${ev.pct}% ODDS`, T.purple, 10);
        sfx('dice');
        return this.wait(500);
      }
      case 'attack': return this.animAttack(ev);
      case 'damage': return this.animDamage(ev);
      case 'heal': {
        if (!ev.amount) return;
        const h = this.head(ev.uid);
        floater(this, h.x, h.y, '+' + ev.amount, T.green, 12);
        this.sparkle(v.a.x, v.a.y - v.a.h / 2, 0x8be04e);
        sfx('heal');
        v.bar.draw(v.u.hp, v.u.maxHp);
        return this.wait(200);
      }
      case 'status': {
        const h = this.head(ev.uid);
        floater(this, h.x, h.y - 10, ev.text, T[ev.color] || T.cream, 8);
        return this.wait(320);
      }
      case 'die': return this.animDie(ev);
      case 'probe': return this.animProbe(ev);
      case 'reveal': return this.animReveal(ev);
      case 'beam': return this.animBeam(ev);
      case 'dani': return this.animDani(ev);
      case 'flex': {
        bubble(this, v.a.x, v.a.y - v.a.h - 6, 'LOOK AT ME.', 1100);
        await this.tween({ targets: v.a.sprite, scaleX: v.a.sprite.scaleX * 1.15, scaleY: v.a.sprite.scaleY * 1.08, duration: 120, yoyo: true, repeat: 1 });
        return;
      }
      case 'gold': {
        const h = this.head(ev.uid);
        floater(this, h.x, h.y - 4, (ev.amount > 0 ? '+' : '') + ev.amount + 'g', T.gold, 10);
        sfx('coin');
        this.refreshTop();
        return this.wait(250);
      }
      case 'potion': {
        const from = this.views[ev.uid].a, to = this.views[ev.target].a;
        const p = this.add.image(from.x, from.y - from.h * 0.6, 'icon_potion_health').setDepth(300);
        await this.tween({ targets: p, x: to.x, y: to.y - to.h * 0.6, duration: 300, ease: 'Quad.Out' });
        p.destroy();
        return;
      }
      case 'glow': this.sparkle(v.a.x, v.a.y - v.a.h / 2, 0xf7e048); return this.wait(150);
      case 'modifier': return this.animModifier(ev);
      case 'bush': return this.animBush(ev);
    }
  }

  async animAttack(ev) {
    const a = this.views[ev.uid].a;
    const t = this.views[ev.target].a;
    const dir = t.x > a.x ? 1 : -1;
    if (ev.kind === 'melee') {
      const home = { x: a.x, y: a.y };
      a.setDepth(t.depth + 1);
      a.setPose('attack');
      sfx('swing');
      await this.tween({ targets: a, x: t.x - dir * (t.h * 0.45 + 18), y: t.y + 2, duration: 170, ease: 'Quad.In' });
      this.time.delayedCall(260, () => {
        this.tweens.add({ targets: a, x: home.x, y: home.y, duration: 220, ease: 'Quad.Out', onComplete: () => { a.setDepth(home.y); a.setPose('idle'); } });
      });
      return;
    }
    a.setPose('attack');
    const color = ev.kind === 'magic' ? 0xc58cff : a.base.includes('alien') ? 0x5fe8ff : 0xf4e3b5;
    const pr = this.add.rectangle(a.x + dir * 14, a.y - a.h * 0.6, ev.kind === 'magic' ? 8 : 10, ev.kind === 'magic' ? 8 : 3, color).setDepth(300);
    sfx(ev.kind === 'magic' ? 'magic' : 'swing');
    await this.tween({ targets: pr, x: t.x, y: t.y - t.h * 0.55, duration: 220 });
    pr.destroy();
    this.time.delayedCall(200, () => a.setPose('idle'));
  }

  async animDamage(ev) {
    const v = this.views[ev.uid];
    const h = this.head(ev.uid);
    if (ev.miss) {
      floater(this, h.x, h.y, rng.pick(MISS_WORDS), T.grey, 10);
      sfx('miss');
      await this.tween({ targets: v.a, x: v.a.x + (v.u.side === 'hero' ? -10 : 10), duration: 90, yoyo: true });
      return;
    }
    v.a.sprite.setTintFill(0xffffff);
    this.time.delayedCall(90, () => v.a.sprite.clearTint());
    v.a.setPose('hurt');
    this.time.delayedCall(350, () => v.u.alive && v.a.setPose('idle'));
    if (ev.crit) {
      floater(this, h.x, h.y - 14, rng.pick(CRIT_WORDS), T.gold, 10);
      floater(this, h.x, h.y, '-' + ev.amount, T.gold, 16, true);
      this.cameras.main.shake(180, 0.008);
      sfx('crit');
    } else {
      floater(this, h.x, h.y, '-' + ev.amount, T.red, ev.big ? 16 : 12, ev.big);
      if (ev.big) this.cameras.main.shake(160, 0.006);
      sfx(ev.big ? 'crit' : 'hit');
    }
    const x0 = v.a.x;
    v.bar.draw(v.u.hp, v.u.maxHp);
    await this.tween({ targets: v.a, x: x0 + (v.u.side === 'hero' ? -4 : 4), duration: 50, yoyo: true, repeat: 1 });
    v.a.x = x0;
    return this.wait(140);
  }

  layDown(a, instant) {
    this.tweens.killTweensOf(a.sprite);
    a.setPose('downed');
    a.sprite.setTint(0x6a6070);
    // Placeholder art has no "downed" pose, so tip the idle sprite over.
    if (a.sprite.texture.key.endsWith('_idle')) {
      if (instant) a.sprite.setAngle(-90);
      else this.tweens.add({ targets: a.sprite, angle: -90, duration: 320, ease: 'Bounce.Out' });
    }
  }

  async animDie(ev) {
    const v = this.views[ev.uid];
    v.bar.setVisible(false);
    v.st.setText('');
    sfx('die');
    if (v.u.side === 'hero') {
      this.layDown(v.a);
      return this.wait(400);
    }
    v.a.sprite.setTintFill(0xffffff);
    await this.wait(80);
    v.a.sprite.clearTint();
    await this.tween({ targets: v.a, alpha: 0, y: v.a.y + 6, duration: 380 });
    v.a.setVisible(false);
  }

  sparkle(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const s = this.add.rectangle(x + rng.int(-16, 16), y + rng.int(-14, 14), 3, 3, color).setDepth(300);
      this.tweens.add({ targets: s, y: s.y - 18, alpha: 0, duration: 500 + i * 40, onComplete: () => s.destroy() });
    }
  }

  // Josh gets probed. Cartoon slapstick: a telescoping scanner arm, a boop, done.
  async animProbe(ev) {
    const josh = this.views[ev.uid].a;
    const alien = Object.values(this.views).find((v) => v.u.side === 'enemy' && v.u.faction === 'alien');
    const from = alien ? { x: alien.a.x - 10, y: alien.a.y - alien.a.h * 0.55 } : { x: 640, y: 120 };
    const to = { x: josh.x + 10, y: josh.y - josh.h * 0.68 };
    const g = this.add.graphics().setDepth(310);
    sfx('probe');
    const segs = 6;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t;
      g.clear();
      g.lineStyle(4, 0x5d6474, 1); g.lineBetween(from.x, from.y, x, y);
      g.lineStyle(2, 0x9aa3b5, 1); g.lineBetween(from.x, from.y, x, y);
      for (let k = 1; k < i; k++) {
        const jx = from.x + (to.x - from.x) * (k / segs), jy = from.y + (to.y - from.y) * (k / segs);
        g.fillStyle(0xc8d0dc, 1); g.fillRect(jx - 3, jy - 3, 6, 6);
      }
      g.fillStyle(0x5fe8ff, 1); g.fillRect(x - 4, y - 4, 8, 8);
      g.fillStyle(0xffffff, 1); g.fillRect(x - 1, y - 3, 2, 2);
      await this.wait(80);
    }
    bubble(this, josh.x, josh.y - josh.h - 8, '*BOOP*', 900, '#2a7a8a');
    josh.sprite.setTint(0x9af0c0);
    await this.tween({ targets: josh, x: josh.x - 3, duration: 40, yoyo: true, repeat: 5 });
    const h = this.head(ev.uid);
    floater(this, h.x, h.y - 20, 'SCAN COMPLETE', T.blue, 8);
    await this.wait(300);
    josh.sprite.clearTint();
    // retract
    for (let i = segs; i >= 0; i--) {
      const t = i / segs;
      g.clear();
      g.lineStyle(3, 0x7b8496, 1);
      g.lineBetween(from.x, from.y, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
      await this.wait(30);
    }
    g.destroy();
  }

  async animReveal(ev) {
    const from = this.views[ev.from].a;
    const to = this.views[ev.uid].a;
    const g = this.add.graphics().setDepth(310);
    const fx = from.x + 2, fy = from.y - from.h * 0.83;
    sfx('magic');
    for (let i = 0; i < 4; i++) {
      g.clear();
      g.lineStyle(i % 2 ? 2 : 1, 0x5fe8ff, 1);
      g.lineBetween(fx, fy, to.x, to.y - to.h * 0.6);
      await this.wait(70);
    }
    g.destroy();
    const h = this.head(ev.uid);
    floater(this, h.x, h.y - 8, 'WEAK SPOT', T.blue, 8);
    this.refreshStatuses();
    return this.wait(250);
  }

  async animBeam(ev) {
    const a = this.views[ev.uid].a;
    const y = a.y - a.h * 0.65;
    const beam = this.add.rectangle(a.x + 10, y, 10, 14, 0x5fe8ff).setOrigin(0, 0.5).setDepth(305);
    const core = this.add.rectangle(a.x + 10, y, 10, 4, 0xffffff).setOrigin(0, 0.5).setDepth(306);
    sfx('magic');
    this.cameras.main.flash(120, 95, 232, 255);
    await this.tween({ targets: [beam, core], width: 640 - a.x, duration: 200 });
    await this.tween({ targets: [beam, core], alpha: 0, duration: 220 });
    beam.destroy(); core.destroy();
  }

  async animDani(ev) {
    const d = this.dani;
    if (!d) return;
    const lines = DANI_LINES[ev.action];
    const line = rng.pick(lines);
    if (ev.action === 'heal') {
      const t = ev.target ? this.views[ev.target].a : this.views[ev.uid].a;
      d.setPose('heal');
      await this.tween({ targets: d, x: t.x - 20, y: t.y - 16, duration: 260, ease: 'Quad.Out' });
      bubble(this, d.x, d.y - d.h - 18, line, 1100, '#6e1a2e');
      this.sparkle(t.x, t.y - t.h / 2, 0x8be04e);
      await this.wait(350);
      await this.tween({ targets: d, x: this.daniHome.x, y: this.daniHome.y, duration: 260 });
      d.setPose('idle');
      return;
    }
    if (ev.action === 'bolt') {
      const t = this.views[ev.target].a;
      d.setPose('attack');
      bubble(this, d.x, d.y - d.h - 18, line, 1000, '#6e1a2e');
      const bolt = this.add.rectangle(d.x + 10, d.y - d.h * 0.7, 8, 8, 0x9b2ad0).setDepth(310);
      sfx('magic');
      await this.tween({ targets: bolt, x: t.x, y: t.y - t.h * 0.5, angle: 360, duration: 300 });
      bolt.destroy();
      d.setPose('idle');
      return;
    }
    // whip: she cuts in front of Griffin and he loses his turn
    const g = this.views[ev.uid].a;
    d.setPose('scold');
    sfx('whip');
    await this.tween({ targets: d, x: g.x + 30, y: g.y - 4, duration: 220, ease: 'Back.Out' });
    d.setDepth(g.depth + 2);
    bubble(this, d.x, d.y - d.h - 18, line, 1300, '#6e1a2e');
    g.sprite.setTint(0xff9ab8);
    await this.tween({ targets: g, y: g.y - 6, duration: 90, yoyo: true, repeat: 1 });
    floater(this, g.x, g.y - g.h - 10, '<3', T.red, 12);
    await this.wait(500);
    g.sprite.clearTint();
    await this.tween({ targets: d, x: this.daniHome.x, y: this.daniHome.y, duration: 300 });
    d.setDepth(this.daniHome.y - 1);
    d.setPose('idle');
  }

  // A silly rule for this fight, announced like a game show.
  async animModifier(ev) {
    const D = 850;
    const g = this.add.graphics().setDepth(D);
    g.fillStyle(C.ink, 0.85); g.fillRect(0, 120, 640, 70);
    g.fillStyle(C.gold, 1); g.fillRect(0, 120, 640, 3); g.fillRect(0, 187, 640, 3);
    const t1 = text(this, 320, 140, ev.name, { size: 16, ox: 0.5, color: T.gold, depth: D + 1, strokeThickness: 5 });
    const t2 = text(this, 320, 166, ev.desc, { size: 8, ox: 0.5, color: T.cream, depth: D + 1 });
    t1.setScale(0.3);
    this.tweens.add({ targets: t1, scale: 1, duration: 260, ease: 'Back.Out' });
    sfx('jackpot');
    this.modTag = this.modTag || text(this, 320, 44, '', { size: 8, ox: 0.5, color: T.gold, depth: 91 });
    this.modTag.setText(ev.name);
    await this.wait(2000);
    await this.tween({ targets: [g, t1, t2], alpha: 0, duration: 250 });
    [g, t1, t2].forEach((o) => o.destroy());
  }

  // Josh dives into (or crawls out of) a bush during dog fights.
  async animBush(ev) {
    const v = this.views[ev.uid];
    const a = v.a;
    if (ev.action === 'in') {
      this.bush = this.add.image(BUSH_SPOT.x, BUSH_SPOT.y + 8, 'prop_bush').setOrigin(0.5, 1);
      fitHeight(this.bush, 54);
      this.bush.setDepth(BUSH_SPOT.y + 20);
      this.joshHome = { x: a.x, y: a.y };
      v.bar.setVisible(false);
      sfx('step');
      await this.tween({ targets: a, x: BUSH_SPOT.x, y: BUSH_SPOT.y, duration: 380, ease: 'Quad.In' });
      a.setDepth(BUSH_SPOT.y);
      this.tweens.add({ targets: this.bush, angle: 4, duration: 70, yoyo: true, repeat: 3 });
      this.moveZone(v);
      return this.wait(150);
    }
    this.tweens.add({ targets: this.bush, angle: -5, duration: 70, yoyo: true, repeat: 3 });
    await this.tween({ targets: a, x: this.joshHome.x, y: this.joshHome.y, duration: 420, ease: 'Quad.Out' });
    a.setDepth(this.joshHome.y);
    this.moveZone(v);
    this.placeBar(v);
    return this.wait(100);
  }

  moveZone(v) {
    v.zone.setPosition(v.a.x, v.a.y - v.a.h / 2);
    this.placeBar(v);
    if (v.u.st.bush) v.bar.setVisible(false);
  }

  // ------------------------------------------------------------ end of fight
  async finish() {
    const b = this.b;
    const res = K.finishBattle(b);
    this.clearBar();
    this.refreshTop();
    await this.wait(400);
    dimmer(this, 0.55, 400);
    const won = b.over === 'win';
    sfx(won ? 'win' : 'lose');
    const title = text(this, 320, 110, won ? 'VICTORY!' : 'PARTY WIPED', { size: 24, ox: 0.5, color: won ? T.gold : T.red, depth: 401, strokeThickness: 6 });
    title.setScale(0.4);
    this.tweens.add({ targets: title, scale: 1, duration: 300, ease: 'Back.Out' });
    let sub = won ? `+${res.gold} gold` : 'The dungeon keeps your deposit.';
    if (won && run.party.some((h) => h.hp > 0 && K.heroes(b).find((u) => u.heroIndex === run.party.indexOf(h) && !u.alive))) {
      sub += '\nDowned heroes get back up with 25% HP.';
    }
    text(this, 320, 150, sub, { size: 10, ox: 0.5, align: 'center', color: T.cream, depth: 401 });
    const isBoss = b.type === 'boss';
    button(this, 230, 210, 180, 40, won && !isBoss ? 'CONTINUE' : won ? 'CLAIM VICTORY' : 'ACCEPT FATE', () => {
      if (!won) fadeTo(this, 'End', { won: false });
      else if (isBoss) fadeTo(this, 'End', { won: true });
      else fadeTo(this, 'Map');
    }, { size: 10, depth: 402, fill: won ? 0x2a5a3a : 0x6a2a3a });
  }
}
