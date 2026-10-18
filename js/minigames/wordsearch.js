import { h, sparkle } from '../ui.js';
import { sleep } from '../pixel.js';
import { mount, banner } from './common.js';
import { SEARCH_SETS } from './words.js';

const FILL = 'ABCDEFGHIKLMNOPRSTUWY';
const DIRS_EASY = [[0, 1], [1, 0], [1, 1]];
const DIRS_HARD = [[0, 1], [1, 0], [1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1], [-1, 1]];
const COLORS = ['#f6b8c8', '#b8d8f6', '#c8ecb0', '#f8e0a0', '#d8c4f0', '#f8c8a8', '#b4ece4'];
const rnd = n => (Math.random() * n) | 0;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Hide words in an n x n grid. Returns { grid, placed: [{ word, cells }] } or null if it didn't fit.
export function buildSearch(n, words, dirs) {
  const grid = Array(n * n).fill('');
  const placed = [];
  for (const word of [...words].sort((a, b) => b.length - a.length)) {
    let ok = false;
    for (let tries = 0; tries < 300 && !ok; tries++) {
      const [dr, dc] = dirs[rnd(dirs.length)];
      const r0 = rnd(n), c0 = rnd(n);
      const cells = [...word].map((_, k) => [r0 + dr * k, c0 + dc * k]);
      if (cells.some(([r, c]) => r < 0 || c < 0 || r >= n || c >= n)) continue;
      if (cells.some(([r, c], k) => grid[r * n + c] && grid[r * n + c] !== word[k])) continue;
      cells.forEach(([r, c], k) => (grid[r * n + c] = word[k]));
      placed.push({ word, cells: cells.map(([r, c]) => r * n + c) });
      ok = true;
    }
    if (!ok) return null;
  }
  for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = FILL[rnd(FILL.length)];
  return { grid, placed };
}

// The straight line of cells from a to b (row, column or diagonal), or null.
export function lineBetween(n, a, b) {
  const ra = (a / n) | 0, ca = a % n, rb = (b / n) | 0, cb = b % n;
  const dr = Math.sign(rb - ra), dc = Math.sign(cb - ca), len = Math.max(Math.abs(rb - ra), Math.abs(cb - ca));
  if (!(ra === rb || ca === cb || Math.abs(rb - ra) === Math.abs(cb - ca))) return null;
  return Array.from({ length: len + 1 }, (_, k) => (ra + dr * k) * n + ca + dc * k);
}

// Word Search: find every hidden word before time runs out. Drag across a word, or tap its first
// letter and then its last.
export function play(root, { difficulty: d, sfx, boost }) {
  const n = d < 0.4 ? 8 : d < 0.75 ? 9 : 10;
  const set = SEARCH_SETS[rnd(SEARCH_SETS.length)];
  const count = Math.min(set.words.length, 5 + Math.round(d * 2));
  let built = null;
  while (!built) {
    const words = shuffle(set.words.filter(w => w.length <= n)).slice(0, count);
    built = buildSearch(n, words, d > 0.45 ? DIRS_HARD : DIRS_EASY);
  }
  const { grid, placed } = built;
  const limit = (80 - 25 * d + (boost === 'toast' ? 30 : 0)) * 1000;
  let left = limit, done = false, start = -1, drag = null, found = 0;

  const ui = mount(root, { title: 'Word Search', tip: 'Find every hidden word before time runs out. Drag across a word, or tap its first letter, then its last.' });
  const bar = h('div', { class: 'timebar' }, h('i'));
  const hintBtn = h('button', { class: 'btn small', onclick: () => act.hint() }, 'Hint (−10s)');
  const cells = grid.map(ch => h('span', { class: 'ws-cell' }, ch));
  const board = h('div', { class: 'ws-grid', style: `grid-template-columns: repeat(${n}, 1fr)` }, cells);
  const list = placed.map(p => h('span', { class: 'ws-word' }, p.word));
  ui.info.append(bar, hintBtn);
  ui.body.append(h('p', { class: 'ws-theme' }, set.theme), h('div', { class: 'ws-wrap' }, board), h('div', { class: 'ws-list' }, list));
  ui.status(`${placed.length} words to find.`);

  // ---------- selection ----------
  const cellAt = e => {
    const r = board.getBoundingClientRect();
    const c = Math.floor(((e.clientX - r.left) / r.width) * n), rr = Math.floor(((e.clientY - r.top) / r.height) * n);
    return c < 0 || rr < 0 || c >= n || rr >= n ? -1 : rr * n + c;
  };
  const paint = line => cells.forEach((c, i) => c.classList.toggle('sel', !!line && line.includes(i)));
  const act = {}; // handlers forward through here; they're filled in inside the Promise below

  board.addEventListener('pointerdown', e => {
    if (done) return;
    e.preventDefault();
    try { board.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    const i = cellAt(e);
    if (i < 0) return;
    drag = { from: start >= 0 ? start : i, moved: false, at: i };
    paint(lineBetween(n, drag.from, i));
  });
  board.addEventListener('pointermove', e => {
    if (!drag) return;
    const i = cellAt(e);
    if (i < 0 || i === drag.at) return;
    drag.at = i;
    drag.moved = true;
    paint(lineBetween(n, drag.from, i));
  });
  const up = e => {
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
    act.check(lineBetween(n, from, i));
  };
  board.addEventListener('pointerup', up);
  board.addEventListener('pointercancel', () => { drag = null; paint(null); });

  return new Promise(resolve => {
    async function finish(res, msg) {
      done = true;
      clearInterval(timer);
      sfx(res === 'win' ? 'tttwin' : 'tttlose');
      if (res !== 'win') placed.forEach(p => !p.found && p.cells.forEach(i => cells[i].classList.add('missed')));
      await sleep(700);
      await banner(ui, res, msg);
      resolve(res);
    }

    act.check = line => {
      paint(null);
      if (!line) { sfx('nope'); return; }
      const word = line.map(i => grid[i]).join('');
      const hit = placed.find(p => !p.found && (p.word === word || p.word === [...word].reverse().join('')) && p.cells.length === line.length);
      if (!hit) { sfx('nope'); board.classList.add('shake'); setTimeout(() => board.classList.remove('shake'), 300); return; }
      hit.found = true;
      const col = COLORS[found % COLORS.length];
      found++;
      hit.cells.forEach((i, k) => setTimeout(() => { cells[i].classList.add('found'); cells[i].style.background = col; }, k * 40));
      list[placed.indexOf(hit)].classList.add('got');
      sparkle(list[placed.indexOf(hit)], { count: 8 });
      sfx('coin');
      const rest = placed.length - found;
      ui.status(rest ? `${hit.word}! ${rest} to go.` : 'Every word found!');
      if (!rest) finish('win', 'Every word found!');
    };

    act.hint = () => {
      if (done || left < 12000) return;
      const p = placed.find(q => !q.found);
      if (!p) return;
      left -= 10000;
      const c = cells[p.cells[0]];
      c.classList.add('hint');
      setTimeout(() => c.classList.remove('hint'), 2500);
      sfx('select');
      ui.status(`Look for ${p.word} starting at the glowing letter.`);
    };

    let last = performance.now();
    const timer = setInterval(() => {
      if (!board.isConnected) { clearInterval(timer); return; }
      const now = performance.now();
      if (!document.hidden && !done) left -= now - last;
      last = now;
      bar.firstChild.style.width = `${Math.max(0, (left / limit) * 100)}%`;
      bar.classList.toggle('low', left < 15000);
      if (left <= 0 && !done) finish('lose', 'Out of time!');
    }, 100);
  });
}
