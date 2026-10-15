import { T, SPRITE_HEIGHT } from '../config.js';
import { ITEMS, SHOP_POOL } from '../data/items.js';
import { text, panel, button, bubble, floater, fadeTo, fadeIn } from '../ui/ui.js';
import { background, actor, spawnParty } from '../ui/stage.js';
import { run, rng } from '../systems/state.js';
import { SCENE_SLOTS } from './Event.js';
import { sfx } from '../audio/sfx.js';
import { fitHeight } from '../art/assets.js';

// The goblin market. Mike gets the family discount.
export class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }

  create() {
    fadeIn(this);
    background(this, 'bg_goblin_market');
    this.party = spawnParty(this, { slots: SCENE_SLOTS });
    this.mike = run.party.some((h) => h.race === 'mike' && h.hp > 0);
    this.discount = this.mike ? 0.7 : 1;

    const m = actor(this, 'npc_goblin_merchant', 470, 214, SPRITE_HEIGHT.npc + 6, { flip: true });
    this.time.delayedCall(600, () => bubble(this, 470, 130,
      this.mike ? 'COUSIN MIKE! Family discount for you. 30% off!' : 'Welcome, tall-folk. Prices are prices.', 2600));

    this.stock = rng.shuffle(SHOP_POOL).slice(0, 4);
    this.sold = [];
    this.goldLabel = text(this, 632, 8, '', { size: 10, color: T.gold, ox: 1, depth: 600 });
    this.ui = this.add.container(0, 0).setDepth(500);
    this.pickZones = [];
    this.drawShop();
  }

  price(id) { return Math.round(ITEMS[id].price * this.discount); }

  drawShop(msg) {
    this.ui.removeAll(true);
    this.goldLabel.setText(`${run.gold}g   potions ${run.potions}`);
    this.ui.add(panel(this, 8, 244, 624, 110));
    this.ui.add(text(this, 22, 252, msg || (this.mike ? 'GOBLIN MARKET  (Mike: 30% off)' : 'GOBLIN MARKET'), { size: 8, color: T.gold }));
    this.stock.forEach((id, i) => {
      const it = ITEMS[id];
      const x = 18 + i * 124;
      const sold = this.sold.includes(i);
      const p = this.price(id);
      const b = button(this, x, 268, 118, 78, '', () => this.buy(i), { size: 8 });
      b.setEnabled(!sold && run.gold >= p);
      const icon = this.add.image(x + 59, 288, it.icon);
      fitHeight(icon, 22);
      this.ui.add([b, icon,
        text(this, x + 59, 304, sold ? 'SOLD' : it.name, { size: 8, ox: 0.5, align: 'center', wrap: 112, color: T.cream }),
        text(this, x + 59, 326, sold ? '' : `${p}g`, { size: 8, ox: 0.5, color: this.mike ? T.green : T.gold }),
      ]);
    });
    this.ui.add(button(this, 516, 268, 108, 78, 'LEAVE', () => fadeTo(this, 'Map'), { size: 10, fill: 0x6a2a3a }));
  }

  buy(i) {
    const id = this.stock[i];
    const it = ITEMS[id];
    if (it.consumable) {
      run.gold -= this.price(id);
      run.potions++;
      this.sold.push(i);
      sfx('coin');
      this.drawShop(`Bought a ${it.name}.`);
      return;
    }
    // Pick which hero gets it.
    this.ui.removeAll(true);
    this.ui.add(panel(this, 8, 244, 624, 110));
    this.ui.add(text(this, 22, 256, `${it.name}: ${it.desc}`, { size: 8, wrap: 596 }));
    this.ui.add(text(this, 22, 290, 'TAP A HERO TO GIVE IT TO', { size: 12, color: T.gold }));
    this.ui.add(button(this, 516, 300, 108, 44, 'BACK', () => { this.clearPick(); this.drawShop(); }, { size: 10 }));
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
    run.gold -= this.price(id);
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
    this.drawShop(msg);
  }
}
