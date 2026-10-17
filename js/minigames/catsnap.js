import { h, icon, sparkle } from '../ui.js';
import { sleep } from '../pixel.js';
import { CAT_BREEDS } from '../spritedata.js';
import { mount, banner, hearts } from './common.js';
import { POOL } from '../arcade/meowdoku-levels.js';
import { decode, REGION_COLORS } from '../meowdokuboard.js';
import { transform, logicSolve } from '../meowdoku-engine.js';
import { TIME } from './micro.js';

// Cat Snap: Mewdoku against the fuse. A row lights up, and logic says exactly one square in it
// can hold a cat. You have 5 seconds to find it. Too slow or wrong costs a heart (the cat
// still drops into place, so the puzzle keeps going).
export function play(root, { difficulty: d, sfx, boost }) {
  const ui = mount(root, { title: 'Cat Snap', tip: 'A row lights up: 5 seconds to tap where its cat goes, by Mewdoku rules. Too slow or wrong costs a heart!' });
  const size = d < 0.5 ? 5 : 6;
  const pool = POOL.filter(e => e[1].length === size);
  const { N, regions, solution } = transform(decode(pool[(Math.random() * pool.length) | 0]), (Math.random() * 8) | 0);
  const locked = (Math.random() * N) | 0;
  const start = locked * N + solution[locked];
  const ls = logicSolve(N, regions, [start]);
  // the order logic finds the cats in; each one is forced by the ones before it
  const order = ls.order.length === N - 1 ? ls.order : [...Array(N).keys()].filter(r => r !== locked).map(r => r * N + solution[r]);
  const cats = new Set([start]);
  const max = 3 + (boost === 'tea' ? 1 : 0);
  let lives = max, k = 0, t0 = 0, done = false, wait = true;
  const R = i => (i / N) | 0, C = i => i % N;
  const edge = (i, dr, dc) => {
    const r = R(i) + dr, c = C(i) + dc;
    return r < 0 || r >= N || c < 0 || c >= N || regions[r * N + c] !== regions[i];
  };
  const act = {}; // handlers are set inside the Promise below
  const cells = [...Array(N * N).keys()].map(i => h('button', {
    type: 'button',
    class: 'md-cell' + (edge(i, -1, 0) ? ' bt' : '') + (edge(i, 1, 0) ? ' bb' : '') + (edge(i, 0, -1) ? ' bl' : '') + (edge(i, 0, 1) ? ' br' : '') + (i === start ? ' locked' : ''),
    style: `background:${REGION_COLORS[regions[i]]}`,
    onpointerdown: e => { e.preventDefault(); act.tap(i); },
  }));
  const fuse = h('div', { class: 'mc-fuse' }, h('i'));
  ui.body.append(fuse, h('div', { class: 'md-wrap' }, h('div', { class: `md-grid n${N}`, style: `grid-template-columns: repeat(${N}, 1fr)` }, cells)));

  function render() {
    const row = done || wait ? -1 : R(order[k]);
    cells.forEach((b, i) => {
      b.classList.toggle('lit', R(i) === row && !cats.has(i));
      b.replaceChildren(cats.has(i) ? icon('cat' + (regions[i] % CAT_BREEDS.length), 'ico cat') : '');
    });
    ui.info.replaceChildren(h('span', { class: 'mg-stat' }, hearts(lives, max)), h('span', { class: 'mg-stat' }, `${N - cats.size} cat${N - cats.size === 1 ? '' : 's'} to go`));
  }
  render();

  return new Promise(resolve => {
    async function finish(res, msg) {
      done = true;
      render();
      sfx(res === 'win' ? 'tttwin' : 'tttlose');
      await sleep(500);
      await banner(ui, res, msg);
      resolve(res);
    }
    async function next() {
      if (k >= order.length) return finish('win', lives === max ? 'Not a whisker wrong!' : 'Every cat found its patch!');
      wait = true;
      render();
      ui.status(k === 0 ? 'Get ready…' : '');
      await sleep(k === 0 ? 900 : 350);
      wait = false;
      t0 = performance.now();
      sfx('blip');
      ui.status(`Row ${R(order[k]) + 1}: where does its cat go?`);
      render();
    }
    function settle(ok, msg) {
      const i = order[k++];
      cats.add(i);
      if (ok) { sfx('mew'); sparkle(cells[i], { count: 7 }); cells[i].classList.add('pop'); }
      else {
        lives--;
        sfx('nope');
        cells[i].classList.add('wrong');
        setTimeout(() => cells[i].classList.remove('wrong'), 500);
        ui.status(`${msg} −1 heart`);
      }
      wait = true;
      render();
      if (lives <= 0) return finish('lose', 'Out of hearts.');
      next();
    }
    act.tap = i => {
      if (done || wait || cats.has(i) || R(i) !== R(order[k])) return;
      i === order[k] ? settle(true) : settle(false, 'Not there!');
    };
    const tick = now => {
      if (done || !fuse.isConnected) return;
      const left = wait ? 1 : 1 - (now - t0) / (TIME * 1000);
      fuse.firstChild.style.width = `${Math.max(0, left * 100)}%`;
      fuse.classList.toggle('low', left < 0.3);
      if (!wait && left <= 0) settle(false, 'Too slow!');
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    next();
  });
}
