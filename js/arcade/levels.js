import { generate, seeded } from '../sudoku.js';

export const LEVEL_COUNT = 100;

// Difficulty curve: 4x4 warm-ups, then 6x6, then 9x9, with fewer givens as you go.
export function levelSpec(n) {
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  if (n <= 10) return { N: 4, givens: lerp(10, 6, (n - 1) / 9) };
  if (n <= 40) return { N: 6, givens: lerp(26, 12, (n - 11) / 29) };
  return { N: 9, givens: lerp(44, 24, (n - 41) / 59) };
}

const cache = new Map();

// The same level number always builds the same puzzle, so leaderboard times are comparable.
export function buildLevel(n) {
  if (cache.has(n)) return cache.get(n);
  const { N, givens } = levelSpec(n);
  const lvl = { n, ...generate(N, givens, seeded(0xda96 + n * 7919)), N };
  lvl.givens = lvl.puzzle.filter(Boolean).length;
  cache.set(n, lvl);
  return lvl;
}

export const tierName = n => (n <= 10 ? 'Twinkle' : n <= 40 ? 'Moonbeam' : n <= 70 ? 'Starlight' : 'Supernova');
