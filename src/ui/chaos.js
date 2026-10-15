// CHAOS: big dumb visual events that can interrupt any scene (dungeon map,
// battles, the arcade hub). Purely visual: nobody loses HP or gold here.
//
//   playChaos(scene, id, { actors })  ->  Promise that resolves when it's over
//
// `actors` is a list of stage actors (containers from ui/stage.js actor()).
// Archie needs actors to bite; without them he just runs across the screen.

import { T, C } from '../config.js';
import { text } from './ui.js';
import { sfx } from '../audio/sfx.js';
import { poseKey, fitHeight, isReal } from '../art/assets.js';
import { reduceFlashing } from './settings.js';

export const CHAOS_IDS = ['psychosis', 'poop', 'archie'];
export const CHAOS_NAMES = {
  psychosis: "YOU'VE TRIGGERED THE ORACLE'S PSYCHOSIS",
  poop: 'POOP TIME',
  archie: "ARCHIE'S REVENGE",
};

const wait = (scene, ms) => new Promise((res) => scene.time.delayedCall(ms, res));

// Big wobbly title across the middle of the screen.
function banner(scene, str, color = T.gold, depth = 960) {
  const t = text(scene, 320, 150, str, { size: 16, ox: 0.5, oy: 0.5, color, strokeThickness: 6, wrap: 600, align: 'center', depth });
  t.setScale(0.2);
  scene.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.Out' });
  scene.tweens.add({ targets: t, angle: { from: -3, to: 3 }, duration: 260, yoyo: true, repeat: -1 });
  return t;
}

// Little helper: make a hit actor react (hurt pose, flash, shake), then reset.
function ouch(scene, a, word, color = T.red) {
  if (!a || !a.active) return;
  a.setPose?.('hurt');
  a.sprite.setTintFill(0xffffff);
  scene.time.delayedCall(80, () => a.sprite.active && a.sprite.clearTint());
  scene.tweens.add({ targets: a, x: a.x - 3, duration: 45, yoyo: true, repeat: 2 });
  const head = a.y - (a.h || 60) - (a.float || 0);
  const w = text(scene, a.x, head - 4, word, { size: 10, ox: 0.5, oy: 1, color, strokeThickness: 4, depth: 955 });
  scene.tweens.add({ targets: w, y: w.y - 18, alpha: 0, duration: 800, onComplete: () => w.destroy() });
  scene.time.delayedCall(500, () => a.active && a.setPose?.('idle'));
}

export async function playChaos(scene, id, { actors = [] } = {}) {
  if (scene.chaosRunning) return;
  scene.chaosRunning = true;
  try {
    if (id === 'psychosis') await psychosis(scene, actors);
    else if (id === 'poop') await poop(scene, actors);
    else if (id === 'archie') await archie(scene, actors);
  } finally {
    scene.chaosRunning = false;
  }
}

// ------------------------------------------------------------ the oracle
// 5 seconds of swirl, colour pulses, a tilting wobbling camera, and the words.
// Flashing stays under 3 per second (photosensitive-safe), and "reduce
// flashing" in settings turns the colour pulses into a slow fade.
async function psychosis(scene, actors) {
  const D = 940;
  const cam = scene.cameras.main;
  const calm = reduceFlashing();
  sfx('magic');

  // colour wash: shifts hue a couple of times a second, never full white
  const wash = scene.add.rectangle(320, 180, 640, 360, 0x9b59d0, 0).setDepth(D);
  const hues = [0x9b59d0, 0x5fcde4, 0xf7c548, 0xd9473c, 0x6abe30];
  let hi = 0;
  const pulse = scene.time.addEvent({
    delay: calm ? 1200 : 400, // 2.5 changes a second at most
    loop: true,
    callback: () => {
      hi = (hi + 1) % hues.length;
      wash.setFillStyle(hues[hi], 1);
      scene.tweens.add({ targets: wash, alpha: { from: calm ? 0.18 : 0.32, to: 0.1 }, duration: calm ? 1100 : 360 });
    },
  });

  // swirl: two spinning spiral arms drawn once, rotated every frame
  const swirl = scene.add.graphics().setDepth(D + 1).setPosition(320, 180);
  const arms = [0xc58cff, 0x7fe0f0, 0xf7c548];
  arms.forEach((col, k) => {
    swirl.lineStyle(6, col, 0.55);
    swirl.beginPath();
    for (let s = 0; s <= 120; s++) {
      const a = s * 0.16 + (k * Math.PI * 2) / arms.length;
      const r = s * 3.4;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (s === 0) swirl.moveTo(x, y); else swirl.lineTo(x, y);
    }
    swirl.strokePath();
  });
  swirl.setScale(0.2).setAlpha(0);
  scene.tweens.add({ targets: swirl, scale: 1.2, alpha: 1, duration: 600, ease: 'Quad.Out' });
  scene.tweens.add({ targets: swirl, angle: 360 * 3, duration: 5000, ease: 'Linear' });

  // the third eye, huge, in the middle
  const eye = scene.add.container(320, 80).setDepth(D + 2);
  const white = scene.add.ellipse(0, 0, 70, 34, 0xfff6e0);
  const iris = scene.add.circle(0, 0, 13, 0x9b59d0);
  const pupil = scene.add.circle(0, 0, 6, C.ink);
  eye.add([white, iris, pupil]);
  eye.setScale(0);
  scene.tweens.add({ targets: eye, scale: 1, duration: 500, ease: 'Back.Out' });
  scene.tweens.add({ targets: [iris, pupil], x: { from: -18, to: 18 }, duration: 350, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

  const title = banner(scene, CHAOS_NAMES.psychosis, T.purple, D + 3);
  title.setY(190);

  // everyone in the scene spins and floats a bit
  const spun = actors.filter((a) => a && a.active);
  spun.forEach((a, k) => scene.tweens.add({ targets: a.sprite, angle: 360, duration: 1400, delay: k * 120, repeat: 2, ease: 'Sine.InOut' }));

  // the camera tilts and breathes
  const t0 = scene.time.now;
  const wobble = scene.time.addEvent({
    delay: 16, loop: true,
    callback: () => {
      const t = (scene.time.now - t0) / 1000;
      cam.setRotation(Math.sin(t * 3) * 0.06);
      cam.setZoom(1 + Math.sin(t * 2.2) * 0.04);
    },
  });

  const lines = ['THE WALLS ARE BREATHING', 'I CAN TASTE COLOURS', 'WE ARE ALL LONG JOHNNY', 'THE ANUNNAKI ARE HERE'];
  for (let k = 0; k < 3; k++) {
    await wait(scene, 1300);
    const w = text(scene, 120 + Math.random() * 400, 250 + Math.random() * 50, lines[(k + Math.floor(Math.random() * 4)) % 4], { size: 8, ox: 0.5, color: T.cream, strokeThickness: 4, depth: D + 3 });
    scene.tweens.add({ targets: w, alpha: 0, y: w.y - 30, duration: 1300, onComplete: () => w.destroy() });
  }
  await wait(scene, 1100); // ~5 seconds total

  pulse.remove(); wobble.remove();
  cam.setRotation(0); cam.setZoom(1);
  spun.forEach((a) => { scene.tweens.killTweensOf(a.sprite); a.sprite.setAngle(0); });
  scene.tweens.add({ targets: [wash, swirl, eye, title], alpha: 0, duration: 300, onComplete: () => { wash.destroy(); swirl.destroy(); eye.destroy(); title.destroy(); } });
  await wait(scene, 320);
}

// ------------------------------------------------------------ poop time
async function poop(scene, actors) {
  const D = 940;
  sfx('whip');
  const title = banner(scene, CHAOS_NAMES.poop, '#c08a52', D + 3);
  title.setY(120);
  const targets = actors.filter((a) => a && a.active);
  const piles = [];
  const ground = (x) => {
    // land at the feet line of the nearest actor, otherwise near the bottom
    const near = targets.reduce((b, a) => (Math.abs(a.x - x) < Math.abs((b?.x ?? 9e9) - x) ? a : b), null);
    return near && Math.abs(near.x - x) < 120 ? near.y + 2 : 300;
  };
  const drop = () => {
    const x = 10 + Math.random() * 620;
    const p = scene.add.image(x, -12, 'prop_poop').setDepth(D - 2).setAngle(Math.random() * 40 - 20);
    if (isReal('prop_poop')) p.setScale(1.6); else p.setScale(2.4);
    const gy = ground(x);
    // a direct hit on somebody's head?
    const victim = targets.find((a) => Math.abs(a.x - x) < 18);
    const endY = victim ? victim.y - (victim.h || 60) - (victim.float || 0) + 4 : gy;
    scene.tweens.add({
      targets: p, y: endY, angle: p.angle + 180, duration: 650 + Math.random() * 400, ease: 'Quad.In',
      onComplete: () => {
        if (victim) {
          sfx('splat');
          ouch(scene, victim, rng3(['EW!', 'GROSS!', 'NOT AGAIN!', 'ON MY HEAD?!']), '#c08a52');
          scene.tweens.add({ targets: p, y: gy, x: p.x + (Math.random() * 30 - 15), duration: 300, ease: 'Bounce.Out' });
        } else {
          scene.tweens.add({ targets: p, scaleY: p.scaleY * 0.7, duration: 90, yoyo: true });
        }
        piles.push(p);
      },
    });
  };
  const rain = scene.time.addEvent({ delay: 70, repeat: 60, callback: drop });
  scene.cameras.main.shake(4800, 0.0025);
  await wait(scene, 4800);
  rain.remove();
  await wait(scene, 700);
  scene.tweens.add({ targets: [...piles, title], alpha: 0, duration: 500, onComplete: () => { piles.forEach((p) => p.destroy()); title.destroy(); } });
  await wait(scene, 520);
}

// ------------------------------------------------------------ archie
// Archie sprints in, bites every character in turn, then leaves.
async function archie(scene, actors) {
  const D = 945;
  sfx('bark');
  const title = banner(scene, CHAOS_NAMES.archie, T.red, D + 3);
  title.setY(110);
  const dog = scene.add.image(700, 280, poseKey(scene, 'archie', 'idle')).setOrigin(0.5, 1).setDepth(D);
  if (isReal(dog.texture.key)) dog.setScale(640 / 480); else fitHeight(dog, 52);
  dog.setFlipX(true); // runs in from the right, facing left
  const hop = scene.tweens.add({ targets: dog, y: '-=5', duration: 90, yoyo: true, repeat: -1 });
  const run = (x, y, ms) => new Promise((res) => {
    dog.setFlipX(x < dog.x);
    scene.tweens.add({ targets: dog, x, duration: ms, ease: 'Linear', onUpdate: () => dog.setDepth(Math.max(D, dog.y)), onComplete: res });
    if (y !== undefined) scene.tweens.add({ targets: dog, y, duration: ms });
  });
  const victims = actors.filter((a) => a && a.active).sort((a, b) => b.x - a.x);
  await wait(scene, 400);
  if (!victims.length) {
    await run(-60, 280, 1600);
  } else {
    for (const a of victims) {
      await run(a.x + 22, a.y + 1, 380);
      sfx('bark');
      scene.cameras.main.shake(120, 0.006);
      ouch(scene, a, ['CHOMP!', 'MY ANKLE!', 'BAD DOG!', 'ARCHIE NO!'][Math.floor(Math.random() * 4)]);
      // a little shake of the head on the bite
      scene.tweens.add({ targets: dog, angle: { from: -12, to: 12 }, duration: 70, yoyo: true, repeat: 3, onComplete: () => dog.setAngle(0) });
      await wait(scene, 520);
    }
    await run(-60, 280, 700);
  }
  hop.stop();
  dog.destroy();
  scene.tweens.add({ targets: title, alpha: 0, duration: 300, onComplete: () => title.destroy() });
  await wait(scene, 320);
}

function rng3(list) { return list[Math.floor(Math.random() * list.length)]; }
