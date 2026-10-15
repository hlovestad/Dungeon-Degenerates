// 16x16 placeholder icons (map nodes, items, coins).
import { painter } from './painter.js';

const ICONS = {
  node_fight: (p) => {
    for (let i = 0; i < 10; i++) { p.px(3 + i, 3 + i, '#dfe6ee'); p.px(12 - i, 3 + i, '#dfe6ee'); }
    p.r(2, 11, 3, 3, '#8a5a2a'); p.r(11, 11, 3, 3, '#8a5a2a');
    p.r(3, 10, 2, 1, '#f7c548'); p.r(11, 10, 2, 1, '#f7c548');
  },
  node_elite: (p) => {
    p.ell(7, 6, 5, 5, '#e8e4d0'); p.r(4, 10, 7, 3, '#e8e4d0');
    p.r(4, 5, 2, 2, '#140c1c'); p.r(9, 5, 2, 2, '#140c1c'); p.px(7, 8, '#140c1c');
    p.px(5, 12, '#140c1c'); p.px(7, 12, '#140c1c'); p.px(9, 12, '#140c1c');
    p.px(1, 1, '#d9473c'); p.px(13, 1, '#d9473c');
  },
  node_boss: (p) => {
    p.r(2, 6, 12, 7, '#f7c548'); p.px(2, 3, '#f7c548'); p.r(2, 4, 2, 2, '#f7c548');
    p.r(7, 2, 2, 4, '#f7c548'); p.r(12, 4, 2, 2, '#f7c548'); p.px(13, 3, '#f7c548');
    p.px(5, 9, '#d9473c'); p.px(8, 9, '#5fcde4'); p.px(11, 9, '#d9473c');
    p.h(12, 2, 13, '#c99a3a');
  },
  node_shop: (p) => {
    p.ell(7, 9, 6, 5, '#a06a35'); p.r(5, 2, 5, 3, '#a06a35'); p.h(4, 4, 10, '#6a4018');
    p.r(6, 7, 3, 5, '#f7c548'); p.px(5, 8, '#f7c548'); p.px(9, 11, '#f7c548');
  },
  node_casino: (p) => {
    p.r(1, 4, 8, 8, '#f4f0e0'); p.px(3, 6, '#140c1c'); p.px(6, 9, '#140c1c');
    p.r(7, 1, 7, 7, '#d9473c'); p.px(9, 3, '#f4f0e0'); p.px(12, 3, '#f4f0e0'); p.px(9, 6, '#f4f0e0'); p.px(12, 6, '#f4f0e0');
  },
  node_event: (p) => {
    p.r(4, 1, 7, 2, '#c58cff'); p.r(10, 2, 2, 5, '#c58cff'); p.r(6, 6, 5, 2, '#c58cff');
    p.r(6, 8, 2, 3, '#c58cff'); p.r(6, 12, 2, 2, '#c58cff'); p.r(3, 3, 2, 2, '#c58cff');
  },
  node_unknown: (p) => {
    p.r(4, 1, 7, 2, '#8a7f99'); p.r(10, 2, 2, 5, '#8a7f99'); p.r(6, 6, 5, 2, '#8a7f99');
    p.r(6, 8, 2, 3, '#8a7f99'); p.r(6, 12, 2, 2, '#8a7f99'); p.r(3, 3, 2, 2, '#8a7f99');
  },
  node_treasure: (p) => {
    p.r(1, 6, 14, 8, '#8a5a2a'); p.r(1, 2, 14, 5, '#a06a35'); p.h(6, 1, 14, '#6a4018');
    p.v(4, 2, 13, '#c99a3a'); p.v(11, 2, 13, '#c99a3a'); p.r(6, 5, 4, 3, '#f7c548');
  },
  node_rest: (p) => {
    p.r(2, 12, 12, 2, '#6a4018');
    p.ell(8, 7, 4, 5, '#e85a28'); p.ell(8, 8, 2, 3, '#f7e048'); p.px(7, 1, '#f7a038');
  },
  node_alien: (p) => {
    p.ell(7, 6, 6, 6, '#9ad8a8'); p.r(5, 11, 5, 3, '#9ad8a8');
    p.r(2, 5, 4, 3, '#0a0610'); p.r(9, 5, 4, 3, '#0a0610'); p.px(7, 10, '#5a9a6a'); p.px(4, 0, '#9ad8a8'); p.px(3, 0, '#5fe8ff');
  },
  node_trial: (p) => {
    p.ell(7, 6, 5, 5, '#e8e4d0'); p.r(4, 9, 7, 2, '#e8e4d0');
    p.r(4, 5, 2, 2, '#140c1c'); p.r(9, 5, 2, 2, '#140c1c');
    p.r(3, 12, 3, 3, '#d9473c'); p.r(9, 12, 3, 3, '#d9473c'); p.r(6, 13, 3, 1, '#a02a2a');
    p.px(13, 1, '#f7e048'); p.px(14, 3, '#f7e048');
  },
  node_whack: (p) => {
    p.r(6, 6, 2, 9, '#8a5a2a');
    p.r(1, 1, 12, 6, '#c83a3a'); p.r(1, 1, 12, 1, '#e85a5a');
    p.ell(12, 12, 3, 3, '#6aa03a'); p.px(11, 11, '#f7e048'); p.px(13, 11, '#f7e048');
  },
  node_start: (p) => {
    p.r(3, 2, 10, 13, '#5a3a20'); p.ell(8, 3, 5, 2, '#5a3a20');
    p.r(4, 3, 8, 11, '#140c1c'); p.px(10, 9, '#f7c548');
  },
  icon_gold_coin: (p) => {
    p.ell(7, 7, 6, 6, '#f7c548'); p.ell(7, 7, 4, 4, '#e0a830'); p.r(6, 4, 2, 7, '#ffe888');
  },
  icon_potion_health: (p) => {
    p.r(6, 1, 4, 2, '#a06a35'); p.r(6, 3, 4, 2, '#b8d8e8');
    p.ell(8, 10, 5, 5, '#d9473c'); p.r(5, 8, 2, 2, '#ff9a8a');
  },
  icon_protein_shaker: (p) => {
    p.r(4, 1, 8, 3, '#2a2a34'); p.r(4, 4, 8, 11, '#f4f0e0'); p.r(4, 8, 8, 5, '#c08048');
    p.r(5, 5, 2, 2, '#ffffff'); p.h(10, 6, 9, '#f4f0e0');
  },
  icon_rusty_crown: (p) => {
    p.r(1, 7, 14, 6, '#c99a3a'); p.r(1, 4, 2, 3, '#c99a3a'); p.r(7, 3, 2, 4, '#c99a3a'); p.r(13, 4, 2, 3, '#c99a3a');
    p.px(4, 9, '#8a6a2a'); p.px(10, 11, '#8a6a2a'); p.px(7, 9, '#d9473c');
  },
  icon_mystery_meat: (p) => {
    p.ell(9, 8, 5, 4, '#a85a5a'); p.ell(9, 8, 3, 2, '#d88a7a'); p.r(1, 11, 5, 2, '#f4f0d8'); p.px(1, 10, '#f4f0d8'); p.px(1, 13, '#f4f0d8');
    p.px(11, 6, '#6abe30');
  },
  icon_energy_drink: (p) => {
    p.r(4, 1, 8, 14, '#3ac080'); p.r(4, 1, 8, 2, '#b8c0cc'); p.r(4, 13, 8, 2, '#b8c0cc');
    p.px(8, 5, '#f7e048'); p.px(7, 6, '#f7e048'); p.r(6, 7, 4, 1, '#f7e048'); p.px(8, 8, '#f7e048'); p.px(7, 9, '#f7e048');
  },
};

export function drawIcon(key) {
  const fn = ICONS[key];
  if (!fn) return null;
  const p = painter(16, 16);
  fn(p);
  return p.finish();
}
export const ICON_KEYS = Object.keys(ICONS);
