import { h, icon } from '../ui.js';
import { sleep } from '../pixel.js';
import { CAT_BREEDS } from '../spritedata.js';
import { generate } from '../sudoku.js';
import { sudokuBoard } from '../sudokuboard.js';
import { mount, banner, hearts } from './common.js';

// 6x6 sudoku with cats; `letters` mode (Wordoku) is a 4x4 whose top row spells a clue's answer.
export function play(root, { difficulty: d, sfx, wordoku = null }) {
  const N = wordoku ? 4 : 6;
  const ui = mount(root, wordoku
    ? { title: 'Wordoku', tip: 'A sudoku made of letters. The top row spells the answer to the clue.' }
    : { title: 'Mewdoku', tip: 'One of every cat in each row, column and box. Tap a square, then a cat.' });
  const { puzzle, solution } = generate(N, wordoku ? 7 - Math.round(d * 2) : 20 - Math.round(d * 6));
  let symbol, names;
  if (wordoku) {
    const letter = {};
    for (let k = 0; k < N; k++) letter[solution[k]] = wordoku.word[k];
    symbol = v => h('span', { class: 'sd-letter' }, letter[v]);
    names = Array.from({ length: N }, (_, k) => letter[k + 1]);
    ui.body.append(h('p', { class: 'cw-clue' }, h('b', {}, 'Clue: '), wordoku.clue));
  } else {
    symbol = v => icon('cat' + (v - 1), 'ico cat');
    names = CAT_BREEDS.map(b => b.name);
  }
  return new Promise(resolve => {
    sudokuBoard(ui.body, {
      N, puzzle, solution, symbol, names, lives: 3, sfx, placeSfx: wordoku ? 'type' : 'mew',
      onChange: s => ui.info.replaceChildren(h('span', { class: 'mg-stat' }, hearts(s.lives, 3)), h('span', { class: 'mg-stat' }, `${s.empty} empty`)),
      onDone: async res => {
        sfx(res === 'win' ? 'tttwin' : 'tttlose');
        await sleep(500);
        await banner(ui, res, res === 'win' ? (wordoku ? `It spells ${wordoku.word}!` : 'A purr-fect grid!') : 'Out of hearts.');
        resolve(res);
      },
    });
    ui.status('Tap an empty square, then pick.');
  });
}
