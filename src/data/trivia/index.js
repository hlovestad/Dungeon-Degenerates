// Every trivia theme. Each theme file exports an array of { q, a: [right, wrong, wrong, wrong] }.
// Add a theme: write the file, import it here, add a line to THEMES. That's it.
import general from './general.js';
import degenerates from './degenerates.js';
import science from './science.js';
import nature from './nature.js';
import space from './space.js';
import body from './body.js';
import geography from './geography.js';
import history from './history.js';
import myth from './myth.js';
import words from './words.js';
import movies from './movies.js';
import tv from './tv.js';
import music from './music.js';
import nostalgia from './nostalgia.js';
import sports from './sports.js';
import games from './games.js';
import food from './food.js';
import tech from './tech.js';

export const THEMES = [
  { id: 'mixed', name: 'EVERYTHING' },
  { id: 'movies', name: 'MOVIES', qs: movies },
  { id: 'tv', name: 'TV SHOWS', qs: tv },
  { id: 'music', name: 'MUSIC', qs: music },
  { id: 'nostalgia', name: '90s & 2000s', qs: nostalgia },
  { id: 'games', name: 'VIDEO GAMES', qs: games },
  { id: 'sports', name: 'SPORTS', qs: sports },
  { id: 'food', name: 'FOOD & DRINK', qs: food },
  { id: 'science', name: 'SCIENCE', qs: science },
  { id: 'nature', name: 'ANIMALS', qs: nature },
  { id: 'space', name: 'SPACE', qs: space },
  { id: 'body', name: 'HUMAN BODY', qs: body },
  { id: 'geography', name: 'GEOGRAPHY', qs: geography },
  { id: 'history', name: 'HISTORY', qs: history },
  { id: 'myth', name: 'MYTH & FANTASY', qs: myth },
  { id: 'words', name: 'WORDS', qs: words },
  { id: 'tech', name: 'TECH', qs: tech },
  { id: 'general', name: 'GRAB BAG', qs: general },
  { id: 'degenerates', name: 'THE DEGENERATES', qs: degenerates },
];
export const COUNTS = [10, 15, 20, 30];

// Every question with a stable id ("movies:12") so a night can avoid repeats.
export function questionPool(themeId) {
  const list = themeId === 'mixed' ? THEMES.filter((t) => t.qs && t.id !== 'degenerates') : THEMES.filter((t) => t.id === themeId);
  const seen = new Set();
  // the same question can live in two themes (e.g. history + space): only once in a mix
  return list.flatMap((t) => t.qs.map((x, k) => ({ ...x, id: `${t.id}:${k}`, theme: t.name })))
    .filter((x) => { const key = x.q.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
}
export const themeName = (id) => THEMES.find((t) => t.id === id)?.name || 'EVERYTHING';
export const totalQuestions = () => THEMES.reduce((n, t) => n + (t.qs ? t.qs.length : 0), 0);
