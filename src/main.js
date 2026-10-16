import { W, H, landscapeSize } from './config.js';
import { setRouter } from './net/session.js';
import { BootScene } from './scenes/Boot.js';
import { TitleScene } from './scenes/Title.js';
import { PartyScene } from './scenes/Party.js';
import { MapScene } from './scenes/Map.js';
import { BattleScene } from './scenes/Battle.js';
import { ShopScene } from './scenes/Shop.js';
import { CasinoScene } from './scenes/Casino.js';
import { EventScene } from './scenes/Event.js';
import { EndScene } from './scenes/End.js';
import { TriviaScene } from './minigames/Trivia.js';
import { WhackScene } from './minigames/Whack.js';
import { ShowdownScene } from './minigames/Showdown.js';
import { ArcadeScene } from './scenes/Arcade.js';
import { StackScene } from './minigames/Stack.js';
import { LobbyScene } from './scenes/Lobby.js';
import { PartyGameScene } from './minigames/PartyGame.js';
import { WheelScene } from './minigames/Wheel.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: landscapeSize().w,
  height: H,
  backgroundColor: '#0b0710',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  scene: [BootScene, TitleScene, PartyScene, MapScene, BattleScene, ShopScene, CasinoScene, EventScene, EndScene, TriviaScene, WhackScene, ShowdownScene, WheelScene, ArcadeScene, StackScene, LobbyScene, PartyGameScene],
});

// Centre a landscape scene's camera on the 640-wide stage (tall scenes,
// like the card table, size themselves and keep scroll at 0).
function centre(scene) {
  if (document.body.classList.contains('tall')) return;
  const cam = scene.cameras?.main;
  if (cam) cam.setScroll(-Math.round((scene.scale.width - W) / 2), 0);
}
game.events.once('ready', () => {
  game.scene.scenes.forEach((sc) => sc.sys.events.on('create', () => centre(sc)));
});
let rt = null;
const refit = () => {
  if (document.body.classList.contains('tall')) return; // the tall scene handles itself
  const s = landscapeSize();
  if (s.w !== game.scale.width || s.h !== game.scale.height) game.scale.setGameSize(s.w, s.h);
  game.scene.getScenes(true).forEach(centre);
};
window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(refit, 150); });
window.__refit = refit;

// Android: go properly full screen (and stay sideways) on the first tap.
// iPhones don't allow this in Safari; there, Add to Home Screen does it.
window.addEventListener('pointerdown', () => {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen && !window.matchMedia('(display-mode: fullscreen)').matches) {
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
      if (!document.body.classList.contains('tall')) screen.orientation?.lock?.('landscape').catch(() => {});
    }).catch(() => {});
  }
}, { once: true });

// Online: the host tells client phones which scene to be in.
setRouter((net, m) => {
  const active = game.scene.getScenes(true).map((s) => s.scene.key);
  if (m.t === 'start' && active.includes('Stack')) return; // the card table restarts itself
  if (m.t === 'tolobby' && active.includes('Lobby')) return;
  const key = m.t === 'start' ? 'Stack' : m.t === 'tolobby' ? 'Lobby' : m.scene;
  const data = m.t === 'start' ? { net, init: m } : m.t === 'tolobby' ? {} : { net, init: m.init };
  game.scene.getScenes(true).forEach((s) => s.scene.stop());
  game.scene.start(key, data);
});

// Handy for debugging from the browser console.
window.__game = game;
import * as State from './systems/state.js';
window.__dd = State;
