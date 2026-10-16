import { T, SPRITE_HEIGHT, VERSION } from '../config.js';
import { text, button, iconButton, fadeTo, fadeIn } from '../ui/ui.js';
import { background, actor } from '../ui/stage.js';
import { reduceFlashing, toggleReduceFlashing } from '../ui/settings.js';
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

    const start = button(this, 70, 292, 160, 40, 'DUNGEON', () => {
      unlockAudio();
      sfx('win');
      fadeTo(this, 'Party');
    }, { size: 12, fill: 0x6a2a3a, depth: 300 });
    const arcade = button(this, 240, 292, 160, 40, 'ARCADE', () => {
      unlockAudio();
      sfx('jackpot');
      fadeTo(this, 'Arcade', { fresh: true });
    }, { size: 12, fill: 0x2a3a6a, depth: 300 });
    const online = button(this, 410, 292, 160, 40, 'ONLINE', () => {
      unlockAudio();
      sfx('coin');
      fadeTo(this, 'Lobby');
    }, { size: 12, fill: 0x2a5a3a, depth: 300 });
    this.tweens.add({ targets: [start, arcade, online], alpha: 0.8, duration: 500, yoyo: true, repeat: -1, ease: 'Stepped' });

    const flash = button(this, 470, 340, 164, 18, `REDUCE FLASHING: ${reduceFlashing() ? 'ON' : 'OFF'}`, () => {
      flash.setLabel(`REDUCE FLASHING: ${toggleReduceFlashing() ? 'ON' : 'OFF'}`);
    }, { size: 8, depth: 300 });

    const mute = iconButton(this, 602, 8, isMuted() ? 'x' : '♪', () => {
      unlockAudio();
      mute.setLabel(toggleMute() ? 'x' : '♪');
    });
    text(this, 8, 348, 'v' + VERSION + ' prototype', { size: 8, color: T.grey, oy: 1 });
  }
}
