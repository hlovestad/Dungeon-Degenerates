// Plays quips, random events and chaos in any scene. Arcade hub, dungeon map
// and battles all use this, so a joke added once shows up everywhere.
//
// items: what systems/arcade.js returns ({ type: 'quip' | 'event' | 'chaos' }).
// opts:
//   actorOf(i)  -> the stage actor for party seat i, or null (map has none)
//   anchorOf(i) -> {x, y} for bubbles/floaters when there's no actor
//   actors      -> everyone who can get hit by chaos
//   dani        -> Dani's actor, if she's in the scene
//   onGold()    -> redraw purses after gold moves

import { T, C } from '../config.js';
import { text, panel, bubble } from './ui.js';
import { playChaos } from './chaos.js';
import { sfx } from '../audio/sfx.js';
import { run } from '../systems/state.js';
import { RACES } from '../data/races.js';

const wait = (scene, ms) => new Promise((res) => scene.time.delayedCall(ms, res));

function headOf(a) {
  return { x: a.x, y: a.y - (a.h || 60) - (a.float || 0) - 2 };
}

export function speak(scene, who, line, opts, ms = 2600) {
  const a = who === 'dani' ? opts.dani : opts.actorOf?.(who);
  const p = a ? headOf(a) : who === 'dani' ? { x: 320, y: 120 } : opts.anchorOf?.(who) || { x: 320, y: 120 };
  const b = bubble(scene, p.x, p.y, line, ms);
  b.setDepth(880);
  return b;
}

function goldFloat(scene, i, d, opts) {
  const a = opts.actorOf?.(i);
  const p = a ? headOf(a) : opts.anchorOf?.(i) || { x: 320, y: 180 };
  const t = text(scene, p.x, p.y - 4, `${d > 0 ? '+' : ''}${d}g`, { size: 10, ox: 0.5, oy: 1, color: d > 0 ? T.gold : T.red, strokeThickness: 4, depth: 900 });
  scene.tweens.add({ targets: t, y: t.y - 22, alpha: 0, delay: 700, duration: 900, onComplete: () => t.destroy() });
}

// A friend "steps away": walks off the nearest edge, comes back later.
function walkOff(scene, a) {
  if (!a) return () => {};
  const home = a.x;
  const edge = a.x < 320 ? -80 : 720;
  scene.tweens.add({ targets: a, x: edge, duration: 700, ease: 'Quad.In' });
  return () => scene.tweens.add({ targets: a, x: home, duration: 700, ease: 'Quad.Out' });
}

async function showEvent(scene, ev, opts) {
  // the friend says their gag first, then leaves
  let comeBack = () => {};
  if (ev.line !== undefined && ev.who !== undefined) {
    speak(scene, ev.who, ev.line, opts, 2800);
    await wait(scene, 2300);
    if (typeof ev.who === 'number') comeBack = walkOff(scene, opts.actorOf?.(ev.who));
  }
  sfx('select');
  const D = 870;
  const box = scene.add.container(0, 0).setDepth(D);
  const top = 112;
  box.add(panel(scene, 110, top, 420, 92, { alpha: 0.95, border: C.gold }));
  const owner = typeof ev.who === 'number' ? run.party[ev.who] : null;
  box.add(text(scene, 320, top + 12, ev.title, { size: 12, ox: 0.5, color: owner ? RACES[owner.race].color : T.gold }));
  box.add(text(scene, 320, top + 36, ev.text, { size: 8, ox: 0.5, align: 'center', wrap: 390, lineSpacing: 5, color: T.cream }));
  box.setAlpha(0);
  scene.tweens.add({ targets: box, alpha: 1, duration: 180 });
  await wait(scene, 500);
  (ev.changes || []).forEach((c) => goldFloat(scene, c.i, c.d, opts));
  if (ev.changes?.length) sfx('coin');
  opts.onGold?.();
  // auto-advance (every phone sees the same thing, nobody has to tap)
  await new Promise((res) => {
    let done = false;
    const finish = () => { if (!done) { done = true; res(); } };
    scene.time.delayedCall(3600, finish);
    scene.input.once('pointerdown', () => scene.time.delayedCall(250, finish));
  });
  scene.tweens.add({ targets: box, alpha: 0, duration: 200, onComplete: () => box.destroy() });
  comeBack();
  await wait(scene, 400);
}

export async function playInterlude(scene, items, opts = {}) {
  for (const it of items) {
    if (!scene.sys.isActive()) return;
    if (it.type === 'quip') {
      speak(scene, it.who, it.line, opts);
      await wait(scene, 2000);
    } else if (it.type === 'event') {
      await showEvent(scene, it, opts);
    } else if (it.type === 'chaos') {
      await playChaos(scene, it.id, { actors: opts.actors || [] });
    }
  }
}
