import { h } from './ui.js';
import { SHAPES } from './sudoku.js';

// Interactive sudoku grid. Tap a square then a symbol, or arm a symbol then tap squares.
// symbol(v) -> Node for value v (1..N). onDone('win' | 'lose').
export function sudokuBoard(host, { N, puzzle, solution, symbol, names, lives = 3, sfx, onChange, onDone, placeSfx = 'place' }) {
  const [BR, BC] = SHAPES[N];
  const grid = puzzle.slice();
  const state = { mistakes: 0, hints: 0, done: false };
  let sel = -1, armed = 0;

  const cls = i => {
    const r = (i / N) | 0, c = i % N;
    return 'sd-cell' + (puzzle[i] ? ' given' : '') +
      (c % BC === BC - 1 && c < N - 1 ? ' bx' : '') + (r % BR === BR - 1 && r < N - 1 ? ' by' : '');
  };
  const cells = grid.map((_, i) => h('button', { class: cls(i), 'aria-label': `Row ${((i / N) | 0) + 1} column ${(i % N) + 1}`, onclick: () => tapCell(i) }));
  const palette = Array.from({ length: N }, (_, k) => h('button', { class: 'sd-sym', 'aria-label': names[k], onclick: () => tapSym(k + 1) }, symbol(k + 1)));
  host.append(
    h('div', { class: `sd-grid n${N}`, style: `grid-template-columns: repeat(${N}, 1fr)` }, cells),
    h('div', { class: `sd-palette n${N}` }, palette));

  function render() {
    cells.forEach((c, i) => {
      c.replaceChildren(grid[i] ? symbol(grid[i]) : '');
      c.classList.toggle('sel', i === sel);
      c.classList.toggle('same', !!armed && grid[i] === armed);
    });
    palette.forEach((p, k) => {
      p.classList.toggle('on', armed === k + 1);
      p.disabled = grid.filter(v => v === k + 1).length >= N;
    });
    onChange && onChange({ ...state, empty: grid.filter(v => !v).length, lives: lives - state.mistakes });
  }

  function finish(res) {
    state.done = true;
    render();
    onDone(res);
  }

  function place(i, v) {
    if (state.done || grid[i]) return;
    if (solution[i] === v) {
      grid[i] = v;
      sfx(placeSfx);
      cells[i].classList.add('pop');
      if (!grid.includes(0)) return finish('win');
      render();
      return;
    }
    state.mistakes++;
    sfx('nope');
    cells[i].classList.add('wrong');
    setTimeout(() => cells[i].classList.remove('wrong'), 450);
    render();
    if (state.mistakes >= lives) finish('lose');
  }

  function tapCell(i) {
    if (state.done) return;
    if (grid[i]) { armed = grid[i]; sel = -1; render(); return; }
    if (armed) return place(i, armed);
    sel = i;
    sfx('select');
    render();
  }

  function tapSym(v) {
    if (state.done) return;
    if (sel >= 0 && !grid[sel]) { const i = sel; sel = -1; place(i, v); return; }
    armed = armed === v ? 0 : v;
    render();
  }

  render();
  return {
    state,
    // Fill the selected square (or a random empty one) with its answer.
    hint() {
      if (state.done) return false;
      const empty = grid.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
      if (!empty.length) return false;
      const i = sel >= 0 && !grid[sel] ? sel : empty[(Math.random() * empty.length) | 0];
      state.hints++;
      sel = -1;
      cells[i].classList.add('hinted');
      place(i, solution[i]);
      return true;
    },
  };
}
