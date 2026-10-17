import { h, sparkle } from '../ui.js';
import { sleep } from '../pixel.js';
import { mount, banner } from './common.js';
import { stormSkill } from './tictactoe.js';
import { WORDS3 } from './words3.js';

// Word-Tac-Toe: tic-tac-toe with letters. Take turns placing a letter from your tray on the 3x3
// board. Whoever completes a real three-letter word in a line (across, down or diagonal) wins.
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const VOWELS = 'AEIOU';
const BAG = 'EEEEEAAAAOOOIIIUUTTTNNNSSSRRRHHLLDDDCCMMPPBBGGWWYFFKVJXZ';

const lineWord = (b, l) => (l.every(i => b[i]) ? l.map(i => b[i]).join('') : null);
const makesWord = (b, i) => LINES.filter(l => l.includes(i)).some(l => WORDS3.has(lineWord(b, l)));
// Squares where SOME letter would complete a word right now.
const threats = b => b.map((v, i) => i).filter(i => !b[i] && [...ABC].some(ch => { const t = b.slice(); t[i] = ch; return makesWord(t, i); }));

function draw(n) {
  const out = [];
  while (out.length < n) out.push(BAG[(Math.random() * BAG.length) | 0]);
  if (!out.some(ch => VOWELS.includes(ch))) out[0] = VOWELS[(Math.random() * 5) | 0];
  if (n > 1 && out.filter(ch => VOWELS.includes(ch)).length < 2) out[1] = VOWELS[(Math.random() * 5) | 0];
  return out;
}

export function play(root, { difficulty: d, sfx, boost }) {
  const ui = mount(root, { title: 'Word-Tac-Toe', tip: 'Place letters from your tray. Complete a real 3-letter word in any line (across, down or diagonal) to win!' });
  const skill = stormSkill(d, boost);
  const traySize = boost === 'toast' ? 7 : 5;
  const board = Array(9).fill(null), who = Array(9).fill(null);
  let tray = draw(traySize), stormTray = draw(5), pick = -1, cell = -1, locked = false, done = false;

  const act = {};
  const cells = board.map((_, i) => h('button', { type: 'button', class: 'ttt-cell wt-cell', onclick: () => act.square(i) }));
  const trayEl = h('div', { class: 'wt-tray' });
  ui.body.append(h('div', { class: 'ttt-grid wt-grid' }, cells), h('p', { class: 'muted small center' }, 'Your letters'), trayEl);

  function render(win) {
    const t = new Set(locked || done ? [] : threats(board));
    cells.forEach((c, i) => {
      c.textContent = board[i] || '';
      c.className = 'ttt-cell wt-cell' + (who[i] ? ' by-' + who[i] : '') + (i === cell ? ' sel' : '') + (t.has(i) ? ' threat' : '') + (win && win.includes(i) ? ' hot' : '');
    });
    trayEl.replaceChildren(...tray.map((ch, k) => h('button', { type: 'button', class: 'wt-tile' + (k === pick ? ' on' : ''), onclick: () => act.letter(k) }, ch)));
  }
  render();
  ui.status('Pick a letter, then a square. Glowing squares can complete a word!');

  return new Promise(resolve => {
    async function finish(res, msg, line) {
      done = true;
      render(line);
      sfx(res === 'win' ? 'tttwin' : 'tttlose');
      await sleep(900);
      await banner(ui, res, msg);
      resolve(res);
    }

    // Place a letter; returns the winning line if it completed a word.
    function place(i, ch, by) {
      board[i] = ch;
      who[i] = by;
      return LINES.filter(l => l.includes(i)).find(l => WORDS3.has(lineWord(board, l)));
    }

    function stormMove() {
      const empty = board.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
      const tries = [];
      for (const i of empty) for (const [k, ch] of stormTray.entries()) {
        const t = board.slice(); t[i] = ch;
        tries.push({ i, k, ch, win: makesWord(t, i), danger: threats(t).length });
      }
      if (Math.random() < skill) {
        const win = tries.find(m => m.win);
        if (win) return win;
        const min = Math.min(...tries.map(m => m.danger));
        const safe = tries.filter(m => m.danger === min);
        return safe[(Math.random() * safe.length) | 0];
      }
      return tries[(Math.random() * tries.length) | 0];
    }

    async function go(i, k) {
      locked = true;
      const ch = tray[k];
      tray.splice(k, 1, ...draw(1));
      pick = -1; cell = -1;
      const line = place(i, ch, 'X');
      sfx('type');
      sparkle(cells[i], { count: 6 });
      render();
      if (line) return finish('win', `You spelled ${line.map(j => board[j]).join('')}!`, line);
      if (board.every(Boolean)) return finish('draw', 'The board filled up with no word.');
      ui.status('The storm is thinking…');
      await sleep(700);
      const m = stormMove();
      stormTray.splice(m.k, 1, ...draw(1));
      const sline = place(m.i, m.ch, 'O');
      sfx('aiplace');
      locked = false;
      render();
      if (sline) return finish('lose', `The storm spelled ${sline.map(j => board[j]).join('')}.`, sline);
      if (board.every(Boolean)) return finish('draw', 'The board filled up with no word.');
      ui.status('Your turn.');
    }

    act.letter = k => {
      if (locked || done) return;
      sfx('select');
      if (cell >= 0) return go(cell, k);
      pick = pick === k ? -1 : k;
      render();
    };
    act.square = i => {
      if (locked || done || board[i]) return;
      sfx('select');
      if (pick >= 0) return go(i, pick);
      cell = cell === i ? -1 : i;
      render();
    };
  });
}
