import { T, C, SPRITE_HEIGHT } from '../config.js';
import { RACES } from '../data/races.js';
import { CLASSES } from '../data/classes.js';
import { text, panel, button, floater, fadeTo, fadeIn } from '../ui/ui.js';
import { background, actor } from '../ui/stage.js';
import { run, rng, standings } from '../systems/state.js';
import { sfx } from '../audio/sfx.js';

// End of the night. Win or wipe, somebody is still the Biggest Degenerate.
// Bonus crowns are revealed one at a time, then the final ranking.
const BONUSES = [
  { id: 'kills', name: 'KILL HOG', desc: 'Most kill bounties', stat: (h) => h.st.kills },
  { id: 'dmg', name: 'DAMAGE DEALER', desc: 'Most damage dealt', stat: (h) => h.st.dmg },
  { id: 'gambled', name: 'HIGH ROLLER', desc: 'Gambled the most gold', stat: (h) => h.st.gambled },
  { id: 'stolen', name: 'CAT BURGLAR', desc: 'Stole the most from friends', stat: (h) => h.st.stolen },
  { id: 'robbed', name: 'BIGGEST VICTIM', desc: 'Got robbed the most (pity crown)', stat: (h) => h.st.robbed },
];

export class EndScene extends Phaser.Scene {
  constructor() { super('End'); }

  create({ won }) {
    fadeIn(this);
    this.won = won;
    background(this, won ? 'bg_treasure_vault' : 'bg_landlord_office');
    this.add.rectangle(320, 180, 640, 360, C.ink, 0.35).setDepth(-5);
    text(this, 320, 12, won ? 'THE LANDLORD IS DEFEATED' : 'EVICTED. BUT SOMEBODY STILL WINS.', { size: 12, ox: 0.5, color: won ? T.gold : T.red, strokeThickness: 5 });

    // heroes standing in a row with their crown counts above them
    this.actors = run.party.map((h, i) => {
      const x = 110 + i * 140;
      const a = actor(this, h.race, x, 200, SPRITE_HEIGHT.hero);
      if (!won && h.hp <= 0) { a.sprite.setAngle(-90); a.sprite.setTint(0x6a6070); }
      if (h.race === 'griffin') actor(this, 'dani', x + 34, 186, SPRITE_HEIGHT.companion * 0.8, { float: 10, depth: 180 });
      text(this, x, 208, h.name.toUpperCase(), { size: 8, ox: 0.5, color: RACES[h.race].color });
      text(this, x, 222, CLASSES[h.cls].short, { size: 8, ox: 0.5, color: T.grey });
      const tag = text(this, x, 100, '', { size: 8, ox: 0.5, color: T.gold, align: 'center' });
      return { a, tag, x };
    });
    this.refreshTags();

    this.ui = this.add.container(0, 0).setDepth(500);
    this.time.delayedCall(800, () => this.bonusRound());
  }

  refreshTags() {
    run.party.forEach((h, i) => this.actors[i].tag.setText(`${h.crowns} crown${h.crowns === 1 ? '' : 's'}  ${h.gold}g`));
  }

  async bonusRound() {
    const picks = rng.shuffle(BONUSES).filter((b) => run.party.some((h) => b.stat(h) > 0)).slice(0, 3);
    const banner = text(this, 320, 44, 'BONUS CROWNS!', { size: 16, ox: 0.5, color: T.gold, strokeThickness: 5 });
    sfx('jackpot');
    this.ui.add(banner);
    await this.wait(1200);
    for (const b of picks) {
      const best = Math.max(...run.party.map((h) => b.stat(h)));
      const winners = run.party.map((h, i) => ({ h, i })).filter(({ h }) => b.stat(h) === best);
      banner.setText(b.name);
      const sub = text(this, 320, 70, `${b.desc}...`, { size: 8, ox: 0.5, color: T.cream });
      this.ui.add(sub);
      sfx('dice');
      await this.wait(1300);
      winners.forEach(({ h, i }) => {
        h.crowns++;
        const a = this.actors[i];
        floater(this, a.x, 92, '+1 CROWN', T.gold, 12, true);
        this.tweens.add({ targets: a.a, y: a.a.y - 10, duration: 120, yoyo: true, repeat: 1 });
      });
      sub.setText(`${winners.map((w) => w.h.name).join(' & ')} (${best})`).setColor(T.gold);
      sfx('win');
      this.refreshTags();
      await this.wait(1600);
      sub.destroy();
    }
    banner.destroy();
    this.finale();
  }

  finale() {
    const order = standings();
    const champ = order[0];
    sfx('jackpot');
    this.cameras.main.flash(250, 247, 197, 72);
    const a = this.actors[champ.i];
    this.tweens.add({ targets: a.a, y: a.a.y - 14, duration: 260, yoyo: true, repeat: -1, ease: 'Quad.Out' });
    const t = text(this, 320, 40, `${champ.h.name.toUpperCase()} IS THE\nBIGGEST DEGENERATE`, { size: 16, ox: 0.5, align: 'center', color: T.gold, strokeThickness: 6, lineSpacing: 8 });
    t.setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 400, ease: 'Back.Out' });
    this.ui.add(t);
    this.ui.add(panel(this, 60, 240, 520, 66));
    order.forEach((o, k) => {
      const x = 76 + k * 128;
      this.ui.add(text(this, x, 250, `${k + 1}. ${o.h.name}`, { size: 8, color: RACES[o.h.race].color }));
      this.ui.add(text(this, x, 266, `${o.h.crowns} crown${o.h.crowns === 1 ? '' : 's'}`, { size: 8, color: T.gold }));
      this.ui.add(text(this, x, 282, `${o.h.gold}g`, { size: 8, color: T.cream }));
    });
    const s = run.stats;
    this.ui.add(text(this, 320, 314, `Josh probed ${s.probes}x  -  Griffin whipped ${s.whipped}x  -  ${s.cardsPlayed} dirty cards played  -  ${s.goldGambled}g gambled`, { size: 8, ox: 0.5, color: T.grey }));
    this.ui.add(button(this, 140, 326, 170, 30, 'PLAY AGAIN', () => fadeTo(this, 'Party'), { size: 10, fill: 0x2a5a3a }));
    this.ui.add(button(this, 330, 326, 170, 30, 'TITLE', () => fadeTo(this, 'Title'), { size: 10 }));
  }

  wait(ms) { return new Promise((r) => this.time.delayedCall(ms, r)); }
}
