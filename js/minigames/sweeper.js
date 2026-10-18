import { h, icon, sparkle } from '../ui.js';
import { sleep } from '../pixel.js';
import { mount, banner, hearts as heartRow } from './common.js';

// Storm Sweeper: Minesweeper under rain clouds. Some clouds hide lightning. Clear every safe cloud;
// numbers count the lightning clouds touching each square. Your first tap is always safe, and
// boards are generated so they can be solved by logic alone (no 50/50 guesses).

export const nbrs = (n, i) => {
  const r = (i / n) | 0, c = i % n, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && cc >= 0 && rr < n && cc < n) out.push(rr * n + cc);
  }
  return out;
};

// Can the board be cleared from `first` with logic alone? Simple single-square rules plus the
// pairwise subset rule, which is what a careful player does.
export function solvable(n, mine, first) {
  const NN = n * n, open = new Uint8Array(NN), flag = new Uint8Array(NN);
  const count = i => nbrs(n, i).filter(j => mine[j]).length;
  const reveal = i => {
    const stack = [i];
    while (stack.length) {
      const k = stack.pop();
      if (open[k]) continue;
      open[k] = 1;
      if (count(k) === 0) for (const j of nbrs(n, k)) if (!open[j] && !mine[j]) stack.push(j);
    }
  };
  reveal(first);
  const safeTotal = NN - mine.filter(Boolean).length;
  for (let guard = 0; guard < 500; guard++) {
    if (open.reduce((a, b) => a + b, 0) === safeTotal) return true;
    let progress = false;
    const cons = [];
    for (let i = 0; i < NN; i++) {
      if (!open[i]) continue;
      const hidden = nbrs(n, i).filter(j => !open[j] && !flag[j]);
      const need = count(i) - nbrs(n, i).filter(j => flag[j]).length;
      if (!hidden.length) continue;
      if (need === 0) { hidden.forEach(reveal); progress = true; }
      else if (need === hidden.length) { hidden.forEach(j => (flag[j] = 1)); progress = true; }
      else cons.push({ set: hidden, need });
    }
    if (!progress) {
      // subset rule: if A ⊂ B, then B \ A holds need(B) - need(A) lightning
      outer: for (const a of cons) for (const b of cons) {
        if (a === b || a.set.length >= b.set.length || !a.set.every(x => b.set.includes(x))) continue;
        const diff = b.set.filter(x => !a.set.includes(x)), k = b.need - a.need;
        if (k === 0) { diff.forEach(reveal); progress = true; break outer; }
        if (k === diff.length) { diff.forEach(j => (flag[j] = 1)); progress = true; break outer; }
      }
    }
    if (!progress) return false;
  }
  return false;
}

// Place `mines` lightning clouds on an n x n board, keeping the first tap and its neighbours clear,
// and retrying until the board is logic-solvable.
export function makeBoard(n, mines, first, R = Math.random) {
  const safe = new Set([first, ...nbrs(n, first)]);
  let best = null;
  for (let tries = 0; tries < 400; tries++) {
    const mine = new Array(n * n).fill(false);
    let placed = 0;
    while (placed < mines) { const i = Math.floor(R() * n * n); if (!mine[i] && !safe.has(i)) { mine[i] = true; placed++; } }
    best = mine;
    if (solvable(n, mine, first)) return mine;
  }
  return best;
}

// The playable grid. Tap a cloud to clear it; long-press (or switch to flag mode) to flag it.
// onChange({ left, lives }), onDone('win' | 'lose'), onReveal() after each safe dig.
export function sweeperBoard(host, { n, mines, lives = 1, sfx, onChange, onDone, onReveal, startFlags = 0 }) {
  const NN = n * n;
  let mine = null, done = false, mode = 'dig';
  const open = new Array(NN).fill(false), flag = new Array(NN).fill(false), burnt = new Array(NN).fill(false);
  const state = { lives, mine: () => mine, open, flag, n };
  const cells = Array.from({ length: NN }, () => h('button', { type: 'button', class: 'sw-cell' }));
  const grid = h('div', { class: 'sw-grid', style: `grid-template-columns: repeat(${n}, 1fr)` }, cells);
  const modeBtn = h('button', { type: 'button', class: 'btn small', onclick: () => { mode = mode === 'dig' ? 'flag' : 'dig'; sfx('select'); render(); } });
  host.append(h('div', { class: 'sw-wrap' }, grid), h('div', { class: 'sw-tools' }, modeBtn, h('span', { class: 'muted small' }, 'Long-press a cloud to flag it')));
  const count = i => nbrs(n, i).filter(j => mine[j]).length;
  const safeLeft = () => (mine ? open.reduce((a, o, i) => a + (!o && !mine[i] ? 1 : 0), 0) : NN - mines);

  function render() {
    cells.forEach((b, i) => {
      b.className = 'sw-cell' + (open[i] ? ' open' : '') + (flag[i] ? ' flag' : '') + (burnt[i] ? ' bolt' : '');
      if (open[i]) { const k = count(i); b.textContent = k || ''; b.dataset.k = k; }
      else b.replaceChildren(burnt[i] ? '⚡' : flag[i] ? '⚑' : '');
    });
    modeBtn.textContent = mode === 'dig' ? 'Tap: clear' : 'Tap: flag ⚑';
    modeBtn.classList.toggle('primary', mode === 'flag');
    onChange && onChange({ left: safeLeft(), lives: state.lives });
  }

  function flood(i) {
    const stack = [i];
    let n0 = 0;
    while (stack.length) {
      const k = stack.pop();
      if (open[k] || mine[k]) continue;
      open[k] = true; flag[k] = false; n0++;
      if (count(k) === 0) for (const j of nbrs(n, k)) if (!open[j]) stack.push(j);
    }
    return n0;
  }

  function dig(i) {
    if (done || open[i] || flag[i] || burnt[i]) return;
    if (!mine) {
      mine = makeBoard(n, mines, i);
      // a boost can pre-flag lightning: pick ones next to the opening so they help
      if (startFlags) {
        flood(i);
        const near = mine.map((m, k) => (m && nbrs(n, k).some(j => open[j]) ? k : -1)).filter(k => k >= 0);
        near.slice(0, startFlags).forEach(k => (flag[k] = true));
        sfx('place');
        render();
        if (safeLeft() === 0) finish('win');
        onReveal && onReveal();
        return;
      }
    }
    if (mine[i]) {
      burnt[i] = true;
      state.lives--;
      sfx('thunder');
      cells[i].classList.add('zap');
      grid.classList.add('shake');
      setTimeout(() => grid.classList.remove('shake'), 300);
      render();
      if (state.lives <= 0) finish('lose');
      return;
    }
    const got = flood(i);
    sfx(got > 3 ? 'sparkle' : 'tap');
    if (got > 6) sparkle(cells[i], { count: 10 });
    render();
    onReveal && onReveal();
    if (safeLeft() === 0) finish('win');
  }

  function toggleFlag(i) {
    if (done || open[i] || burnt[i]) return;
    flag[i] = !flag[i];
    sfx('select');
    render();
  }

  function finish(res) {
    done = true;
    if (res === 'lose') mine.forEach((m, i) => m && !burnt[i] && !flag[i] && cells[i].classList.add('reveal'));
    onDone(res);
  }

  // Touch handling: a short tap acts by mode; a long press always flags. Pointer events, deduped.
  cells.forEach((b, i) => {
    let t0 = 0, timer = 0, long = false;
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      t0 = performance.now(); long = false;
      timer = setTimeout(() => { long = true; toggleFlag(i); }, 420);
    });
    const up = () => {
      clearTimeout(timer);
      if (!t0 || long) { t0 = 0; return; }
      t0 = 0;
      if (mode === 'flag') toggleFlag(i); else dig(i);
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointerleave', () => clearTimeout(timer));
    b.addEventListener('pointercancel', () => { clearTimeout(timer); t0 = 0; });
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
  render();
  return { state, cells, dig, toggleFlag, stop: () => (done = true) };
}

// Pick a safe, logically-deducible next square for tests and hints: an unopened non-mine cell that
// touches an opened number, or any safe cell if none.
export function safeMove(st) {
  const { n, open, flag } = st, mine = st.mine();
  if (!mine) return (n * n / 2 + n / 2) | 0;
  const frontier = [...Array(n * n).keys()].filter(i => !open[i] && !mine[i] && !flag[i] && nbrs(n, i).some(j => open[j]));
  return frontier[0] ?? [...Array(n * n).keys()].find(i => !open[i] && !mine[i]);
}

// Storm Sweeper (the 4-in-a-row tile).
export function play(root, { difficulty: d, sfx, boost, extraHeart }) {
  const [n, mines] = d < 0.3 ? [6, 5] : d < 0.6 ? [7, 8] : [8, 11];
  const lives = 1 + (boost === 'tea' ? 1 : 0) + (extraHeart ? 1 : 0);
  const limit = (75 - 15 * d + (boost === 'toast' ? 30 : 0)) * 1000;
  const ui = mount(root, { title: 'Storm Sweeper', tip: 'Clear every safe cloud. Numbers count the lightning clouds touching that square. Long-press (or switch to flag mode) to flag lightning. Your first tap is always safe.' });
  const bar = h('div', { class: 'timebar' }, h('i'));
  const stat = h('span', { class: 'mg-stat' });
  ui.info.append(bar, stat);
  return new Promise(resolve => {
    let left = limit, finished = false;
    const board = sweeperBoard(ui.body, {
      n, mines, lives, sfx, startFlags: boost === 'scarf' ? 2 : 0,
      onChange: s => stat.replaceChildren(...heartRow(s.lives, lives), ` ${s.left} to clear`),
      onDone: async res => {
        finished = true;
        clearInterval(timer);
        sfx(res === 'win' ? 'tttwin' : 'tttlose');
        await sleep(700);
        await banner(ui, res, res === 'win' ? 'Every safe cloud cleared!' : 'Struck by lightning!');
        resolve(res);
      },
    });
    root.__sw = board.state;
    ui.status('Tap any cloud to start.');
    let last = performance.now();
    const timer = setInterval(() => {
      if (!ui.wrap.isConnected) return clearInterval(timer);
      const now = performance.now();
      if (!document.hidden && !finished) left -= now - last;
      last = now;
      bar.firstChild.style.width = `${Math.max(0, (left / limit) * 100)}%`;
      bar.classList.toggle('low', left < 12000);
      if (left <= 0 && !finished) { finished = true; board.stop(); clearInterval(timer); sfx('tttlose'); banner(ui, 'lose', 'The storm rolled in.').then(() => resolve('lose')); }
    }, 100);
  });
}

// Micro Sweeper (Dang! + Sweeper): a small board, but every dig has to land within a 3-second fuse.
export function playMicro(root, { difficulty: d, sfx, boost, extraHeart }) {
  const n = 5, mines = d < 0.5 ? 4 : 5;
  const lives = 2 + (boost === 'tea' ? 1 : 0) + (extraHeart ? 1 : 0);
  const FUSE = 3200 - d * 800;
  const ui = mount(root, { title: 'Micro Sweeper', tip: 'Storm Sweeper at WarioWare speed: every dig has to land before the 3-second fuse burns out. Run out and you lose a heart.' });
  const fuse = h('div', { class: 'mc-fuse' }, h('i'));
  const stat = h('span', { class: 'mg-stat' });
  ui.info.append(stat);
  ui.body.append(fuse);
  return new Promise(resolve => {
    let t0 = 0, finished = false, started = false;
    const board = sweeperBoard(ui.body, {
      n, mines, lives, sfx,
      onChange: s => stat.replaceChildren(...heartRow(s.lives, lives), ` ${s.left} to clear`),
      onReveal: () => { started = true; t0 = performance.now(); },
      onDone: async res => {
        finished = true;
        sfx(res === 'win' ? 'tttwin' : 'tttlose');
        await sleep(600);
        await banner(ui, res, res === 'win' ? 'Swept clean, at speed!' : 'Out of hearts!');
        resolve(res);
      },
    });
    root.__sw = board.state;
    ui.status('Tap any cloud to light the fuse.');
    const tick = now => {
      if (finished || !ui.wrap.isConnected) return;
      if (started) {
        const left = 1 - (now - t0) / FUSE;
        fuse.firstChild.style.width = `${Math.max(0, left * 100)}%`;
        fuse.classList.toggle('low', left < 0.35);
        if (left <= 0) {
          board.state.lives--;
          sfx('thunder');
          t0 = now;
          if (board.state.lives <= 0) { board.stop(); finished = true; sfx('tttlose'); banner(ui, 'lose', 'Too slow!').then(() => resolve('lose')); return; }
          stat.replaceChildren(...heartRow(board.state.lives, lives), ' too slow!');
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
