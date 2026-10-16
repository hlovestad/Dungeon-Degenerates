// Checks every trivia file: format, length limits, ASCII, and duplicate
// questions across ALL files. Run: node tools/trivia_check.mjs [file ...]
import { readdirSync } from 'fs';
const dir = new URL('../src/data/trivia/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'index.js');
const only = process.argv.slice(2).map((f) => f.replace(/\.js$/, ''));
const seen = new Map();
let bad = 0, total = 0;
const norm = (q) => q.toLowerCase().replace(/[^a-z0-9]/g, '');
for (const f of files) {
  const list = (await import(new URL(f, dir))).default;
  let fileBad = 0;
  for (const x of list) {
    const ascii = (s) => /^[\x20-\x7e]*$/.test(s);
    const ok = x && typeof x.q === 'string' && x.q.length <= 110 && ascii(x.q) && Array.isArray(x.a) && x.a.length === 4
      && new Set(x.a).size === 4 && x.a.every((s) => typeof s === 'string' && s.length > 0 && s.length <= 24 && ascii(s));
    const key = norm(x.q || '');
    const dup = seen.get(key);
    if (!ok || dup) {
      fileBad++;
      if (!only.length || only.includes(f.replace(/\.js$/, ''))) console.log(`BAD ${f}${dup ? ` (duplicate of ${dup})` : ''}: ${JSON.stringify(x)}`);
    }
    if (!dup) seen.set(key, f);
  }
  bad += fileBad; total += list.length;
  if (!only.length || only.includes(f.replace(/\.js$/, ''))) console.log(`${f.padEnd(18)} ${String(list.length).padStart(4)} questions, ${fileBad} bad`);
}
console.log(`TOTAL ${total} questions in ${files.length} files, ${bad} bad`);
