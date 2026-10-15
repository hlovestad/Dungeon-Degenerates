// Shop items. `use` describes what applying them does (see systems/state.js).
export const ITEMS = {
  potion_health: {
    name: 'Health Potion', icon: 'icon_potion_health', price: 20,
    desc: 'Heal one hero 15 HP. Usable in battle.', consumable: true,
  },
  protein_shaker: {
    name: 'Protein Shaker', icon: 'icon_protein_shaker', price: 45,
    desc: 'Permanently +2 ATK for one hero.', target: 'hero', effect: { atk: 2 },
  },
  rusty_crown: {
    name: 'Rusty Crown', icon: 'icon_rusty_crown', price: 40,
    desc: 'Permanently +2 DEF for one hero.', target: 'hero', effect: { def: 2 },
  },
  mystery_meat: {
    name: 'Mystery Meat', icon: 'icon_mystery_meat', price: 15,
    desc: 'Permanently +6 max HP... or food poisoning.', target: 'hero', effect: { mystery: true },
  },
  energy_drink: {
    name: 'Energy Drink', icon: 'icon_energy_drink', price: 30,
    desc: 'Permanently +2 SPD for one hero.', target: 'hero', effect: { spd: 2 },
  },
};

export const SHOP_POOL = ['potion_health', 'potion_health', 'protein_shaker', 'rusty_crown', 'mystery_meat', 'energy_drink'];
