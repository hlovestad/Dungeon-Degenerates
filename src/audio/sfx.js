// Crunchy retro sound effects synthesized with WebAudio (no audio files).
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('dd_muted') === '1'; } catch (e) { /* storage unavailable */ }

export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('dd_muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
  return muted;
}

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function tone({ type = 'square', from = 440, to = from, dur = 0.1, vol = 0.12, delay = 0, noise = false }) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  g.connect(ctx.destination);
  if (noise) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = from;
    src.connect(f); f.connect(g);
    src.start(t0);
    return;
  }
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  o.connect(g);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  select: () => tone({ from: 660, to: 880, dur: 0.06, vol: 0.08 }),
  back: () => tone({ from: 440, to: 300, dur: 0.06, vol: 0.08 }),
  step: () => tone({ type: 'triangle', from: 180, to: 120, dur: 0.05, vol: 0.06 }),
  swing: () => tone({ noise: true, from: 2400, dur: 0.08, vol: 0.12 }),
  hit: () => { tone({ noise: true, from: 900, dur: 0.12, vol: 0.2 }); tone({ from: 160, to: 60, dur: 0.12, vol: 0.12 }); },
  crit: () => { tone({ noise: true, from: 1600, dur: 0.2, vol: 0.25 }); tone({ from: 300, to: 50, dur: 0.25, vol: 0.15 }); },
  miss: () => tone({ type: 'triangle', from: 500, to: 200, dur: 0.15, vol: 0.07 }),
  heal: () => { [523, 659, 784].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.12, vol: 0.08, delay: i * 0.06 })); },
  coin: () => { tone({ from: 988, dur: 0.05, vol: 0.08 }); tone({ from: 1319, dur: 0.12, vol: 0.08, delay: 0.05 }); },
  die: () => tone({ type: 'sawtooth', from: 300, to: 40, dur: 0.4, vol: 0.12 }),
  magic: () => tone({ type: 'sawtooth', from: 200, to: 1200, dur: 0.25, vol: 0.08 }),
  probe: () => { for (let i = 0; i < 6; i++) tone({ type: 'sine', from: 900 + i * 120, to: 600, dur: 0.08, vol: 0.07, delay: i * 0.09 }); },
  whip: () => { tone({ noise: true, from: 4000, dur: 0.05, vol: 0.2 }); tone({ type: 'triangle', from: 700, to: 350, dur: 0.3, vol: 0.08, delay: 0.06 }); },
  jackpot: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ from: f, dur: 0.14, vol: 0.09, delay: i * 0.08 })); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.25, vol: 0.1, delay: i * 0.2 })); },
  win: () => { [523, 659, 784, 659, 1047].forEach((f, i) => tone({ type: 'square', from: f, dur: 0.14, vol: 0.07, delay: i * 0.11 })); },
  bark: () => { tone({ type: 'square', from: 520, to: 260, dur: 0.09, vol: 0.12 }); tone({ type: 'square', from: 560, to: 280, dur: 0.09, vol: 0.12, delay: 0.14 }); },
  splat: () => { tone({ noise: true, from: 500, dur: 0.1, vol: 0.18 }); tone({ type: 'triangle', from: 180, to: 70, dur: 0.12, vol: 0.1 }); },
  dice: () => { for (let i = 0; i < 5; i++) tone({ noise: true, from: 3000, dur: 0.03, vol: 0.1, delay: i * 0.06 }); },
};

export function sfx(name) {
  const f = SOUNDS[name];
  if (f) f();
}
