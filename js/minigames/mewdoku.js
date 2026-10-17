import { h, icon } from '../ui.js';
import { sleep } from '../pixel.js';
import { CAT_BREEDS } from '../spritedata.js';
import { generate } from '../sudoku.js';
import { sudokuBoard } from '../sudokuboard.js';
import { meowdokuBoard, decode } from '../meowdokuboard.js';
import { transform } from '../meowdoku-engine.js';
import { POOL } from '../arcade/meowdoku-levels.js';
import { mount, banner, hearts } from './common.js';

// Mewdoku: one cat in every row, column and coloured region, and no two cats may touch.
export function play(root, opts) {
  if (opts.wordoku) return playWordoku(root, opts);
  const { difficulty: d, sfx } = opts;
  const lives = 3 + (opts.boost === 'tea' ? 1 : 0);
  const ui = mount(root, { title: 'Mewdoku', tip: 'One cat in every row, column and colour. Cats can’t touch, not even diagonally. Start from the locked cat.' });
  const size = d < 0.5 ? 5 : 6;
  const pool = POOL.filter(e => e[1].length === size);
  const shuffled = transform(decode(pool[(Math.random() * pool.length) | 0]), (Math.random() * 8) | 0);
  // Like the real game, start with one cat already locked in place.
  const puzzle = { ...shuffled, locked: (Math.random() * size) | 0 };
  return new Promise(resolve => {
    meowdokuBoard(ui.body, {
      puzzle, lives, sfx, pieceName: 'cat',
      piece: g => icon('cat' + (g % CAT_BREEDS.length), 'ico cat'),
      onChange: s => ui.info.replaceChildren(h('span', { class: 'mg-stat' }, hearts(s.lives, lives)), h('span', { class: 'mg-stat' }, `${s.left} cat${s.left === 1 ? '' : 's'} to place`)),
      onDone: async res => {
        sfx(res === 'win' ? 'tttwin' : 'tttlose');
        await sleep(500);
        await banner(ui, res, res === 'win' ? 'Every cat has its own patch!' : 'Out of hearts.');
        resolve(res);
      },
    });
  });
}

// Wordoku: a 4x4 letter sudoku whose top row spells a clue's answer.
function playWordoku(root, { difficulty: d, sfx, wordoku, boost }) {
  const N = 4;
  const lives = 3 + (boost === 'tea' ? 1 : 0);
  const ui = mount(root, { title: 'Wordoku', tip: 'A sudoku made of letters. The top row spells the answer to the clue.' });
  const { puzzle, solution } = generate(N, 7 - Math.round(d * 2));
  const letter = {};
  for (let k = 0; k < N; k++) letter[solution[k]] = wordoku.word[k];
  const symbol = v => h('span', { class: 'sd-letter' }, letter[v]);
  const names = Array.from({ length: N }, (_, k) => letter[k + 1]);
  ui.body.append(h('p', { class: 'cw-clue' }, h('b', {}, 'Clue: '), wordoku.clue));
  return new Promise(resolve => {
    sudokuBoard(ui.body, {
      N, puzzle, solution, symbol, names, lives, sfx, placeSfx: 'type',
      onChange: s => ui.info.replaceChildren(h('span', { class: 'mg-stat' }, hearts(s.lives, lives)), h('span', { class: 'mg-stat' }, `${s.empty} empty`)),
      onDone: async res => {
        sfx(res === 'win' ? 'tttwin' : 'tttlose');
        await sleep(500);
        await banner(ui, res, res === 'win' ? `It spells ${wordoku.word}!` : 'Out of hearts.');
        resolve(res);
      },
    });
    ui.status('Tap an empty square, then pick a letter.');
  });
}
