import { h } from './ui.js';

// Soft region colours, one per region (up to 10).
export const REGION_COLORS = ['#f6b8c8', '#b8d8f6', '#c8ecb0', '#f8e0a0', '#d8c4f0', '#f8c8a8', '#b4ece4', '#e8e4b0', '#f0bce4', '#c4cce4'];

export const decode = ([regions, solution]) => ({
  N: solution.length,
  regions: [...regions].map(ch => ch.charCodeAt(0) - 97),
  solution: [...solution].map(Number),
});

// Playable Mewdoku grid. Tap marks ✕, double-tap places (or switch to "place" mode).
// piece(region) -> Node shown when a piece is placed in that region. onDone('win' | 'lose').
export function meowdokuBoard(host, { puzzle, piece, lives = 3, sfx, onChange, onDone, pieceName = 'cat' }) {
  const { N, regions, solution } = puzzle;
  const NN = N * N;
  const cat = new Array(NN).fill(false);
  const mark = new Array(NN).fill(false);
  const state = { mistakes: 0, hints: 0, placed: 0, done: false };
  let mode = 'mark', last = { i: -1, t: 0 };

  const R = i => (i / N) | 0, C = i => i % N;
  const sees = (i, j) => R(i) === R(j) || C(i) === C(j) || regions[i] === regions[j] || (Math.abs(R(i) - R(j)) <= 1 && Math.abs(C(i) - C(j)) <= 1);
  const edge = (i, dr, dc) => {
    const r = R(i) + dr, c = C(i) + dc;
    return r < 0 || r >= N || c < 0 || c >= N || regions[r * N + c] !== regions[i];
  };

  const cells = [...Array(NN).keys()].map(i => {
    const b = h('button', {
      type: 'button',
      class: 'md-cell' + (edge(i, -1, 0) ? ' bt' : '') + (edge(i, 1, 0) ? ' bb' : '') + (edge(i, 0, -1) ? ' bl' : '') + (edge(i, 0, 1) ? ' br' : ''),
      style: `background:${REGION_COLORS[regions[i]]}`,
      'aria-label': `Row ${R(i) + 1}, column ${C(i) + 1}`,
    });
    b.addEventListener('click', () => tap(i));
    return b;
  });

  const modeBtns = [
    h('button', { type: 'button', class: 'seg-btn on', onclick: () => setMode('mark') }, 'Tap: mark ✕'),
    h('button', { type: 'button', class: 'seg-btn', onclick: () => setMode('place') }, `Tap: place ${pieceName}`),
  ];
  host.append(
    h('div', { class: 'md-wrap' }, h('div', { class: `md-grid n${N}`, style: `grid-template-columns: repeat(${N}, 1fr)` }, cells)),
    h('div', { class: 'seg md-mode' }, modeBtns),
    h('p', { class: 'muted small center md-help' }, mode === 'mark' ? `Tap to mark ✕ · double-tap to place a ${pieceName}` : ''));
  const help = host.querySelector('.md-help');

  function setMode(m) {
    mode = m;
    modeBtns[0].classList.toggle('on', m === 'mark');
    modeBtns[1].classList.toggle('on', m === 'place');
    help.textContent = m === 'mark' ? `Tap to mark ✕ · double-tap to place a ${pieceName}` : `Tap to place a ${pieceName}`;
    sfx('select');
  }

  function render() {
    const placed = [...Array(NN).keys()].filter(i => cat[i]);
    cells.forEach((b, i) => {
      const ruledOut = !cat[i] && placed.some(j => sees(i, j));
      b.classList.toggle('has', cat[i]);
      b.classList.toggle('auto', ruledOut && !mark[i]);
      b.replaceChildren(cat[i] ? piece(regions[i]) : mark[i] ? h('span', { class: 'md-x' }, '✕') : ruledOut ? h('span', { class: 'md-dot' }) : '');
    });
    onChange && onChange({ ...state, lives: lives - state.mistakes, left: N - state.placed });
  }

  function place(i, fromHint = false) {
    if (state.done || cat[i]) return;
    if (solution[R(i)] === C(i)) {
      cat[i] = true;
      mark[i] = false;
      state.placed++;
      sfx(fromHint ? 'coin' : 'place');
      cells[i].classList.add('pop');
      if (state.placed === N) { state.done = true; render(); onDone('win'); return; }
      render();
      return;
    }
    state.mistakes++;
    mark[i] = true;
    sfx('nope');
    cells[i].classList.add('wrong');
    setTimeout(() => cells[i].classList.remove('wrong'), 450);
    render();
    if (state.mistakes >= lives) { state.done = true; onDone('lose'); }
  }

  function tap(i) {
    if (state.done || cat[i]) return;
    const now = performance.now();
    if (mode === 'place') { place(i); return; }
    if (last.i === i && now - last.t < 350) {
      // double tap: undo the ✕ the first tap toggled, then place
      mark[i] = last.markedBefore;
      last = { i: -1, t: 0 };
      place(i);
      return;
    }
    last = { i, t: now, markedBefore: mark[i] };
    mark[i] = !mark[i];
    sfx('select');
    render();
  }

  render();
  return {
    state,
    // Reveal the correct square for a random region that has no piece yet.
    hint() {
      if (state.done) return false;
      const open = [...Array(N).keys()].filter(r => !cat[r * N + solution[r]]);
      if (!open.length) return false;
      const r = open[(Math.random() * open.length) | 0];
      state.hints++;
      cells[r * N + solution[r]].classList.add('hinted');
      place(r * N + solution[r], true);
      return true;
    },
  };
}
