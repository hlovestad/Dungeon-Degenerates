// The DIRTY CARDS menu: pick who's playing, pick a card, pick a victim.
// Shared by the dungeon map and the arcade hub. onDone runs after DONE.
import { T } from '../config.js';
import { text, panel, button, dimmer } from './ui.js';
import { run } from '../systems/state.js';
import { CARDS, playCard } from '../systems/cards.js';
import { RACES } from '../data/races.js';
import { fitHeight, poseKey } from '../art/assets.js';
import { sfx } from '../audio/sfx.js';

export function openCardMenu(scene, onDone = () => {}) {
  const M = {
    openCards() {
      sfx('select');
      scene.cardUi?.destroy();
      const ui = scene.add.container(0, 0).setDepth(900);
      scene.cardUi = ui;
      ui.add(dimmer(scene, 0.7, 0));
      ui.add(panel(scene, 20, 20, 600, 320));
      ui.add(text(scene, 320, 34, "WHO'S PLAYING A CARD?", { size: 12, ox: 0.5, color: T.gold }));
      run.party.forEach((h, i) => {
        const b = button(scene, 36 + i * 144, 64, 136, 54, h.name.toUpperCase(), () => M.pickCard(i), {
          size: 10, sub: h.cards.length ? `${h.cards.length} card${h.cards.length > 1 ? 's' : ''}` : 'no cards',
        });
        b.setEnabled(h.cards.length > 0);
        ui.add(b);
      });
      ui.add(text(scene, 320, 140, 'Win cards in showdowns, buy them at the Goblin Market.\nREVERSE cards work by themselves: they bounce the next card played on you.', { size: 8, ox: 0.5, align: 'center', color: T.grey, lineSpacing: 6 }));
      ui.add(button(scene, 250, 290, 140, 36, 'DONE', () => M.closeCards(), { size: 10 }));
    },

    closeCards() {
      scene.cardUi?.destroy();
      scene.cardUi = null;
      onDone();
    },

    pickCard(i) {
      const h = run.party[i];
      const ui = scene.cardUi;
      ui.removeAll(true);
      ui.add(dimmer(scene, 0.7, 0));
      ui.add(panel(scene, 20, 20, 600, 320));
      ui.add(text(scene, 320, 34, `${h.name.toUpperCase()}'S HAND`, { size: 12, ox: 0.5, color: RACES[h.race].color }));
      h.cards.forEach((cid, k) => {
        const c = CARDS[cid];
        const b = button(scene, 40 + k * 190, 64, 180, 110, c.name, () => (c.hostile ? M.pickTarget(i, cid) : M.resolve(i, cid, i)), {
          size: 10, fill: c.color, sub: c.desc,
        });
        if (c.passive) b.setEnabled(false);
        ui.add(b);
      });
      ui.add(button(scene, 250, 290, 140, 36, 'BACK', () => M.openCards(), { size: 10 }));
    },

    pickTarget(i, cid) {
      const ui = scene.cardUi;
      ui.removeAll(true);
      ui.add(dimmer(scene, 0.7, 0));
      ui.add(panel(scene, 20, 20, 600, 320));
      ui.add(text(scene, 320, 34, `${CARDS[cid].name}: ON WHO?`, { size: 12, ox: 0.5, color: T.gold }));
      run.party.forEach((t, k) => {
        if (k === i) return;
        const x = 60 + (k > i ? k - 1 : k) * 180;
        const b = button(scene, x, 80, 160, 90, t.name.toUpperCase(), () => M.resolve(i, cid, k), {
          size: 12, sub: `${t.gold} gold, ${t.crowns} crown${t.crowns === 1 ? '' : 's'}`,
        });
        ui.add(b);
        const s = scene.add.image(x + 80, 230, poseKey(scene, t.race, 'idle')).setOrigin(0.5, 1);
        fitHeight(s, 50);
        ui.add(s);
      });
      ui.add(button(scene, 250, 290, 140, 36, 'BACK', () => M.pickCard(i), { size: 10 }));
    },

    async resolve(i, cid, k) {
      const lines = playCard(i, cid, k);
      const ui = scene.cardUi;
      ui.removeAll(true);
      ui.add(dimmer(scene, 0.75, 0));
      sfx(cid === 'double' ? 'jackpot' : 'whip');
      scene.cameras.main.shake(200, 0.006);
      const big = text(scene, 320, 70, CARDS[cid].name, { size: 24, ox: 0.5, color: T.red, strokeThickness: 6 });
      big.setScale(0.3);
      scene.tweens.add({ targets: big, scale: 1, duration: 260, ease: 'Back.Out' });
      ui.add(big);
      lines.forEach((ln, n) => {
        const t = text(scene, 320, 130 + n * 30, ln, { size: 10, ox: 0.5, align: 'center', wrap: 560, color: ln.startsWith('REVERSE') ? T.gold : T.cream });
        t.setAlpha(0);
        scene.tweens.add({ targets: t, alpha: 1, delay: 300 + n * 700, duration: 200, onStart: () => { if (ln.startsWith('REVERSE')) { sfx('crit'); scene.cameras.main.flash(150, 247, 197, 72); } } });
        ui.add(t);
      });
      scene.time.delayedCall(400 + lines.length * 700, () => {
        ui.add(button(scene, 170, 280, 140, 40, 'MORE CARDS', () => M.openCards(), { size: 10 }));
        ui.add(button(scene, 330, 280, 140, 40, 'DONE', () => M.closeCards(), { size: 10, fill: 0x2a5a3a }));
      });
    }
  };
  M.openCards();
}
