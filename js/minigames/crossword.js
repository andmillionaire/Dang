import { h } from '../ui.js';
import { sleep } from '../pixel.js';
import { mount, banner } from './common.js';
import { keyboard } from './keyboard.js';

// Double word squares: every row and every column is a different word, each with its own clue.
// `across` are the rows top to bottom, `down` the columns left to right.
export const PUZZLES = [
  {
    across: [['WALK', 'Stroll around the cabin'], ['ICON', 'Little picture on a phone screen'], ['PINE', 'Evergreen outside the window'], ['EDGE', 'Rim or brink']],
    down: [['WIPE', 'Clean the foggy window'], ['ACID', 'Lemon juice has some'], ['LONG', 'Not short, like a rainy night'], ['KNEE', 'Joint you kneel on']],
  },
  {
    across: [['PLOT', 'Garden patch for planting'], ['LOVE', 'Cozy feeling for your pet'], ['USES', 'Puts to work'], ['SENT', 'Mailed off']],
    down: [['PLUS', 'Addition sign'], ['LOSE', 'Opposite of win'], ['OVEN', 'It bakes the bread'], ['TEST', 'Exam or trial']],
  },
  {
    across: [['CLUB', 'Book ___ or golf ___'], ['ROSE', 'Thorny red bloom'], ['EVEN', 'Not odd'], ['WEST', 'Where the sun sets']],
    down: [['CREW', "A ship's team"], ['LOVE', 'Zero, in tennis'], ['USES', 'Puts to work'], ['BENT', 'Not straight']],
  },
  {
    across: [['PATH', 'Trail through the woods'], ['ECHO', 'Sound bouncing off the hills'], ['TRIO', 'Group of three'], ['SEND', 'Mail off']],
    down: [['PETS', 'Cats and dogs at home'], ['ACRE', 'Unit of farmland'], ['THIN', 'Not thick'], ['HOOD', "A cape's head covering"]],
  },
  {
    across: [['THEN', 'After that'], ['HIDE', 'Play ___-and-seek'], ['URGE', 'Strong desire'], ['SEED', 'Plant it to grow a crop']],
    down: [['THUS', 'Therefore'], ['HIRE', 'Give a job to'], ['EDGE', 'Brink'], ['NEED', 'Must have']],
  },
  {
    across: [['EDIT', 'Revise a draft'], ['PACE', 'Walking speed'], ['IRON', 'Press the laundry'], ['CENT', 'A penny']],
    down: [['EPIC', 'Legendary, like a quest'], ['DARE', 'Truth or ___'], ['ICON', 'Little picture on a screen'], ['TENT', 'Camping shelter']],
  },
  {
    across: [['SLOW', 'Like a snail'], ['POPE', 'Leader in the Vatican'], ['OVEN', 'It bakes the bread'], ['TENT', 'Camping shelter']],
    down: [['SPOT', 'Dot, or notice'], ['LOVE', 'Zero, in tennis'], ['OPEN', 'Not shut'], ['WENT', 'Left; departed']],
  },
  {
    across: [['WOLF', 'Howls at the moon'], ['OVER', 'Finished'], ['RAGE', 'Fury'], ['ELSE', 'Otherwise']],
    down: [['WORE', 'Had on, like a scarf'], ['OVAL', 'Egg shape'], ['LEGS', 'A table has four'], ['FREE', 'No charge']],
  },
  {
    across: [['HELP', 'Cry for assistance'], ['OVAL', 'Egg shape'], ['MENU', 'List at a diner'], ['ENDS', 'Finishes']],
    down: [['HOME', 'Where the heart is'], ['EVEN', 'Level; not odd'], ['LAND', 'Touch down'], ['PLUS', 'Addition sign']],
  },
  {
    across: [['PAST', 'Bygone days'], ['ECHO', 'Sound that bounces back'], ['TRUE', 'Not false'], ['SETS', 'Tennis matches have them']],
    down: [['PETS', 'Cats and dogs at home'], ['ACRE', 'Unit of farmland'], ['SHUT', 'Closed'], ['TOES', 'Ten little piggies']],
  },
  {
    across: [['TELL', 'Share a story'], ['IDEA', 'Bright thought'], ['EGGS', 'Breakfast from the hens'], ['REST', 'Take a nap']],
    down: [['TIER', 'Layer of a cake'], ['EDGE', 'Brink'], ['LEGS', 'A table has four'], ['LAST', 'Final']],
  },
  {
    across: [['STIR', 'Mix the soup'], ['WIDE', 'Broad'], ['IRON', 'Press the laundry'], ['MELT', 'What snow does in spring']],
    down: [['SWIM', 'Paddle in the lake'], ['TIRE', "A wheel's rubber"], ['IDOL', 'Pop star'], ['RENT', 'Monthly cabin payment']],
  },
  {
    across: [['DEAR', 'Start of a letter'], ['RARE', 'Hard to find'], ['USES', 'Puts to work'], ['MEAT', 'Stew ingredient']],
    down: [['DRUM', 'Marching band beat'], ['EASE', 'Comfort'], ['AREA', 'Length times width'], ['REST', 'Take a nap']],
  },
  {
    across: [['GHOST', 'Sheet-wearing spook'], ['REPLY', 'Answer a letter'], ['ALTAR', 'Front of a wedding chapel'], ['SLICE', 'Piece of pie'], ['SOCKS', 'Toasty foot warmers']],
    down: [['GRASS', 'Lawn'], ['HELLO', 'Phone greeting'], ['OPTIC', 'Relating to the eye'], ['SLACK', 'Loose, not taut'], ['TYRES', "Wheels' rubber, British-style"]],
  },
  {
    across: [['GRADE', 'School mark'], ['LOVED', 'Adored'], ['AMONG', 'In the middle of'], ['RAISE', 'Lift up'], ['ENDED', 'Finished']],
    down: [['GLARE', 'Angry stare'], ['ROMAN', '___ numerals, like IV'], ['AVOID', 'Steer clear of'], ['DENSE', 'Thick, like fog'], ['EDGED', "Trimmed the lawn's border"]],
  },
  {
    across: [['GRAFT', 'Join a cutting onto a plant'], ['RULER', 'Queen or king'], ['ALONE', 'By yourself in the cabin'], ['PENCE', 'British pennies'], ['EDGES', 'Borders']],
    down: [['GRAPE', 'Vine fruit'], ['RULED', 'Lined, like notebook paper'], ['ALONG', 'Come ___ for the ride'], ['FENCE', 'Garden border'], ['TREES', 'Forest giants']],
  },
  {
    across: [['CAVES', 'Bat homes'], ['ALIVE', 'Living'], ['SPREE', 'Shopping ___'], ['THANK', 'Show gratitude to'], ['SALTS', 'Bath ___']],
    down: [['CASTS', 'Spells a wizard ___'], ['ALPHA', 'First Greek letter'], ['VIRAL', 'Spreading fast online'], ['EVENT', 'Special occasion'], ['SEEKS', 'Looks for']],
  },
];

// Every answer/clue pair, de-duplicated, for the word mashups.
export const WORDS = [...new Map(PUZZLES.flatMap(p => [...p.across, ...p.down].map(([w, clue]) => [w, { word: w, clue }]))).values()];

export function play(root, { difficulty: d, sfx, boost }) {
  const pool = PUZZLES.filter(p => d > 0.45 || p.across.length === 4);
  const P = pool[(Math.random() * pool.length) | 0];
  const n = P.across.length;
  const answer = P.across.map(([w]) => w).join('');
  const grid = Array(n * n).fill('');
  const given = new Set();
  const prefill = Math.round(3 * (1 - d));
  while (given.size < prefill) given.add((Math.random() * n * n) | 0);
  given.forEach(i => (grid[i] = answer[i]));

  const limit = ((n === 4 ? 100 - 30 * d : 150 - 40 * d) + (boost === 'toast' ? 30 : 0)) * 1000;
  let left = limit, sel = [...Array(n * n).keys()].find(i => !given.has(i)) ?? 0, dir = 'across', done = false;

  const ui = mount(root, { title: 'Word Square', tip: 'Every row and every column is a word, each with its own clue. Fill the square before time runs out.' });
  const bar = h('div', { class: 'timebar' }, h('i'));
  const clue = h('p', { class: 'cw-clue' });
  // Buttons are built before the game's handlers exist; they forward through `act`.
  const act = {};
  const cells = grid.map((_, i) => h('button', { class: 'cw-cell' + (given.has(i) ? ' given' : ''), onclick: () => act.tap(i) }));
  const board = h('div', { class: 'cw-grid', style: `grid-template-columns: repeat(${n}, 1fr)` }, cells);
  const hint = h('button', { class: 'btn small', onclick: () => act.useHint() }, 'Hint (−10s)');
  const kb = keyboard(k => act.key(k));
  ui.wrap.classList.add('typing');
  ui.info.append(bar, hint);
  ui.body.append(h('div', { class: 'grid-fit' }, board), clue, kb);

  const word = i => {
    const r = (i / n) | 0, c = i % n;
    return [...Array(n).keys()].map(k => (dir === 'across' ? r * n + k : k * n + c));
  };
  const render = () => {
    const w = word(sel);
    cells.forEach((c, i) => {
      c.textContent = grid[i];
      c.classList.toggle('sel', i === sel);
      c.classList.toggle('word', w.includes(i));
    });
    const idx = dir === 'across' ? (sel / n) | 0 : sel % n;
    clue.replaceChildren(h('b', {}, `${idx + 1} ${dir === 'across' ? 'Across' : 'Down'}`), ` ${P[dir][idx][1]}`);
  };
  render();
  ui.status('Tap a square twice to switch between across and down.');

  return new Promise(resolve => {
    const onKey = e => {
      if (done) return;
      if (/^[a-z]$/i.test(e.key)) key(e.key.toUpperCase());
      else if (e.key === 'Backspace') key('⌫');
    };
    addEventListener('keydown', onKey);
    let last = performance.now();
    const timer = setInterval(() => {
      if (!board.isConnected) { clearInterval(timer); removeEventListener('keydown', onKey); return; }
      const now = performance.now();
      left -= now - last;
      last = now;
      bar.firstChild.style.width = Math.max(0, (left / limit) * 100) + '%';
      bar.classList.toggle('low', left < 15000);
      if (left <= 0 && !done) finish('lose', 'Time’s up! The letters wash away.');
    }, 100);

    async function finish(res, msg) {
      done = true;
      clearInterval(timer);
      removeEventListener('keydown', onKey);
      sfx(res === 'win' ? 'tttwin' : 'tttlose');
      await sleep(400);
      await banner(ui, res, msg);
      resolve(res);
    }

    function tap(i) {
      if (done) return;
      if (i === sel) dir = dir === 'across' ? 'down' : 'across';
      sel = i;
      sfx('select');
      render();
    }

    function advance(step) {
      const w = word(sel), k = w.indexOf(sel);
      for (let j = k + step; j >= 0 && j < n; j += step) if (!given.has(w[j])) { sel = w[j]; return; }
    }

    Object.assign(act, { tap, key, useHint });
    function key(k) {
      if (done) return;
      if (k === '⌫') {
        if (!grid[sel] || given.has(sel)) advance(-1);
        if (!given.has(sel)) grid[sel] = '';
      } else {
        if (!given.has(sel)) grid[sel] = k;
        sfx('type');
        advance(1);
      }
      render();
      check();
    }

    function check() {
      if (grid.includes('')) return;
      if (grid.join('') === answer) return finish('win', 'Every word fits!');
      ui.status('Something’s not quite right…');
      board.classList.remove('shake'); void board.offsetWidth; board.classList.add('shake');
      sfx('nope');
    }

    function useHint() {
      if (done) return;
      const i = grid[sel] !== answer[sel] && !given.has(sel) ? sel : grid.findIndex((v, j) => v !== answer[j]);
      if (i < 0) return;
      grid[i] = answer[i];
      given.add(i);
      cells[i].classList.add('given');
      left -= 10000;
      sfx('coin');
      render();
      check();
    }
  });
}
