import { h } from '../ui.js';
import { sleep } from '../pixel.js';
import { mount, banner } from './common.js';

// Word squares: row n reads the same as column n, so each clue answers both.
export const PUZZLES = [
  { rows: ['CARD', 'AREA', 'REAR', 'DART'], clues: ['Birthday greeting you might mail', 'Length times width', 'Back end', 'Pub game projectile'] },
  { rows: ['BALM', 'AREA', 'LEND', 'MADE'], clues: ['Soothing lip ointment', 'Region or zone', 'Let a friend borrow', 'Crafted by hand'] },
  { rows: ['RAIN', 'ALOE', 'IOTA', 'NEAT'], clues: ['It never stops falling outside', 'Soothing succulent', 'Tiny bit, or a Greek letter', 'Tidy'] },
  { rows: ['TEAS', 'EARL', 'ARIA', 'SLAP'], clues: ['Chamomile and oolong', '___ Grey (a cuppa)', 'Opera solo', '___stick comedy'] },
  { rows: ['LAMP', 'AREA', 'MEAL', 'PALE'], clues: ['Light beside the armchair', 'Square footage', 'Breakfast or supper', 'Wan, like a rainy sky'] },
  { rows: ['HEART', 'EMBER', 'ABUSE', 'RESIN', 'TREND'], clues: ['Shape of a magical brooch', 'Glowing bit in the fireplace', 'Misuse', 'Sticky pine sap', 'Passing fad'] },
];

export const KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM⌫'];

// Every answer/clue pair, de-duplicated, for the word mashups.
export const WORDS = [...new Map(PUZZLES.flatMap(p => p.rows.map((w, i) => [w, { word: w, clue: p.clues[i] }]))).values()];

export function play(root, { difficulty: d, sfx }) {
  const pool = PUZZLES.filter(p => d > 0.45 || p.rows.length === 4);
  const P = pool[(Math.random() * pool.length) | 0];
  const n = P.rows.length;
  const answer = P.rows.join('');
  const grid = Array(n * n).fill('');
  const given = new Set();
  const prefill = Math.round(3 * (1 - d));
  while (given.size < prefill) given.add((Math.random() * n * n) | 0);
  given.forEach(i => (grid[i] = answer[i]));

  const limit = (n === 4 ? 100 - 30 * d : 150 - 40 * d) * 1000;
  let left = limit, sel = [...Array(n * n).keys()].find(i => !given.has(i)) ?? 0, dir = 'across', done = false;

  const ui = mount(root, { title: 'Word Square', tip: 'Every row matches its column. Fill the square before time runs out.' });
  const bar = h('div', { class: 'timebar' }, h('i'));
  const clue = h('p', { class: 'cw-clue' });
  const cells = grid.map((_, i) => h('button', { class: 'cw-cell' + (given.has(i) ? ' given' : ''), onclick: () => tap(i) }));
  const board = h('div', { class: 'cw-grid', style: `grid-template-columns: repeat(${n}, 1fr)` }, cells);
  const hint = h('button', { class: 'btn small', onclick: () => useHint() }, 'Hint (−10s)');
  const kb = h('div', { class: 'kb' }, KEYS.map(row => h('div', { class: 'kb-row' },
    [...row].map(k => h('button', { class: 'kb-key' + (k === '⌫' ? ' wide' : ''), onclick: () => key(k) }, k)))));
  ui.info.append(bar);
  ui.body.append(board, clue, kb, h('div', { class: 'cw-tools' }, hint));

  const word = i => {
    const r = (i / n) | 0, c = i % n;
    return [...Array(n).keys()].map(k => (dir === 'across' ? r * n + k : k * n + c));
  };
  const render = () => {
    const w = word(sel);
    cells.forEach((c, i) => {
      c.textContent = grid[i];
      c.classList.toggle('sel', i === sel);
      c.classList.toggle('word', w.includes(i));
    });
    const idx = dir === 'across' ? (sel / n) | 0 : sel % n;
    clue.replaceChildren(h('b', {}, `${idx + 1} ${dir === 'across' ? 'Across' : 'Down'}`), ` ${P.clues[idx]}`);
  };
  render();
  ui.status('Tap a square twice to switch between across and down.');

  return new Promise(resolve => {
    const onKey = e => {
      if (done) return;
      if (/^[a-z]$/i.test(e.key)) key(e.key.toUpperCase());
      else if (e.key === 'Backspace') key('⌫');
    };
    addEventListener('keydown', onKey);
    let last = performance.now();
    const timer = setInterval(() => {
      if (!board.isConnected) { clearInterval(timer); removeEventListener('keydown', onKey); return; }
      const now = performance.now();
      left -= now - last;
      last = now;
      bar.firstChild.style.width = Math.max(0, (left / limit) * 100) + '%';
      bar.classList.toggle('low', left < 15000);
      if (left <= 0 && !done) finish('lose', 'Time’s up! The letters wash away.');
    }, 100);

    async function finish(res, msg) {
      done = true;
      clearInterval(timer);
      removeEventListener('keydown', onKey);
      sfx(res === 'win' ? 'tttwin' : 'tttlose');
      await sleep(400);
      await banner(ui, res, msg);
      resolve(res);
    }

    function tap(i) {
      if (done) return;
      if (i === sel) dir = dir === 'across' ? 'down' : 'across';
      sel = i;
      sfx('select');
      render();
    }

    function advance(step) {
      const w = word(sel), k = w.indexOf(sel);
      for (let j = k + step; j >= 0 && j < n; j += step) if (!given.has(w[j])) { sel = w[j]; return; }
    }

    function key(k) {
      if (done) return;
      if (k === '⌫') {
        if (!grid[sel] || given.has(sel)) advance(-1);
        if (!given.has(sel)) grid[sel] = '';
      } else {
        if (!given.has(sel)) grid[sel] = k;
        sfx('type');
        advance(1);
      }
      render();
      check();
    }

    function check() {
      if (grid.includes('')) return;
      if (grid.join('') === answer) return finish('win', 'Every word fits!');
      ui.status('Something’s not quite right…');
      board.classList.remove('shake'); void board.offsetWidth; board.classList.add('shake');
      sfx('nope');
    }

    function useHint() {
      if (done) return;
      const i = grid[sel] !== answer[sel] && !given.has(sel) ? sel : grid.findIndex((v, j) => v !== answer[j]);
      if (i < 0) return;
      grid[i] = answer[i];
      given.add(i);
      cells[i].classList.add('given');
      left -= 10000;
      sfx('coin');
      render();
      check();
    }
  });
}
