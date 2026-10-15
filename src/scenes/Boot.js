import { registerPlaceholders } from '../art/assets.js';
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
      entries.forEach(([key, path]) => this.load.image(key, path));
      this.load.on('loaderror', (file) => console.warn('Missing art, using placeholder:', file.key));
      await new Promise((res) => { this.load.once('complete', res); this.load.start(); });
    }
    registerPlaceholders(this);
    label.destroy();
    this.scene.start('Title');
  }
}
