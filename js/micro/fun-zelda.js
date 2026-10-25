import { ICONS } from '../sprites.js';
import { rnd, pick, clamp, dist, spots, tapper, follow, swipe, holdable, art, canvas, addStyle } from './kit.js';

// Funtendo · Hyrule & friends: quick parodies of classic Nintendo moments (Zelda, Kirby, Metroid,
// Star Fox, Donkey Kong Country), plus a couple with a magical-girl twist. All art is our own pixel
// art drawn on a 100x100 canvas that fills the stage, so canvas units == stage %.

addStyle('fun-zelda', `
[class*="mcs-fz-"] .mc-canvas { position: absolute; inset: 0; width: 100% !important; height: 100% !important; display: block; image-rendering: pixelated; }
`);

// ---------- drawing helpers ----------
const SPR = new Map();
function spr(rows, pal = {}) {
  const key = rows.join('/') + JSON.stringify(pal);
  if (!SPR.has(key)) {
    const i = new Image();
    i.src = art(rows, pal);
    SPR.set(key, { i, w: Math.max(...rows.map(r => r.length)), h: rows.length });
  }
  return SPR.get(key);
}
// draw a sprite centred on (x, y), optionally scaled and mirrored
function put(ctx, s, x, y, sc = 1, flip = false) {
  if (!s.i.complete) return;
  const w = s.w * sc, hh = s.h * sc;
  if (flip) {
    ctx.save();
    ctx.translate(Math.round(x), 0);
    ctx.scale(-1, 1);
    ctx.drawImage(s.i, Math.round(-w / 2), Math.round(y - hh / 2), w, hh);
    ctx.restore();
  } else ctx.drawImage(s.i, Math.round(x - w / 2), Math.round(y - hh / 2), w, hh);
}
const R = (ctx, x, y, w, hh, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hh)); };
function txt(ctx, s, x, y, col = '#fff4e0', size = 9) {
  ctx.font = `${size}px "Jersey 10", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1a1220';
  ctx.fillText(s, x + 0.6, y + 0.6);
  ctx.fillStyle = col;
  ctx.fillText(s, x, y);
}
function disc(ctx, x, y, r, c) {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    R(ctx, x - w, y + dy, w * 2 + 1, 1, c);
  }
}
// upward triangle with its apex at (x, y), `hh` rows tall
function tri(ctx, x, y, hh, c) { for (let i = 0; i < hh; i++) R(ctx, x - i, y + i, i * 2 + 1, 1, c); }
const scene = stage => canvas(stage, 100, 100).ctx;
function reflect(x, lo, hi) {
  const w = hi - lo;
  let u = (x - lo) % (2 * w);
  if (u < 0) u += 2 * w;
  return u <= w ? lo + u : lo + 2 * w - u;
}
function grass(ctx, c1 = '#3d7a34', c2 = '#356c2e') {
  R(ctx, 0, 0, 100, 100, c1);
  ctx.fillStyle = c2;
  for (let i = 0; i < 60; i++) ctx.fillRect((i * 37) % 99, (i * 53) % 99, 2, 1);
}
function dungeon(ctx, base = '#2a2440', line = '#221d36') {
  R(ctx, 0, 0, 100, 100, base);
  ctx.fillStyle = line;
  for (let y = 0; y < 100; y += 10) ctx.fillRect(0, y, 100, 1);
  for (let y = 0; y < 100; y += 10) for (let x = (y / 10) % 2 ? 0 : 10; x < 100; x += 20) ctx.fillRect(x, y, 1, 10);
}
function starsky(ctx, top = '#141c3a', n = 30, seed = 1) {
  R(ctx, 0, 0, 100, 100, top);
  ctx.fillStyle = '#fff4e0';
  for (let i = 0; i < n; i++) ctx.fillRect(((i * 41 + seed * 13) % 97) + 1, ((i * 29 + seed * 7) % 95) + 1, 1, 1);
}
const girl = (ctx, n, x, y, sc = 2) => { const g = ICONS['girl' + n]; if (g) ctx.drawImage(g, Math.round(x - 6 * sc), Math.round(y - 6 * sc), 12 * sc, 12 * sc); };
function heart(ctx, x, y, full = true) {
  const c = full ? '#d0463c' : '#3a2a3a';
  R(ctx, x, y + 1, 5, 2, c); R(ctx, x + 1, y, 1, 1, c); R(ctx, x + 3, y, 1, 1, c); R(ctx, x + 1, y + 3, 3, 1, c); R(ctx, x + 2, y + 4, 1, 1, c);
}
function bar(ctx, x, y, w, frac, col = '#ffe27a', zone = null) {
  R(ctx, x - 1, y - 1, w + 2, 6, '#1a1220');
  R(ctx, x, y, w, 4, '#3a2a5c');
  if (zone) R(ctx, x + w * zone[0], y, w * (zone[1] - zone[0]), 4, '#4a8a3a');
  R(ctx, x, y, w * clamp(frac, 0, 1), 4, col);
}

// ---------- sprites (our own) ----------
const ELF = ['...gggg...', '..gggggg..', '.ggggggggG', '.yccccccy.', '.ckcccckc.', '..cccccc..', '...cccc...', '.gggggggg.', 'cgGbbbbGgc', '.gggggggg.', '.gg....gg.', '.BB....BB.'];
const ELF_UP = ['c..gggg..c', 'c.gggggg.c', 'cggggggggc', '.yccccccy.', '.ckcccckc.', '..ccrrcc..', '...cccc...', '.gggggggg.', '.gGbbbbGg.', '.gggggggg.', '.gg....gg.', '.BB....BB.'];
const KIRBY = ['...ffff...', '.ffffffff.', 'ffffffffff', 'fffkffkfff', 'fffkffkfff', 'fFffffffFf', 'ffffkkffff', '.ffffffff.', 'RRR....RRR'];
const KIRBY_SUCK = ['...ffff...', '.ffffffff.', 'ffffffffff', 'ffkkffkkff', 'ffffffffff', 'fFfkkkkfFf', 'fffkRRkfff', '.fffkkfff.', 'RRR....RRR'];
const SAMUS = ['..oooo..', '.oooooo.', '.olllloo', '.oooooo.', 'RRooooUU', 'RRooooUU', '.oooooo.', '.oo..oo.', '.RR..RR.'];
const BALL = ['.oooo.', 'ooyyoo', 'oyooyo', 'oyooyo', 'ooyyoo', '.oooo.'];
const METROID = ['..llllll..', '.lluuuuul.', 'llurruurrl', 'llurruurrl', '.llllllll.', '.k.k..k.k.', '.k..kk..k.'];
const ARWING = ['....w....', '...wsw...', '..wsUsw..', '.wwsssww.', 'ws.sss.sw', 'U..sUs..U', '...r.r...'];
const OCTO = ['..rrrr..', '.rrrrrr.', 'rrwkrwkr', 'rrrrrrrr', '.rrRRrr.', 'r.r..r.r'];
const CUCCO = ['..rr....', '.wwww...', 'wwkwwwo.', 'wwwwwwww', '.wwwwww.', '..o..o..'];
const KEESE = ['P.......P', 'PP.....PP', 'PPPkpkPPP', '.PPpppPP.', '...P.P...'];
const KEESE2 = ['.........', 'PP.....PP', 'PPPkpkPPP', 'PPPpppPPP', 'P..P.P..P'];
const DK = ['..BBBB..', '.BBBBBB.', 'BBttttBB', 'BtktktBB', 'BBttttBB', '.BBrrBB.', 'BBBBBBBB', '.BB..BB.'];
const WADDLE = ['..oooo..', '.oooooo.', 'occwcwco', 'occccccco', '.oooooo.', '.yy..yy.'];
const MOBLIN = ['..UUUU..', '.UUUUUU.', 'UUwkwkUU', 'UUUUUUUU', '.UU..UU.', '.DD..DD.'];
const KOROK = ['..gg.gg..', '.gGggggG.', 'gggbbbggg', '.bkbbbkb.', '.bbbkbbb.', '..bbbbb..', '...b.b...'];

const games = [
  // 1. Pull the legendary sword from its pedestal.
  {
    id: 'fz-sword', cmd: 'Pull the sword!', theme: 'funtendo', time: 5,
    setup({ stage, win, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const s = expose({ pull: 0, done: 0, t: 0 });
      tapper(stage, () => { if (s.done) return; s.pull += 0.1; sfx('tap'); });
      frame((dt, t) => {
        s.t = t;
        if (!s.done) { s.pull = Math.max(0, s.pull - dt * 0.18 * speed); if (s.pull >= 1) { s.done = t; sfx('ring'); } }
        else if (t - s.done > 0.4) win();
        R(ctx, 0, 0, 100, 100, '#1e3a2a');
        R(ctx, 36, 0, 28, 100, '#24443a');
        ctx.fillStyle = '#4a6a3a';
        for (let i = 0; i < 18; i++) ctx.fillRect((i * 31) % 97, 78 + ((i * 7) % 20), 3, 1);
        const lift = Math.min(1, s.pull) * 22 + (s.done ? (t - s.done) * 70 : 0);
        const sy = 30 - lift;
        // blade, buried in the stone below y = 62
        R(ctx, 48, sy + 14, 4, Math.max(0, 62 - (sy + 14)), '#d8d8e8');
        R(ctx, 48, sy + 14, 1, Math.max(0, 62 - (sy + 14)), '#ffffff');
        R(ctx, 42, sy + 11, 16, 3, '#4f8fd0');
        R(ctx, 48, sy + 2, 4, 9, '#2c5a9a');
        R(ctx, 47, sy, 6, 3, '#ffe27a');
        R(ctx, 30, 62, 40, 10, '#8a8aa0'); R(ctx, 30, 62, 40, 2, '#a8a8c0');
        R(ctx, 25, 72, 50, 8, '#6a6a80');
        tri(ctx, 50, 64, 5, '#ffe27a');
        put(ctx, spr(s.done ? ELF_UP : ELF), 50, 88, 1.3);
        bar(ctx, 15, 6, 70, s.pull);
        if (s.done) { ctx.fillStyle = '#fff4e0'; for (let i = 0; i < 8; i++) ctx.fillRect(50 + Math.cos(i + t * 6) * 16, sy + 10 + Math.sin(i + t * 6) * 16, 1, 1); }
        txt(ctx, s.done ? 'You got the sword!' : 'Tap fast!', 50, 96, s.done ? '#ffe27a' : '#c9ad7f');
      });
    },
    async solve(b) { while (!b.over()) await b.tap({ x: 50, y: 50 }); },
  },

  // 2. A magical girl draws the Moon Wand from its crystal pedestal.
  {
    id: 'fz-moonwand', cmd: 'Draw the Moon Wand!', theme: 'funtendo', time: 5,
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const need = 24 + 4 * (speed - 1);
      const s = expose({ lift: 0, handleY: 40, grab: null, base: 0, done: 0 });
      follow(stage, pos, (p, ph) => {
        if (s.done) return;
        if (ph === 'down') {
          if (Math.abs(p.x - 50) < 18 && Math.abs(p.y - (s.handleY - s.lift)) < 20) { s.grab = p.y; s.base = s.lift; sfx('select'); }
        } else if (ph === 'move' && s.grab != null) {
          s.lift = clamp(s.base + (s.grab - p.y) * 0.7, 0, 40);
          if (s.lift >= need) { s.done = performance.now(); sfx('ring'); }
        } else if (ph === 'up') s.grab = null;
      });
      frame((dt, t) => {
        if (!s.done && s.grab == null) s.lift = Math.max(0, s.lift - dt * 40 * speed);
        if (s.done && performance.now() - s.done > 400) win();
        starsky(ctx, '#1a1438', 34, 4);
        disc(ctx, 82, 14, 7, '#ffe27a'); disc(ctx, 85, 12, 6, '#1a1438');
        // crystal pedestal
        R(ctx, 32, 62, 36, 12, '#b8d8f6'); R(ctx, 32, 62, 36, 2, '#ffffff'); R(ctx, 28, 74, 44, 8, '#9fb4d0');
        R(ctx, 46, 64, 8, 6, '#f08ab0');
        const wy = s.handleY - s.lift;
        R(ctx, 49, wy + 4, 3, Math.max(0, 62 - (wy + 4)), '#f08ab0');
        R(ctx, 49, wy + 4, 1, Math.max(0, 62 - (wy + 4)), '#ffd0e4');
        // crescent-moon head with a heart gem
        disc(ctx, 50, wy, 5, '#ffe27a'); disc(ctx, 53, wy - 1, 4, s.done ? '#2a2058' : '#1a1438');
        R(ctx, 48, wy - 1, 3, 2, '#d0463c'); R(ctx, 49, wy + 1, 1, 1, '#d0463c');
        girl(ctx, 3, 20, 86, 2);
        bar(ctx, 15, 6, 70, s.lift / need, '#f08ab0');
        if (s.lift > 4) { ctx.fillStyle = '#fff4e0'; for (let i = 0; i < 6; i++) ctx.fillRect(50 + Math.cos(i * 1.1 + t * 5) * 10, wy + Math.sin(i * 1.1 + t * 5) * 10, 1, 1); }
        txt(ctx, s.done ? 'Moon power!' : 'Drag the wand up!', 60, 92, s.done ? '#ffe27a' : '#c9ad7f');
      });
    },
    async solve(b, s) {
      while (!b.over()) { await b.drag({ x: 50, y: s.handleY - s.lift }, { x: 50, y: 1 }, 420, 14); await b.wait(40); }
    },
  },

  // 3. Open the treasure chest and hold the prize up high.
  {
    id: 'fz-chest', cmd: 'Open it!', theme: 'funtendo', time: 4,
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const need = 3 + (speed > 1.5 ? 1 : 0);
      const s = expose({ taps: 0, open: 0, now: 0, shake: 0 });
      tapper(stage, e => {
        const p = pos(e);
        if (s.open || Math.abs(p.x - 50) > 24 || p.y < 40 || p.y > 82) return;
        s.taps++; s.shake = 0.15; sfx('land');
        if (s.taps >= need) { s.open = s.now || 0.001; sfx('ring'); }
      });
      frame((dt, t) => {
        s.now = t; s.shake = Math.max(0, s.shake - dt);
        if (s.open && t - s.open > 0.6) win();
        dungeon(ctx);
        const k = s.shake > 0 ? (Math.random() - 0.5) * 3 : 0;
        const cx = 50 + k;
        if (s.open) {
          const up = Math.min(1, (t - s.open) / 0.5);
          ctx.fillStyle = 'rgba(255,226,122,0.25)';
          for (let i = 0; i < 8; i++) { const a = i * 0.8 + t; ctx.fillRect(50 + Math.cos(a) * 18, 40 + Math.sin(a) * 18, 2, 2); }
          // a heart container rises out
          const iy = 52 - up * 22;
          R(ctx, 44, iy, 5, 4, '#d0463c'); R(ctx, 51, iy, 5, 4, '#d0463c'); R(ctx, 44, iy + 3, 12, 4, '#d0463c'); R(ctx, 46, iy + 7, 8, 2, '#d0463c'); R(ctx, 48, iy + 9, 4, 2, '#d0463c'); R(ctx, 45, iy + 1, 2, 2, '#ffd0d0');
          txt(ctx, 'da-na-na-NAA!', 50, 14, '#ffe27a', 11);
        }
        // chest body
        R(ctx, cx - 18, 56, 36, 20, '#a0663a'); R(ctx, cx - 18, 56, 36, 2, '#c79a5a');
        R(ctx, cx - 18, 64, 36, 2, '#f2c84b'); R(ctx, cx - 18, 56, 3, 20, '#f2c84b'); R(ctx, cx + 15, 56, 3, 20, '#f2c84b');
        // lid
        if (s.open) { R(ctx, cx - 18, 40, 36, 6, '#6b3d22'); R(ctx, cx - 18, 46, 36, 2, '#f2c84b'); }
        else { R(ctx, cx - 18, 46, 36, 10, '#8a5530'); R(ctx, cx - 18, 46, 36, 2, '#c79a5a'); R(ctx, cx - 3, 52, 6, 6, '#f2c84b'); R(ctx, cx - 1, 54, 2, 2, '#1a1220'); }
        for (let i = 0; i < need; i++) R(ctx, 40 + i * 6, 84, 4, 4, i < s.taps ? '#ffe27a' : '#3a2a5c');
        if (!s.open) txt(ctx, 'Tap the chest!', 50, 94, '#c9ad7f');
      });
    },
    async solve(b) { while (!b.over()) await b.tap({ x: 50, y: 62 }); },
  },

  // 4. Swipe through every tuft of grass.
  {
    id: 'fz-grass', cmd: 'Cut the grass!', theme: 'funtendo', time: 5,
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const n = 6 + Math.round(speed * 1.5);
      const s = expose({ tufts: spots(n, 15, 12, 26).map(p => ({ x: p.x, y: p.y, cut: false, rupee: Math.random() < 0.4, ct: 0 })), slash: null });
      let left = n;
      follow(stage, pos, (p, ph) => {
        if (ph === 'up') return;
        s.slash = { x: p.x, y: p.y, life: 0.15 };
        for (const tf of s.tufts) if (!tf.cut && Math.hypot(p.x - tf.x, p.y - tf.y) < 9) {
          tf.cut = true; left--; sfx(tf.rupee ? 'coin' : 'pop');
          if (!left) win();
        }
      });
      frame((dt, t) => {
        grass(ctx, '#4a8a3a', '#3d7a34');
        for (const tf of s.tufts) {
          if (tf.cut) {
            tf.ct += dt;
            R(ctx, tf.x - 4, tf.y + 2, 8, 2, '#3d7a34');
            if (tf.rupee && tf.ct < 0.8) { const ry = tf.y - tf.ct * 12; R(ctx, tf.x - 1, ry - 3, 3, 6, '#6fb04a'); R(ctx, tf.x, ry - 4, 1, 8, '#a8d870'); }
            if (tf.ct < 0.3) { ctx.fillStyle = '#a8d870'; for (let i = 0; i < 5; i++) ctx.fillRect(tf.x + Math.cos(i * 1.3) * tf.ct * 30, tf.y + Math.sin(i * 1.3) * tf.ct * 30 - tf.ct * 10, 1, 2); }
          } else {
            const sw = Math.sin(t * 3 + tf.x) * 0.8;
            R(ctx, tf.x - 5, tf.y, 10, 4, '#2a5a24');
            for (let i = -4; i <= 4; i += 2) R(ctx, tf.x + i + sw, tf.y - 4 + Math.abs(i) / 2, 1, 5, i % 4 ? '#6fb04a' : '#a8d870');
          }
        }
        if (s.slash && s.slash.life > 0) {
          s.slash.life -= dt;
          ctx.fillStyle = '#fff4e0';
          for (let i = -4; i <= 4; i++) ctx.fillRect(s.slash.x + i * 1.5, s.slash.y - Math.abs(i) * 0.8, 1.5, 1);
        }
        put(ctx, spr(ELF), 50, 90, 1.1);
        txt(ctx, `${left} left · swipe through!`, 50, 6, '#fff4e0');
      });
    },
    async solve(b, s) {
      for (const tf of s.tufts) { if (b.over()) return; if (!tf.cut) await b.drag({ x: tf.x - 7, y: tf.y }, { x: tf.x + 7, y: tf.y }, 60, 3); }
    },
  },

  // 5. Lift the heavy rock: hold, and let go in the green.
  {
    id: 'fz-rock', cmd: 'Lift it!', theme: 'funtendo', time: 5,
    setup({ stage, win, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const fill = 1.1 * (0.8 + 0.25 * speed);
      const s = expose({ bar: 0, holding: false, reveal: 0, now: 0, msg: '', msgT: 0 });
      holdable(stage, () => { if (s.reveal) return; s.holding = true; sfx('select'); }, () => {
        if (!s.holding) return;
        s.holding = false;
        if (s.bar >= 0.7 && s.bar <= 1) { s.reveal = s.now || 0.001; sfx('ring'); }
        else { s.msg = 'Not enough!'; s.msgT = 0.8; s.bar = 0; sfx('land'); }
      });
      frame((dt, t) => {
        s.now = t; s.msgT -= dt;
        if (s.holding) {
          s.bar += fill * dt;
          if (s.bar > 1.15) { s.holding = false; s.bar = 0; s.msg = 'Too heavy!'; s.msgT = 0.8; sfx('nope'); }
        }
        if (s.reveal && t - s.reveal > 0.55) win();
        grass(ctx);
        const ry = s.reveal ? 58 - (t - s.reveal) * 120 : 58 - (s.holding ? s.bar * 14 : 0);
        if (s.reveal) { R(ctx, 44, 60, 12, 4, '#2a5a24'); R(ctx, 48, 52, 4, 8, '#6fb04a'); R(ctx, 49, 50, 2, 12, '#a8d870'); txt(ctx, 'A rupee!', 50, 76, '#ffe27a'); }
        // the rock
        disc(ctx, 50, ry, 13, '#7a7a8a'); disc(ctx, 47, ry - 3, 8, '#8a8aa0'); R(ctx, 42, ry - 9, 4, 2, '#a8a8c0');
        R(ctx, 40, ry + 6, 6, 2, '#3d7a34');
        put(ctx, spr(s.holding || s.reveal ? ELF_UP : ELF), 50, 86, 1.2);
        // meter with the green zone
        R(ctx, 86, 20, 6, 60, '#1a1220');
        R(ctx, 87, 80 - 60 / 1.15, 4, 60 * 0.3 / 1.15, '#4a8a3a');
        R(ctx, 87, 80 - 60 * Math.min(1.15, s.bar) / 1.15, 4, 60 * Math.min(1.15, s.bar) / 1.15, s.bar > 1 ? '#d0463c' : '#ffe27a');
        if (s.msgT > 0) txt(ctx, s.msg, 50, 20, '#d0463c', 11);
        txt(ctx, 'Hold, let go in the green', 46, 96, '#c9ad7f');
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        b.down({ x: 50, y: 55 });
        await b.until(() => s.holding || s.reveal, 400);
        await b.until(() => s.bar >= 0.8 || !s.holding);
        b.up({ x: 50, y: 55 });
        await b.wait(80);
      }
    },
  },

  // 6. One rock wiggles: that's where the Korok is hiding.
  {
    id: 'fz-korok', cmd: 'Find the Korok!', theme: 'funtendo', time: 5,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const rocks = spots(5, 22, 14, 20);
      const s = expose({ rocks, korok: rnd(5), wig: 0, next: 0.5 + Math.random() * 0.5, found: 0, now: 0 });
      tapper(stage, e => {
        if (s.found) return;
        const p = pos(e);
        const i = rocks.findIndex(r => Math.hypot(p.x - r.x, p.y - r.y) < 11);
        if (i < 0) return;
        if (i === s.korok) { s.found = s.now || 0.001; sfx('ring'); } else { sfx('nope'); lose(); }
      });
      frame((dt, t) => {
        s.now = t;
        if (!s.found && t >= s.next) { s.wig = 0.55 / Math.sqrt(speed); s.next = t + 0.9 + Math.random() * 0.6; sfx('tap'); }
        s.wig -= dt;
        if (s.found && t - s.found > 0.6) win();
        grass(ctx, '#5a8a4a', '#4a7a3a');
        rocks.forEach((r, i) => {
          const wob = i === s.korok && s.wig > 0 ? Math.sin(t * 60) * 1.5 : 0;
          if (s.found && i === s.korok) {
            const up = Math.min(1, (t - s.found) / 0.3);
            put(ctx, spr(KOROK), r.x, r.y - up * 8, 1.6);
            disc(ctx, r.x + 12, r.y + 2, 6, '#7a7a8a');
            txt(ctx, 'Yahaha!', r.x, r.y - 20, '#ffe27a', 10);
          } else {
            disc(ctx, r.x + wob, r.y, 7, '#7a7a8a'); disc(ctx, r.x - 2 + wob, r.y - 2, 4, '#8a8aa0'); R(ctx, r.x - 5 + wob, r.y + 4, 10, 2, '#4a6a3a');
          }
        });
        txt(ctx, 'Tap the rock that wiggles', 50, 94, '#fff4e0');
      });
    },
    async solve(b, s) {
      await b.until(() => s.wig > 0);
      const r = s.rocks[s.korok];
      await b.tap({ x: r.x, y: r.y });
    },
  },

  // 7. Play the song on the ocarina.
  {
    id: 'fz-ocarina', cmd: 'Play the song!', theme: 'funtendo', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const NOTES = [{ c: '#4f8fd0', s: 'A' }, { c: '#ffe27a', s: '▼' }, { c: '#ffe27a', s: '►' }, { c: '#ffe27a', s: '◄' }, { c: '#ffe27a', s: '▲' }];
      const len = speed > 1.4 ? 5 : 4;
      const song = [];
      while (song.length < len) { const k = rnd(5); if (k !== song[song.length - 1]) song.push(k); }
      const btn = k => ({ x: 14 + k * 18, y: 80 });
      const s = expose({ song, i: 0, btn, done: 0, now: 0, flash: -1, ft: 0 });
      tapper(stage, e => {
        if (s.done) return;
        const p = pos(e);
        const k = [0, 1, 2, 3, 4].find(j => Math.hypot(p.x - btn(j).x, p.y - btn(j).y) < 10);
        if (k == null) return;
        s.flash = k; s.ft = 0.2;
        if (k === song[s.i]) { s.i++; sfx('peg', s.i); if (s.i >= song.length) { s.done = s.now || 0.001; sfx('ring'); } }
        else { sfx('nope'); lose(); }
      });
      frame((dt, t) => {
        s.now = t; s.ft -= dt;
        if (s.done && t - s.done > 0.4) win();
        R(ctx, 0, 0, 100, 100, '#1a2440');
        // staff
        for (let i = 0; i < 5; i++) R(ctx, 8, 18 + i * 5, 84, 1, '#4a5a8a');
        song.forEach((k, i) => {
          const x = 20 + i * 15, y = 22 + (k * 3) % 14;
          const played = i < s.i;
          disc(ctx, x, y, 4, played ? '#6fb04a' : NOTES[k].c);
          txt(ctx, NOTES[k].s, x, y + 0.5, '#1a1220', 7);
          if (i === s.i) R(ctx, x - 4, 46, 9, 2, '#fff4e0');
        });
        // ocarina
        disc(ctx, 50, 60, 6, '#4f8fd0'); R(ctx, 54, 58, 6, 3, '#4f8fd0'); R(ctx, 48, 58, 2, 2, '#1a1220');
        for (let k = 0; k < 5; k++) {
          const b2 = btn(k);
          disc(ctx, b2.x, b2.y, 7, s.flash === k && s.ft > 0 ? '#fff4e0' : NOTES[k].c);
          txt(ctx, NOTES[k].s, b2.x, b2.y + 0.5, '#1a1220', 8);
        }
        if (s.done) txt(ctx, '♪ Song learned! ♪', 50, 92, '#ffe27a');
        else txt(ctx, 'Tap the notes in order', 50, 94, '#c9ad7f');
      });
    },
    async solve(b, s) { for (const k of s.song) { if (b.over()) return; await b.tap(s.btn(k)); await b.wait(30); } },
  },

  // 8. Raise the shield toward the incoming rock.
  {
    id: 'fz-deflect', cmd: 'Deflect it!', theme: 'funtendo', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const H = { x: 50, y: 62 };
      const SRC = { left: { x: 9, y: 62 }, top: { x: 50, y: 12 }, right: { x: 91, y: 62 } };
      const s = expose({ rock: null, next: 0.7, shield: 'top', shieldT: 0, count: 0, need: 3, H });
      const v = 40 * speed;
      tapper(stage, e => {
        const p = pos(e);
        s.shield = p.y < 40 ? 'top' : p.x < 50 ? 'left' : 'right';
        s.shieldT = 0.45; sfx('select');
      });
      frame((dt, t) => {
        s.shieldT -= dt;
        if (!s.rock && t >= s.next && s.count < s.need) {
          const side = pick(['left', 'top', 'right']);
          s.rock = { x: SRC[side].x, y: SRC[side].y, side, back: false };
          sfx('swap');
        }
        const r = s.rock;
        if (r) {
          const tgt = r.back ? SRC[r.side] : H;
          const d = Math.hypot(tgt.x - r.x, tgt.y - r.y);
          const sp = (r.back ? 90 : v) * dt;
          r.x += ((tgt.x - r.x) / d) * Math.min(sp, d); r.y += ((tgt.y - r.y) / d) * Math.min(sp, d);
          if (!r.back) {
            const dh = Math.hypot(r.x - H.x, r.y - H.y);
            if (dh <= 12 && s.shieldT > 0 && s.shield === r.side) { r.back = true; s.count++; sfx('ring'); if (s.count >= s.need) win(); }
            else if (dh <= 5) { sfx('nope'); lose(); }
          } else if (d < 2) { s.rock = null; s.next = t + 0.3 / speed; }
        }
        R(ctx, 0, 0, 100, 100, '#c8a868');
        ctx.fillStyle = '#b89858'; for (let i = 0; i < 40; i++) ctx.fillRect((i * 37) % 99, (i * 53) % 99, 2, 1);
        put(ctx, spr(OCTO), SRC.left.x, SRC.left.y, 1.3);
        put(ctx, spr(OCTO), SRC.top.x, SRC.top.y, 1.3);
        put(ctx, spr(OCTO), SRC.right.x, SRC.right.y, 1.3, true);
        put(ctx, spr(ELF), H.x, H.y, 1.2);
        if (s.shieldT > 0) {
          if (s.shield === 'top') R(ctx, H.x - 6, H.y - 12, 12, 3, '#4f8fd0');
          else R(ctx, s.shield === 'left' ? H.x - 10 : H.x + 7, H.y - 6, 3, 12, '#4f8fd0');
        }
        if (r) { disc(ctx, r.x, r.y, 2, r.back ? '#ffe27a' : '#6b3d22'); }
        for (let i = 0; i < s.need; i++) R(ctx, 40 + i * 7, 92, 5, 4, i < s.count ? '#ffe27a' : '#6b3d22');
        txt(ctx, 'Tap toward the rock!', 50, 85, '#1a1220', 8);
      });
    },
    async solve(b, s) {
      const P = { left: { x: 15, y: 62 }, right: { x: 85, y: 62 }, top: { x: 50, y: 22 } };
      while (!b.over()) {
        const r = s.rock;
        if (r && !r.back && Math.hypot(r.x - s.H.x, r.y - s.H.y) < 24 && !(s.shieldT > 0.1 && s.shield === r.side)) await b.tap(P[r.side]);
        else await b.wait(10);
      }
    },
  },

  // 9. Drop the bomb by the cracked part of the wall.
  {
    id: 'fz-bomb', cmd: 'Bomb the wall!', theme: 'funtendo', time: 5,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const SEG = [14, 38, 62, 86];
      const s = expose({ SEG, crack: rnd(4), bx: 50, by: 84, held: false, placed: null, fuse: 0, boom: 0, ok: false, now: 0 });
      follow(stage, pos, (p, ph) => {
        if (s.placed) return;
        if (ph === 'down') s.held = Math.hypot(p.x - s.bx, p.y - s.by) < 15;
        if (s.held && (ph === 'down' || ph === 'move')) { s.bx = clamp(p.x, 5, 95); s.by = clamp(p.y, 40, 95); }
        if (ph === 'up' && s.held) {
          s.held = false;
          if (s.by < 52) { s.placed = { x: s.bx, y: s.by }; s.fuse = 0.6; sfx('select'); } else { s.bx = 50; s.by = 84; }
        }
      });
      frame((dt, t) => {
        s.now = t;
        if (s.placed && !s.boom) {
          s.fuse -= dt;
          if (s.fuse <= 0) { s.boom = t; s.ok = Math.abs(s.placed.x - SEG[s.crack]) < 12; sfx('boom'); }
        }
        if (s.boom && t - s.boom > 0.45) s.ok ? win() : lose();
        R(ctx, 0, 0, 100, 100, '#3a3048');
        // stone wall
        R(ctx, 0, 0, 100, 42, '#6a6a80');
        ctx.fillStyle = '#5a5a70';
        for (let y = 0; y < 42; y += 7) { ctx.fillRect(0, y, 100, 1); for (let x = (y / 7) % 2 ? 0 : 6; x < 100; x += 12) ctx.fillRect(x, y, 1, 7); }
        const cx = SEG[s.crack];
        if (s.boom && s.ok) { disc(ctx, cx, 34, 10, '#140e18'); R(ctx, cx - 10, 34, 21, 8, '#140e18'); }
        else {
          ctx.fillStyle = speed > 1.6 ? '#4a4a5c' : '#2a2a3a';
          const zig = [[0, 18], [2, 22], [-1, 26], [3, 30], [0, 34], [2, 38], [-2, 41]];
          zig.forEach(([dx, y]) => ctx.fillRect(cx + dx, y, 2, 4));
          ctx.fillRect(cx + 4, 26, 4, 1); ctx.fillRect(cx - 6, 33, 5, 1);
        }
        R(ctx, 0, 42, 100, 2, '#2a2438');
        put(ctx, spr(ELF), 30, 86, 1.1);
        if (!s.boom) {
          const bx = s.placed ? s.placed.x : s.bx, by = s.placed ? s.placed.y : s.by;
          disc(ctx, bx, by, 5, '#2c3a7a'); R(ctx, bx - 2, by - 3, 2, 2, '#9fb4d0'); R(ctx, bx, by - 8, 1, 3, '#c79a5a');
          if (s.placed && Math.floor(t * 12) % 2) R(ctx, bx - 1, by - 10, 3, 2, '#ffe27a');
        } else if (t - s.boom < 0.35) {
          const r = 4 + (t - s.boom) * 50;
          disc(ctx, s.placed.x, s.placed.y, Math.round(r), '#ffe27a'); disc(ctx, s.placed.x, s.placed.y, Math.round(r * 0.6), '#fff4e0');
        }
        if (s.boom && s.ok) txt(ctx, 'A secret passage!', 50, 60, '#ffe27a', 10);
        txt(ctx, 'Drag the bomb to the crack', 50, 96, '#c9ad7f', 8);
      });
    },
    async solve(b, s) { await b.drag({ x: s.bx, y: s.by }, { x: s.SEG[s.crack], y: 47 }, 300, 10); },
  },

  // 10. Light both torches with the fire rod.
  {
    id: 'fz-torch', cmd: 'Light both torches!', theme: 'funtendo', time: 6,
    setup({ stage, win, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const O = { x: 50, y: 80 };
      const torches = [{ x: 12 + rnd(22), y: 16 + rnd(24), lit: false }, { x: 66 + rnd(22), y: 16 + rnd(24), lit: false }];
      const s = expose({ a: -1.2, dir: 1, flame: null, torches, O, done: 0, now: 0 });
      tapper(stage, () => {
        if (s.flame || s.done) return;
        s.flame = { x: O.x, y: O.y, vx: Math.sin(s.a) * 130, vy: -Math.cos(s.a) * 130 };
        sfx('swap');
      });
      frame((dt, t) => {
        s.now = t;
        s.a += s.dir * 1.2 * speed * dt;
        if (s.a > 1.25) { s.a = 1.25; s.dir = -1; } else if (s.a < -1.25) { s.a = -1.25; s.dir = 1; }
        const f = s.flame;
        if (f) {
          f.x += f.vx * dt; f.y += f.vy * dt;
          for (const tc of torches) if (!tc.lit && Math.hypot(f.x - tc.x, f.y - tc.y) < 7) { tc.lit = true; s.flame = null; sfx('ring'); if (torches.every(q => q.lit)) s.done = t; }
          if (s.flame && (f.x < -5 || f.x > 105 || f.y < -5)) s.flame = null;
        }
        if (s.done && t - s.done > 0.35) win();
        dungeon(ctx, '#241e34', '#1c1830');
        for (const tc of torches) {
          R(ctx, tc.x - 3, tc.y, 6, 10, '#6a6a80'); R(ctx, tc.x - 4, tc.y - 2, 8, 3, '#8a8aa0');
          if (tc.lit) { const fl = Math.sin(t * 20 + tc.x) > 0 ? 1 : 0; R(ctx, tc.x - 2, tc.y - 7 - fl, 4, 5 + fl, '#f39a3a'); R(ctx, tc.x - 1, tc.y - 5, 2, 3, '#ffe27a'); }
        }
        // aim line
        ctx.fillStyle = 'rgba(255,226,122,0.6)';
        for (let i = 6; i < 22; i += 3) ctx.fillRect(O.x + Math.sin(s.a) * i, O.y - Math.cos(s.a) * i, 1, 1);
        put(ctx, spr(ELF), O.x, O.y + 8, 1.1);
        R(ctx, O.x + 4, O.y, 2, 8, '#d0463c');
        if (f) { disc(ctx, f.x, f.y, 2, '#f39a3a'); R(ctx, f.x - 1, f.y - 1, 2, 2, '#ffe27a'); }
        txt(ctx, `${torches.filter(q => q.lit).length}/2 lit · tap to shoot fire`, 50, 96, '#c9ad7f', 8);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const tc = s.torches.find(q => !q.lit);
        if (!tc) return;
        const want = Math.atan2(tc.x - s.O.x, s.O.y - tc.y);
        await b.until(() => Math.abs(s.a - want) < 0.05 && !s.flame);
        if (b.over()) return;
        await b.tap({ x: 50, y: 50 });
        await b.until(() => !s.flame);
      }
    },
  },

  // 11. Fire the hookshot when the post lines up.
  {
    id: 'fz-hookshot', cmd: 'Hookshot!', theme: 'funtendo', time: 5,
    setup({ stage, win, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const v = 30 * speed;
      const s = expose({ px: 18 + rnd(64), dir: pick([-1, 1]), v, hook: null, zip: 0, now: 0, HS: 220 });
      tapper(stage, () => { if (s.hook || s.zip) return; s.hook = { y: 78, out: true }; sfx('swap'); });
      frame((dt, t) => {
        s.now = t;
        if (!s.zip) {
          s.px += s.dir * v * dt;
          if (s.px > 85) { s.px = 85; s.dir = -1; } else if (s.px < 15) { s.px = 15; s.dir = 1; }
        }
        const hk = s.hook;
        if (hk && !s.zip) {
          if (hk.out) {
            hk.y -= s.HS * dt;
            if (hk.y <= 24) { if (Math.abs(s.px - 50) < 7) { s.zip = t; hk.y = 24; sfx('ring'); } else { hk.out = false; sfx('land'); } }
          } else { hk.y += s.HS * dt; if (hk.y >= 78) s.hook = null; }
        }
        if (s.zip && t - s.zip > 0.45) win();
        R(ctx, 0, 0, 100, 100, '#140e18');
        R(ctx, 0, 0, 100, 16, '#6a6a80'); R(ctx, 0, 14, 100, 2, '#4a4a5c');
        R(ctx, 0, 82, 100, 18, '#6a6a80'); R(ctx, 0, 82, 100, 2, '#8a8aa0');
        ctx.fillStyle = '#241c30'; for (let i = 0; i < 20; i++) ctx.fillRect((i * 37) % 99, 20 + ((i * 23) % 60), 1, 3);
        // the rail and target post
        R(ctx, 10, 18, 80, 2, '#4a3a2a');
        R(ctx, s.px - 3, 14, 6, 12, '#a0663a'); R(ctx, s.px - 4, 13, 8, 3, '#c79a5a');
        const heroY = s.zip ? 86 - Math.min(1, (t - s.zip) / 0.4) * 56 : 86;
        if (hk) { R(ctx, 50, hk.y, 1, heroY - 6 - hk.y, '#c9ad7f'); R(ctx, 48, hk.y - 2, 5, 3, '#d8d8e8'); }
        put(ctx, spr(ELF), 50, heroY, 1.1);
        ctx.fillStyle = 'rgba(255,226,122,0.35)'; for (let y = 28; y < 78; y += 4) ctx.fillRect(50, y, 1, 1);
        txt(ctx, 'Tap when the post lines up', 50, 94, '#fff4e0', 8);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        if (!s.hook && !s.zip) {
          const T = (78 - 24) / s.HS;
          const pred = reflect(s.px + s.dir * s.v * T, 15, 85);
          if (Math.abs(pred - 50) < 2.5) { await b.tap({ x: 50, y: 50 }); continue; }
        }
        await b.wait(5);
      }
    },
  },

  // 12. Catch the fairy in a bottle.
  {
    id: 'fz-fairy', cmd: 'Bottle the fairy!', theme: 'funtendo', time: 5,
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ fx: 50, fy: 35, tx: 30, ty: 30, bx: 50, by: 84, caught: 0, done: 0 });
      follow(stage, pos, (p, ph) => { if (ph !== 'up' && !s.done) { s.bx = clamp(p.x, 6, 94); s.by = clamp(p.y, 8, 94); } });
      frame((dt, t) => {
        if (!s.done) {
          if (Math.hypot(s.tx - s.fx, s.ty - s.fy) < 3) { s.tx = 12 + Math.random() * 76; s.ty = 12 + Math.random() * 60; }
          const d = Math.hypot(s.tx - s.fx, s.ty - s.fy) || 1, sp = 40 * speed * dt;
          s.fx += ((s.tx - s.fx) / d) * sp + Math.sin(t * 17) * 0.3; s.fy += ((s.ty - s.fy) / d) * sp + Math.cos(t * 13) * 0.3;
          if (Math.hypot(s.bx - s.fx, s.by - 3 - s.fy) < 9) { s.caught += dt; if (s.caught >= 0.35) { s.done = t; sfx('ring'); } }
        } else if (t - s.done > 0.4) win();
        grass(ctx, '#2a5a44', '#24503c');
        disc(ctx, 30, 80, 14, '#2c5a9a'); disc(ctx, 30, 80, 11, '#4f8fd0');
        // fairy
        if (!s.done) {
          const fl = Math.floor(t * 20) % 2;
          disc(ctx, s.fx, s.fy, 5, 'rgba(240,138,176,0.35)');
          R(ctx, s.fx - 4, s.fy - 3 - fl, 3, 3, '#fff4e0'); R(ctx, s.fx + 2, s.fy - 3 - fl, 3, 3, '#fff4e0');
          disc(ctx, s.fx, s.fy, 2, '#f08ab0'); R(ctx, s.fx, s.fy, 1, 1, '#ffffff');
        }
        // bottle
        const bx = s.bx, by = s.by;
        R(ctx, bx - 5, by - 6, 10, 12, 'rgba(159,211,242,0.5)'); R(ctx, bx - 5, by - 6, 1, 12, '#bfe6ff'); R(ctx, bx + 4, by - 6, 1, 12, '#bfe6ff'); R(ctx, bx - 5, by + 5, 10, 1, '#bfe6ff');
        R(ctx, bx - 2, by - 9, 4, 3, '#a0663a');
        if (s.done) { disc(ctx, bx, by, 3, '#f08ab0'); txt(ctx, 'Got a fairy!', 50, 20, '#ffe27a', 11); }
        bar(ctx, 25, 4, 50, s.caught / 0.35, '#f08ab0');
        txt(ctx, 'Drag the bottle onto the fairy', 50, 96, '#fff4e0', 8);
      });
    },
    async solve(b, s) {
      b.down({ x: s.bx, y: s.by });
      while (!b.over()) { b.move({ x: s.fx, y: s.fy + 3 }); await b.wait(16); }
      b.up({ x: s.bx, y: s.by });
    },
  },

  // 13. Don't anger the chickens. Too late: dodge the swarm.
  {
    id: 'fz-cucco', cmd: 'Dodge the Cuccos!', theme: 'funtendo', time: 5, timeoutWins: true,
    setup({ stage, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ hx: 50, hy: 60, birds: [], next: 0.45, hit: false });
      follow(stage, pos, (p, ph) => { if (ph !== 'up' && !s.hit) { s.hx = clamp(p.x, 8, 92); s.hy = clamp(p.y, 15, 92); } });
      frame((dt, t) => {
        if (t >= s.next && !s.hit) {
          s.next = t + 0.45 / speed;
          const left = Math.random() < 0.5;
          const y = Math.random() < 0.5 ? clamp(s.hy + (Math.random() - 0.5) * 18, 14, 92) : 14 + Math.random() * 78;
          s.birds.push({ x: left ? -6 : 106, y, vx: (45 + Math.random() * 25) * speed * (left ? 1 : -1) });
          sfx('blip');
        }
        for (const c of s.birds) {
          c.x += c.vx * dt;
          if (!s.hit && Math.hypot(c.x - s.hx, c.y - s.hy) < 7) { s.hit = true; sfx('nope'); lose(); }
        }
        s.birds = s.birds.filter(c => c.x > -12 && c.x < 112);
        grass(ctx, '#6a9a4a', '#5a8a3a');
        R(ctx, 0, 8, 100, 2, '#a0663a'); for (let x = 2; x < 100; x += 10) R(ctx, x, 4, 2, 8, '#a0663a');
        put(ctx, spr(ELF), s.hx, s.hy, 1.1);
        for (const c of s.birds) put(ctx, spr(CUCCO), c.x, c.y + Math.sin(t * 20 + c.x) * 1, 1.3, c.vx < 0);
        txt(ctx, 'Drag to dodge!', 50, 96, '#1a1220', 8);
      });
    },
    async solve(b, s) {
      b.down({ x: s.hx, y: s.hy });
      while (!b.over()) {
        let best = { x: s.hx, y: s.hy }, bs = -1;
        for (let x = 12; x <= 88; x += 8) for (let y = 18; y <= 90; y += 6) {
          let m = 99;
          for (const c of s.birds) for (const k of [0, 0.15, 0.3, 0.45]) m = Math.min(m, Math.hypot(c.x + c.vx * k - x, c.y - y));
          const sc = m - Math.hypot(x - s.hx, y - s.hy) * 0.02;
          if (sc > bs) { bs = sc; best = { x, y }; }
        }
        b.move(best);
        await b.wait(16);
      }
      b.up({ x: s.hx, y: s.hy });
    },
  },

  // 14. Push the block onto the switch.
  {
    id: 'fz-block', cmd: 'Push the block!', theme: 'funtendo', time: 6,
    setup({ stage, win, sfx, frame, pos, expose }) {
      const ctx = scene(stage);
      const G = 5, CELL = 14, OX = 15, OY = 16;
      const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      let rocks, block, goal, path;
      const free = (x, y) => x >= 0 && y >= 0 && x < G && y < G && !rocks.some(r => r[0] === x && r[1] === y);
      function bfs(from) {
        const seen = new Map([[from.join(), []]]), q = [from];
        while (q.length) {
          const c = q.shift(), p = seen.get(c.join());
          if (c[0] === goal[0] && c[1] === goal[1]) return p;
          for (const [d, [dx, dy]] of Object.entries(DIRS)) {
            const n = [c[0] + dx, c[1] + dy];
            if (free(n[0], n[1]) && !seen.has(n.join())) { seen.set(n.join(), [...p, d]); q.push(n); }
          }
        }
        return null;
      }
      for (let tries = 0; tries < 200; tries++) {
        rocks = Array.from({ length: 3 }, () => [rnd(G), rnd(G)]);
        block = [rnd(G), rnd(G)]; goal = [rnd(G), rnd(G)];
        if (!free(...block) || !free(...goal)) continue;
        path = bfs(block);
        if (path && path.length >= 2 && path.length <= 4) break;
      }
      const s = expose({ block, goal, path, done: 0, now: 0, bump: 0 });
      swipe(stage, pos, dir => {
        if (s.done) return;
        const [dx, dy] = DIRS[dir], nx = block[0] + dx, ny = block[1] + dy;
        if (!free(nx, ny)) { s.bump = 0.15; sfx('land'); return; }
        block[0] = nx; block[1] = ny; sfx('swap');
        if (nx === goal[0] && ny === goal[1]) { s.done = s.now || 0.001; sfx('ring'); }
      });
      frame((dt, t) => {
        s.now = t; s.bump -= dt;
        if (s.done && t - s.done > 0.35) win();
        dungeon(ctx, '#3a3048', '#30283e');
        R(ctx, OX - 3, OY - 3, G * CELL + 6, G * CELL + 6, '#5a4a6a');
        for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) R(ctx, OX + x * CELL, OY + y * CELL, CELL - 1, CELL - 1, (x + y) % 2 ? '#4a3e5a' : '#463a56');
        const gx = OX + goal[0] * CELL, gy = OY + goal[1] * CELL;
        R(ctx, gx + 2, gy + 2, CELL - 5, CELL - 5, s.done ? '#ffe27a' : '#4f8fd0'); R(ctx, gx + 5, gy + 5, 3, 3, '#fff4e0');
        for (const [x, y] of rocks) { disc(ctx, OX + x * CELL + 6, OY + y * CELL + 6, 5, '#7a7a8a'); R(ctx, OX + x * CELL + 3, OY + y * CELL + 3, 3, 2, '#a8a8c0'); }
        const k = s.bump > 0 ? (Math.random() - 0.5) * 2 : 0;
        const bxp = OX + block[0] * CELL + k, byp = OY + block[1] * CELL;
        R(ctx, bxp + 1, byp + 1, CELL - 3, CELL - 3, '#8a6aa8'); R(ctx, bxp + 1, byp + 1, CELL - 3, 2, '#a88ac8');
        R(ctx, bxp + 4, byp + 5, 2, 2, '#1a1220'); R(ctx, bxp + 8, byp + 5, 2, 2, '#1a1220'); R(ctx, bxp + 5, byp + 9, 4, 1, '#1a1220');
        txt(ctx, s.done ? 'Click! The door opens.' : 'Swipe to push the block onto the switch', 50, 93, s.done ? '#ffe27a' : '#c9ad7f', 7);
      });
    },
    async solve(b, s) { for (const d of s.path) { if (b.over()) return; await b.swipe(d); await b.wait(60); } },
  },

  // 15. Whack the Deku Scrub as it pops up.
  {
    id: 'fz-deku', cmd: 'Stun the scrub!', theme: 'funtendo', time: 5,
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const holes = [{ x: 22, y: 62 }, { x: 50, y: 44 }, { x: 78, y: 62 }];
      const s = expose({ holes, up: -1, ut: 0, down: 0.35, hits: 0, need: 3, last: -1, stun: 0 });
      tapper(stage, e => {
        const p = pos(e);
        if (s.up < 0) return;
        const hl = holes[s.up];
        if (Math.hypot(p.x - hl.x, p.y - (hl.y - 4)) < 12) {
          s.hits++; s.stun = 0.4; s.last = s.up; s.up = -1; s.down = 0.35 / speed; sfx('ring');
          if (s.hits >= s.need) win();
        }
      });
      frame((dt, t) => {
        s.stun -= dt;
        if (s.up < 0) { s.down -= dt; if (s.down <= 0) { let k; do k = rnd(3); while (k === s.last); s.up = k; s.last = k; s.ut = 0.95 / Math.pow(speed, 0.6); sfx('pop'); } }
        else { s.ut -= dt; if (s.ut <= 0) { s.up = -1; s.down = 0.3 / speed; } }
        grass(ctx, '#3a6a34', '#30602c');
        holes.forEach((hl, i) => {
          R(ctx, hl.x - 9, hl.y - 1, 18, 5, '#1a1220'); R(ctx, hl.x - 11, hl.y + 3, 22, 3, '#2a5a24');
          if (i === s.up) {
            R(ctx, hl.x - 6, hl.y - 12, 12, 11, '#a0663a'); R(ctx, hl.x - 7, hl.y - 14, 14, 3, '#3d7a34'); R(ctx, hl.x - 3, hl.y - 17, 6, 3, '#6fb04a');
            R(ctx, hl.x - 4, hl.y - 9, 2, 2, '#ffe27a'); R(ctx, hl.x + 2, hl.y - 9, 2, 2, '#ffe27a');
            R(ctx, hl.x - 2, hl.y - 6, 4, 3, '#6b3d22'); R(ctx, hl.x - 1, hl.y - 5, 2, 1, '#1a1220');
          }
          if (s.stun > 0 && i === s.last) { ctx.fillStyle = '#ffe27a'; for (let j = 0; j < 3; j++) ctx.fillRect(hl.x + Math.cos(t * 10 + j * 2) * 6, hl.y - 14 + Math.sin(t * 10 + j * 2) * 2, 2, 2); }
        });
        put(ctx, spr(ELF), 50, 86, 1.1);
        for (let i = 0; i < s.need; i++) R(ctx, 40 + i * 7, 6, 5, 4, i < s.hits ? '#ffe27a' : '#2a5a24');
        txt(ctx, 'Tap the scrub when it pops up!', 50, 96, '#fff4e0', 8);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        if (s.up >= 0) { const hl = s.holes[s.up]; await b.tap({ x: hl.x, y: hl.y - 6 }); }
        else await b.wait(10);
      }
    },
  },

  // 16. Draw a circle around the hero for a spin attack.
  {
    id: 'fz-spin', cmd: 'Spin attack!', theme: 'funtendo', time: 5,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const C = { x: 50, y: 55 };
      const n = 5 + (speed > 1.5 ? 1 : 0);
      const foes = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + Math.random() * 0.4; return { a, r: 36, out: 0 }; });
      const s = expose({ acc: 0, last: null, spun: 0, now: 0, C });
      const angle = p => Math.atan2(p.y - C.y, p.x - C.x);
      follow(stage, pos, (p, ph) => {
        if (s.spun) return;
        if (ph === 'up') { s.acc = 0; s.last = null; return; }
        if (Math.hypot(p.x - C.x, p.y - C.y) < 8) return;
        const a = angle(p);
        if (s.last != null) {
          let da = a - s.last;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          s.acc += da;
          if (Math.abs(s.acc) >= Math.PI * 2 * 0.85) { s.spun = s.now || 0.001; sfx('boom'); }
        }
        s.last = a;
      });
      frame((dt, t) => {
        s.now = t;
        for (const f of foes) {
          if (s.spun) { f.out += dt * 120; continue; }
          f.r -= 4 * speed * dt;
          if (f.r < 10) { sfx('nope'); lose(); }
        }
        if (s.spun && t - s.spun > 0.5) win();
        grass(ctx, '#4a7a3a', '#3e6e32');
        for (const f of foes) put(ctx, spr(MOBLIN), C.x + Math.cos(f.a) * (f.r + f.out), C.y + Math.sin(f.a) * (f.r + f.out), 1.3);
        // progress arc
        const frac = Math.min(1, Math.abs(s.acc) / (Math.PI * 2 * 0.85));
        ctx.fillStyle = s.spun ? '#bfe6ff' : 'rgba(255,226,122,0.8)';
        const steps = Math.floor((s.spun ? 1 : frac) * 40);
        for (let i = 0; i < steps; i++) { const a = (i / 40) * Math.PI * 2 * Math.sign(s.acc || 1); ctx.fillRect(C.x + Math.cos(a) * 16, C.y + Math.sin(a) * 16, 2, 2); }
        put(ctx, spr(ELF), C.x, C.y, 1.2);
        if (s.spun) { const a = t * 30; R(ctx, C.x + Math.cos(a) * 10, C.y + Math.sin(a) * 10, 3, 3, '#d8d8e8'); }
        txt(ctx, 'Draw a circle around you!', 50, 95, '#fff4e0', 8);
      });
    },
    async solve(b, s) {
      const P = a => ({ x: s.C.x + Math.cos(a) * 24, y: s.C.y + Math.sin(a) * 24 });
      while (!b.over()) {
        b.down(P(0));
        for (let i = 1; i <= 20; i++) { await b.wait(14); b.move(P((i / 20) * Math.PI * 2.2)); }
        b.up(P(Math.PI * 2.2));
        await b.wait(40);
      }
    },
  },

  // 17. Slingshot the sliding eye switch.
  {
    id: 'fz-slingshot', cmd: 'Hit the eye switch!', theme: 'funtendo', time: 6,
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const v = 35 * speed;
      const s = expose({ ex: 20 + rnd(60), edir: pick([-1, 1]), v, aim: 50, pellet: null, hit: 0, now: 0, PS: 170 });
      follow(stage, pos, (p, ph) => {
        if (s.hit) return;
        s.aim = clamp(p.x, 10, 90);
        if (ph === 'up' && !s.pellet) { s.pellet = { x: s.aim, y: 84 }; sfx('swap'); }
      });
      frame((dt, t) => {
        s.now = t;
        if (!s.hit) { s.ex += s.edir * v * dt; if (s.ex > 85) { s.ex = 85; s.edir = -1; } else if (s.ex < 15) { s.ex = 15; s.edir = 1; } }
        const pl = s.pellet;
        if (pl && !s.hit) {
          pl.y -= s.PS * dt;
          if (pl.y <= 20) { if (Math.abs(pl.x - s.ex) < 6) { s.hit = t; sfx('ring'); } else { s.pellet = null; sfx('land'); } }
        }
        if (s.hit && t - s.hit > 0.4) win();
        R(ctx, 0, 0, 100, 100, '#3a3a2a');
        R(ctx, 0, 0, 100, 26, '#6a6a50'); ctx.fillStyle = '#5a5a40'; for (let x = 0; x < 100; x += 10) ctx.fillRect(x, 0, 1, 26);
        R(ctx, 8, 15, 84, 2, '#2a2a1a');
        // eye switch
        disc(ctx, s.ex, 16, 6, '#fff4e0');
        if (s.hit) R(ctx, s.ex - 6, 15, 12, 2, '#6b3d22'); else { disc(ctx, s.ex, 16, 3, '#d0463c'); R(ctx, s.ex - 1, 15, 2, 2, '#1a1220'); }
        ctx.fillStyle = 'rgba(255,244,224,0.3)'; for (let y = 24; y < 80; y += 4) ctx.fillRect(s.aim, y, 1, 1);
        // slingshot
        R(ctx, s.aim - 4, 82, 2, 6, '#a0663a'); R(ctx, s.aim + 2, 82, 2, 6, '#a0663a'); R(ctx, s.aim - 1, 86, 2, 8, '#6b3d22');
        if (pl && !s.hit) disc(ctx, pl.x, pl.y, 1, '#c79a5a');
        if (s.hit) txt(ctx, 'Ding! A door opens.', 50, 50, '#ffe27a', 10);
        txt(ctx, 'Drag to aim, let go to shoot', 50, 97, '#c9ad7f', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        if (!s.pellet) {
          const T = (84 - 20) / s.PS + 0.035;
          const x = reflect(s.ex + s.edir * s.v * T, 15, 85);
          await b.tap({ x, y: 70 });
        }
        await b.until(() => !s.pellet || s.hit, 2000);
        await b.wait(10);
      }
    },
  },

  // 18. Magical-girl twist: throw the tiara like a boomerang at the bats.
  {
    id: 'fz-tiara', cmd: 'Tiara boomerang!', theme: 'funtendo', time: 6,
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const G = { x: 50, y: 86 };
      const bats = Array.from({ length: 3 }, (_, i) => ({ bx: 20 + i * 30 + (Math.random() - 0.5) * 10, by: 18 + Math.random() * 30, ph: Math.random() * 6, dead: false }));
      const batPos = (bt, time) => ({ x: bt.bx + Math.sin(time * 1.3 * speed + bt.ph) * 12, y: bt.by + Math.cos(time * 1.7 * speed + bt.ph) * 6 });
      const s = expose({ tiara: null, bats, batPos, t: 0, G, TS: 140, done: 0 });
      tapper(stage, e => {
        if (s.tiara || s.done) return;
        const p = pos(e);
        s.tiara = { x: G.x, y: G.y - 8, tx: p.x, ty: p.y, back: false };
        sfx('swap');
      });
      frame((dt, t) => {
        s.t = t;
        const tr = s.tiara;
        if (tr) {
          const tx = tr.back ? G.x : tr.tx, ty = tr.back ? G.y - 8 : tr.ty;
          const d = Math.hypot(tx - tr.x, ty - tr.y), sp = s.TS * dt;
          if (d <= sp) { if (tr.back) s.tiara = null; else tr.back = true; }
          else { tr.x += ((tx - tr.x) / d) * sp; tr.y += ((ty - tr.y) / d) * sp; }
          for (const bt of bats) if (!bt.dead) { const p = batPos(bt, t); if (Math.hypot(p.x - tr.x, p.y - tr.y) < 7) { bt.dead = true; sfx('ring'); } }
          if (!s.done && bats.every(q => q.dead)) s.done = t;
        }
        if (s.done && t - s.done > 0.3) win();
        starsky(ctx, '#1a1438', 30, 9);
        disc(ctx, 16, 14, 6, '#ffe27a'); disc(ctx, 19, 12, 5, '#1a1438');
        for (const bt of bats) if (!bt.dead) { const p = batPos(bt, t); put(ctx, spr(Math.floor(t * 8 + bt.ph) % 2 ? KEESE : KEESE2), p.x, p.y, 1.4); }
        girl(ctx, 2, G.x, G.y, 2);
        if (s.tiara) {
          const a = t * 25;
          R(ctx, s.tiara.x - 4, s.tiara.y - 1, 8, 2, '#ffe27a');
          R(ctx, s.tiara.x - 1 + Math.cos(a) * 2, s.tiara.y - 2, 2, 2, '#d0463c');
          ctx.fillStyle = 'rgba(255,226,122,0.5)'; ctx.fillRect(s.tiara.x - Math.cos(a) * 5, s.tiara.y - Math.sin(a) * 5, 1, 1);
        } else { R(ctx, G.x - 4, G.y - 14, 8, 2, '#ffe27a'); R(ctx, G.x - 1, G.y - 15, 2, 2, '#d0463c'); }
        txt(ctx, `${bats.filter(q => !q.dead).length} bats left · tap to throw`, 50, 97, '#c9ad7f', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        if (!s.tiara) {
          const live = s.bats.filter(q => !q.dead);
          if (!live.length) return;
          const bt = live[0];
          let p = s.batPos(bt, s.t);
          for (let k = 0; k < 3; k++) { const T = Math.hypot(p.x - s.G.x, p.y - (s.G.y - 8)) / s.TS; p = s.batPos(bt, s.t + T); }
          await b.tap(p);
        }
        await b.until(() => !s.tiara, 3000);
        await b.wait(10);
      }
    },
  },

  // 19. Kirby inhales the enemy.
  {
    id: 'fz-inhale', cmd: 'Inhale!', theme: 'funtendo', time: 5,
    setup({ stage, win, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const K = { x: 20, y: 64 };
      const s = expose({ hold: false, breath: 1, gasp: 0, ex: 62 + rnd(24), edir: -1, gulp: 0, now: 0 });
      holdable(stage, () => { if (s.gasp > 0 || s.gulp) return; s.hold = true; sfx('swap'); }, () => { s.hold = false; });
      frame((dt, t) => {
        s.now = t; s.gasp -= dt;
        if (s.gulp) { if (t - s.gulp > 0.45) win(); }
        else if (s.hold) {
          s.breath -= dt / 1.6;
          if (s.breath <= 0) { s.hold = false; s.gasp = 0.6; sfx('land'); }
          if (s.ex - K.x < 50) { s.ex -= 60 * dt; if (s.ex <= 28) { s.gulp = t; s.hold = false; sfx('pop'); } }
        } else {
          s.breath = Math.min(1, s.breath + dt * 0.8);
          s.ex += s.edir * 15 * speed * dt;
          if (s.ex < 45) { s.ex = 45; s.edir = 1; } else if (s.ex > 90) { s.ex = 90; s.edir = -1; }
        }
        R(ctx, 0, 0, 100, 100, '#9fd3f2');
        disc(ctx, 20, 120, 50, '#6fb04a'); disc(ctx, 80, 125, 50, '#5aa040');
        R(ctx, 0, 72, 100, 28, '#6fb04a'); R(ctx, 0, 72, 100, 2, '#a8d870');
        R(ctx, 70, 20, 14, 4, '#fff4e0'); R(ctx, 74, 17, 8, 3, '#fff4e0');
        if (s.hold) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 6; i++) ctx.fillRect(K.x + 50 - ((t * 80 + i * 9) % 42), K.y - 6 + (i % 3) * 5, 4, 1); }
        if (!s.gulp) put(ctx, spr(WADDLE), s.ex, K.y + 2, 1.4, s.edir > 0);
        put(ctx, spr(s.hold ? KIRBY_SUCK : KIRBY), K.x, K.y, s.gulp ? 2 : 1.6);
        bar(ctx, 6, 6, 40, s.breath, s.gasp > 0 ? '#d0463c' : '#f08ab0');
        txt(ctx, s.gulp ? 'Gulp!' : 'Hold to inhale!', 50, 92, '#1a1220', 9);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        await b.until(() => s.ex < 66 && s.gasp <= 0 && s.breath > 0.7);
        if (b.over()) return;
        b.down({ x: 50, y: 50 });
        await b.until(() => s.gulp || !s.hold);
        b.up({ x: 50, y: 50 });
        await b.wait(30);
      }
    },
  },

  // 20. Ride the Warp Star through the sparkles.
  {
    id: 'fz-warpstar', cmd: 'Ride the Warp Star!', theme: 'funtendo', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const items = [];
      for (let i = 0; i < 8; i++) {
        items.push({ kind: 'spark', x: 72 + i * 44, y: 30 + Math.random() * 40, got: false });
        items.push({ kind: 'gordo', x: 94 + i * 44, y: pick([13, 87]) });
      }
      const s = expose({ ky: 50, ty: 50, items, got: 0, need: 3, done: false });
      const v = 40 * speed;
      follow(stage, pos, (p, ph) => { if (ph !== 'up') s.ty = clamp(p.y, 10, 90); });
      frame((dt, t) => {
        s.ky += (s.ty - s.ky) * Math.min(1, dt * 10);
        for (const it of items) {
          it.x -= v * dt;
          if (s.done) continue;
          if (it.kind === 'spark' && !it.got && Math.abs(it.x - 25) < 7 && Math.abs(it.y - s.ky) < 9) { it.got = true; s.got++; sfx('coin'); if (s.got >= s.need) { s.done = true; win(); } }
          if (it.kind === 'gordo' && Math.abs(it.x - 25) < 7 && Math.abs(it.y - s.ky) < 8) { s.done = true; sfx('nope'); lose(); }
        }
        R(ctx, 0, 0, 100, 100, '#2a1c58');
        R(ctx, 0, 50, 100, 50, '#3a2a6a');
        ctx.fillStyle = '#fff4e0';
        for (let i = 0; i < 30; i++) ctx.fillRect((((i * 37) - t * v * 0.3) % 100 + 100) % 100, (i * 29) % 100, 1, 1);
        for (const it of items) {
          if (it.x < -10 || it.x > 110) continue;
          if (it.kind === 'spark' && !it.got) { const tw = Math.floor(t * 10 + it.x) % 2; R(ctx, it.x - 1, it.y - 4 - tw, 2, 8 + tw * 2, '#ffe27a'); R(ctx, it.x - 4 - tw, it.y - 1, 8 + tw * 2, 2, '#ffe27a'); R(ctx, it.x - 1, it.y - 1, 2, 2, '#ffffff'); }
          if (it.kind === 'gordo') { disc(ctx, it.x, it.y, 5, '#3a3a4a'); for (let a = 0; a < 8; a++) R(ctx, it.x + Math.cos(a * 0.785) * 7 - 1, it.y + Math.sin(a * 0.785) * 7 - 1, 2, 2, '#d8d8e8'); R(ctx, it.x - 2, it.y - 1, 1, 2, '#fff4e0'); R(ctx, it.x + 1, it.y - 1, 1, 2, '#fff4e0'); }
        }
        // warp star under Kirby
        const sy = s.ky + 6;
        R(ctx, 17, sy - 1, 16, 3, '#ffe27a'); R(ctx, 23, sy - 4, 4, 9, '#ffe27a'); R(ctx, 12, sy + 1, 6, 1, 'rgba(255,226,122,0.6)');
        put(ctx, spr(KIRBY), 25, s.ky - 2, 1.2);
        txt(ctx, `${s.got}/${s.need} sparkles · drag up & down`, 50, 96, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      b.down({ x: 50, y: 50 });
      while (!b.over()) {
        const nx = s.items.find(it => it.kind === 'spark' && !it.got && it.x > 18);
        if (nx) b.move({ x: 50, y: nx.y });
        await b.wait(16);
      }
      b.up({ x: 50, y: 50 });
    },
  },

  // 21. Morph into a ball to roll through the low tunnel.
  {
    id: 'fz-morph', cmd: 'Morph ball!', theme: 'funtendo', time: 5,
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const v = 25 * speed;
      const s = expose({ x: 8, ball: 0, v, done: false });
      tapper(stage, () => { if (s.ball > 0 || s.done) return; s.ball = 1.3; sfx('select'); });
      frame((dt, t) => {
        if (!s.done) {
          s.x += v * dt; s.ball -= dt;
          if (s.ball <= 0 && s.x + 4 > 55 && s.x - 4 < 70) { s.done = true; sfx('nope'); lose(); }
          if (s.x > 78) { s.done = true; sfx('ring'); win(); }
        }
        R(ctx, 0, 0, 100, 100, '#0e2228');
        ctx.fillStyle = '#16343a'; for (let i = 0; i < 26; i++) ctx.fillRect((i * 37) % 99, (i * 23) % 70, 3, 2);
        R(ctx, 0, 80, 100, 20, '#4a3a5a'); R(ctx, 0, 80, 100, 2, '#7a5a8a');
        // tunnel: rock from the ceiling down to a low gap
        R(ctx, 55, 0, 15, 73, '#6a4a7a'); R(ctx, 55, 70, 15, 3, '#8a6aa8');
        ctx.fillStyle = '#5a3a6a'; for (let y = 4; y < 70; y += 8) ctx.fillRect(57 + (y % 3), y, 8, 2);
        if (s.ball > 0) put(ctx, spr(BALL), s.x, 77, 1.2);
        else put(ctx, spr(SAMUS), s.x, 72, 1.6);
        txt(ctx, 'Tap to morph!', 30, 92, '#9fd3f2', 9);
      });
    },
    async solve(b, s) {
      await b.until(() => s.x >= 47);
      await b.tap({ x: 50, y: 50 });
    },
  },

  // 22. Freeze the Metroid, then finish it with a missile.
  {
    id: 'fz-metroid', cmd: 'Freeze it!', theme: 'funtendo', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const S = { x: 16, y: 76 }, BTN = { x: 82, y: 88 };
      const s = expose({ mx: 85, my: 20, frozen: 0, missile: null, dead: 0, now: 0, BTN, beam: 0 });
      tapper(stage, e => {
        if (s.dead) return;
        const p = pos(e);
        if (s.frozen <= 0 && Math.hypot(p.x - s.mx, p.y - s.my) < 12) { s.frozen = 1.5; s.beam = 0.15; sfx('ring'); }
        else if (s.frozen > 0 && !s.missile && Math.hypot(p.x - BTN.x, p.y - BTN.y) < 12) { s.missile = { x: S.x + 6, y: S.y - 4 }; sfx('boom'); }
      });
      frame((dt, t) => {
        s.now = t; s.frozen -= dt; s.beam -= dt;
        if (!s.dead && s.frozen <= 0) {
          const d = Math.hypot(S.x - s.mx, S.y - s.my), sp = 18 * speed * dt;
          s.mx += ((S.x - s.mx) / d) * sp + Math.sin(t * 5) * 0.4; s.my += ((S.y - s.my) / d) * sp + Math.cos(t * 4) * 0.3;
          if (d < 11) { s.dead = -1; sfx('nope'); lose(); }
        }
        const m = s.missile;
        if (m && !s.dead) {
          const d = Math.hypot(s.mx - m.x, s.my - m.y), sp = 150 * dt;
          m.x += ((s.mx - m.x) / d) * Math.min(sp, d); m.y += ((s.my - m.y) / d) * Math.min(sp, d);
          if (d < 6) { if (s.frozen > 0) { s.dead = t; sfx('boom'); } else { s.missile = null; sfx('land'); } }
        }
        if (s.dead > 0 && t - s.dead > 0.45) win();
        R(ctx, 0, 0, 100, 100, '#140e24');
        ctx.fillStyle = '#241a3a'; for (let i = 0; i < 30; i++) ctx.fillRect((i * 37) % 99, (i * 23) % 99, 2, 2);
        R(ctx, 0, 84, 100, 16, '#3a2a4a');
        put(ctx, spr(SAMUS), S.x, S.y, 1.6);
        if (s.beam > 0) { ctx.fillStyle = '#bfe6ff'; for (let i = 0; i < 20; i++) ctx.fillRect(S.x + 6 + (s.mx - S.x - 6) * i / 20, S.y - 4 + (s.my - S.y + 4) * i / 20, 2, 2); }
        if (s.dead > 0) { ctx.fillStyle = '#bfe6ff'; for (let i = 0; i < 10; i++) ctx.fillRect(s.mx + Math.cos(i) * (t - s.dead) * 60, s.my + Math.sin(i) * (t - s.dead) * 60, 2, 2); }
        else {
          put(ctx, spr(METROID), s.mx, s.my, 1.5);
          if (s.frozen > 0) { ctx.fillStyle = 'rgba(159,211,242,0.6)'; ctx.fillRect(s.mx - 8, s.my - 6, 16, 11); }
        }
        if (m && !(s.dead > 0)) { R(ctx, m.x - 2, m.y - 1, 4, 2, '#d0463c'); R(ctx, m.x - 3, m.y - 1, 1, 2, '#fff4e0'); }
        if (s.frozen > 0 && !(s.dead > 0)) { R(ctx, BTN.x - 12, BTN.y - 5, 24, 10, '#d0463c'); txt(ctx, 'MISSILE', BTN.x, BTN.y, '#fff4e0', 7); }
        txt(ctx, s.frozen > 0 ? 'Now fire a missile!' : 'Tap the Metroid to freeze it', 42, 6, '#9fd3f2', 8);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        if (s.frozen <= 0.05) await b.tap({ x: s.mx, y: s.my });
        else if (!s.missile) await b.tap(s.BTN);
        else await b.wait(16);
      }
    },
  },

  // 23. Do a barrel roll to shrug off the lasers.
  {
    id: 'fz-roll', cmd: 'Do a barrel roll!', theme: 'funtendo', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const v = 70 * speed;
      const gap = Math.max(0.7, 1 / speed);
      const times = [0.6, 0.6 + gap, 0.6 + 2 * gap];
      const s = expose({ roll: 0, rdir: 1, lasers: [], spawned: 0, dodged: 0, need: 3, v, done: false });
      swipe(stage, pos, dir => { if (s.roll <= 0 && !s.done) { s.roll = 0.5; s.rdir = dir === 'left' ? -1 : 1; sfx('swap'); } });
      frame((dt, t) => {
        s.roll -= dt;
        if (s.spawned < times.length && t >= times[s.spawned]) { s.spawned++; s.lasers.push({ y: 18, crossed: false }); sfx('blip'); }
        for (const l of s.lasers) {
          const prev = l.y;
          l.y += v * dt;
          if (!l.crossed && prev < 72 && l.y >= 72) {
            l.crossed = true;
            if (s.roll > 0) { l.deflect = true; s.dodged++; sfx('ring'); if (s.dodged >= s.need && !s.done) { s.done = true; win(); } }
            else if (!s.done) { s.done = true; sfx('nope'); lose(); }
          }
        }
        R(ctx, 0, 0, 100, 100, '#0a0a24');
        ctx.fillStyle = '#4a4a8a'; for (let i = 0; i < 20; i++) ctx.fillRect((i * 37) % 99, ((i * 29) + t * 60) % 100, 1, 3);
        R(ctx, 0, 88, 100, 12, '#2a5a44'); ctx.fillStyle = '#3a7a5a'; for (let x = 0; x < 100; x += 8) ctx.fillRect((x + t * 40) % 100, 88, 1, 12);
        // enemy ship
        R(ctx, 40, 8, 20, 6, '#d0463c'); R(ctx, 46, 4, 8, 4, '#8e2a2a'); R(ctx, 49, 14, 2, 3, '#ffe27a');
        for (const l of s.lasers) if (l.y < 104) {
          if (l.deflect) { R(ctx, 50 + (l.y - 72) * 1.5 * s.rdir, l.y - 4, 2, 6, '#a8d870'); }
          else R(ctx, 49, l.y - 5, 2, 8, '#6fb04a');
        }
        const sq = s.roll > 0 ? Math.abs(Math.cos((0.5 - s.roll) * Math.PI * 4)) : 1;
        const sp = spr(ARWING);
        const aw = Math.max(2, Math.round(9 * 1.6 * sq));
        if (sp.i.complete) ctx.drawImage(sp.i, Math.round(50 - aw / 2), 70, aw, 11);
        if (s.roll > 0) { ctx.fillStyle = 'rgba(159,211,242,0.5)'; for (let i = 0; i < 6; i++) ctx.fillRect(50 + Math.cos(i + s.roll * 20) * 12, 75 + Math.sin(i + s.roll * 20) * 6, 2, 2); }
        for (let i = 0; i < s.need; i++) R(ctx, 40 + i * 7, 94, 5, 3, i < s.dodged ? '#ffe27a' : '#3a3a6a');
        txt(ctx, 'Swipe to roll!', 50, 30, '#9fd3f2', 8);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const l = s.lasers.find(q => !q.crossed);
        if (l && s.roll <= 0 && (72 - l.y) / s.v < 0.3) await b.swipe(pick(['left', 'right']), { x: 50, y: 50 }, 30);
        else await b.wait(5);
      }
    },
  },

  // 24. Blast between barrel cannons to the bananas.
  {
    id: 'fz-cannon', cmd: 'Blast off!', theme: 'funtendo', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const B = [{ x: 50, y: 84 }, { x: 22 + rnd(56), y: 48 + rnd(8) }];
      const goal = { x: 20 + rnd(60), y: 14 };
      const s = expose({ cur: 0, a: -1, dir: 1, fly: null, done: 0, now: 0, B, goal });
      tapper(stage, () => {
        if (s.fly || s.done) return;
        const o = B[s.cur];
        s.fly = { x: o.x, y: o.y, vx: Math.sin(s.a) * 140, vy: -Math.cos(s.a) * 140 };
        sfx('boom');
      });
      frame((dt, t) => {
        s.now = t;
        if (!s.fly && !s.done) { s.a += s.dir * 1.6 * speed * dt; if (s.a > 1.15) { s.a = 1.15; s.dir = -1; } else if (s.a < -1.15) { s.a = -1.15; s.dir = 1; } }
        const f = s.fly;
        if (f && !s.done) {
          f.x += f.vx * dt; f.y += f.vy * dt;
          const tgt = s.cur === 0 ? B[1] : goal;
          if (Math.hypot(f.x - tgt.x, f.y - tgt.y) < 8) {
            if (s.cur === 0) { s.cur = 1; s.fly = null; s.a = -1.15 * s.dir; sfx('land'); }
            else { s.done = t; sfx('coin'); }
          } else if (f.x < -6 || f.x > 106 || f.y < -6) { s.done = -1; sfx('nope'); lose(); }
        }
        if (s.done > 0 && t - s.done > 0.3) win();
        R(ctx, 0, 0, 100, 100, '#1e3a24');
        ctx.fillStyle = '#2a4a2a'; for (let x = 4; x < 100; x += 13) ctx.fillRect(x, 0, 2, 40 + (x % 20));
        ctx.fillStyle = '#3d7a34'; for (let i = 0; i < 30; i++) ctx.fillRect((i * 37) % 99, (i * 29) % 99, 3, 2);
        // bananas
        if (s.done <= 0) { for (let i = 0; i < 3; i++) { R(ctx, goal.x - 5 + i * 3, goal.y - 3 + i, 3, 7, '#ffe27a'); } R(ctx, goal.x - 1, goal.y - 5, 2, 2, '#6b3d22'); }
        B.forEach((br, i) => {
          const a = i === s.cur && !s.fly ? s.a : 0;
          ctx.save(); ctx.translate(br.x, br.y); ctx.rotate(a);
          R(ctx, -6, -7, 12, 14, '#a0663a'); R(ctx, -6, -7, 12, 2, '#6b3d22'); R(ctx, -6, 5, 12, 2, '#6b3d22'); R(ctx, -2, -10, 4, 4, '#8a5530');
          R(ctx, -1, -2, 2, 4, '#ffe27a');
          ctx.restore();
          if (i === s.cur && !s.fly && !s.done) { ctx.fillStyle = 'rgba(255,226,122,0.6)'; for (let k = 10; k < 30; k += 4) ctx.fillRect(br.x + Math.sin(s.a) * k, br.y - Math.cos(s.a) * k, 1, 1); }
        });
        if (f) put(ctx, spr(DK), f.x, f.y, 1.2);
        else if (!(s.done > 0)) put(ctx, spr(DK), B[s.cur].x, B[s.cur].y - 9, 0.9);
        txt(ctx, 'Tap to blast · reach the bananas', 50, 96, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        if (!s.fly && !s.done) {
          const o = s.B[s.cur], tg = s.cur === 0 ? s.B[1] : s.goal;
          const want = Math.atan2(tg.x - o.x, o.y - tg.y);
          await b.until(() => Math.abs(s.a - want) < 0.045 || s.fly || s.done);
          if (!s.fly && !s.done) await b.tap({ x: 50, y: 50 });
        }
        await b.wait(10);
      }
    },
  },

  // 25. Fit the three golden triangles together.
  {
    id: 'fz-triforce', cmd: 'Assemble it!', theme: 'funtendo', time: 6,
    setup({ stage, win, sfx, frame, pos, expose }) {
      const ctx = scene(stage);
      const SLOTS = [{ x: 50, y: 30 }, { x: 34, y: 46 }, { x: 66, y: 46 }].map(p => ({ ...p, full: false }));
      const pieces = [{ x: 18, y: 80 }, { x: 50, y: 84 }, { x: 82, y: 78 }].map(p => ({ x: p.x + (Math.random() - 0.5) * 8, y: p.y, placed: false }));
      const s = expose({ SLOTS, pieces, held: null, done: 0, now: 0 });
      follow(stage, pos, (p, ph) => {
        if (s.done) return;
        if (ph === 'down') s.held = pieces.find(q => !q.placed && Math.hypot(p.x - q.x, p.y - q.y) < 12) || null;
        if (s.held && (ph === 'down' || ph === 'move')) { s.held.x = p.x; s.held.y = p.y; }
        if (ph === 'up' && s.held) {
          const sl = SLOTS.find(q => !q.full && Math.hypot(q.x - s.held.x, q.y - s.held.y) < 10);
          if (sl) { sl.full = true; s.held.placed = true; s.held.x = sl.x; s.held.y = sl.y; sfx('place'); if (SLOTS.every(q => q.full)) { s.done = s.now || 0.001; sfx('ring'); } }
          s.held = null;
        }
      });
      frame((dt, t) => {
        s.now = t;
        if (s.done && t - s.done > 0.5) win();
        R(ctx, 0, 0, 100, 100, '#1a1430');
        ctx.fillStyle = '#2a2048'; for (let i = 0; i < 20; i++) ctx.fillRect((i * 37) % 99, (i * 23) % 99, 1, 1);
        // outlines: a triangle's centre is 10 below its apex
        for (const sl of SLOTS) if (!sl.full) { tri(ctx, sl.x, sl.y - 10, 16, '#4a3a2a'); tri(ctx, sl.x, sl.y - 8, 13, '#1a1430'); }
        for (const pc of pieces) { tri(ctx, pc.x, pc.y - 10, 16, s.done ? (Math.floor(t * 10) % 2 ? '#fff4e0' : '#ffe27a') : '#ffe27a'); tri(ctx, pc.x, pc.y - 7, 6, '#f2c84b'); }
        if (s.done) { ctx.fillStyle = 'rgba(255,226,122,0.4)'; for (let i = 0; i < 12; i++) { const a = i * 0.52 + t * 2; ctx.fillRect(50 + Math.cos(a) * 34, 44 + Math.sin(a) * 30, 2, 2); } }
        txt(ctx, s.done ? 'Power, wisdom and courage!' : 'Drag the pieces into place', 50, 95, s.done ? '#ffe27a' : '#c9ad7f', 8);
      });
    },
    async solve(b, s) {
      for (const pc of s.pieces) {
        if (b.over()) return;
        const sl = s.SLOTS.find(q => !q.full);
        if (!sl) return;
        await b.drag({ x: pc.x, y: pc.y }, { x: sl.x, y: sl.y }, 200, 8);
        await b.wait(30);
      }
    },
  },

  // 26. BOSS: the dungeon's giant eye beast. Stun it, strike it, then a game of energy-ball tennis.
  {
    id: 'fz-boss', cmd: 'Dungeon boss!', theme: 'funtendo', time: 26, boss: true,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose, phase }) {
      const ctx = scene(stage);
      const H = { x: 50, y: 86 };
      const TITLES = ['', 'Shoot the eye!', 'It’s enraged!', 'Return to sender!'];
      const s = expose({ ph: 0, bx: 50, bdir: 1, by: 26, eye: false, eyeLeft: 0, et: 0, stun: 0, strikes: 0, need: 5, hp: 4, hearts: 3, ball: null, calm: 1.2, cd: 0, p3hits: 0, swing: 0, flash: 0, win: 0, now: 0, arrow: null });
      const v = 28 * speed;
      function start(n) {
        s.ph = n; s.calm = n === 1 ? 1.0 : 1.1; s.stun = 0; s.strikes = 0; s.et = 0; s.eye = false; s.by = 26; s.ball = null; s.cd = 0.4;
        phase(n, TITLES[n]);
      }
      tapper(stage, e => {
        const p = pos(e);
        s.swing = 0.15;
        if (s.ph === 1 || s.ph === 2) {
          if (s.calm > 0) return;
          if (s.stun > 0) {
            if (Math.hypot(p.x - s.bx, p.y - s.by) < 16) {
              s.strikes++; s.flash = 0.1; sfx('land');
              if (s.strikes >= s.need) { s.hp--; sfx('boom'); start(s.ph + 1); }
            }
          } else if (s.eye && Math.hypot(p.x - s.bx, p.y - s.by) < 10) {
            s.stun = 2.4; s.strikes = 0; sfx('ring'); s.arrow = { x: s.bx, y: s.by, life: 0.15 };
          }
        } else if (s.ph === 3 && s.calm <= 0 && s.ball && !s.ball.back) {
          const d = Math.hypot(s.ball.x - H.x, s.ball.y - H.y);
          if (d < 28 && d > 4) { s.ball.back = true; s.ball.v = Math.min(105, s.ball.v * 1.15); sfx('ring'); }
        }
      });
      frame((dt, t) => {
        s.now = t;
        if (!s.ph && t > 0.9) start(1);
        s.calm -= dt; s.swing -= dt; s.flash -= dt;
        if (s.arrow) s.arrow.life -= dt;
        if (s.win) { if (t - s.win > 0.6) win(); }
        else if (s.ph === 1 || s.ph === 2) {
          const mult = s.ph === 2 ? 1.5 : 1;
          if (s.stun > 0) {
            s.by = Math.min(58, s.by + 120 * dt);
            s.stun -= dt;
            if (s.stun <= 0) { s.strikes = 0; sfx('land'); }
          } else {
            if (s.by > 26) s.by = Math.max(26, s.by - 80 * dt);
            if (s.calm <= 0) {
              s.bx += s.bdir * v * mult * dt;
              if (s.bx > 82) { s.bx = 82; s.bdir = -1; } else if (s.bx < 18) { s.bx = 18; s.bdir = 1; }
              s.et += dt;
              const open = (s.ph === 2 ? 0.85 : 1.1) / Math.pow(speed, 0.3), closed = 1.0 / Math.pow(speed, 0.3);
              const k = s.et % (open + closed);
              s.eye = k >= closed && s.by <= 27;
              s.eyeLeft = s.eye ? open + closed - k : 0;
            } else s.eye = false;
          }
        } else if (s.ph === 3) {
          s.bx = 50 + Math.sin(t * 1.5) * 10; s.by = 26;
          if (s.calm <= 0) {
            if (!s.ball) { s.cd -= dt; if (s.cd <= 0) { s.ball = { x: s.bx, y: 32, v: Math.min(100, 48 * speed), back: false, ret: 0 }; sfx('swap'); } }
            const bl = s.ball;
            if (bl) {
              const tg = bl.back ? { x: s.bx, y: 30 } : H;
              const d = Math.hypot(tg.x - bl.x, tg.y - bl.y), sp = bl.v * dt;
              bl.x += ((tg.x - bl.x) / d) * Math.min(sp, d); bl.y += ((tg.y - bl.y) / d) * Math.min(sp, d);
              if (!bl.back && Math.hypot(bl.x - H.x, bl.y - H.y) < 4) {
                s.hearts--; s.ball = null; s.cd = 1.0; sfx('nope');
                if (s.hearts <= 0) lose();
              } else if (bl.back && d < 5) {
                if (bl.ret < 1) { bl.ret++; bl.back = false; bl.v = Math.min(105, bl.v * 1.1); sfx('swap'); }
                else { s.hp--; s.p3hits++; s.ball = null; s.cd = 1.2; s.flash = 0.25; sfx('boom'); if (s.p3hits >= 2) s.win = t; }
              }
            }
          }
        }
        // ---- draw ----
        dungeon(ctx, '#2a1a2a', '#22142a');
        R(ctx, 0, 0, 100, 6, '#4a2a3a'); R(ctx, 0, 94, 100, 6, '#4a2a3a');
        for (const x of [6, 94]) { R(ctx, x - 2, 40, 4, 8, '#6a6a80'); R(ctx, x - 2, 36 - (Math.floor(t * 8) % 2), 4, 4, '#f39a3a'); }
        const fl = s.flash > 0;
        if (s.ph <= 2) {
          const enraged = s.ph === 2;
          const body = fl ? '#ffffff' : enraged ? '#8e2a2a' : '#6b3d22';
          // legs
          for (let i = -1; i <= 1; i += 2) for (let j = 0; j < 3; j++) R(ctx, s.bx + i * (10 + j * 4), s.by + 2 + j * 3, 3, 8 - j, enraged ? '#5a1a1a' : '#4a2a14');
          disc(ctx, s.bx, s.by, 11, body);
          if (s.stun > 0) {
            disc(ctx, s.bx, s.by, 5, '#c9ad7f');
            ctx.fillStyle = '#ffe27a'; for (let j = 0; j < 3; j++) ctx.fillRect(s.bx + Math.cos(t * 9 + j * 2) * 9, s.by - 13 + Math.sin(t * 9 + j * 2) * 2, 2, 2);
            txt(ctx, 'Strike! Tap fast!', 50, 76, '#ffe27a', 9);
            for (let i = 0; i < s.need; i++) R(ctx, 36 + i * 6, 70, 4, 3, i < s.strikes ? '#ffe27a' : '#3a2a3a');
          } else if (s.eye) {
            disc(ctx, s.bx, s.by, 6, '#fff4e0'); disc(ctx, s.bx, s.by, 3, '#d0463c'); R(ctx, s.bx - 1, s.by - 1, 2, 2, '#1a1220');
          } else { R(ctx, s.bx - 6, s.by - 1, 12, 2, '#1a1220'); }
          if (s.ph && !s.stun) txt(ctx, s.eye ? 'Now! Tap the eye!' : 'Wait for the eye to open…', 50, 76, s.eye ? '#ffe27a' : '#c9ad7f', 8);
        } else {
          // the phantom form
          const c = fl ? '#ffffff' : '#6a3e94';
          disc(ctx, s.bx, s.by, 9, c); R(ctx, s.bx - 12, s.by + 4, 24, 10, c); R(ctx, s.bx - 12, s.by + 14, 4, 3, c); R(ctx, s.bx - 2, s.by + 14, 4, 3, c); R(ctx, s.bx + 8, s.by + 14, 4, 3, c);
          R(ctx, s.bx - 4, s.by - 2, 2, 2, '#ffe27a'); R(ctx, s.bx + 2, s.by - 2, 2, 2, '#ffe27a');
          R(ctx, s.bx - 9, s.by - 10, 18, 3, '#ffe27a');
          if (s.ball) { disc(ctx, s.ball.x, s.ball.y, 4, s.ball.back ? '#9fd3f2' : '#ffe27a'); disc(ctx, s.ball.x, s.ball.y, 2, '#ffffff'); }
          if (!s.win) txt(ctx, 'Tap to swat the ball back!', 50, 72, '#c9ad7f', 8);
        }
        if (s.arrow && s.arrow.life > 0) { ctx.fillStyle = '#fff4e0'; for (let i = 0; i < 10; i++) ctx.fillRect(H.x + (s.arrow.x - H.x) * i / 10, H.y - 8 + (s.arrow.y - H.y + 8) * i / 10, 1, 2); }
        put(ctx, spr(ELF), H.x, H.y, 1.2);
        if (s.swing > 0) { R(ctx, H.x + 5, H.y - 12, 2, 9, '#d8d8e8'); }
        // HUD
        for (let i = 0; i < 4; i++) R(ctx, 30 + i * 10, 2, 8, 3, i < s.hp ? '#d0463c' : '#3a2a3a');
        for (let i = 0; i < 3; i++) heart(ctx, 4 + i * 7, 88, i < s.hearts);
        if (s.win) txt(ctx, 'Boss defeated!', 50, 50, '#ffe27a', 12);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        if ((s.ph === 1 || s.ph === 2) && s.calm <= 0) {
          if (s.stun > 0 && s.by > 40) await b.tap({ x: s.bx, y: s.by });
          else if (s.stun <= 0 && s.eye && s.eyeLeft > 0.1) await b.tap({ x: s.bx, y: s.by });
          else await b.wait(8);
        } else if (s.ph === 3 && s.calm <= 0 && s.ball && !s.ball.back) {
          const d = Math.hypot(s.ball.x - 50, s.ball.y - 86);
          if (d < 22 && d > 6) await b.tap({ x: 50, y: 60 }); else await b.wait(4);
        } else await b.wait(10);
      }
    },
  },
];

export default games;
