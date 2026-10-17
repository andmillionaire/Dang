import { $, h, icon } from './ui.js';
import { sleep } from './pixel.js';

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function outcome(b) {
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

function aiMove(b, skill) {
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

// Resolves 'win' | 'lose' | 'draw'. Ties replay, up to MAX_TIES times.
const MAX_TIES = 2;

export function playTicTacToe({ skill, sfx }) {
  const root = $('#ttt');
  const grid = $('#tttGrid');
  const status = $('#tttStatus');
  const rounds = $('#tttRound');
  root.hidden = false;
  root.classList.remove('leaving');

  return new Promise(resolve => {
    let board, locked, ties = 0;
    const cells = Array.from({ length: 9 }, (_, i) => h('button', { class: 'ttt-cell', 'aria-label': `Cell ${i + 1}`, onclick: () => play(i) }));
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
      status.textContent = 'Your move: you are the warm X';
      rounds.textContent = ties ? `Tie-breaker ${ties}/${MAX_TIES}` : '';
      render();
    }

    async function finish(res, msg, line) {
      locked = true;
      status.textContent = msg;
      render(line);
      sfx(res === 'win' ? 'tttwin' : 'tttlose');
      await sleep(1300);
      root.classList.add('leaving');
      await sleep(250);
      root.hidden = true;
      resolve(res);
    }

    async function check() {
      const o = outcome(board);
      if (!o) return false;
      if (o.w === 'X') finish('win', 'You beat the storm! Blast away!', o.line);
      else if (o.w === 'O') finish('lose', 'The storm wins. Your match fizzles…', o.line);
      else if (ties >= MAX_TIES) finish('draw', 'Stalemate. The charge fizzles…');
      else {
        ties++;
        locked = true;
        status.textContent = 'Tie! Again!';
        render();
        sfx('aiplace');
        await sleep(900);
        newRound();
      }
      return true;
    }

    async function play(i) {
      if (locked || board[i]) return;
      board[i] = 'X';
      sfx('place');
      locked = true;
      render();
      if (await check()) return;
      status.textContent = 'The storm is thinking…';
      await sleep(450 + Math.random() * 350);
      board[aiMove(board, skill)] = 'O';
      sfx('aiplace');
      locked = false;
      render();
      if (await check()) return;
      status.textContent = 'Your move';
    }

    newRound();
  });
}
