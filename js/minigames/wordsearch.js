import { h, sparkle } from '../ui.js';
import { sleep } from '../pixel.js';
import { mount, banner } from './common.js';
import { SEARCH_SETS } from './words.js';

const FILL = 'ABCDEFGHIKLMNOPRSTUWY';
export const DIRS_EASY = [[0, 1], [1, 0], [1, 1]];
export const DIRS_MEDIUM = [[0, 1], [1, 0], [1, 1], [0, -1], [-1, 0]];
export const DIRS_HARD = [[0, 1], [1, 0], [1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1], [-1, 1]];
const COLORS = ['#f6b8c8', '#b8d8f6', '#c8ecb0', '#f8e0a0', '#d8c4f0', '#f8c8a8', '#b4ece4'];
const shuffleWith = (a, R) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Hide words in an n x n grid. R is a random source (seeded for the arcade's fixed levels).
// Returns { grid, placed: [{ word, cells }] } or null if a word didn't fit.
export function buildSearch(n, words, dirs, R = Math.random) {
  const grid = Array(n * n).fill('');
  const placed = [];
  for (const word of [...words].sort((a, b) => b.length - a.length)) {
    let ok = false;
    for (let tries = 0; tries < 400 && !ok; tries++) {
      const [dr, dc] = dirs[Math.floor(R() * dirs.length)];
      const r0 = Math.floor(R() * n), c0 = Math.floor(R() * n);
      const cells = [...word].map((_, k) => [r0 + dr * k, c0 + dc * k]);
      if (cells.some(([r, c]) => r < 0 || c < 0 || r >= n || c >= n)) continue;
      if (cells.some(([r, c], k) => grid[r * n + c] && grid[r * n + c] !== word[k])) continue;
      cells.forEach(([r, c], k) => (grid[r * n + c] = word[k]));
      placed.push({ word, cells: cells.map(([r, c]) => r * n + c) });
      ok = true;
    }
    if (!ok) return null;
  }
  for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = FILL[Math.floor(R() * FILL.length)];
  return { grid, placed: words.map(w => placed.find(p => p.word === w)) };
}

// The straight line of cells from a to b (row, column or diagonal), or null.
export function lineBetween(n, a, b) {
  const ra = (a / n) | 0, ca = a % n, rb = (b / n) | 0, cb = b % n;
  const dr = Math.sign(rb - ra), dc = Math.sign(cb - ca), len = Math.max(Math.abs(rb - ra), Math.abs(cb - ca));
  if (!(ra === rb || ca === cb || Math.abs(rb - ra) === Math.abs(cb - ca))) return null;
  return Array.from({ length: len + 1 }, (_, k) => (ra + dr * k) * n + ca + dc * k);
}

// A playable word-search grid plus its word list. Drag across a word, or tap its first letter
// then its last. onFound(word, left) runs for each find. Returns { hint(), state }.
export function searchBoard(host, { n, grid, placed, sfx, onFound, theme }) {
  const state = { found: 0, done: false };
  let start = -1, drag = null;
  const cells = grid.map(ch => h('span', { class: 'ws-cell' }, ch));
  const board = h('div', { class: 'ws-grid', style: `grid-template-columns: repeat(${n}, 1fr)` }, cells);
  const list = placed.map(p => h('span', { class: 'ws-word' }, p.word));
  host.append(...[theme && h('p', { class: 'ws-theme' }, theme), h('div', { class: 'ws-wrap' }, board), h('div', { class: 'ws-list' }, list)].filter(Boolean));

  const cellAt = e => {
    const r = board.getBoundingClientRect();
    const c = Math.floor(((e.clientX - r.left) / r.width) * n), rr = Math.floor(((e.clientY - r.top) / r.height) * n);
    return c < 0 || rr < 0 || c >= n || rr >= n ? -1 : rr * n + c;
  };
  const paint = line => cells.forEach((c, i) => c.classList.toggle('sel', !!line && line.includes(i)));

  function check(line) {
    paint(null);
    if (!line) { sfx('nope'); return; }
    const word = line.map(i => grid[i]).join('');
    const hit = placed.find(p => !p.found && p.cells.length === line.length && (p.word === word || p.word === [...word].reverse().join('')));
    if (!hit) { sfx('nope'); board.classList.add('shake'); setTimeout(() => board.classList.remove('shake'), 300); return; }
    hit.found = true;
    const col = COLORS[state.found % COLORS.length];
    state.found++;
    hit.cells.forEach((i, k) => setTimeout(() => { cells[i].classList.add('found'); cells[i].style.background = col; }, k * 40));
    list[placed.indexOf(hit)].classList.add('got');
    sparkle(list[placed.indexOf(hit)], { count: 8 });
    sfx('coin');
    onFound(hit.word, placed.length - state.found);
  }

  board.addEventListener('pointerdown', e => {
    if (state.done) return;
    e.preventDefault();
    try { board.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    const i = cellAt(e);
    if (i < 0) return;
    drag = { from: start >= 0 ? start : i, at: i };
    paint(lineBetween(n, drag.from, i));
  });
  board.addEventListener('pointermove', e => {
    if (!drag) return;
    const i = cellAt(e);
    if (i < 0 || i === drag.at) return;
    drag.at = i;
    paint(lineBetween(n, drag.from, i));
  });
  board.addEventListener('pointerup', e => {
    if (!drag) return;
    const i = cellAt(e) >= 0 ? cellAt(e) : drag.at;
    const from = drag.from;
    drag = null;
    if (from === i) {
      // a tap: remember it as the start, or cancel if it's the start again
      start = start === i ? -1 : i;
      cells.forEach((c, k) => c.classList.toggle('start', k === start));
      paint(null);
      if (start >= 0) sfx('select');
      return;
    }
    start = -1;
    cells.forEach(c => c.classList.remove('start'));
    check(lineBetween(n, from, i));
  });
  board.addEventListener('pointercancel', () => { drag = null; paint(null); });

  return {
    state,
    board,
    // Glow the first letter of a word still to find; returns that word or null.
    hint() {
      const p = placed.find(q => !q.found);
      if (!p || state.done) return null;
      const c = cells[p.cells[0]];
      c.classList.add('hint');
      setTimeout(() => c.classList.remove('hint'), 2500);
      sfx('select');
      return p.word;
    },
    revealMissed() { placed.forEach(p => !p.found && p.cells.forEach(i => cells[i].classList.add('missed'))); },
  };
}

// Word Search (the 2x2 tile): find every hidden word before time runs out.
export function play(root, { difficulty: d, sfx, boost }) {
  const n = d < 0.4 ? 8 : d < 0.75 ? 9 : 10;
  const set = SEARCH_SETS[(Math.random() * SEARCH_SETS.length) | 0];
  const count = Math.min(set.words.length, 5 + Math.round(d * 2));
  let built = null;
  while (!built) built = buildSearch(n, shuffleWith(set.words.filter(w => w.length <= n), Math.random).slice(0, count), d > 0.45 ? DIRS_HARD : DIRS_EASY);
  const limit = (80 - 25 * d + (boost === 'toast' ? 30 : 0)) * 1000;
  let left = limit;

  const ui = mount(root, { title: 'Word Search', tip: 'Find every hidden word before time runs out. Drag across a word, or tap its first letter, then its last.' });
  const bar = h('div', { class: 'timebar' }, h('i'));
  const act = {}; // set inside the Promise below
  const hintBtn = h('button', { class: 'btn small', onclick: () => act.hint() }, 'Hint (−10s)');
  ui.info.append(bar, hintBtn);
  ui.status(`${built.placed.length} words to find.`);

  return new Promise(resolve => {
    const sb = searchBoard(ui.body, {
      n, ...built, sfx, theme: set.theme,
      onFound: (word, rest) => { ui.status(rest ? `${word}! ${rest} to go.` : 'Every word found!'); if (!rest) finish('win', 'Every word found!'); },
    });
    async function finish(res, msg) {
      sb.state.done = true;
      clearInterval(timer);
      sfx(res === 'win' ? 'tttwin' : 'tttlose');
      if (res !== 'win') sb.revealMissed();
      await sleep(700);
      await banner(ui, res, msg);
      resolve(res);
    }
    act.hint = () => {
      if (sb.state.done || left < 12000) return;
      const w = sb.hint();
      if (!w) return;
      left -= 10000;
      ui.status(`Look for ${w} starting at the glowing letter.`);
    };
    let last = performance.now();
    const timer = setInterval(() => {
      if (!sb.board.isConnected) { clearInterval(timer); return; }
      const now = performance.now();
      if (!document.hidden && !sb.state.done) left -= now - last;
      last = now;
      bar.firstChild.style.width = `${Math.max(0, (left / limit) * 100)}%`;
      bar.classList.toggle('low', left < 15000);
      if (left <= 0 && !sb.state.done) finish('lose', 'Out of time!');
    }, 100);
  });
}
