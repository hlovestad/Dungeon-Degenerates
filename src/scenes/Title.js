import { T, SPRITE_HEIGHT, VERSION } from '../config.js';
import { text, button, iconButton, fadeTo, fadeIn } from '../ui/ui.js';
import { background, actor } from '../ui/stage.js';
import { unlockAudio, toggleMute, isMuted, sfx } from '../audio/sfx.js';

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    fadeIn(this);
    background(this, 'bg_title');

    // Title with a chunky drop shadow
    const title1 = text(this, 320, 34, 'DUNGEON', { size: 32, ox: 0.5, color: T.gold, strokeThickness: 6 });
    const title2 = text(this, 320, 74, 'DEGENERATES', { size: 32, ox: 0.5, color: T.red, strokeThickness: 6 });
    this.tweens.add({ targets: [title1, title2], y: '-=2', duration: 700, yoyo: true, repeat: -1, ease: 'Stepped' });
    text(this, 320, 118, 'Different races. Same classes. Maximum degeneracy.', { size: 8, ox: 0.5, color: T.cream });

    // The lineup
    const xs = [170, 260, 380, 470];
    ['haakon', 'mike', 'josh', 'griffin'].forEach((id, i) => {
      actor(this, id, xs[i], 262, SPRITE_HEIGHT.hero + 6);
    });
    actor(this, 'dani', 512, 250, SPRITE_HEIGHT.companion, { float: 14, depth: 240 });

    const start = button(this, 230, 292, 180, 40, 'TAP TO PLAY', () => {
      unlockAudio();
      sfx('win');
      fadeTo(this, 'Party');
    }, { size: 12, fill: 0x6a2a3a, depth: 300 });
    this.tweens.add({ targets: start, alpha: 0.75, duration: 500, yoyo: true, repeat: -1, ease: 'Stepped' });

    const mute = iconButton(this, 602, 8, isMuted() ? 'x' : '♪', () => {
      unlockAudio();
      mute.setLabel(toggleMute() ? 'x' : '♪');
    });
    text(this, 8, 348, 'v' + VERSION + ' prototype', { size: 8, color: T.grey, oy: 1 });
  }
}
