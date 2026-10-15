// Per-device settings, kept in localStorage (wrapped: storage can be blocked).
const KEY = 'dd_settings';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

let S = load();

// Reduce flashing: calms the Oracle's Psychosis colour pulses.
export function reduceFlashing() { return !!S.reduceFlashing; }
export function toggleReduceFlashing() {
  S = { ...S, reduceFlashing: !S.reduceFlashing };
  save(S);
  return S.reduceFlashing;
}
