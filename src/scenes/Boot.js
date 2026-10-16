import { registerPlaceholders, REAL } from '../art/assets.js';
import { text } from '../ui/ui.js';
import { T } from '../config.js';

// Loads the pixel font, then any real art listed in assets/manifest.json,
// then fills every gap with generated placeholder art.
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.json('manifest', 'assets/manifest.json');
  }

  async create() {
    try { await document.fonts.load('10px PressStart'); } catch (e) { /* fall back to monospace */ }
    const label = text(this, 320, 180, 'Summoning degenerates...', { size: 10, ox: 0.5, oy: 0.5, color: T.grey });

    const manifest = this.cache.json.get('manifest') || {};
    const entries = Object.entries(manifest.images || {});
    if (entries.length) {
      entries.forEach(([key, path]) => { this.load.image(key, path); REAL.add(key); });
      this.load.on('loaderror', (file) => console.warn('Missing art, using placeholder:', file.key));
      await new Promise((res) => { this.load.once('complete', res); this.load.start(); });
    }
    registerPlaceholders(this);
    // tiny white square used by particle effects
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 3, 3);
    g.generateTexture('px', 3, 3);
    g.destroy();
    // ?test=battle jumps straight into the art test battle
    if (new URLSearchParams(location.search).get('test') === 'battle') {
      const { newRun } = await import('../systems/state.js');
      newRun([{ race: 'haakon', cls: 'juggernaut' }, { race: 'mike', cls: 'goblin_king' }, { race: 'josh', cls: 'cosmic_oracle' }, { race: 'griffin', cls: 'hellbound_gambler' }]);
      label.destroy();
      this.scene.start('Battle', { type: 'fight', enemies: ['goblin_grunt', 'goblin_grunt'], bg: 'bg_dungeon_crypt', depth: 1, test: true, intro: 'ART TEST: two goblins, one crypt.' });
      return;
    }
    if (new URLSearchParams(location.search).get('test') === 'stack') {
      const { startArcade, beginGame, gameById } = await import('../systems/arcade.js');
      const { ARCADE_PICKS } = await import('./Arcade.js');
      startArcade(ARCADE_PICKS);
      beginGame(gameById('stack'));
      label.destroy();
      this.scene.start('Stack', { returnTo: 'Arcade', auto: new URLSearchParams(location.search).get('auto') === '1' });
      return;
    }
    if (new URLSearchParams(location.search).get('test') === 'arcade') {
      label.destroy();
      this.scene.start('Arcade', { fresh: true });
      return;
    }
    label.destroy();
    this.scene.start('Title');
  }
}
