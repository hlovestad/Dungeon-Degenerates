import { W, H } from './config.js';
import { BootScene } from './scenes/Boot.js';
import { TitleScene } from './scenes/Title.js';
import { PartyScene } from './scenes/Party.js';
import { MapScene } from './scenes/Map.js';
import { BattleScene } from './scenes/Battle.js';
import { ShopScene } from './scenes/Shop.js';
import { CasinoScene } from './scenes/Casino.js';
import { EventScene } from './scenes/Event.js';
import { EndScene } from './scenes/End.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#0b0710',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  scene: [BootScene, TitleScene, PartyScene, MapScene, BattleScene, ShopScene, CasinoScene, EventScene, EndScene],
});

// Handy for debugging from the browser console.
window.__game = game;
import * as State from './systems/state.js';
window.__dd = State;
