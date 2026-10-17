import { h, icon, sparkle } from '../ui.js';
import { sleep } from '../pixel.js';
import { CAT_BREEDS } from '../spritedata.js';
import { mount, banner, hearts } from './common.js';
import { WORDS3 } from './words3.js';
import { WORDS } from './crossword.js';

// WarioWare-style microgames: a one-line command, a 5-second fuse, one simple task.
// Each micro has setup(api); api.win()/api.lose() end it early, and when the fuse runs out
// it counts as a loss unless the micro sets timeoutWins (the "don't do anything" ones).
export const TIME = 5;

const rnd = n => (Math.random() * n) | 0;
const pick = a => a[rnd(a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ITEMS = ['wheat', 'cotton', 'flowers', 'pumpkin', 'coin', 'star', 'heart', 'shard'];

// Put an element at (x, y) percent of the stage, centred.
const at = (el, x, y) => { el.classList.add('mc-pos'); el.style.left = x + '%'; el.style.top = y + '%'; return el; };

// n random spots at least `gap` percent apart, inside a margin.
function spots(n, gap = 20, m = 12, top = m) {
  const out = [];
  for (let tries = 0; out.length < n && tries < 600; tries++) {
    const p = { x: m + Math.random() * (100 - 2 * m), y: top + Math.random() * (100 - top - m) };
    if (out.every(q => Math.hypot(q.x - p.x, q.y - p.y) >= gap)) out.push(p);
  }
  while (out.length < n) out.push({ x: m + Math.random() * (100 - 2 * m), y: top + Math.random() * (100 - top - m) });
  return out;
}

// A tap target: fires on pointerdown so fast taps feel instant.
const tapper = (el, fn) => { el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(e); }); return el; };

function drop(stage, x, y) {
  const d = at(h('i', { class: 'mc-drop' }), x, y);
  stage.append(d);
  return d;
}

export const MICROS = [
  {
    id: 'patch', cmd: 'Patch it!',
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
  },
  {
    id: 'pop', cmd: 'Pop ’em!',
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
  },
  {
    id: 'stop', cmd: 'Stop!',
    setup({ stage, win, lose, sfx, speed, frame }) {
      // A needle sweeps the gauge; tap while it's in the gold.
      const w = Math.max(10, 24 - speed * 7), zx = 10 + Math.random() * (80 - w);
      const needle = h('i', { class: 'mc-needle' });
      stage.append(h('div', { class: 'mc-gauge' }, h('i', { class: 'mc-zone', style: `left:${zx}%;width:${w}%` }), needle),
        h('p', { class: 'mc-note' }, 'Tap anywhere when the needle is in the gold'));
      let p = 0, dir = 1;
      frame(dt => {
        p += dir * 75 * speed * dt;
        if (p > 100) { p = 100; dir = -1; } else if (p < 0) { p = 0; dir = 1; }
        needle.style.left = p + '%';
      });
      tapper(stage, () => { sfx('select'); p >= zx && p <= zx + w ? win() : lose(); });
    },
  },
  {
    id: 'stoke', cmd: 'Stoke it!',
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
  },
  {
    id: 'odd', cmd: 'Find it!',
    setup({ stage, win, lose, sfx, speed }) {
      // One cat is a different breed from the rest.
      const n = speed > 1.3 ? 5 : 4;
      const a = rnd(CAT_BREEDS.length);
      let b = rnd(CAT_BREEDS.length - 1); if (b >= a) b++;
      const odd = rnd(n * n);
      stage.append(h('div', { class: 'mc-grid', style: `grid-template-columns:repeat(${n},1fr)` },
        Array.from({ length: n * n }, (_, i) => tapper(h('button', { type: 'button', class: 'mc-pick' }, icon('cat' + (i === odd ? b : a), 'ico cat')),
          () => { sfx(i === odd ? 'mew' : 'nope'); i === odd ? win() : lose(); }))));
    },
  },
  {
    id: 'count', cmd: 'How many?',
    setup({ stage, win, lose, sfx, speed, frame }) {
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
      stage.append(h('div', { class: 'mc-answers' }, opts.map(v => tapper(h('button', { type: 'button', class: 'btn' }, String(v)),
        () => { sfx(v === k ? 'coin' : 'nope'); v === k ? win() : lose(); }))));
    },
  },
  {
    id: 'catch', cmd: 'Catch!',
    setup({ stage, win, lose, sfx, speed, frame, pos }) {
      // Slide the bucket under every drip from the leaky roof.
      const bucket = at(h('i', { class: 'mc-bucket' }), 50, 90);
      stage.append(bucket);
      let bx = 50;
      const follow = e => { bx = Math.max(8, Math.min(92, pos(e).x)); at(bucket, bx, 90); };
      stage.addEventListener('pointerdown', e => { stage.setPointerCapture?.(e.pointerId); follow(e); });
      stage.addEventListener('pointermove', follow);
      const times = [0.3, 1.45, 2.6].map(t => t / Math.sqrt(speed));
      const drops = [];
      let caught = 0, spawned = 0;
      frame((dt, t) => {
        if (spawned < times.length && t >= times[spawned]) {
          spawned++;
          const d = drop(stage, 10 + Math.random() * 80, -4);
          d.x = parseFloat(d.style.left); d.y = -4;
          drops.push(d);
          sfx('drip');
        }
        for (const d of drops) {
          if (d.done) continue;
          d.y += (48 + 22 * speed) * dt;
          d.style.top = d.y + '%';
          if (d.y >= 84 && d.y < 94 && Math.abs(d.x - bx) < 11) {
            d.done = true; d.remove(); sfx('coin');
            if (++caught === times.length) win();
          } else if (d.y > 100) { d.done = true; lose(); }
        }
      });
    },
  },
  {
    id: 'dodge', cmd: 'Stay dry!', timeoutWins: true,
    setup({ stage, lose, sfx, speed, frame, pos }) {
      // You're the cat: slide left and right so no raindrop lands on you.
      const me = at(h('span', { class: 'mc-me' }, icon('cat', 'ico')), 50, 88);
      stage.append(me);
      let mx = 50, next = 0.3;
      const follow = e => { mx = Math.max(8, Math.min(92, pos(e).x)); at(me, mx, 88); };
      stage.addEventListener('pointerdown', e => { stage.setPointerCapture?.(e.pointerId); follow(e); });
      stage.addEventListener('pointermove', follow);
      const drops = [];
      frame((dt, t) => {
        if (t >= next && t < TIME - 0.6) {
          next = t + 0.42 / speed;
          const x = Math.random() < 0.5 ? mx + (Math.random() - 0.5) * 20 : 6 + Math.random() * 88;
          const d = drop(stage, Math.max(5, Math.min(95, x)), -4);
          d.x = parseFloat(d.style.left); d.y = -4;
          drops.push(d);
        }
        for (const d of drops) {
          if (d.done) continue;
          d.y += (55 + 25 * speed) * dt;
          d.style.top = d.y + '%';
          if (d.y > 80 && d.y < 94 && Math.abs(d.x - mx) < 7) { d.done = true; sfx('drip'); me.classList.add('wet'); lose(); }
          else if (d.y > 104) { d.done = true; d.remove(); }
        }
      });
    },
  },
  {
    id: 'swat', cmd: 'Swat!',
    setup({ stage, win, sfx, speed, frame, pos }) {
      const fly = at(h('i', { class: 'mc-fly' }), 50, 50);
      stage.append(fly);
      let x = 50, y = 50, tx = 50, ty = 50;
      frame(dt => {
        if (Math.hypot(tx - x, ty - y) < 3) { tx = 10 + Math.random() * 80; ty = 10 + Math.random() * 80; }
        const d = Math.hypot(tx - x, ty - y), v = 55 * speed * dt;
        x += ((tx - x) / d) * v; y += ((ty - y) / d) * v;
        at(fly, x + (Math.random() - 0.5) * 2, y + (Math.random() - 0.5) * 2);
      });
      tapper(stage, e => {
        const p = pos(e);
        if (Math.hypot(p.x - x, p.y - y) < 11) { fly.classList.add('splat'); sfx('pop'); win(); } else sfx('tap');
      });
    },
  },
  {
    id: 'shh', cmd: 'Shh!', timeoutWins: true,
    setup({ stage, lose, sfx }) {
      // The pet is napping. Whatever you do, don't touch anything.
      stage.append(h('div', { class: 'mc-nap' }, icon('cat', 'ico'), h('b', {}, 'z'), h('b', {}, 'z'), h('b', {}, 'Z')),
        h('button', { type: 'button', class: 'btn mc-tempt' }, 'Boop?'));
      tapper(stage, () => { sfx('meow'); stage.classList.add('woke'); lose(); });
    },
  },
  {
    id: 'light', cmd: 'Light ’em!',
    setup({ stage, win, lose, sfx, speed }) {
      // Light the candles in order, 1 first.
      const n = speed > 1.25 ? 5 : 4;
      let next = 1;
      spots(n, 24, 14, 16).forEach((p, i) => {
        const c = at(h('button', { type: 'button', class: 'mc-candle' }, h('b', {}, String(i + 1))), p.x, p.y);
        tapper(c, () => {
          if (c.classList.contains('lit')) return;
          if (i + 1 !== next) { sfx('nope'); c.classList.add('bad'); return lose(); }
          c.classList.add('lit'); sfx('ring');
          if (++next > n) win();
        });
        stage.append(c);
      });
    },
  },
  {
    id: 'match', cmd: 'Match!',
    setup({ stage, win, lose, sfx, speed }) {
      const opts = shuffle(ITEMS.slice()).slice(0, speed > 1.3 ? 6 : 4);
      const want = pick(opts);
      stage.append(h('div', { class: 'mc-want' }, icon(want, 'ico big')),
        h('div', { class: 'mc-row' }, opts.map(it => tapper(h('button', { type: 'button', class: 'mc-pick' }, icon(it, 'ico')),
          () => { sfx(it === want ? 'coin' : 'nope'); it === want ? win() : lose(); }))));
    },
  },
  {
    id: 'curtain', cmd: 'Shut it!',
    setup({ stage, win, sfx, speed, frame, pos }) {
      // Drag the curtain across the rainy window before the draught gets in.
      const cur = h('i', { class: 'mc-curtain' });
      stage.append(h('div', { class: 'mc-window' }), cur, h('p', { class: 'mc-note' }, 'Drag the curtain across →'));
      let w = 12, drag = false;
      stage.addEventListener('pointerdown', e => { drag = true; stage.setPointerCapture?.(e.pointerId); sfx('select'); });
      stage.addEventListener('pointermove', e => {
        if (!drag) return;
        w = Math.max(w, Math.min(100, pos(e).x));
        if (w >= 88) { sfx('door'); win(); }
      });
      stage.addEventListener('pointerup', () => (drag = false));
      frame(dt => { if (!drag) w = Math.max(12, w - 30 * speed * dt); cur.style.width = w + '%'; });
    },
  },
];

// ---------- word microgames (Word Rush) ----------
const W3 = [...WORDS3];
const letterButtons = (letters, onTap) => h('div', { class: 'mc-row' }, letters.map((ch, k) => tapper(h('button', { type: 'button', class: 'wt-tile' }, ch), e => onTap(ch, k, e.currentTarget))));

export const WORD_MICROS = [
  {
    id: 'spell', cmd: 'Spell it!',
    setup({ stage, win, lose, sfx }) {
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
    },
  },
  {
    id: 'fill', cmd: 'Fill it!',
    setup({ stage, win, lose, sfx }) {
      // One letter is missing. Only one of the choices makes a word.
      for (let tries = 0; tries < 50; tries++) {
        const w = pick(W3), gap = rnd(3);
        const bad = shuffle([...'ABCDEFGHIJKLMNOPRSTUWY']).filter(ch => !WORDS3.has(w.slice(0, gap) + ch + w.slice(gap + 1))).slice(0, 2);
        if (bad.length < 2) continue;
        stage.append(h('div', { class: 'mc-spell' }, [...w].map((ch, k) => h('b', { class: k === gap ? 'gap' : '' }, k === gap ? '?' : ch))),
          letterButtons(shuffle([w[gap], ...bad]), ch => { sfx(ch === w[gap] ? 'type' : 'nope'); ch === w[gap] ? win() : lose(); }));
        return;
      }
    },
  },
  {
    id: 'real', cmd: 'Real one!',
    setup({ stage, win, lose, sfx }) {
      // Two of these are gibberish.
      const w = pick(W3);
      const fakes = new Set();
      for (let k = 0; k < 40 && fakes.size < 2; k++) {
        const f = k < 10 ? shuffle([...w]).join('') : w.slice(0, 2) + 'BCDFGHKMPTVZ'[rnd(12)];
        if (!WORDS3.has(f) && f !== w) fakes.add(f);
      }
      stage.append(h('div', { class: 'mc-col' }, shuffle([w, ...fakes]).map(x => tapper(h('button', { type: 'button', class: 'btn mc-word' }, x),
        () => { sfx(x === w ? 'coin' : 'nope'); x === w ? win() : lose(); }))));
    },
  },
  {
    id: 'clue', cmd: 'Answer it!',
    setup({ stage, win, lose, sfx }) {
      const e = pick(WORDS);
      const others = shuffle(WORDS.filter(x => x.word.length === e.word.length && x.word !== e.word)).slice(0, 2).map(x => x.word);
      stage.append(h('p', { class: 'mc-clue' }, e.clue),
        h('div', { class: 'mc-col' }, shuffle([e.word, ...others]).map(x => tapper(h('button', { type: 'button', class: 'btn mc-word' }, x),
          () => { sfx(x === e.word ? 'coin' : 'nope'); x === e.word ? win() : lose(); }))));
    },
  },
  {
    id: 'type', cmd: 'Type it!',
    setup({ stage, win, lose, sfx }) {
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
    },
  },
];

// Play one microgame in `host`. Resolves true (won) or false.
export function runMicro(host, m, { sfx, speed = 1 }) {
  const stage = h('div', { class: 'mc-stage mcs-' + m.id });
  const fuse = h('div', { class: 'mc-fuse' }, h('i'));
  const box = h('div', { class: 'mc-box' }, stage, h('div', { class: 'mc-cmd' }, m.cmd));
  const wrap = h('div', { class: 'mc' }, fuse, box);
  host.replaceChildren(wrap);
  return new Promise(resolve => {
    let over = false, t = 0, last = performance.now(), tick = 3;
    const frames = [];
    const end = ok => {
      if (over) return;
      over = true;
      wrap.classList.add(ok ? 'won' : 'lost');
      box.append(h('div', { class: 'mc-stamp' }, ok ? 'Nice!' : 'Oops!'));
      sfx(ok ? 'sparkle' : 'fizzle');
      if (ok) sparkle(box, { count: 12 });
      setTimeout(() => resolve(ok), 750);
    };
    const pos = e => {
      const r = stage.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
    };
    m.setup({ stage, speed, sfx, pos, win: () => end(true), lose: () => end(false), frame: fn => frames.push(fn) });
    const loop = now => {
      if (over) return;
      if (!wrap.isConnected) { over = true; resolve(false); return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      fuse.firstChild.style.width = `${Math.max(0, 100 - (t / TIME) * 100)}%`;
      fuse.classList.toggle('low', t > TIME - 1.5);
      // tick-tock for the last three seconds, like the bomb fuse
      if (t > TIME - tick) { sfx('blip'); tick--; }
      for (const f of frames) if (!over) f(dt, t);
      if (t >= TIME) return end(!!m.timeoutWins);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

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

export function play(root, opts) {
  const d = opts.difficulty;
  return rush(root, opts, MICROS, 'Micro Rush', 'Quick! A string of 5-second microgames. Read the command and do it before the fuse burns out.', 4 + Math.round(d * 2));
}

// Word Square + Micro Rush: rapid-fire word microgames.
export function playWords(root, opts) {
  const d = opts.difficulty;
  return rush(root, opts, WORD_MICROS, 'Word Rush', 'Five-second word microgames: unscramble, fill the gap, spot the real word, answer the clue, type it out.', 5 + Math.round(d * 2));
}
