import { h, icon, sparkle } from '../ui.js';
import { sleep } from '../pixel.js';
import { mount, banner } from './common.js';
import { stormSkill } from './tictactoe.js';
import { POOL } from '../arcade/meowdoku-levels.js';
import { decode, REGION_COLORS } from '../meowdokuboard.js';
import { transform } from '../meowdoku-engine.js';

// Cat-Tac-Toe: a duel on a Mewdoku board. You and the storm take turns placing cats, and every
// cat must follow Mewdoku's rules against ALL cats on the board: no shared row, column or colour,
// and no touching. Whoever can't place a cat on their turn loses.
export function play(root, { difficulty: d, sfx, boost }) {
  const ui = mount(root, { title: 'Cat-Tac-Toe', tip: 'Take turns placing cats by Mewdoku rules: no shared row, column or colour, no touching. Run out of legal moves and you lose!' });
  const pool = POOL.filter(e => e[1].length === 6);
  const { N, regions } = transform(decode(pool[(Math.random() * pool.length) | 0]), (Math.random() * 8) | 0);
  const NN = N * N;
  const skill = stormSkill(d, boost);
  const owner = new Array(NN).fill(null);
  let locked = false, done = false;
  const act = {}; // handlers are set inside the Promise below

  const R = i => (i / N) | 0, C = i => i % N;
  const sees = (i, j) => R(i) === R(j) || C(i) === C(j) || regions[i] === regions[j] || (Math.abs(R(i) - R(j)) <= 1 && Math.abs(C(i) - C(j)) <= 1);
  const legal = (own = owner) => [...Array(NN).keys()].filter(i => !own[i] && !own.some((o, j) => o && sees(i, j)));
  const edge = (i, dr, dc) => {
    const r = R(i) + dr, c = C(i) + dc;
    return r < 0 || r >= N || c < 0 || c >= N || regions[r * N + c] !== regions[i];
  };

  const cells = [...Array(NN).keys()].map(i => h('button', {
    type: 'button',
    class: 'md-cell' + (edge(i, -1, 0) ? ' bt' : '') + (edge(i, 1, 0) ? ' bb' : '') + (edge(i, 0, -1) ? ' bl' : '') + (edge(i, 0, 1) ? ' br' : ''),
    style: `background:${REGION_COLORS[regions[i]]}`,
    onclick: () => act.tap(i),
  }));
  ui.body.append(h('div', { class: 'md-wrap' }, h('div', { class: `md-grid n${N}`, style: `grid-template-columns: repeat(${N}, 1fr)` }, cells)));

  function render() {
    const ok = new Set(locked ? [] : legal());
    cells.forEach((b, i) => {
      b.classList.toggle('mine', owner[i] === 'X');
      b.classList.toggle('storm', owner[i] === 'O');
      b.classList.toggle('blocked', !owner[i] && !ok.has(i) && !locked);
      b.replaceChildren(owner[i] ? icon(owner[i] === 'X' ? 'cat0' : 'cat2', 'ico cat') : !ok.has(i) && !locked ? h('span', { class: 'md-dot' }) : '');
    });
    const n = legal().length;
    ui.info.replaceChildren(h('span', { class: 'mg-stat' }, icon('cat0'), ' you'), h('span', { class: 'mg-stat' }, icon('cat2'), ' the storm'), h('span', { class: 'mg-stat' }, `${n} legal square${n === 1 ? '' : 's'} left`));
  }
  render();
  ui.status('Your turn: place a cat on any open square.');

  // The storm looks one move ahead: win if it can leave you stuck, else squeeze your options.
  function stormMove() {
    const moves = legal();
    if (Math.random() > skill) return moves[(Math.random() * moves.length) | 0];
    let best = [], bestScore = -Infinity;
    for (const m of moves) {
      const after = owner.slice(); after[m] = 'O';
      const yours = legal(after);
      let score;
      if (!yours.length) score = 1000;
      else {
        // how badly each of your replies leaves the storm
        const worst = Math.min(...yours.map(y => { const a2 = after.slice(); a2[y] = 'X'; return legal(a2).length; }));
        score = worst === 0 ? -1000 : worst * 2 - yours.length;
      }
      if (score > bestScore) { bestScore = score; best = [m]; } else if (score === bestScore) best.push(m);
    }
    return best[(Math.random() * best.length) | 0];
  }

  return new Promise(resolve => {
    async function finish(res, msg) {
      done = true;
      sfx(res === 'win' ? 'tttwin' : 'tttlose');
      await sleep(600);
      await banner(ui, res, msg);
      resolve(res);
    }

    act.tap = async i => {
      if (locked || done || owner[i]) return;
      if (!legal().includes(i)) {
        sfx('nope');
        cells[i].classList.add('wrong');
        setTimeout(() => cells[i].classList.remove('wrong'), 400);
        ui.status('That square shares a row, column or colour with a cat, or touches one.');
        return;
      }
      owner[i] = 'X';
      sfx('mew');
      sparkle(cells[i], { count: 7 });
      locked = true;
      render();
      if (!legal().length) return finish('win', 'The storm has nowhere left to go!');
      ui.status('The storm is thinking…');
      await sleep(650);
      const m = stormMove();
      owner[m] = 'O';
      sfx('aiplace');
      locked = false;
      render();
      if (!legal().length) return finish('lose', 'No legal squares left for you.');
      ui.status('Your turn.');
    };
  });
}
