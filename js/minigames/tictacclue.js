import { h } from '../ui.js';
import { sleep } from '../pixel.js';
import { mount, banner } from './common.js';
import { outcome, aiMove, stormSkill } from './tictactoe.js';
import { WORDS } from './crossword.js';
import { keyboard } from './keyboard.js';

// Tic-tac-toe where each square hides a clue. Answer it to claim the square.
export function play(root, { difficulty: d, sfx, boost }) {
  const ui = mount(root, { title: 'Tic-Tac-Clue', tip: 'Pick a square and answer its clue to claim it. A wrong answer ends your turn.' });
  const words = [...WORDS].sort(() => Math.random() - 0.5).slice(0, 9);
  const board = Array(9).fill(null);
  const skill = stormSkill(d, boost);
  // Honey Toast shows the first letter of every answer.
  const given = boost === 'toast' ? 1 : 0;
  let sel = -1, typed = '', locked = false, done = false;

  // Buttons are built before the game's handlers exist; they forward through `act`.
  const act = {};
  const cells = words.map((w, i) => h('button', { class: 'ttt-cell clue-cell', onclick: () => act.pick(i) }));
  const clue = h('p', { class: 'cw-clue' }, 'Tap a square to see its clue.');
  const slots = h('div', { class: 'slots' });
  const kb = keyboard(k => act.key(k));
  ui.wrap.classList.add('typing');
  ui.body.append(h('div', { class: 'grid-fit' }, h('div', { class: 'ttt-grid small' }, cells)), clue, slots, kb);

  function render(line) {
    cells.forEach((c, i) => {
      c.replaceChildren(board[i] ? h('span', { class: 'mark-' + board[i] }, board[i] === 'X' ? '✕' : '○') : h('small', {}, `${words[i].word.length}`));
      c.classList.toggle('sel', i === sel);
      c.classList.toggle('hot', !!(line && line.includes(i)));
      c.disabled = done || !!board[i];
    });
    slots.replaceChildren(...(sel >= 0 ? [...words[sel].word].map((_, k) => h('b', {}, typed[k] || '')) : []));
  }
  render();
  ui.status('Your move.');

  return new Promise(resolve => {
    const onKey = e => {
      if (/^[a-z]$/i.test(e.key)) key(e.key.toUpperCase());
      else if (e.key === 'Backspace') key('⌫');
    };
    addEventListener('keydown', onKey);

    async function finish(res, msg, line) {
      done = true;
      removeEventListener('keydown', onKey);
      render(line);
      sfx(res === 'win' ? 'tttwin' : 'tttlose');
      await sleep(700);
      await banner(ui, res, msg);
      resolve(res);
    }

    function check() {
      const o = outcome(board);
      if (!o) return false;
      if (o.w === 'X') finish('win', 'Three clues in a row!', o.line);
      else if (o.w === 'O') finish('lose', 'The storm got three in a row.', o.line);
      else finish('draw', 'Stalemate.');
      return true;
    }

    function pick(i) {
      if (locked || done || board[i]) return;
      sel = i;
      typed = words[i].word.slice(0, given);
      clue.replaceChildren(h('b', {}, `${words[i].word.length} letters: `), words[i].clue);
      sfx('select');
      render();
    }

    Object.assign(act, { pick, key });
    async function key(k) {
      if (locked || done || sel < 0) return;
      if (k === '⌫') typed = typed.length > given ? typed.slice(0, -1) : typed;
      else if (typed.length < words[sel].word.length) { typed += k; sfx('type'); }
      render();
      if (typed.length === words[sel].word.length) submit();
    }

    async function submit() {
      locked = true;
      const i = sel;
      if (typed === words[i].word) {
        board[i] = 'X';
        sfx('place');
        ui.status('Correct!');
      } else {
        sfx('nope');
        ui.status(`Not quite. It was ${words[i].word}.`);
      }
      sel = -1;
      typed = '';
      clue.textContent = 'Tap a square to see its clue.';
      render();
      if (check()) return;
      await sleep(900);
      board[aiMove(board, skill)] = 'O';
      sfx('aiplace');
      render();
      if (check()) return;
      locked = false;
      ui.status('Your move.');
    }
  });
}
