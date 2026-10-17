import { h, icon } from '../ui.js';
import { sleep } from '../pixel.js';
import { CAT_BREEDS } from '../spritedata.js';
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

// Five-letter answers with no repeated letters, so every colour gets its own letter.
const WORDS5 = [
  ['CABIN', 'A cosy little wooden house in the woods'], ['STORM', 'Wild weather with wind and thunder'],
  ['CLOUD', 'It drifts overhead and sometimes rains'], ['MAGIC', 'What a wand is for'],
  ['CHARM', 'A lucky trinket on a bracelet'], ['SPARK', 'A tiny flash from a fire'],
  ['PLANT', 'It grows in a pot on the windowsill'], ['QUILT', 'A patchwork blanket'],
  ['CANDY', 'A sweet treat in a wrapper'], ['MOUSE', 'A small squeaky visitor'],
  ['BREAD', 'A loaf from the oven'], ['HEART', 'It beats in your chest'],
  ['LIGHT', 'The opposite of dark'], ['NIGHT', 'When the moon comes out'],
  ['SCARF', 'Knitted and wrapped round your neck'], ['GHOST', 'A spooky sheet that says boo'],
  ['DREAM', 'What you have while you sleep'], ['RAINY', 'A day for staying indoors'],
  ['FROST', 'Icy sparkle on the window'],
].filter(([w]) => new Set(w).size === 5);

// Word Mewdoku: every colour is labelled with a letter. Read the cats top to bottom and they spell
// the clue's answer, so cracking the clue tells you which colour each row's cat lives in.
function playWordoku(root, { difficulty: d, sfx, boost }) {
  const lives = 3 + (boost === 'tea' ? 1 : 0);
  const ui = mount(root, { title: 'Word Mewdoku', tip: 'Mewdoku rules, but each colour has a letter. Top to bottom, the cats spell the answer to the clue. Solve the clue to know where they go!' });
  const pool = POOL.filter(e => e[1].length === 5);
  const puzzle = transform(decode(pool[(Math.random() * pool.length) | 0]), (Math.random() * 8) | 0);
  const N = puzzle.N;
  const [word, clue] = WORDS5[(Math.random() * WORDS5.length) | 0];
  const letter = {};
  for (let r = 0; r < N; r++) letter[puzzle.regions[r * N + puzzle.solution[r]]] = word[r];
  // Harder levels drop the locked cat, so the clue does more of the work.
  if (d < 0.6) puzzle.locked = (Math.random() * N) | 0;
  const slots = Array.from({ length: N }, () => h('b', {}, ''));
  ui.body.append(h('p', { class: 'cw-clue' }, h('b', {}, 'Clue: '), clue), h('div', { class: 'word-slots' }, slots));
  return new Promise(resolve => {
    meowdokuBoard(ui.body, {
      puzzle, lives, sfx, pieceName: 'cat',
      regionLabel: g => letter[g],
      piece: g => h('span', { class: 'wm-piece' }, icon('cat' + (g % CAT_BREEDS.length), 'ico cat'), h('b', {}, letter[g])),
      onChange: s => {
        // The answer slots fill in from whichever row each cat sits in.
        slots.forEach(b => { b.textContent = ''; b.classList.remove('on'); });
        for (const i of s.placed) { const b = slots[(i / N) | 0]; b.textContent = letter[puzzle.regions[i]]; b.classList.add('on'); }
        ui.info.replaceChildren(h('span', { class: 'mg-stat' }, hearts(s.lives, lives)), h('span', { class: 'mg-stat' }, `${s.left} to place`));
      },
      onDone: async res => {
        sfx(res === 'win' ? 'tttwin' : 'tttlose');
        await sleep(500);
        await banner(ui, res, res === 'win' ? `The cats spell ${word}!` : `Out of hearts. It was ${word}.`);
        resolve(res);
      },
    });
  });
}
