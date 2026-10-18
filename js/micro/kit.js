import { h, sparkle } from '../ui.js';
import { fitCanvas } from '../pixel.js';
import { PAL } from '../spritedata.js';

// The shared kit for WarioWare-style microgames.
//
// A microgame is a plain object:
//   { id, cmd, theme, time?, boss?, timeoutWins?, setup(api), solve?(bot, state) }
//   id      unique kebab-case id
//   cmd     the one-line command shown as it starts ("Plunge it!")
//   theme   'classic' | 'gross' | 'cozy' | 'magic' | 'sport' | 'silly' | 'word'
//   time    seconds on the fuse, default 5, never more than 15 (bosses up to 30)
//   boss    a longer multi-phase showpiece; the arcade puts one every 10th stage
//   timeoutWins  surviving until the fuse runs out is the win ("Don't touch!")
//   setup(api)   builds the game inside api.stage and calls api.win() / api.lose()
//   solve(bot, state)  plays it to a win; the test harness uses it to prove every game is winnable
//
// api: { stage, speed, sfx, time, win(), lose(), frame(fn(dt, t)), pos(e) -> {x, y} in stage %,
//        expose(obj) -> obj handed to solve() as `state`, over() -> true once decided,
//        phase(n, title) -> flashes a "PHASE n" banner, for bosses moving to their next stage }

export const DEFAULT_TIME = 5;
export const MAX_TIME = 15;
export const BOSS_MAX_TIME = 30;

export const rnd = n => (Math.random() * n) | 0;
export const pick = a => a[rnd(a.length)];
export const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Put an element at (x, y) percent of the stage, centred on that point.
export const at = (el, x, y) => { el.classList.add('mc-pos'); el.style.left = x + '%'; el.style.top = y + '%'; return el; };

// n random spots at least `gap` percent apart, inside a margin.
export function spots(n, gap = 20, m = 12, top = m) {
  const out = [];
  for (let tries = 0; out.length < n && tries < 600; tries++) {
    const p = { x: m + Math.random() * (100 - 2 * m), y: top + Math.random() * (100 - top - m) };
    if (out.every(q => dist(q, p) >= gap)) out.push(p);
  }
  while (out.length < n) out.push({ x: m + Math.random() * (100 - 2 * m), y: top + Math.random() * (100 - top - m) });
  return out;
}

// A tap target that fires on pointerdown, so quick taps feel instant.
export const tapper = (el, fn) => { el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(e); }); return el; };

const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch { /* synthetic or already released */ } };

// Track a finger (or mouse) on the stage: cb(p, phase) with p in stage %; phase 'down' | 'move' | 'up'.
export function follow(stage, pos, cb) {
  let held = false;
  stage.addEventListener('pointerdown', e => { held = true; capture(stage, e); cb(pos(e), 'down'); });
  stage.addEventListener('pointermove', e => { if (held || e.pointerType === 'mouse') cb(pos(e), held ? 'move' : 'hover'); });
  const up = e => { if (held) { held = false; cb(pos(e), 'up'); } };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
}

// Swipes on the stage: cb(dir, dx, dy) with dir 'left' | 'right' | 'up' | 'down' (dx, dy in stage %).
export function swipe(stage, pos, cb, min = 12) {
  let start = null;
  stage.addEventListener('pointerdown', e => { start = pos(e); capture(stage, e); });
  stage.addEventListener('pointerup', e => {
    if (!start) return;
    const p = pos(e), dx = p.x - start.x, dy = p.y - start.y;
    start = null;
    if (Math.hypot(dx, dy) < min) return;
    cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), dx, dy);
  });
}

// Press-and-hold: onDown() when pressed, onUp(heldSeconds) when released.
export function holdable(el, onDown, onUp) {
  let t0 = 0;
  el.addEventListener('pointerdown', e => { e.preventDefault(); t0 = performance.now(); capture(el, e); onDown && onDown(); });
  const up = () => { if (!t0) return; const s = (performance.now() - t0) / 1000; t0 = 0; onUp && onUp(s); };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  return el;
}

// ---------- pixel art ----------
// art(rows, pal) turns rows of palette letters ('.' = clear) into a data URL, cached.
// Palette letters default to the game's PAL (k outline, w white, r red, g green, u/U blues, y yellow,
// o orange, p purple, f pink, b/B browns, c cream, s silver ...); pass extra letters in `pal`.
const artCache = new Map();
export function art(rows, pal = {}) {
  const key = rows.join('/') + JSON.stringify(pal);
  if (artCache.has(key)) return artCache.get(key);
  const w = Math.max(...rows.map(r => r.length)), hgt = rows.length;
  const c = document.createElement('canvas');
  c.width = w; c.height = hgt;
  const ctx = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const col = pal[ch] || PAL[ch];
    if (ch === '.' || !col) return;
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 1, 1);
  }));
  const url = c.toDataURL();
  artCache.set(key, url);
  return url;
}

// A crisp pixel-art <img>; size is its width in % of the stage (height follows the art's aspect).
export function sprite(rows, pal, size = 14, cls = '') {
  return h('img', { src: art(rows, pal), class: 'mc-spr ' + cls, alt: '', draggable: 'false', style: `width:${size}%` });
}

// A pixel canvas filling the stage, LW x LH logical pixels. Returns { cv, ctx, toLogical(p) }.
export function canvas(stage, LW = 100, LH = 100) {
  const cv = h('canvas', { class: 'mc-canvas' });
  stage.append(cv);
  const fit = fitCanvas(cv, LW, LH);
  return { cv, ctx: fit.ctx, toLogical: p => ({ x: (p.x / 100) * LW, y: (p.y / 100) * LH }) };
}

// Styles a microgame file needs, added once. Keeps the micro files self-contained.
export function addStyle(id, cssText) {
  if (document.getElementById('mcss-' + id)) return;
  document.head.append(h('style', { id: 'mcss-' + id }, cssText));
}

// ---------- running one microgame ----------
// Resolves true (won) or false. speed >= 1 makes things faster and trims the fuse a little.
// autoplay runs the micro's own solve() (the test harness and the attract demo use this).
export function runMicro(host, m, { sfx = () => {}, speed = 1, autoplay = false } = {}) {
  // Faster speeds trim the fuse; bosses only half as much, since their phases need room.
  const time = Math.min(m.boss ? BOSS_MAX_TIME : MAX_TIME, (m.time || DEFAULT_TIME) / (1 + (speed - 1) * (m.boss ? 0.18 : 0.35)));
  const stage = h('div', { class: 'mc-stage mcs-' + m.id });
  const fuse = h('div', { class: 'mc-fuse' }, h('i'));
  const box = h('div', { class: 'mc-box' }, stage, h('div', { class: 'mc-cmd' }, m.cmd));
  const wrap = h('div', { class: 'mc' + (m.boss ? ' boss' : '') }, fuse, box);
  host.replaceChildren(wrap);
  return new Promise(resolve => {
    let over = false, t = 0, last = performance.now(), tick = 3, exposed = {};
    const frames = [];
    const end = ok => {
      if (over) return;
      over = true;
      wrap.classList.add(ok ? 'won' : 'lost');
      box.append(h('div', { class: 'mc-stamp' }, ok ? pick(['Nice!', 'Dang!', 'Yes!', 'Sweet!']) : pick(['Oops!', 'Nope!', 'Aw!'])));
      sfx(ok ? 'sparkle' : 'fizzle');
      if (ok) sparkle(box, { count: 12 });
      setTimeout(() => resolve(ok), 750);
    };
    const pos = e => {
      const r = stage.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
    };
    const api = {
      stage, speed, sfx, time, pos,
      win: () => end(true), lose: () => end(false), over: () => over,
      frame: fn => frames.push(fn),
      expose: obj => (exposed = obj),
      phase: (n, title = '') => {
        if (over) return;
        box.querySelector('.mc-phase')?.remove();
        const el = h('div', { class: 'mc-phase' }, h('b', {}, `PHASE ${n}`), title && h('span', {}, title));
        box.append(el);
        sfx('alarm');
        setTimeout(() => el.remove(), 1400);
      },
    };
    try { m.setup(api); } catch (err) { console.error('micro setup failed', m.id, err); }
    const loop = now => {
      if (over) return;
      if (!wrap.isConnected) { over = true; resolve(false); return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      fuse.firstChild.style.width = `${Math.max(0, 100 - (t / time) * 100)}%`;
      fuse.classList.toggle('low', t > time - 1.5);
      // tick-tock for the last three seconds, like a bomb fuse
      if (t > time - tick) { sfx('blip'); tick--; }
      for (const f of frames) if (!over) f(dt, t);
      if (t >= time) return end(!!m.timeoutWins);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    if (autoplay && m.solve) Promise.resolve().then(() => m.solve(bot(stage, () => over), exposed)).catch(err => console.error('solve failed', m.id, err));
  });
}

// ---------- the test bot ----------
// Drives a microgame through real pointer events, so a solve() exercises the same code a finger does.
// Points are an Element (its centre) or { x, y } in stage percent.
export function bot(stage, isOver = () => false) {
  const client = p => {
    if (p instanceof Element) { const r = p.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    const r = stage.getBoundingClientRect();
    return { x: r.left + (p.x / 100) * r.width, y: r.top + (p.y / 100) * r.height };
  };
  let target = null;
  const fire = (type, p, el) => {
    const c = client(p);
    const t = el || (p instanceof Element ? p : document.elementFromPoint(c.x, c.y)) || stage;
    t.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: c.x, clientY: c.y, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
    return t;
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const B = {
    wait,
    over: isOver,
    q: sel => stage.querySelector(sel),
    qa: sel => [...stage.querySelectorAll(sel)],
    down(p) { target = fire('pointerdown', p); },
    // moves go to the element that got the pointerdown, like pointer capture
    move(p) { fire('pointermove', p, target || undefined); },
    up(p) { const t = fire('pointerup', p, target || undefined); target = null; t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: client(p).x, clientY: client(p).y })); },
    async tap(p) { B.down(p); await wait(30); B.up(p); await wait(30); },
    async hold(p, ms) { B.down(p); await wait(ms); B.up(p); },
    async drag(a, b, ms = 250, steps = 10) {
      B.down(a);
      const A = a instanceof Element ? centrePct(a) : a, Bp = b instanceof Element ? centrePct(b) : b;
      for (let i = 1; i <= steps; i++) { await wait(ms / steps); B.move({ x: A.x + (Bp.x - A.x) * (i / steps), y: A.y + (Bp.y - A.y) * (i / steps) }); }
      B.up(Bp);
    },
    async swipe(dir, from = { x: 50, y: 50 }, len = 30) {
      const d = { left: [-len, 0], right: [len, 0], up: [0, -len], down: [0, len] }[dir];
      await B.drag(from, { x: from.x + d[0], y: from.y + d[1] }, 120, 4);
    },
    // wait until fn() is truthy (or the game ends); returns its value
    async until(fn, ms = 15000) {
      const t0 = performance.now();
      for (;;) { const v = fn(); if (v || isOver() || performance.now() - t0 > ms) return v; await wait(16); }
    },
    pct: centrePct,
  };
  function centrePct(el) {
    const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
    return { x: ((r.left + r.width / 2 - s.left) / s.width) * 100, y: ((r.top + r.height / 2 - s.top) / s.height) * 100 };
  }
  return B;
}
