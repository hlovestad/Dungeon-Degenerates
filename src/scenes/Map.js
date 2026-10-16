import { T, C } from '../config.js';
import { text, panel, hpBar, fadeTo, fadeIn, bubble, iconButton, button, dimmer, floater } from '../ui/ui.js';
import { run, rng, nodeById, hasRace, leader, nextLeader } from '../systems/state.js';
import { CARDS, playCard } from '../systems/cards.js';
import { FORMATIONS, FIGHT_BG } from '../data/enemies.js';
import { RACES } from '../data/races.js';
import { pickEvent } from './Event.js';
import { openCardMenu } from '../ui/cardMenu.js';
import { sideFill } from '../ui/stage.js';
import { dungeonInterlude } from '../systems/arcade.js';
import { playInterlude } from '../ui/interlude.js';
import { fitHeight, poseKey, isReal } from '../art/assets.js';
import { sfx, toggleMute, isMuted, unlockAudio } from '../audio/sfx.js';

const NODE_LABEL = {
  start: 'Entrance', fight: 'Fight', elite: 'Elite Fight', boss: 'BOSS', shop: 'Goblin Market',
  casino: 'Goblin Casino', event: 'Weird Stuff', trial: "Idiot's Trial", whack: 'Whack-a-Goblin', wheel: 'Wheel of Misfortune', treasure: 'Treasure', rest: 'Campfire', alien: 'Aliens',
};

export class MapScene extends Phaser.Scene {
  constructor() { super('Map'); }

  create() {
    // Mario Party rhythm: after (almost) every room, a showdown minigame.
    if (run.pendingShowdown) {
      run.pendingShowdown = false;
      this.scene.start('Showdown');
      return;
    }
    fadeIn(this);
    this.add.image(0, 0, 'map_background').setOrigin(0).setDisplaySize(640, 360).setDepth(-10);
    sideFill(this, 'map_background');
    this.moving = false;
    const here = nodeById(run.at);
    const josh = hasRace('josh') && run.party.find((h) => h.race === 'josh').hp > 0;

    // connections
    const g = this.add.graphics().setDepth(1);
    run.map.nodes.forEach((n) => n.next.forEach((id) => {
      const m = nodeById(id);
      const walked = run.visited.includes(n.id) && run.visited.includes(m.id);
      const avail = n.id === run.at;
      g.fillStyle(walked ? C.gold : avail ? C.border : 0x2a1e24, walked || avail ? 1 : 0.8);
      const steps = Math.floor(Phaser.Math.Distance.Between(n.x, n.y, m.x, m.y) / 6);
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        g.fillRect(Math.round(n.x + (m.x - n.x) * t) - 1, Math.round(n.y + (m.y - n.y) * t) - 1, 3, 3);
      }
    }));

    // nodes
    this.nodeViews = [];
    run.map.nodes.forEach((n) => {
      const reachable = here.next.includes(n.id);
      const visited = run.visited.includes(n.id);
      const hidden = !josh && n.row > here.row + 1 && n.type !== 'boss';
      const ring = this.add.graphics().setDepth(2);
      const r = n.type === 'boss' ? 16 : 12;
      ring.fillStyle(C.ink, 1); ring.fillCircle(n.x, n.y, r + 2);
      ring.fillStyle(reachable ? C.gold : visited ? 0x5a4836 : C.border, 1); ring.fillCircle(n.x, n.y, r);
      ring.fillStyle(n.type === 'boss' ? 0x5a1418 : C.panel, 1); ring.fillCircle(n.x, n.y, r - 2);
      const icon = this.add.image(n.x, n.y, hidden ? 'node_unknown' : 'node_' + n.type).setDepth(3);
      fitHeight(icon, n.type === 'boss' ? 22 : 16);
      if (visited && n.id !== run.at) { icon.setAlpha(0.45); ring.setAlpha(0.6); }
      if (reachable) {
        this.tweens.add({ targets: icon, y: n.y - 2, duration: 350, yoyo: true, repeat: -1, ease: 'Stepped' });
        const z = this.add.zone(n.x, n.y, 44, 44).setInteractive({ useHandCursor: true }).setDepth(5);
        z.on('pointerup', () => this.travel(n));
        if (!hidden) text(this, n.x, n.y + r + 4, NODE_LABEL[n.type], { size: 8, ox: 0.5, color: T.gold, depth: 4 });
      }
      this.nodeViews.push({ n, icon });
    });

    // party marker: tiny versions of the heroes standing at the current node
    this.marker = this.add.container(here.x, here.y - 2).setDepth(20);
    run.party.forEach((h, i) => {
      const s = this.add.image((i - 1.5) * 7, 0, poseKey(this, h.race, 'idle')).setOrigin(0.5, 1);
      fitHeight(s, 22);
      if (h.hp <= 0) s.setTint(0x555555);
      this.marker.add(s);
    });
    this.tweens.add({ targets: this.marker, y: here.y - 4, duration: 400, yoyo: true, repeat: -1, ease: 'Stepped' });

    this.drawHud();

    // Whose pick is it? Rotates every room, Mario Party style.
    const L = leader();
    panel(this, 6, 318, 400, 36, { alpha: 0.9 }).setDepth(25);
    const tip = text(this, 18, 336, `${L.name.toUpperCase()} PICKS THE NEXT ROOM`, { size: 10, oy: 0.5, color: RACES[L.race].color, depth: 26 });
    this.tweens.add({ targets: tip, alpha: 0.55, duration: 600, yoyo: true, repeat: -1 });
    const nCards = run.party.reduce((n, h) => n + h.cards.length, 0);
    button(this, 414, 318, 220, 36, `DIRTY CARDS (${nCards})`, () => this.openCards(), { size: 10, fill: 0x6a2a3a, depth: 27 });

    if (josh && !run.flags.joshMapTip) {
      run.flags.joshMapTip = true;
      const j = run.party.findIndex((h) => h.race === 'josh');
      this.time.delayedCall(500, () => bubble(this, 84 + j * 157, 96, 'My third eye sees the whole path.', 2600));
    } else if (run.visited.length > 1 && run.interludeAt !== run.at) {
      run.interludeAt = run.at;
      const items = dungeonInterlude();
      if (items.length) {
        this.moving = true; // no travelling mid-joke
        const hudSpot = (i) => ({ x: 84 + i * 157, y: 96 });
        const gold = items.some((x) => x.type === 'event' && x.changes?.length);
        this.time.delayedCall(600, async () => {
          await playInterlude(this, items, { anchorOf: hudSpot, actors: [] });
          if (gold) this.scene.restart(); else this.moving = false;
        });
      }
    }
  }

  // Standings across the top: HP, gold, crowns and cards for each friend.
  drawHud() {
    const w = 152;
    run.party.forEach((h, i) => {
      const x = 6 + i * 157;
      const isLeader = i === run.leader;
      panel(this, x, 4, w, 42, { alpha: 0.92, border: isLeader ? C.gold : C.border, fill: isLeader ? 0x3b2a52 : C.panel }).setDepth(25);
      // UI uses the portrait when real art has one
      const pk = isReal(`${h.race}_portrait`) ? `${h.race}_portrait` : poseKey(this, h.race, 'idle');
      const s = this.add.image(x + 14, 42, pk).setOrigin(0.5, 1).setDepth(26);
      fitHeight(s, 34);
      if (h.hp <= 0) s.setTint(0x555555);
      text(this, x + 30, 9, h.name.toUpperCase(), { size: 8, color: RACES[h.race].color, depth: 26 });
      const bar = hpBar(this, 46).setPosition(x + 125, 11).setDepth(26);
      bar.draw(h.hp, h.maxHp);
      this.add.image(x + 36, 30, 'icon_gold_coin').setDepth(26).setScale(0.75);
      text(this, x + 46, 25, String(h.gold), { size: 8, color: T.gold, depth: 26 });
      this.add.image(x + 88, 30, 'icon_crown').setDepth(26).setScale(0.75);
      text(this, x + 98, 25, String(h.crowns), { size: 8, color: T.white, depth: 26 });
      text(this, x + 124, 25, `C${h.cards.length}`, { size: 8, color: T.purple, depth: 26 });
    });
    const mute = iconButton(this, 600, 286, isMuted() ? 'x' : '♪', () => { unlockAudio(); mute.setLabel(toggleMute() ? 'x' : '♪'); }, 27);
    text(this, 8, 300, `POTIONS ${run.potions}`, { size: 8, color: T.red, depth: 26 });
  }

  // ------------------------------------------------------------ dirty cards
  openCards() {
    openCardMenu(this, () => this.scene.restart());
  }

  travel(n) {
    if (this.moving) return;
    this.moving = true;
    sfx('select');
    const from = nodeById(run.at);
    const steps = 6;
    this.tweens.killTweensOf(this.marker);
    let i = 0;
    const hop = () => {
      i++;
      sfx('step');
      this.tweens.add({
        targets: this.marker,
        x: from.x + (n.x - from.x) * (i / steps),
        y: from.y - 2 + (n.y - from.y) * (i / steps),
        duration: 110,
        onComplete: () => (i < steps ? hop() : this.enter(n)),
      });
    };
    hop();
  }

  enter(n) {
    run.at = n.id;
    run.visited.push(n.id);
    // The friend who picked this room gets the room's rewards; next pick rotates.
    run.roomLeader = run.leader;
    nextLeader();
    // Showdown minigame after every room except the casino and the boss.
    run.pendingShowdown = !['casino', 'boss'].includes(n.type);
    const go = (key, data) => this.time.delayedCall(150, () => fadeTo(this, key, data));
    switch (n.type) {
      case 'fight':
      case 'elite':
      case 'alien':
      case 'boss':
        go('Battle', { type: n.type, enemies: rng.pick(FORMATIONS[n.type]), bg: rng.pick(FIGHT_BG[n.type]), depth: n.row });
        break;
      case 'treasure':
        if (rng.chance(0.3)) go('Battle', { type: 'mimic', enemies: FORMATIONS.mimic[0], bg: 'bg_treasure_vault', intro: 'The chest has teeth.', depth: n.row });
        else go('Event', { id: 'treasure' });
        break;
      case 'shop': go('Shop'); break;
      case 'casino': go('Casino'); break;
      case 'trial': go('Trivia', { mode: 'crawl' }); break;
      case 'whack': go('Whack', { mode: 'crawl' }); break;
      case 'wheel': go('Wheel'); break;
      case 'rest': go('Event', { id: 'rest' }); break;
      case 'event': go('Event', { id: pickEvent() }); break;
      default: go('Map');
    }
  }
}
