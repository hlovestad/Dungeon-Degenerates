import { T, SPRITE_HEIGHT } from '../config.js';
import { ITEMS, SHOP_POOL } from '../data/items.js';
import { RACES } from '../data/races.js';
import { text, panel, button, bubble, floater, fadeTo, fadeIn } from '../ui/ui.js';
import { background, actor, spawnParty } from '../ui/stage.js';
import { run, rng, giveCard } from '../systems/state.js';
import { CARDS } from '../systems/cards.js';
import { SCENE_SLOTS } from './Event.js';
import { sfx } from '../audio/sfx.js';
import { fitHeight } from '../art/assets.js';

// The goblin market. Everyone shops with their own gold.
// Mike gets the family discount (just Mike). Dirty cards are on sale too.
const CARD_PRICE = 15;

export class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }

  create() {
    fadeIn(this);
    background(this, 'bg_goblin_market');
    this.party = spawnParty(this, { slots: SCENE_SLOTS });
    actor(this, 'npc_goblin_merchant', 470, 214, SPRITE_HEIGHT.npc + 6, { flip: true });
    const mike = run.party.some((h) => h.race === 'mike');
    this.time.delayedCall(600, () => bubble(this, 470, 130,
      mike ? 'COUSIN MIKE! 30% off for you. Everyone else pays full price.' : 'Welcome, tall-folk. Prices are prices.', 2600));

    // stock: 3 items + a dirty card
    this.stock = rng.shuffle(SHOP_POOL).slice(0, 3).concat(['card']);
    this.sold = [];
    this.buyer = run.roomLeader ?? 0;
    this.ui = this.add.container(0, 0).setDepth(500);
    this.pickZones = [];
    this.drawShop();
  }

  price(id, buyer = this.buyer) {
    const base = id === 'card' ? CARD_PRICE : ITEMS[id].price;
    return Math.round(base * (run.party[buyer].race === 'mike' ? 0.7 : 1));
  }

  drawShop(msg) {
    this.ui.removeAll(true);
    const b = run.party[this.buyer];
    this.ui.add(panel(this, 8, 234, 624, 120));
    // who's shopping?
    this.ui.add(text(this, 14, 218, msg || 'WHO IS BUYING? Tap a name.', { size: 8, color: T.gold, wrap: 610 }));
    run.party.forEach((h, i) => {
      const btn = button(this, 18 + i * 128, 242, 122, 26, `${h.name.toUpperCase()} ${h.gold}g`, () => { this.buyer = i; this.drawShop(); }, {
        size: 8, selected: i === this.buyer,
      });
      this.ui.add(btn);
    });
    this.stock.forEach((id, i) => {
      const card = id === 'card';
      const name = card ? 'Dirty Card' : ITEMS[id].name;
      const icon = card ? 'icon_card' : ITEMS[id].icon;
      const x = 18 + i * 128;
      const sold = this.sold.includes(i);
      const p = this.price(id);
      const btn = button(this, x, 274, 122, 72, '', () => this.buy(i), { size: 8 });
      btn.setEnabled(!sold && b.gold >= p);
      const ic = this.add.image(x + 61, 290, icon);
      fitHeight(ic, 20);
      this.ui.add([btn, ic,
        text(this, x + 61, 306, sold ? 'SOLD' : name, { size: 8, ox: 0.5, align: 'center', wrap: 116 }),
        text(this, x + 61, 328, sold ? '' : `${p}g`, { size: 8, ox: 0.5, color: b.race === 'mike' ? T.green : T.gold }),
      ]);
    });
    this.ui.add(button(this, 530, 242, 92, 104, 'LEAVE', () => fadeTo(this, 'Map'), { size: 10, fill: 0x6a2a3a }));
  }

  buy(i) {
    const id = this.stock[i];
    const b = run.party[this.buyer];
    if (id === 'card') {
      b.gold -= this.price(id);
      this.sold.push(i);
      const c = giveCard(this.buyer);
      sfx('coin');
      this.drawShop(`${b.name} bought a dirty card: ${CARDS[c].name}. Use it from the map.`);
      return;
    }
    const it = ITEMS[id];
    if (it.consumable) {
      b.gold -= this.price(id);
      run.potions++;
      this.sold.push(i);
      sfx('coin');
      this.drawShop(`${b.name} bought a ${it.name} for the party. How generous.`);
      return;
    }
    // Pick which hero gets it (yes, you can buy stuff for friends. Nobody will.)
    this.ui.removeAll(true);
    this.ui.add(panel(this, 8, 234, 624, 120));
    this.ui.add(text(this, 22, 246, `${it.name}: ${it.desc}`, { size: 8, wrap: 596 }));
    this.ui.add(text(this, 22, 276, `${b.name.toUpperCase()}: TAP WHO GETS IT`, { size: 12, color: RACES[b.race].color }));
    this.ui.add(button(this, 516, 290, 108, 44, 'BACK', () => { this.clearPick(); this.drawShop(); }, { size: 10 }));
    this.party.heroes.forEach((a) => {
      const z = this.add.zone(a.x, a.y - 40, 50, 84).setInteractive({ useHandCursor: true }).setDepth(700);
      z.on('pointerup', () => { this.clearPick(); this.give(i, a.hero, a); });
      this.pickZones.push(z);
      a.sprite.setTint(0xffe888);
    });
  }

  clearPick() {
    this.pickZones.forEach((z) => z.destroy());
    this.pickZones = [];
    this.party.heroes.forEach((a) => a.sprite.clearTint());
  }

  give(i, h, a) {
    const id = this.stock[i];
    const it = ITEMS[id];
    const buyer = run.party[this.buyer];
    buyer.gold -= this.price(id);
    this.sold.push(i);
    sfx('coin');
    let msg;
    const e = it.effect;
    if (e.mystery) {
      if (rng.chance(0.7)) { h.maxHp += 6; h.hp += 6; msg = `${h.name} eats the Mystery Meat. +6 max HP!`; floater(this, a.x, a.y - 80, '+6 MAX HP', T.green); }
      else { h.hp = Math.max(1, h.hp - 5); msg = `${h.name} eats the Mystery Meat. Food poisoning. -5 HP.`; floater(this, a.x, a.y - 80, 'BLEH', T.red); }
    } else {
      const stat = Object.keys(e)[0];
      h[stat] += e[stat];
      msg = `${h.name} gets ${it.name}: +${e[stat]} ${stat.toUpperCase()}.`;
      floater(this, a.x, a.y - 80, `+${e[stat]} ${stat.toUpperCase()}`, T.green);
    }
    if (h !== buyer) msg = `${buyer.name} buys it for ${h.name}?! ` + msg;
    this.drawShop(msg);
  }
}
