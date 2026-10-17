import { h, icon } from '../ui.js';
import { sleep } from '../pixel.js';
import { mount, banner } from './common.js';

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export function outcome(b) {
  for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return { w: b[l[0]], line: l };
  return b.every(Boolean) ? { w: 'draw' } : null;
}

// Score from the storm's (O) point of view; quicker wins score higher.
function minimax(b, turn, depth) {
  const o = outcome(b);
  if (o) return o.w === 'O' ? 10 - depth : o.w === 'X' ? depth - 10 : 0;
  let best = turn === 'O' ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = turn;
    const s = minimax(b, turn === 'O' ? 'X' : 'O', depth + 1);
    b[i] = null;
    best = turn === 'O' ? Math.max(best, s) : Math.min(best, s);
  }
  return best;
}

export function aiMove(b, skill) {
  const empty = b.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
  if (Math.random() > skill) return empty[(Math.random() * empty.length) | 0];
  let best = -Infinity, picks = [];
  for (const i of empty) {
    b[i] = 'O';
    const s = minimax(b, 'X', 1);
    b[i] = null;
    if (s > best) { best = s; picks = [i]; } else if (s === best) picks.push(i);
  }
  return picks[(Math.random() * picks.length) | 0];
}

const MAX_TIES = 2;

// Resolves 'win' | 'lose' | 'draw'. Ties replay up to MAX_TIES times.
// The storm's chance of a perfect move; a Cozy Scarf makes it sleepy.
export const stormSkill = (d, boost) => Math.max(0.1, 0.35 + 0.5 * d - (boost === 'scarf' ? 0.3 : 0));

export function play(root, { difficulty, sfx, boost }) {
  const skill = stormSkill(difficulty, boost);
  const ui = mount(root, { title: 'Tic-Tac-Toe', tip: 'Get three warm X’s in a row before the storm does.' });
  const grid = h('div', { class: 'ttt-grid' });
  ui.body.append(grid);
  ui.info.textContent = `The storm is ${Math.round(skill * 100)}% focused`;

  return new Promise(resolve => {
    let board, locked, ties = 0;
    const cells = Array.from({ length: 9 }, (_, i) => h('button', { class: 'ttt-cell', 'aria-label': `Cell ${i + 1}`, onclick: () => move(i) }));
    grid.replaceChildren(...cells);

    function render(line) {
      cells.forEach((c, i) => {
        c.replaceChildren(board[i] ? icon(board[i] === 'X' ? 'markX' : 'markO', 'mark') : '');
        c.dataset.mark = board[i] || '';
        c.classList.toggle('hot', !!(line && line.includes(i)));
        c.disabled = locked || !!board[i];
      });
    }

    function newRound() {
      board = Array(9).fill(null);
      locked = false;
      ui.status(ties ? `Tie-breaker ${ties}/${MAX_TIES}. Your move` : 'Your move');
      render();
    }

    async function finish(res, msg, line) {
      locked = true;
      render(line);
      sfx(res === 'win' ? 'tttwin' : 'tttlose');
      await sleep(700);
      await banner(ui, res, msg);
      resolve(res);
    }

    async function check() {
      const o = outcome(board);
      if (!o) return false;
      if (o.w === 'X') finish('win', 'You beat the storm!', o.line);
      else if (o.w === 'O') finish('lose', 'The storm got three in a row.', o.line);
      else if (ties >= MAX_TIES) finish('draw', 'Stalemate.');
      else {
        ties++;
        locked = true;
        ui.status('Tie! Again!');
        render();
        await sleep(900);
        newRound();
      }
      return true;
    }

    async function move(i) {
      if (locked || board[i]) return;
      board[i] = 'X';
      sfx('place');
      locked = true;
      render();
      if (await check()) return;
      ui.status('The storm is thinking…');
      await sleep(450 + Math.random() * 350);
      board[aiMove(board, skill)] = 'O';
      sfx('aiplace');
      locked = false;
      render();
      if (await check()) return;
      ui.status('Your move');
    }

    newRound();
  });
}
