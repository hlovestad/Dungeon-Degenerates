// Tiny timing minigames that pop up over a scene. Each returns a Promise.
// They only report what the player did; the rules decide what it means.
import { C, T } from '../config.js';
import { text, drawPanel } from './ui.js';
import { sfx } from '../audio/sfx.js';

// Power meter: a marker sweeps across a bar, tap to stop it.
// Resolves 'perfect' | 'good' | 'weak'.
export function powerMeter(scene, label = 'TAP IN THE GOLD!') {
  return new Promise((resolve) => {
    const D = 900;
    const cx = 320, cy = 150, w = 300, h = 18;
    const shield = scene.add.rectangle(320, 180, 2000, 360, C.ink, 0.25).setDepth(D).setInteractive();
    const g = scene.add.graphics().setDepth(D + 1);
    drawPanel(g, cx - w / 2 - 14, cy - 34, w + 28, 74, { fill: C.panel });
    // zones: weak (red) | good (cream) | perfect (gold, narrow, random spot)
    const perfectW = 26;
    const perfectX = cx - w / 2 + 40 + Math.random() * (w - 80 - perfectW);
    const goodW = 90;
    const goodX = Math.max(cx - w / 2, Math.min(cx + w / 2 - goodW, perfectX + perfectW / 2 - goodW / 2));
    g.fillStyle(C.ink, 1); g.fillRect(cx - w / 2 - 2, cy - 2, w + 4, h + 4);
    g.fillStyle(0x6a2a3a, 1); g.fillRect(cx - w / 2, cy, w, h);
    g.fillStyle(0xd8c89a, 1); g.fillRect(goodX, cy, goodW, h);
    g.fillStyle(C.gold, 1); g.fillRect(perfectX, cy, perfectW, h);
    const title = text(scene, cx, cy - 24, label, { size: 10, ox: 0.5, color: T.gold, depth: D + 2 });
    const marker = scene.add.rectangle(cx - w / 2, cy + h / 2, 4, h + 12, 0xffffff).setDepth(D + 2).setStrokeStyle(2, C.ink);
    const tw = scene.tweens.add({ targets: marker, x: cx + w / 2, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    let done = false;
    const finish = (q) => {
      if (done) return;
      done = true;
      tw.stop();
      shield.off('pointerdown');
      const word = { perfect: 'PERFECT!', good: 'GOOD', weak: 'WEAK...' }[q];
      const col = { perfect: T.gold, good: T.cream, weak: T.red }[q];
      sfx(q === 'perfect' ? 'jackpot' : q === 'good' ? 'select' : 'miss');
      const res = text(scene, cx, cy + 34, word, { size: 12, ox: 0.5, color: col, depth: D + 3 });
      if (q === 'perfect') scene.cameras.main.flash(120, 247, 197, 72);
      scene.time.delayedCall(420, () => {
        [shield, g, title, marker, res, timer].forEach((o) => o.destroy());
        resolve(q);
      });
    };
    shield.on('pointerdown', () => {
      const x = marker.x;
      if (x >= perfectX - 2 && x <= perfectX + perfectW + 2) finish('perfect');
      else if (x >= goodX && x <= goodX + goodW) finish('good');
      else finish('weak');
    });
    const timer = scene.time.delayedCall(4000, () => finish('weak'));
  });
}

// Dodge prompt: after a random delay a DODGE button flashes; tap it in time.
// Resolves true if dodged.
export function dodgePrompt(scene, warn = 'BIG ATTACK INCOMING...') {
  return new Promise((resolve) => {
    const D = 900;
    const shield = scene.add.rectangle(320, 180, 2000, 360, 0x3a0a14, 0.35).setDepth(D).setInteractive();
    const warnT = text(scene, 320, 120, warn, { size: 12, ox: 0.5, color: T.red, depth: D + 1 });
    const sub = text(scene, 320, 142, 'Wait for it... then TAP!', { size: 8, ox: 0.5, color: T.cream, depth: D + 1 });
    let live = false;
    let done = false;
    let btn = null;
    const end = (ok, why) => {
      if (done) return;
      done = true;
      sfx(ok ? 'jackpot' : 'hit');
      const res = text(scene, 320, 200, ok ? 'DODGED!' : why, { size: 16, ox: 0.5, color: ok ? T.green : T.red, depth: D + 3 });
      scene.time.delayedCall(500, () => {
        [shield, warnT, sub, res, btn].forEach((o) => o && o.destroy());
        resolve(ok);
      });
    };
    shield.on('pointerdown', () => end(live, 'TOO EARLY!'));
    scene.time.delayedCall(700 + Math.random() * 1300, () => {
      if (done) return;
      live = true;
      sfx('crit');
      btn = text(scene, 320, 190, 'DODGE!', { size: 24, ox: 0.5, oy: 0.5, color: T.gold, depth: D + 2, strokeThickness: 6 });
      scene.tweens.add({ targets: btn, scale: 1.2, duration: 120, yoyo: true, repeat: -1 });
      scene.time.delayedCall(750, () => { live = false; end(false, 'TOO SLOW!'); });
    });
  });
}
