import { T, SPRITE_HEIGHT } from '../config.js';
import { text, panel, button, fadeTo, fadeIn } from '../ui/ui.js';
import { background, actor } from '../ui/stage.js';
import { run } from '../systems/state.js';
import { CLASSES } from '../data/classes.js';

export class EndScene extends Phaser.Scene {
  constructor() { super('End'); }

  create({ won }) {
    fadeIn(this);
    background(this, won ? 'bg_treasure_vault' : 'bg_landlord_office');
    text(this, 320, 16, won ? 'YOU BEAT THE LANDLORD' : 'EVICTED', { size: 20, ox: 0.5, color: won ? T.gold : T.red, strokeThickness: 6 });
    text(this, 320, 46, won ? 'The deposit is yours. Mostly.' : 'The dungeon keeps your security deposit.', { size: 8, ox: 0.5 });

    run.party.forEach((h, i) => {
      const a = actor(this, h.race, 56 + i * 66, 170, SPRITE_HEIGHT.hero);
      if (!won) { a.sprite.setAngle(-90); a.sprite.setTint(0x6a6070); }
      text(this, a.x, 178, h.name, { size: 8, ox: 0.5 });
      text(this, a.x, 192, CLASSES[h.cls].short, { size: 8, ox: 0.5, color: T.grey });
      if (h.race === 'griffin') actor(this, 'dani', a.x + 34, 150, SPRITE_HEIGHT.companion, { float: 12, depth: 149 });
    });

    const s = run.stats;
    panel(this, 340, 70, 288, 210);
    text(this, 354, 82, 'HIGHLIGHTS', { size: 10, color: T.gold });
    const rows = [
      ['Fights', s.fights],
      ['Monsters killed', s.kills],
      ['Gold earned', s.goldEarned],
      ['Gold gambled', s.goldGambled],
      ['Times Josh got probed', s.probes],
      ['Times Griffin got whipped', s.whipped],
      ['Long shots taken', s.longShots],
      ['Heroes knocked out', s.deaths],
    ];
    rows.forEach(([k, v], i) => {
      text(this, 354, 106 + i * 20, k, { size: 8 });
      text(this, 614, 106 + i * 20, String(v), { size: 8, ox: 1, color: T.gold });
    });

    button(this, 120, 300, 190, 42, 'PLAY AGAIN', () => fadeTo(this, 'Party'), { size: 10, fill: 0x2a5a3a });
    button(this, 330, 300, 190, 42, 'TITLE', () => fadeTo(this, 'Title'), { size: 10 });
  }
}
