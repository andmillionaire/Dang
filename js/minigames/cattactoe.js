import { h, icon } from '../ui.js';
import { sleep } from '../pixel.js';
import { CAT_BREEDS } from '../spritedata.js';
import { generate } from '../sudoku.js';
import { mount, banner } from './common.js';

// Tic-tac-toe on a 4x4 cat sudoku: place the right cat to claim a square. Wrong cat = lost turn.
const N = 4;
const LINES = [];
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells = [0, 1, 2].map(k => [r + dr * k, c + dc * k]);
    if (cells.every(([y, x]) => y >= 0 && y < N && x >= 0 && x < N)) LINES.push(cells.map(([y, x]) => y * N + x));
  }
}
const lineOf = (owner, who) => LINES.find(l => l.every(i => owner[i] === who));

export function play(root, { difficulty: d, sfx }) {
  const ui = mount(root, { title: 'Cat-Tac-Toe', tip: 'Place the right cat to claim a square. Three of your squares in a row wins!' });
  const { puzzle, solution } = generate(N, 5);
  const grid = puzzle.slice();
  const owner = Array(N * N).fill(null);
  const skill = 0.35 + 0.5 * d;
  let sel = -1, locked = false, done = false;

  const cells = grid.map((_, i) => h('button', {
    class: 'sd-cell ctt' + (i % N === 1 ? ' bx' : '') + (((i / N) | 0) === 1 ? ' by' : ''),
    onclick: () => { if (!locked && !done && !grid[i]) { sel = i; sfx('select'); render(); } },
  }));
  // The palette is built before the game's handlers exist; it forwards through `act`.
  const act = {};
  const palette = [1, 2, 3, 4].map(v => h('button', { class: 'sd-sym', 'aria-label': CAT_BREEDS[v - 1].name, onclick: () => act.choose(v) }, icon('cat' + (v - 1), 'ico cat')));
  ui.body.append(h('div', { class: 'sd-grid n4', style: 'grid-template-columns: repeat(4, 1fr)' }, cells), h('div', { class: 'sd-palette n4' }, palette));

  function render(line) {
    cells.forEach((c, i) => {
      c.replaceChildren(grid[i] ? icon('cat' + (grid[i] - 1), 'ico cat') : '');
      c.classList.toggle('sel', i === sel);
      c.classList.toggle('mine', owner[i] === 'X');
      c.classList.toggle('storm', owner[i] === 'O');
      c.classList.toggle('hot', !!(line && line.includes(i)));
    });
    ui.info.textContent = 'Gold squares are yours, blue are the storm’s.';
  }
  render();
  ui.status('Your turn: tap an empty square, then a cat.');

  return new Promise(resolve => {
    async function finish(res, msg, line) {
      done = true;
      render(line);
      sfx(res === 'win' ? 'tttwin' : 'tttlose');
      await sleep(700);
      await banner(ui, res, msg);
      resolve(res);
    }

    function check() {
      const x = lineOf(owner, 'X'), o = lineOf(owner, 'O');
      if (x) { finish('win', 'Three in a row!', x); return true; }
      if (o) { finish('lose', 'The storm got three in a row.', o); return true; }
      if (!grid.includes(0)) { finish('draw', 'The grid filled up with no winner.'); return true; }
      return false;
    }

    function stormPick() {
      const empty = grid.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
      if (Math.random() < skill) {
        for (const who of ['O', 'X']) {
          for (const l of LINES) {
            const free = l.filter(i => !grid[i]);
            if (free.length === 1 && l.filter(i => owner[i] === who).length === 2) return free[0];
          }
        }
        const central = empty.filter(i => [5, 6, 9, 10].includes(i));
        if (central.length) return central[(Math.random() * central.length) | 0];
      }
      return empty[(Math.random() * empty.length) | 0];
    }

    act.choose = choose;
    async function choose(v) {
      if (locked || done || sel < 0) return;
      const i = sel;
      sel = -1;
      locked = true;
      if (solution[i] === v) {
        grid[i] = v;
        owner[i] = 'X';
        sfx('mew');
        render();
        if (check()) return;
      } else {
        sfx('nope');
        cells[i].classList.add('wrong');
        setTimeout(() => cells[i].classList.remove('wrong'), 450);
        ui.status('Wrong cat! Your turn is over.');
        render();
      }
      await sleep(700);
      ui.status('The storm is thinking…');
      await sleep(400);
      const j = stormPick();
      grid[j] = solution[j];
      owner[j] = 'O';
      sfx('aiplace');
      render();
      if (check()) return;
      locked = false;
      ui.status('Your turn: tap an empty square, then a cat.');
    }
  });
}
