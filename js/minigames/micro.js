import { h, icon } from '../ui.js';
import { sleep } from '../pixel.js';
import { CAT_BREEDS } from '../spritedata.js';
import { mount, banner, hearts } from './common.js';
import { WORDS3 } from './words3.js';
import { WORDS } from './words.js';
import { buildSearch, lineBetween } from './wordsearch.js';
import { rnd, pick, shuffle, at, spots, tapper, follow, runMicro, DEFAULT_TIME } from '../micro/kit.js';

// The first WarioWare-style microgames (the Dang! tile's Micro Rush). The shared engine and
// helpers live in ../micro/kit.js; the arcade's big collection lives in ../micro/.
export { runMicro };
export const TIME = DEFAULT_TIME;

const ITEMS = ['wheat', 'cotton', 'flowers', 'pumpkin', 'coin', 'star', 'heart', 'shard'];

function drop(stage, x, y) {
  const d = at(h('i', { class: 'mc-drop' }), x, y);
  d.x = x; d.y = y;
  stage.append(d);
  return d;
}

export const MICROS = [
  {
    id: 'patch', cmd: 'Patch it!', theme: 'cozy',
    setup({ stage, win, sfx, speed, frame }) {
      // Leaks spring open in the cabin roof one after another. Tape every one.
      const total = 3 + Math.round(speed);
      const where = spots(total, 22, 12, 14);
      let made = 0, fixed = 0, next = 0.1;
      frame((dt, t) => {
        if (made >= total || t < next) return;
        const p = where[made++];
        next = t + 0.7 / speed;
        const hole = at(h('button', { type: 'button', class: 'mc-leak' }, h('i', { class: 'mc-drip' })), p.x, p.y);
        tapper(hole, () => {
          if (hole.classList.contains('fixed')) return;
          hole.classList.add('fixed');
          sfx('place');
          if (++fixed === total) win();
        });
        stage.append(hole);
        sfx('drip');
      });
    },
    async solve(b) {
      while (!b.over()) { const l = b.q('.mc-leak:not(.fixed)'); if (l) await b.tap(l); else await b.wait(40); }
    },
  },
  {
    id: 'pop', cmd: 'Pop ’em!', theme: 'cozy',
    setup({ stage, win, sfx, speed, frame }) {
      const n = 5 + Math.round(speed * 1.5);
      let popped = 0;
      const bubbles = spots(n, 16, 10, 18).map(p => {
        const b = at(h('button', { type: 'button', class: 'mc-bubble' }), p.x, p.y);
        b.vy = -(6 + Math.random() * 10) * speed;
        b.y = p.y;
        tapper(b, () => {
          if (b.classList.contains('popped')) return;
          b.classList.add('popped');
          sfx('peg', ++popped);
          if (popped === n) win();
        });
        stage.append(b);
        return b;
      });
      frame(dt => bubbles.forEach(b => { b.y += b.vy * dt; if (b.y < 6) b.y = 94; b.style.top = b.y + '%'; }));
    },
    async solve(b) {
      while (!b.over()) { const x = b.q('.mc-bubble:not(.popped)'); if (x) await b.tap(x); else await b.wait(30); }
    },
  },
  {
    id: 'stop', cmd: 'Stop!', theme: 'silly',
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      // A needle sweeps the gauge; tap while it's in the gold.
      const w = Math.max(10, 24 - speed * 7), zx = 10 + Math.random() * (80 - w);
      const needle = h('i', { class: 'mc-needle' });
      stage.append(h('div', { class: 'mc-gauge' }, h('i', { class: 'mc-zone', style: `left:${zx}%;width:${w}%` }), needle),
        h('p', { class: 'mc-note' }, 'Tap anywhere when the needle is in the gold'));
      const s = expose({ p: 0, zx, w });
      let dir = 1;
      frame(dt => {
        s.p += dir * 75 * speed * dt;
        if (s.p > 100) { s.p = 100; dir = -1; } else if (s.p < 0) { s.p = 0; dir = 1; }
        needle.style.left = s.p + '%';
      });
      tapper(stage, () => { sfx('select'); s.p >= zx && s.p <= zx + w ? win() : lose(); });
    },
    async solve(b, s) {
      await b.until(() => Math.abs(s.p - (s.zx + s.w / 2)) < s.w * 0.25);
      await b.tap({ x: 50, y: 20 });
    },
  },
  {
    id: 'stoke', cmd: 'Stoke it!', theme: 'cozy',
    setup({ stage, win, sfx, speed, frame }) {
      // Tap like mad to get the fire roaring before it dies down.
      const need = 9 + Math.round(speed * 4);
      let heat = 0;
      const flame = h('i', { class: 'mc-flame' });
      stage.append(h('div', { class: 'mc-hearth' }, flame), h('p', { class: 'mc-note' }, 'Tap fast!'));
      const show = () => (flame.style.transform = `translateX(-50%) scale(${0.25 + 0.95 * Math.min(1, heat / need)})`);
      tapper(stage, () => { heat++; sfx('tap'); show(); if (heat >= need) win(); });
      frame(dt => { heat = Math.max(0, heat - dt * 1.1 * speed); show(); });
    },
    async solve(b) { while (!b.over()) await b.tap({ x: 50, y: 50 }); },
  },
  {
    id: 'odd', cmd: 'Find it!', theme: 'cozy',
    setup({ stage, win, lose, sfx, speed, expose }) {
      // One cat is a different breed from the rest.
      const n = speed > 1.3 ? 5 : 4;
      const a = rnd(CAT_BREEDS.length);
      let b = rnd(CAT_BREEDS.length - 1); if (b >= a) b++;
      const odd = rnd(n * n);
      const picks = Array.from({ length: n * n }, (_, i) => tapper(h('button', { type: 'button', class: 'mc-pick' }, icon('cat' + (i === odd ? b : a), 'ico cat')),
        () => { sfx(i === odd ? 'mew' : 'nope'); i === odd ? win() : lose(); }));
      stage.append(h('div', { class: 'mc-grid', style: `grid-template-columns:repeat(${n},1fr)` }, picks));
      expose({ el: picks[odd] });
    },
    async solve(b, s) { await b.tap(s.el); },
  },
  {
    id: 'count', cmd: 'How many?', theme: 'cozy',
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const k = 3 + rnd(3 + Math.round(speed * 2));
      const it = pick(ITEMS);
      const things = spots(k, 14, 10, 8).map(p => {
        const el = at(h('span', { class: 'mc-thing' }, icon(it, 'ico')), p.x, p.y * 0.68);
        el.p = { x: p.x, y: p.y * 0.68, a: Math.random() * 6 };
        stage.append(el);
        return el;
      });
      frame((dt, t) => things.forEach(el => at(el, el.p.x + Math.sin(t * 2 * speed + el.p.a) * 4, el.p.y + Math.cos(t * 1.6 * speed + el.p.a) * 3)));
      const opts = shuffle([...new Set([k, k + 1, k - 1 > 0 ? k - 1 : k + 2])]);
      const btns = opts.map(v => tapper(h('button', { type: 'button', class: 'btn' }, String(v)), () => { sfx(v === k ? 'coin' : 'nope'); v === k ? win() : lose(); }));
      stage.append(h('div', { class: 'mc-answers' }, btns));
      expose({ el: btns[opts.indexOf(k)] });
    },
    async solve(b, s) { await b.wait(300); await b.tap(s.el); },
  },
  {
    id: 'catch', cmd: 'Catch!', theme: 'cozy',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      // Slide the bucket under every drip from the leaky roof.
      const bucket = at(h('i', { class: 'mc-bucket' }), 50, 90);
      stage.append(bucket);
      const s = expose({ bx: 50, drops: [] });
      follow(stage, pos, p => { s.bx = Math.max(8, Math.min(92, p.x)); at(bucket, s.bx, 90); });
      const times = [0.3, 1.45, 2.6].map(t => t / Math.sqrt(speed));
      let caught = 0, spawned = 0;
      frame((dt, t) => {
        if (spawned < times.length && t >= times[spawned]) {
          spawned++;
          s.drops.push(drop(stage, 10 + Math.random() * 80, -4));
          sfx('drip');
        }
        for (const d of s.drops) {
          if (d.done) continue;
          d.y += (48 + 22 * speed) * dt;
          d.style.top = d.y + '%';
          if (d.y >= 84 && d.y < 94 && Math.abs(d.x - s.bx) < 11) {
            d.done = true; d.remove(); sfx('coin');
            if (++caught === times.length) win();
          } else if (d.y > 100) { d.done = true; lose(); }
        }
      });
    },
    async solve(b, s) {
      b.down({ x: 50, y: 90 });
      while (!b.over()) {
        const d = s.drops.filter(d => !d.done).sort((p, q) => q.y - p.y)[0];
        if (d) b.move({ x: d.x, y: 90 });
        await b.wait(30);
      }
      b.up({ x: 50, y: 90 });
    },
  },
  {
    id: 'dodge', cmd: 'Stay dry!', theme: 'cozy', timeoutWins: true,
    setup({ stage, lose, sfx, speed, frame, pos, time, expose }) {
      // You're the cat: slide left and right so no raindrop lands on you.
      const me = at(h('span', { class: 'mc-me' }, icon('cat', 'ico')), 50, 88);
      stage.append(me);
      const s = expose({ mx: 50, drops: [] });
      let next = 0.3;
      follow(stage, pos, p => { s.mx = Math.max(8, Math.min(92, p.x)); at(me, s.mx, 88); });
      frame((dt, t) => {
        if (t >= next && t < time - 0.6) {
          next = t + 0.42 / speed;
          const x = Math.random() < 0.5 ? s.mx + (Math.random() - 0.5) * 20 : 6 + Math.random() * 88;
          s.drops.push(drop(stage, Math.max(5, Math.min(95, x)), -4));
        }
        for (const d of s.drops) {
          if (d.done) continue;
          d.y += (55 + 25 * speed) * dt;
          d.style.top = d.y + '%';
          if (d.y > 80 && d.y < 94 && Math.abs(d.x - s.mx) < 7) { d.done = true; sfx('drip'); me.classList.add('wet'); lose(); }
          else if (d.y > 104) { d.done = true; d.remove(); }
        }
      });
    },
    async solve(b, s) {
      b.down({ x: 50, y: 88 });
      while (!b.over()) {
        // stand where the nearest threatening drop is furthest away
        const threat = s.drops.filter(d => !d.done && d.y > 30 && d.y < 94);
        let best = s.mx, bestScore = -1;
        for (let x = 8; x <= 92; x += 4) {
          const sc = Math.min(100, ...threat.map(d => Math.abs(d.x - x))) - Math.abs(x - s.mx) * 0.05;
          if (sc > bestScore) { bestScore = sc; best = x; }
        }
        b.move({ x: best, y: 88 });
        await b.wait(30);
      }
      b.up({ x: s.mx, y: 88 });
    },
  },
  {
    id: 'swat', cmd: 'Swat!', theme: 'silly',
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const fly = at(h('i', { class: 'mc-fly' }), 50, 50);
      stage.append(fly);
      const s = expose({ x: 50, y: 50 });
      let tx = 50, ty = 50;
      frame(dt => {
        if (Math.hypot(tx - s.x, ty - s.y) < 3) { tx = 10 + Math.random() * 80; ty = 10 + Math.random() * 80; }
        const d = Math.hypot(tx - s.x, ty - s.y), v = 55 * speed * dt;
        s.x += ((tx - s.x) / d) * v; s.y += ((ty - s.y) / d) * v;
        at(fly, s.x + (Math.random() - 0.5) * 2, s.y + (Math.random() - 0.5) * 2);
      });
      tapper(stage, e => {
        const p = pos(e);
        if (Math.hypot(p.x - s.x, p.y - s.y) < 11) { fly.classList.add('splat'); sfx('pop'); win(); } else sfx('tap');
      });
    },
    async solve(b, s) { while (!b.over()) { await b.tap({ x: s.x, y: s.y }); await b.wait(80); } },
  },
  {
    id: 'shh', cmd: 'Shh!', theme: 'cozy', timeoutWins: true,
    setup({ stage, lose, sfx }) {
      // The pet is napping. Whatever you do, don't touch anything.
      stage.append(h('div', { class: 'mc-nap' }, icon('cat', 'ico'), h('b', {}, 'z'), h('b', {}, 'z'), h('b', {}, 'Z')),
        h('button', { type: 'button', class: 'btn mc-tempt' }, 'Boop?'));
      tapper(stage, () => { sfx('meow'); stage.classList.add('woke'); lose(); });
    },
    async solve() { /* the winning move is not to play */ },
  },
  {
    id: 'light', cmd: 'Light ’em!', theme: 'cozy',
    setup({ stage, win, lose, sfx, speed }) {
      // Light the candles in order, 1 first.
      const n = speed > 1.25 ? 5 : 4;
      let next = 1;
      spots(n, 24, 14, 16).forEach((p, i) => {
        const c = at(h('button', { type: 'button', class: 'mc-candle', 'data-n': i + 1 }, h('b', {}, String(i + 1))), p.x, p.y);
        tapper(c, () => {
          if (c.classList.contains('lit')) return;
          if (i + 1 !== next) { sfx('nope'); c.classList.add('bad'); return lose(); }
          c.classList.add('lit'); sfx('ring');
          if (++next > n) win();
        });
        stage.append(c);
      });
    },
    async solve(b) {
      for (const c of b.qa('.mc-candle').sort((p, q) => p.dataset.n - q.dataset.n)) await b.tap(c);
    },
  },
  {
    id: 'match', cmd: 'Match!', theme: 'cozy',
    setup({ stage, win, lose, sfx, speed, expose }) {
      const opts = shuffle(ITEMS.slice()).slice(0, speed > 1.3 ? 6 : 4);
      const want = pick(opts);
      const btns = opts.map(it => tapper(h('button', { type: 'button', class: 'mc-pick' }, icon(it, 'ico')),
        () => { sfx(it === want ? 'coin' : 'nope'); it === want ? win() : lose(); }));
      stage.append(h('div', { class: 'mc-want' }, icon(want, 'ico big')), h('div', { class: 'mc-row' }, btns));
      expose({ el: btns[opts.indexOf(want)] });
    },
    async solve(b, s) { await b.tap(s.el); },
  },
  {
    id: 'curtain', cmd: 'Shut it!', theme: 'cozy',
    setup({ stage, win, sfx, speed, frame, pos }) {
      // Drag the curtain across the rainy window before the draught gets in.
      const cur = h('i', { class: 'mc-curtain' });
      stage.append(h('div', { class: 'mc-window' }), cur, h('p', { class: 'mc-note' }, 'Drag the curtain across →'));
      let w = 12, drag = false;
      follow(stage, pos, (p, phase) => {
        if (phase === 'down') { drag = true; sfx('select'); }
        if (phase === 'up') drag = false;
        if (phase === 'move' && drag) {
          w = Math.max(w, Math.min(100, p.x));
          if (w >= 88) { sfx('door'); win(); }
        }
      });
      frame(dt => { if (!drag) w = Math.max(12, w - 30 * speed * dt); cur.style.width = w + '%'; });
    },
    async solve(b) { await b.drag({ x: 8, y: 50 }, { x: 96, y: 50 }, 400, 12); },
  },
];

// ---------- word microgames (Word Rush) ----------
const W3 = [...WORDS3];
const letterButtons = (letters, onTap) => h('div', { class: 'mc-row' }, letters.map((ch, k) => tapper(h('button', { type: 'button', class: 'wt-tile' }, ch), e => onTap(ch, k, e.currentTarget))));
const byText = (b, sel, text) => b.qa(sel).find(el => el.textContent === text && !el.disabled);

export const WORD_MICROS = [
  {
    id: 'spell', cmd: 'Spell it!', theme: 'word',
    setup({ stage, win, lose, sfx, expose }) {
      // Unscramble three letters into any real word.
      const w = pick(W3);
      let tiles = shuffle([...w]);
      for (let k = 0; k < 4 && tiles.join('') === w; k++) tiles = shuffle(tiles);
      let built = '';
      const out = h('div', { class: 'mc-spell' }, h('b', {}), h('b', {}), h('b', {}));
      stage.append(out, letterButtons(tiles, (ch, k, el) => {
        if (el.disabled) return;
        el.disabled = true;
        built += ch;
        out.children[built.length - 1].textContent = ch;
        sfx('type');
        if (built.length === 3) WORDS3.has(built) ? win() : lose();
      }));
      expose({ w });
    },
    async solve(b, s) { for (const ch of s.w) await b.tap(byText(b, '.wt-tile', ch)); },
  },
  {
    id: 'fill', cmd: 'Fill it!', theme: 'word',
    setup({ stage, win, lose, sfx, expose }) {
      // One letter is missing. Only one of the choices makes a word.
      for (let tries = 0; tries < 50; tries++) {
        const w = pick(W3), gap = rnd(3);
        const bad = shuffle([...'ABCDEFGHIJKLMNOPRSTUWY']).filter(ch => !WORDS3.has(w.slice(0, gap) + ch + w.slice(gap + 1))).slice(0, 2);
        if (bad.length < 2) continue;
        stage.append(h('div', { class: 'mc-spell' }, [...w].map((ch, k) => h('b', { class: k === gap ? 'gap' : '' }, k === gap ? '?' : ch))),
          letterButtons(shuffle([w[gap], ...bad]), ch => { sfx(ch === w[gap] ? 'type' : 'nope'); ch === w[gap] ? win() : lose(); }));
        expose({ ch: w[gap] });
        return;
      }
    },
    async solve(b, s) { await b.tap(byText(b, '.wt-tile', s.ch)); },
  },
  {
    id: 'real', cmd: 'Real one!', theme: 'word',
    setup({ stage, win, lose, sfx, expose }) {
      // Two of these are gibberish.
      const w = pick(W3);
      const fakes = new Set();
      for (let k = 0; k < 40 && fakes.size < 2; k++) {
        const f = k < 10 ? shuffle([...w]).join('') : w.slice(0, 2) + 'BCDFGHKMPTVZ'[rnd(12)];
        if (!WORDS3.has(f) && f !== w) fakes.add(f);
      }
      stage.append(h('div', { class: 'mc-col' }, shuffle([w, ...fakes]).map(x => tapper(h('button', { type: 'button', class: 'btn mc-word' }, x),
        () => { sfx(x === w ? 'coin' : 'nope'); x === w ? win() : lose(); }))));
      expose({ w });
    },
    async solve(b, s) { await b.tap(byText(b, '.mc-word', s.w)); },
  },
  {
    id: 'clue', cmd: 'Answer it!', theme: 'word',
    setup({ stage, win, lose, sfx, expose }) {
      const e = pick(WORDS);
      const others = shuffle(WORDS.filter(x => x.word.length === e.word.length && x.word !== e.word)).slice(0, 2).map(x => x.word);
      stage.append(h('p', { class: 'mc-clue' }, e.clue),
        h('div', { class: 'mc-col' }, shuffle([e.word, ...others]).map(x => tapper(h('button', { type: 'button', class: 'btn mc-word' }, x),
          () => { sfx(x === e.word ? 'coin' : 'nope'); x === e.word ? win() : lose(); }))));
      expose({ w: e.word });
    },
    async solve(b, s) { await b.tap(byText(b, '.mc-word', s.w)); },
  },
  {
    id: 'seek', cmd: 'Find the word!', theme: 'word', time: 6,
    setup({ stage, win, sfx, expose }) {
      // A tiny word search: one word hidden in a 5x5 grid. Drag across it (or tap its ends).
      const n = 5;
      const word = pick(W3.concat(WORDS.map(x => x.word).filter(w => w.length <= 5)));
      const { grid, placed } = buildSearch(n, [word], [[0, 1], [1, 0], [1, 1]]);
      const cells = grid.map(ch => h('span', { class: 'ws-cell' }, ch));
      const board = h('div', { class: 'ws-grid mc-ws', style: `grid-template-columns:repeat(${n},1fr)` }, cells);
      stage.append(h('p', { class: 'mc-clue' }, word), board);
      expose({ cells, ends: [placed[0].cells[0], placed[0].cells[placed[0].cells.length - 1]] });
      let from = -1;
      const cellAt = e => {
        const r = board.getBoundingClientRect();
        const c = Math.floor(((e.clientX - r.left) / r.width) * n), rr = Math.floor(((e.clientY - r.top) / r.height) * n);
        return c < 0 || rr < 0 || c >= n || rr >= n ? -1 : rr * n + c;
      };
      board.addEventListener('pointerdown', e => { e.preventDefault(); const i = cellAt(e); if (i >= 0 && from < 0) from = i; });
      board.addEventListener('pointerup', e => {
        const i = cellAt(e);
        if (i < 0 || from < 0 || i === from) return;
        const line = lineBetween(n, from, i);
        from = -1;
        const got = line && line.map(k => grid[k]).join('');
        if (got === word || (got && [...got].reverse().join('') === word)) {
          line.forEach(k => cells[k].classList.add('found'));
          sfx('coin');
          win();
        } else sfx('nope');
      });
    },
    async solve(b, s) { await b.drag(s.cells[s.ends[0]], s.cells[s.ends[1]], 200, 6); },
  },
  {
    id: 'type', cmd: 'Type it!', theme: 'word',
    setup({ stage, win, lose, sfx, expose }) {
      // Tap the letters of the word in order. One slip and it's over.
      const w = pick(WORDS.filter(x => x.word.length <= 5)).word;
      const decoys = shuffle([...'BCDFGHKMPRSTW'].filter(ch => !w.includes(ch))).slice(0, 3);
      let got = 0;
      const show = h('div', { class: 'mc-spell' }, [...w].map(ch => h('b', {}, ch)));
      stage.append(show, letterButtons(shuffle([...new Set(w), ...decoys]), ch => {
        if (ch !== w[got]) { sfx('nope'); return lose(); }
        show.children[got++].classList.add('on');
        sfx('type');
        if (got === w.length) win();
      }));
      expose({ w });
    },
    // the same letter can repeat, and taps on one key within the dedupe window are fine here
    async solve(b, s) { for (const ch of s.w) { await b.tap(byText(b, '.wt-tile', ch)); await b.wait(40); } },
  },
];

// A rush: a string of microgames back to back, each a little faster. Survive them all.
function rush(root, { difficulty: d, sfx, boost }, pool, title, tip, rounds) {
  const ui = mount(root, { title, tip });
  const max = 3 + (boost === 'tea' ? 1 : 0);
  let lives = max;
  const host = h('div', { class: 'mc-host' });
  ui.body.append(host);
  const deck = shuffle(pool.slice());
  const info = i => ui.info.replaceChildren(h('span', { class: 'mg-stat' }, hearts(lives, max)), h('span', { class: 'mg-stat' }, `${Math.min(i + 1, rounds)} / ${rounds}`));
  return (async () => {
    for (let i = 0; i < rounds; i++) {
      info(i);
      host.replaceChildren(h('div', { class: 'mc-inter' },
        h('b', {}, i === 0 ? 'Ready?' : i === rounds - 1 ? 'Last one!' : 'Next!'),
        h('div', { class: 'mc-lives' }, hearts(lives, max)),
        h('span', {}, `${i + 1} of ${rounds}`)));
      sfx('blip');
      await sleep(i ? 800 : 1100);
      ui.status('');
      const ok = await runMicro(host, deck[i % deck.length], { sfx, speed: 1 + d * 0.3 + i * 0.1 });
      if (!ok && --lives <= 0) {
        info(i);
        sfx('tttlose');
        await banner(ui, 'lose', 'Out of hearts!');
        return 'lose';
      }
    }
    sfx('tttwin');
    await banner(ui, 'win', `All ${rounds} cleared!`);
    return 'win';
  })();
}

// Micro Rush draws from the whole arcade library (every theme, no bosses).
export async function play(root, opts) {
  const d = opts.difficulty;
  const { ALL } = await import('../micro/index.js');
  const pool = ALL.filter(m => !m.boss);
  return rush(root, opts, pool.length ? pool : MICROS, 'Micro Rush', 'Quick! A string of microgames from the whole arcade. Read the command and do it before the fuse burns out.', 4 + Math.round(d * 2));
}

// Word Search + Micro Rush: rapid-fire word microgames.
export function playWords(root, opts) {
  const d = opts.difficulty;
  return rush(root, opts, WORD_MICROS, 'Word Rush', 'Five-second word microgames: unscramble, fill the gap, spot the real word, answer the clue, type it out.', 5 + Math.round(d * 2));
}
