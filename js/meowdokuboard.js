import { h, sparkle } from './ui.js';
import { logicSolve } from './meowdoku-engine.js';

// Soft region colours, one per region (up to 10).
export const REGION_COLORS = ['#f6b8c8', '#b8d8f6', '#c8ecb0', '#f8e0a0', '#d8c4f0', '#f8c8a8', '#b4ece4', '#e8e4b0', '#f0bce4', '#c4cce4'];

export const decode = ([regions, solution, locked]) => ({
  N: solution.length,
  regions: [...regions].map(ch => ch.charCodeAt(0) - 97),
  solution: [...solution].map(Number),
  locked: locked ?? null,
});

// Playable Mewdoku board, following Meowdoku's rules:
// - one piece per row, column and colour region; pieces may not touch, even diagonally
// - the puzzle starts with one locked piece
// - tap marks ✕, double-tap places, tap a placed piece to pick it back up
// - placing a piece that breaks a rule costs a heart (and isn't placed)
// - Undo, Restart, and a hint that points at a square worth checking
// piece(region) -> Node for a placed piece. onDone('win' | 'lose').
export function meowdokuBoard(host, { puzzle, piece, lives = 3, sfx, onChange, onDone, pieceName = 'cat' }) {
  const { N, regions, solution } = puzzle;
  const NN = N * N;
  const lockedCell = puzzle.locked == null ? -1 : puzzle.locked * N + solution[puzzle.locked];
  const cat = new Array(NN).fill(false);
  const mark = new Array(NN).fill(false);
  if (lockedCell >= 0) cat[lockedCell] = true;
  const state = { mistakes: 0, hints: 0, done: false };
  const history = [];
  let mode = 'mark', autoX = false, last = { i: -1, t: 0 }, hintCell = -1, hintTimer = 0;

  const R = i => (i / N) | 0, C = i => i % N;
  const sees = (i, j) => i !== j && (R(i) === R(j) || C(i) === C(j) || regions[i] === regions[j] || (Math.abs(R(i) - R(j)) <= 1 && Math.abs(C(i) - C(j)) <= 1));
  const edge = (i, dr, dc) => {
    const r = R(i) + dr, c = C(i) + dc;
    return r < 0 || r >= N || c < 0 || c >= N || regions[r * N + c] !== regions[i];
  };
  const placedCells = () => [...Array(NN).keys()].filter(i => cat[i]);

  const cells = [...Array(NN).keys()].map(i => {
    const b = h('button', {
      type: 'button',
      class: 'md-cell' + (edge(i, -1, 0) ? ' bt' : '') + (edge(i, 1, 0) ? ' bb' : '') + (edge(i, 0, -1) ? ' bl' : '') + (edge(i, 0, 1) ? ' br' : '') + (i === lockedCell ? ' locked' : ''),
      style: `background:${REGION_COLORS[regions[i]]}`,
      'aria-label': `Row ${R(i) + 1}, column ${C(i) + 1}`,
    });
    b.addEventListener('click', () => tap(i));
    return b;
  });

  const modeBtns = [
    h('button', { type: 'button', class: 'seg-btn on', onclick: () => setMode('mark') }, 'Tap: ✕'),
    h('button', { type: 'button', class: 'seg-btn', onclick: () => setMode('place') }, `Tap: ${pieceName}`),
  ];
  const autoBtn = h('button', { type: 'button', class: 'seg-btn', onclick: () => { autoX = !autoX; autoBtn.classList.toggle('on', autoX); sfx('select'); render(); } }, 'Auto ✕');
  const help = h('p', { class: 'muted small center md-help' });
  host.append(
    h('div', { class: 'md-wrap' }, h('div', { class: `md-grid n${N}`, style: `grid-template-columns: repeat(${N}, 1fr)` }, cells)),
    h('div', { class: 'md-tools' },
      h('div', { class: 'seg' }, modeBtns),
      autoBtn,
      h('button', { type: 'button', class: 'btn small', onclick: () => undo() }, 'Undo'),
      h('button', { type: 'button', class: 'btn small', onclick: () => restart() }, 'Restart')),
    help);

  function setMode(m) {
    mode = m;
    modeBtns[0].classList.toggle('on', m === 'mark');
    modeBtns[1].classList.toggle('on', m === 'place');
    sfx('select');
    render();
  }

  function render() {
    const placed = placedCells();
    cells.forEach((b, i) => {
      const ruledOut = autoX && !cat[i] && !mark[i] && placed.some(j => sees(i, j));
      b.classList.toggle('has', cat[i]);
      b.classList.toggle('hint', i === hintCell);
      b.replaceChildren(cat[i] ? piece(regions[i]) : mark[i] ? h('span', { class: 'md-x' }, '✕') : ruledOut ? h('span', { class: 'md-dot' }) : '');
    });
    help.textContent = mode === 'mark'
      ? `Tap to mark ✕ · double-tap to place a ${pieceName} · tap a ${pieceName} to pick it up`
      : `Tap to place a ${pieceName} · tap a ${pieceName} to pick it up`;
    onChange && onChange({ ...state, lives: lives - state.mistakes, left: N - placed.length });
  }

  function clearHint() { hintCell = -1; clearTimeout(hintTimer); }

  function flash(list) {
    for (const j of list) {
      cells[j].classList.add('wrong');
      setTimeout(() => cells[j].classList.remove('wrong'), 500);
    }
  }

  // Place a piece if it breaks no rule; otherwise it costs a heart.
  function place(i) {
    if (state.done || cat[i]) return;
    clearHint();
    const clash = placedCells().filter(j => sees(i, j));
    if (clash.length) {
      state.mistakes++;
      sfx('nope');
      flash([i, ...clash]);
      render();
      if (state.mistakes >= lives) { state.done = true; onDone('lose'); }
      return;
    }
    history.push({ type: 'cat', i, mark: mark[i] });
    cat[i] = true;
    mark[i] = false;
    sfx('place');
    sparkle(cells[i], { count: 7 });
    cells[i].classList.add('pop');
    setTimeout(() => cells[i].classList.remove('pop'), 250);
    // N pieces with no clashes is the (unique) solution.
    if (placedCells().length === N) { state.done = true; render(); onDone('win'); return; }
    render();
  }

  function tap(i) {
    if (state.done || i === lockedCell) return;
    clearHint();
    if (cat[i]) {
      history.push({ type: 'uncat', i });
      cat[i] = false;
      sfx('select');
      render();
      return;
    }
    if (mode === 'place') { place(i); return; }
    const now = performance.now();
    if (last.i === i && now - last.t < 350) {
      // double tap: undo the ✕ the first tap toggled, then place
      history.pop();
      mark[i] = last.markedBefore;
      last = { i: -1, t: 0 };
      place(i);
      return;
    }
    last = { i, t: now, markedBefore: mark[i] };
    history.push({ type: 'mark', i, was: mark[i] });
    mark[i] = !mark[i];
    sfx('select');
    render();
  }

  function undo() {
    if (state.done) return;
    const a = history.pop();
    if (!a) return;
    clearHint();
    if (a.type === 'mark') mark[a.i] = a.was;
    else if (a.type === 'cat') { cat[a.i] = false; mark[a.i] = a.mark; }
    else if (a.type === 'uncat') cat[a.i] = true;
    sfx('select');
    render();
  }

  function restart() {
    if (state.done) return;
    clearHint();
    for (let i = 0; i < NN; i++) { if (i !== lockedCell) cat[i] = false; mark[i] = false; }
    history.length = 0;
    sfx('select');
    render();
  }

  render();
  return {
    state,
    // Point at a square worth looking at; never places anything. Returns a message, or null.
    hint() {
      if (state.done) return null;
      state.hints++;
      clearHint();
      const wrong = placedCells().find(i => i !== lockedCell && solution[R(i)] !== C(i));
      let msg;
      if (wrong !== undefined) {
        hintCell = wrong;
        msg = `That ${pieceName} doesn’t fit the solution. Try picking it up.`;
      } else {
        const ls = logicSolve(N, regions, placedCells());
        hintCell = ls.order.find(i => !cat[i]) ?? [...Array(N).keys()].map(r => r * N + solution[r]).find(i => !cat[i]);
        msg = `Look closely at the glowing square: logic says a ${pieceName} must go there.`;
      }
      hintTimer = setTimeout(() => { hintCell = -1; render(); }, 4000);
      render();
      return msg;
    },
  };
}
