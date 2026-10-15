import { T, C, SPRITE_HEIGHT } from '../config.js';
import { RACES, RACE_ORDER } from '../data/races.js';
import { CLASSES, CLASS_ORDER } from '../data/classes.js';
import { text, button, panel, fadeTo, fadeIn } from '../ui/ui.js';
import { background, actor } from '../ui/stage.js';
import { newRun } from '../systems/state.js';
import { sfx } from '../audio/sfx.js';

// Pick a class for each of the four friends. Single device for now:
// one phone controls the whole party (hotseat). Multiplayer comes later.
export class PartyScene extends Phaser.Scene {
  constructor() { super('Party'); }

  create() {
    fadeIn(this);
    background(this, 'bg_dungeon_crypt');
    this.picks = RACE_ORDER.map((r) => ({ race: r, cls: RACES[r].signature }));
    this.sel = 0;

    text(this, 176, 12, 'PICK YOUR DEGENERATES', { size: 12, ox: 0.5, color: T.gold });
    text(this, 176, 32, 'Tap a hero, then pick a class.', { size: 8, ox: 0.5, color: T.grey });

    // Heroes standing in the room
    this.actors = [];
    this.tags = [];
    const xs = [56, 130, 204, 282];
    RACE_ORDER.forEach((id, i) => {
      const a = actor(this, id, xs[i], 190, SPRITE_HEIGHT.hero);
      if (id === 'griffin') actor(this, 'dani', xs[i] + 30, 166, SPRITE_HEIGHT.companion * 0.8, { float: 10, depth: 150 });
      const hit = this.add.zone(xs[i], 150, 64, 110).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => { sfx('select'); this.select(i); });
      this.actors.push(a);
      const name = text(this, xs[i], 196, RACES[id].name.toUpperCase(), { size: 8, ox: 0.5, color: RACES[id].color, depth: 300 });
      const cls = text(this, xs[i], 210, '', { size: 8, ox: 0.5, color: T.cream, depth: 300, wrap: 76, align: 'center', lineSpacing: 2 });
      this.tags.push({ name, cls });
    });
    this.arrow = text(this, 0, 0, 'v', { size: 12, ox: 0.5, color: T.gold, depth: 400 });
    this.tweens.add({ targets: this.arrow, y: '+=3', duration: 300, yoyo: true, repeat: -1, ease: 'Stepped' });

    // Ability card under the heroes
    panel(this, 12, 236, 330, 62);
    this.abilityName = text(this, 22, 246, '', { size: 10, color: T.blue });
    this.abilityDesc = text(this, 22, 262, '', { size: 8, color: T.cream, wrap: 312, lineSpacing: 4 });

    // Start
    button(this, 12, 308, 222, 42, 'ENTER THE DUNGEON', () => {
      newRun(this.picks);
      fadeTo(this, 'Map');
    }, { size: 10, fill: 0x6a2a3a });
    button(this, 244, 308, 98, 42, 'RANDOM', () => this.randomize(), { size: 8 });

    // Info panel on the right
    panel(this, 352, 8, 280, 344);
    this.raceName = text(this, 366, 20, '', { size: 16 });
    this.raceSub = text(this, 366, 42, '', { size: 8, color: T.grey });
    this.perk = text(this, 366, 60, '', { size: 8, color: T.green, wrap: 254, lineSpacing: 5 });
    this.flaw = text(this, 366, 0, '', { size: 8, color: T.red, wrap: 254, lineSpacing: 5 });
    text(this, 366, 238, 'CLASS  (* = signature bonus)', { size: 8, color: T.gold });
    this.classBtns = CLASS_ORDER.map((cid, i) => {
      const bx = 362 + (i % 2) * 132, by = 252 + Math.floor(i / 2) * 32;
      return button(this, bx, by, 128, 28, CLASSES[cid].name, () => this.pickClass(cid), { size: 8 });
    });
    this.select(0);
  }

  select(i) {
    this.sel = i;
    const p = this.picks[i];
    const r = RACES[p.race];
    const a = this.actors[i];
    this.arrow.setPosition(a.x, a.y - SPRITE_HEIGHT.hero - 18);
    this.actors.forEach((x, j) => x.sprite.setAlpha(j === i ? 1 : 0.7));
    this.raceName.setText(r.name).setColor(r.color);
    this.raceSub.setText(`The ${r.race}`);
    this.perk.setText('+ ' + r.perk);
    this.flaw.setText('- ' + r.flaw).setY(this.perk.y + this.perk.height + 10);
    this.refresh();
  }

  pickClass(cid) {
    this.picks[this.sel].cls = cid;
    this.refresh();
  }

  randomize() {
    this.picks.forEach((p) => { p.cls = Phaser.Utils.Array.GetRandom(CLASS_ORDER); });
    this.refresh();
  }

  refresh() {
    const p = this.picks[this.sel];
    const r = RACES[p.race];
    this.classBtns.forEach((b, i) => {
      const cid = CLASS_ORDER[i];
      b.setLabel(CLASSES[cid].name + (cid === r.signature ? ' *' : ''));
      b.setSelected(cid === p.cls);
    });
    const c = CLASSES[p.cls];
    const sig = p.cls === r.signature;
    this.abilityName.setText(`${c.name.toUpperCase()}: ${c.ability.name}`);
    this.abilityDesc.setText(c.ability.desc + (sig && c.sigBonus ? `\n* ${c.sigBonus}` : ''));
    this.picks.forEach((pk, i) => {
      const s = pk.cls === RACES[pk.race].signature;
      this.tags[i].cls.setText(CLASSES[pk.cls].short + (s ? '*' : '')).setColor(s ? T.gold : T.cream);
    });
  }
}
