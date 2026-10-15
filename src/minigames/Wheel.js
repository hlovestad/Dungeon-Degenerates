// WHEEL OF MISFORTUNE: Mario Party "Chance Time". The room picker spins the
// wheel for an effect, then two name reels pick who it happens to. Pure chaos.
import { T, C } from '../config.js';
import { RACES } from '../data/races.js';
import { text, panel, button, floater, fadeTo, fadeIn } from '../ui/ui.js';
import { hubScene } from '../systems/arcade.js';
import { background, spawnParty } from '../ui/stage.js';
import { run, rng, steal, addGold, giveCard } from '../systems/state.js';
import { CARDS } from '../systems/cards.js';
import { SCENE_SLOTS } from '../scenes/Event.js';
import { sfx } from '../audio/sfx.js';

// `pair`: needs two different friends (A and B). Otherwise just A, or nobody.
const SLICES = [
  { id: 'swapgold', label: 'SWAP\nGOLD', color: 0xc99a3a, pair: true },
  { id: 'gift', label: 'GIFT\n30G', color: 0x2a6a3a, pair: true },
  { id: 'bankrupt', label: 'BANK-\nRUPT', color: 0x2a2a34, pair: false },
  { id: 'jackpot', label: 'JACK-\nPOT', color: 0xd9a020, pair: false },
  { id: 'swapcrown', label: 'SWAP\nCROWNS', color: 0x8a1c2b, pair: true },
  { id: 'cardthief', label: 'CARD\nTHIEF', color: 0x5a2a7a, pair: true },
  { id: 'taxday', label: 'TAX\nDAY', color: 0x3a5a8a, pair: false },
  { id: 'robin', label: 'ROBIN\nHOOD', color: 0x3a7a3a, pair: null },
];

export class WheelScene extends Phaser.Scene {
  constructor() { super('Wheel'); }

  create(data = {}) {
    fadeIn(this);
    this.returnTo = data.returnTo || hubScene();
    background(this, 'bg_trivia_stage');
    this.party = spawnParty(this, { slots: SCENE_SLOTS.map((s) => ({ x: s.x - 10, y: s.y + 26 })) });
    this.spinner = run.roomLeader ?? 0;
    text(this, 400, 10, 'WHEEL OF MISFORTUNE', { size: 12, ox: 0.5, color: T.gold });

    // the wheel
    this.cx = 430; this.cy = 140; this.r = 92;
    this.wheel = this.add.container(this.cx, this.cy).setDepth(10);
    const g = this.add.graphics();
    const n = SLICES.length;
    SLICES.forEach((sl, i) => {
      const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
      g.fillStyle(sl.color, 1);
      g.slice(0, 0, this.r, a0, a1, false);
      g.fillPath();
      g.lineStyle(2, C.ink, 1);
      g.slice(0, 0, this.r, a0, a1, false);
      g.strokePath();
    });
    g.fillStyle(C.ink, 1); g.fillCircle(0, 0, 14);
    g.fillStyle(C.gold, 1); g.fillCircle(0, 0, 10);
    this.wheel.add(g);
    SLICES.forEach((sl, i) => {
      const a = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
      const t = text(this, Math.cos(a) * this.r * 0.64, Math.sin(a) * this.r * 0.64, sl.label, { size: 8, ox: 0.5, oy: 0.5, align: 'center', lineSpacing: 2 });
      t.setRotation(a + Math.PI / 2);
      this.wheel.add(t);
    });
    // pointer
    const p = this.add.graphics().setDepth(11);
    p.fillStyle(C.ink, 1); p.fillTriangle(this.cx - 11, this.cy - this.r - 16, this.cx + 11, this.cy - this.r - 16, this.cx, this.cy - this.r + 6);
    p.fillStyle(C.red, 1); p.fillTriangle(this.cx - 8, this.cy - this.r - 14, this.cx + 8, this.cy - this.r - 14, this.cx, this.cy - this.r + 2);

    this.ui = this.add.container(0, 0).setDepth(500);
    const L = run.party[this.spinner];
    this.ui.add(panel(this, 8, 270, 624, 84));
    this.ui.add(text(this, 22, 280, `${L.name.toUpperCase()} SPINS. It might not even be about ${L.name}.`, { size: 8, color: RACES[L.race].color }));
    this.ui.add(button(this, 245, 300, 150, 44, 'SPIN!', () => this.spin(), { size: 12, fill: 0x8a1c2b }));
  }

  wait(ms) { return new Promise((r) => this.time.delayedCall(ms, r)); }

  async spin() {
    this.ui.removeAll(true);
    const n = SLICES.length;
    const idx = rng.int(0, n - 1);
    // land so slice `idx` is under the top pointer
    const sliceCenter = ((idx + 0.5) / n) * 360;
    const target = 360 * 5 + (360 - sliceCenter) + rng.int(-14, 14);
    sfx('dice');
    let lastTick = 0;
    await new Promise((resolve) => this.tweens.add({
      targets: this.wheel, angle: target, duration: 3600, ease: 'Cubic.Out',
      onUpdate: () => { const a = Math.floor(this.wheel.angle / 45); if (a !== lastTick) { lastTick = a; sfx('step'); } },
      onComplete: resolve,
    }));
    const sl = SLICES[idx];
    sfx('crit');
    this.cameras.main.flash(150, 247, 197, 72);
    const head = text(this, 220, 60, sl.label.replace('\n', ' ').replace('- ', ''), { size: 16, ox: 0.5, color: T.gold, strokeThickness: 6, depth: 600 });
    this.ui.add(head);
    await this.wait(800);

    // name reels
    let A = null, B = null;
    if (sl.pair !== null) {
      A = await this.reel(96, 'WHO?');
      if (sl.pair) B = await this.reel(120, 'AND...', A);
    }
    const lines = this.apply(sl.id, A, B);
    this.ui.add(panel(this, 8, 222, 624, 132));
    lines.forEach((ln, k) => this.ui.add(text(this, 22, 236 + k * 18, ln, { size: 8, wrap: 596 })));
    sfx(sl.id === 'jackpot' || sl.id === 'gift' ? 'jackpot' : 'whip');
    this.ui.add(button(this, 245, 306, 150, 40, 'CONTINUE', () => fadeTo(this, this.returnTo), { size: 10, fill: 0x2a5a3a }));
  }

  // Spinning name slot that lands on a random friend (not `not`).
  async reel(y, label, not = null) {
    const pool = run.party.map((h, i) => i).filter((i) => i !== not);
    const pick = rng.pick(pool);
    const lab = text(this, 150, y, label, { size: 10, ox: 1, color: T.grey, depth: 600 });
    const nm = text(this, 160, y, '', { size: 12, color: T.white, depth: 600 });
    this.ui.add([lab, nm]);
    for (let k = 0; k < 14; k++) {
      const i = pool[k % pool.length];
      nm.setText(run.party[i].name.toUpperCase()).setColor(RACES[run.party[i].race].color);
      sfx('step');
      await this.wait(60 + k * 12);
    }
    nm.setText(run.party[pick].name.toUpperCase()).setColor(RACES[run.party[pick].race].color);
    this.tweens.add({ targets: nm, scale: 1.3, duration: 120, yoyo: true });
    sfx('select');
    const a = this.party.heroes[pick];
    this.tweens.add({ targets: a, y: a.y - 8, duration: 100, yoyo: true, repeat: 1 });
    await this.wait(600);
    return pick;
  }

  apply(id, A, B) {
    const a = A !== null ? run.party[A] : null;
    const b = B !== null ? run.party[B] : null;
    switch (id) {
      case 'swapgold': {
        const ga = a.gold; a.gold = b.gold; b.gold = ga;
        return [`${a.name} and ${b.name} SWAP GOLD.`, `${a.name} now has ${a.gold}g. ${b.name} now has ${b.gold}g.`];
      }
      case 'gift': {
        const n = steal(A, B, 30);
        return [`${a.name} gives ${b.name} ${n} gold.`, n < 30 ? `(${a.name} only had ${n}. Generous with nothing.)` : 'Out of the goodness of the wheel.'];
      }
      case 'bankrupt': {
        const lost = Math.floor(a.gold / 2);
        a.gold -= lost; a.st.robbed += lost;
        return [`BANKRUPT! ${a.name} loses half their gold: -${lost}g.`, 'The goblins say thank you.'];
      }
      case 'jackpot':
        addGold(A, 50);
        return [`JACKPOT! ${a.name} gets 50 gold from the goblins.`, 'Somebody should probably tax that.'];
      case 'swapcrown': {
        const ca = a.crowns; a.crowns = b.crowns; b.crowns = ca;
        return [`${a.name} and ${b.name} SWAP CROWNS.`, `${a.name} now has ${a.crowns}, ${b.name} has ${b.crowns}.`];
      }
      case 'cardthief': {
        if (b.cards.length) {
          const c = b.cards.splice(rng.int(0, b.cards.length - 1), 1)[0];
          giveCard(A, c);
          return [`${a.name} steals a card from ${b.name}: ${CARDS[c].name}.`];
        }
        const c = giveCard(A);
        return [`${b.name} has no cards to steal, so the wheel gives ${a.name} one: ${CARDS[c].name}.`];
      }
      case 'taxday': {
        let total = 0;
        run.party.forEach((h, i) => { if (i !== A) total += steal(A, i, 10); });
        return [`TAX DAY! ${a.name} pays everyone 10 gold.`, `${a.name} is out ${total}g.`];
      }
      case 'robin': {
        const sorted = run.party.map((h, i) => i).sort((x, y) => run.party[y].gold - run.party[x].gold);
        const rich = sorted[0], poor = sorted[sorted.length - 1];
        const n = steal(rich, poor, 25);
        return [`ROBIN HOOD! The richest (${run.party[rich].name}) pays the poorest (${run.party[poor].name}) ${n} gold.`];
      }
    }
    return [];
  }
}
