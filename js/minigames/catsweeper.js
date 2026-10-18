import { h, icon, sparkle } from '../ui.js';
import { sleep } from '../pixel.js';
import { CAT_BREEDS } from '../spritedata.js';
import { mount, banner, hearts as heartRow } from './common.js';

// Cat Sweeper (Mewdoku + Storm Sweeper): a Mewdoku with no colours. One cat per row and column,
// no two touching (not even diagonally). Number squares say how many cats touch them, and there are
// just enough of them for exactly one answer.

const touching = (a, b) => Math.abs(a - b) <= 1;

// Every legal placement: perm[r] = column of row r's cat.
function allPlacements(N) {
  const out = [], perm = [], used = new Array(N).fill(false);
  (function rec(r) {
    if (r === N) { out.push(perm.slice()); return; }
    for (let c = 0; c < N; c++) {
      if (used[c] || (r && touching(perm[r - 1], c))) continue;
      used[c] = true; perm[r] = c; rec(r + 1); used[c] = false;
    }
  })(0);
  return out;
}

const adjCount = (N, perm, i) => {
  const r = (i / N) | 0, c = i % N;
  let k = 0;
  for (let dr = -1; dr <= 1; dr++) { const rr = r + dr; if (rr >= 0 && rr < N && Math.abs(perm[rr] - c) <= 1 && !(dr === 0 && perm[rr] === c)) k++; }
  return k;
};

// A puzzle: a hidden answer and a set of clue squares that pin it down uniquely.
export function makeCatSweeper(N, extra = 0, R = Math.random) {
  const all = allPlacements(N);
  const sol = all[Math.floor(R() * all.length)];
  const isCat = i => sol[(i / N) | 0] === i % N;
  const cand = [...Array(N * N).keys()].filter(i => !isCat(i));
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const clues = new Map();
  const fits = p => [...clues].every(([i, k]) => p[(i / N) | 0] !== i % N && adjCount(N, p, i) === k);
  for (const i of cand) {
    if (all.filter(fits).length === 1) break;
    clues.set(i, adjCount(N, sol, i));
  }
  // a few more clues on easier boards
  for (const i of cand) { if (extra <= 0) break; if (!clues.has(i)) { clues.set(i, adjCount(N, sol, i)); extra--; } }
  return { N, sol, clues };
}

export function play(root, { difficulty: d, sfx, boost, extraHeart }) {
  const N = d < 0.5 ? 5 : 6;
  const { sol, clues } = makeCatSweeper(N, d < 0.3 ? 3 : d < 0.6 ? 1 : 0);
  const max = 3 + (boost === 'tea' ? 1 : 0) + (extraHeart ? 1 : 0);
  let lives = max, done = false;
  const cat = new Array(N * N).fill(false);
  const R = i => (i / N) | 0, C = i => i % N;
  // one cat starts in its right spot (locked), to get you going
  const r0 = (Math.random() * N) | 0, locked = r0 * N + sol[r0];
  cat[locked] = true;
  let autoX = false;
  const ui = mount(root, { title: 'Cat Sweeper', tip: 'One cat in every row and column, and cats can’t touch, not even diagonally. Each number says how many cats touch that square. Tap to place or remove a cat. One cat is already in place.' });
  const stat = h('span', { class: 'mg-stat' });
  ui.info.append(stat);
  const act = {};
  const autoBtn = h('button', { type: 'button', class: 'seg-btn', onclick: () => { autoX = !autoX; autoBtn.classList.toggle('on', autoX); sfx('select'); render(); } }, 'Auto ✕');
  const cells = [...Array(N * N).keys()].map(i => h('button', { type: 'button', class: 'csw-cell' + (clues.has(i) ? ' clue' : ''), onpointerdown: e => { e.preventDefault(); act.tap(i); } }));
  ui.body.append(h('div', { class: 'sw-wrap' }, h('div', { class: 'sw-grid csw-grid', style: `grid-template-columns: repeat(${N}, 1fr)` }, cells)), h('div', { class: 'md-tools csw-tools' }, autoBtn));
  root.__cs = { sol, N, clues, locked };

  const placed = () => [...Array(N * N).keys()].filter(i => cat[i]);
  const around = i => placed().filter(j => j !== i && Math.abs(R(j) - R(i)) <= 1 && Math.abs(C(j) - C(i)) <= 1).length;
  function render() {
    cells.forEach((b, i) => {
      if (clues.has(i)) {
        const k = clues.get(i), have = around(i);
        b.textContent = k;
        b.dataset.k = k;
        b.classList.toggle('ok', have === k);
        b.classList.toggle('over', have > k);
      } else {
        // auto ✕: squares a placed cat rules out, or next to a number that already has all its cats
        const near = (a, b) => Math.abs(R(a) - R(b)) <= 1 && Math.abs(C(a) - C(b)) <= 1;
        const ruledOut = autoX && !cat[i] && (placed().some(j => R(j) === R(i) || C(j) === C(i) || near(i, j)) || [...clues].some(([k, v]) => near(i, k) && around(k) === v));
        b.replaceChildren(cat[i] ? icon('cat' + (C(i) % CAT_BREEDS.length), 'ico cat') : ruledOut ? h('span', { class: 'md-dot' }) : '');
        b.classList.toggle('locked', i === locked);
      }
    });
    stat.replaceChildren(...heartRow(lives, max), ` ${N - placed().length} cats to place`);
  }
  render();
  ui.status('Start where a number leaves only one choice.');

  return new Promise(resolve => {
    async function finish(res, msg) {
      done = true;
      sfx(res === 'win' ? 'tttwin' : 'tttlose');
      await sleep(600);
      await banner(ui, res, msg);
      resolve(res);
    }
    act.tap = i => {
      if (done || clues.has(i) || i === locked) return;
      if (cat[i]) { cat[i] = false; sfx('select'); render(); return; }
      // breaking a rule (row, column, touching, or a number going over) costs a heart
      const clash = placed().some(j => R(j) === R(i) || C(j) === C(i) || (Math.abs(R(j) - R(i)) <= 1 && Math.abs(C(j) - C(i)) <= 1));
      cat[i] = true;
      const over = [...clues].some(([k, v]) => around(k) > v);
      if (clash || over) {
        cat[i] = false;
        lives--;
        sfx('nope');
        cells[i].classList.add('wrong');
        setTimeout(() => cells[i].classList.remove('wrong'), 450);
        ui.status(clash ? 'That cat would share a row or column, or touch another cat. −1 heart' : 'Too many cats around that number. −1 heart');
        render();
        if (lives <= 0) finish('lose', 'Out of hearts.');
        return;
      }
      sfx('mew');
      sparkle(cells[i], { count: 6 });
      render();
      if (placed().length === N) {
        if ([...clues].every(([k, v]) => around(k) === v)) finish('win', 'Every cat found its spot!');
        else ui.status('All cats placed, but some numbers aren’t satisfied yet. Move a cat.');
      }
    };
  });
}
