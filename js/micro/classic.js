import { h } from '../ui.js';
import { rnd, pick, shuffle, clamp, dist, spots, tapper, follow, swipe, holdable, art, canvas, addStyle } from './kit.js';

// Retro Remix: quick classic-video-game challenges (generic parodies, no real characters).
// Most are drawn on a 100x100 pixel canvas that fills the stage, so canvas units == stage %.

addStyle('classic', `
[class*="mcs-cl-"] .mc-canvas { position: absolute; inset: 0; width: 100% !important; height: 100% !important; display: block; image-rendering: pixelated; }
.cl-code { position: absolute; left: 0; right: 0; top: 30%; display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; padding: 0 8px; pointer-events: none; }
.cl-code b { width: 34px; height: 38px; display: grid; place-items: center; background: #34406a; color: #9fb4d0; font-size: 28px; font-weight: 400; }
.cl-code b.on { background: var(--gold); color: var(--ink); }
.cl-code b.next { box-shadow: 0 0 0 3px #fff4e0; color: #fff4e0; }
.cl-code-title { position: absolute; left: 0; right: 0; top: 12%; text-align: center; color: #f08ab0; font-size: 22px; margin: 0; pointer-events: none; letter-spacing: 2px; }
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
function txt(ctx, s, x, y, col = '#fff4e0', size = 10) {
  ctx.font = `${size}px "Jersey 10", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1a1220';
  ctx.fillText(s, x + 0.6, y + 0.6);
  ctx.fillStyle = col;
  ctx.fillText(s, x, y);
}
const scene = stage => canvas(stage, 100, 100).ctx;
// bounce a 1-D position between lo and hi (where it will be after moving freely)
function reflect(x, lo, hi) {
  const w = hi - lo;
  let u = (x - lo) % (2 * w);
  if (u < 0) u += 2 * w;
  return u <= w ? lo + u : lo + 2 * w - u;
}
function stars(ctx, seed = 3, n = 24, col = '#2a3a5c') {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) ctx.fillRect(((i * 37 + seed * 11) % 97) + 1, ((i * 53 + seed * 7) % 95) + 1, 1, 1);
}

// ---------- sprites ----------
const HERO = ['..rrrr..', '.rrrrrrr', '.cckckc.', '.cccccc.', '..cccc..', '.rUUUUr.', 'cUUyyUUc', '.UUUUUU.', '.UU..UU.', 'bbb..bbb'];
const HERO_JUMP = ['..rrrr..', '.rrrrrrr', '.cckckc.', '.cccccc.', 'c.cccc.c', 'crUUUUrc', '.UUyyUU.', '.UUUUUU.', 'UU....UU', 'bb....bb'];
const BARREL = ['.BBBBBB.', 'BbbbbbbB', 'BBBBBBBB', 'BbbtbbbB', 'BbbbbtbB', 'BBBBBBBB', 'BbbbbbbB', '.BBBBBB.'];
const BARREL2 = ['.BBBBBB.', 'BbbBbbbB', 'BbbBbbbB', 'BBBBBBBB', 'BbbbbBbB', 'BbbbbBbB', 'BBBBBBBB', '.BBBBBB.'];
const MUSH = ['...FFFF...', '.FFwFFwFF.', 'FFFFFFFFFF', 'FwFFFFFFwF', '.cccccccc.', '.ckcccckc.', '..cccccc..', '.BB....BB.', 'BBB....BBB'];
const MUSH_FLAT = ['..FFFFFF..', 'FFwFFFFwFF', 'FFFFFFFFFF', '.ckkcckkc.', 'BBB....BBB'];
const GHOST = ['..fffff..', '.fffffff.', 'fwwfffwwf', 'fwkfffwkf', 'fffffffff', 'fffffffff', 'fffffffff', 'f.ff.ff.f'];
const CHOMP_OPEN = ['..yyyyy..', '.yyyyyyy.', 'yyyyykyy.', 'yyyyyy...', 'yyyy.....', 'yyyyyy...', 'yyyyyyyy.', '.yyyyyyy.', '..yyyyy..'];
const CHOMP_SHUT = ['..yyyyy..', '.yyyyyyy.', 'yyyyykyyy', 'yyyyyyyyy', 'yyyyyyy..', 'yyyyyyyyy', 'yyyyyyyyy', '.yyyyyyy.', '..yyyyy..'];
const INVADER = ['..g.....g..', '...g...g...', '..ggggggg..', '.gg.ggg.gg.', 'ggggggggggg', 'g.ggggggg.g', 'g.g.....g.g', '...gg.gg...'];
const INVADER2 = ['..g.....g..', 'g..g...g..g', 'g.ggggggg.g', 'ggg.ggg.ggg', 'ggggggggggg', '.ggggggggg.', '..g.....g..', '.g.......g.'];
const SHIP = ['....w....', '...uuu...', '...uUu...', '.u.uuu.u.', 'uuuuUuuuu', 'uuuUUUuuu', 'u..r.r..u'];
const FROG = ['.gg...gg.', 'gwkg.gwkg', 'ggggggggg', '.ggGGGgg.', 'ggggggggg', 'g.ggggg.g', 'g.g...g.g', 'gg.....gg'];
const BIRD = ['...yyyy..', '..yyywwk.', '.yyyywwy.', 'wwwyyyyoo', 'wwwyyyyoo', '.wyyyyyy.', '..yyyyy..'];
const BIRD_UP = ['...yyyy..', 'w.yyywwk.', 'ww.yywwy.', 'wwwyyyyoo', '.yyyyyyoo', '.yyyyyyy.', '..yyyyy..'];
const RING = ['.nnnn.', 'nnwwnn', 'nn..nn', 'nn..nn', 'nnNNnn', '.nnnn.'];
const QBLOCK = ['NNNNNNNNNN', 'NnnnnnnnnN', 'NnnkkkknnN', 'NnkknnkknN', 'NnnnnkknnN', 'NnnnkknnnN', 'NnnnkknnnN', 'NnnnnnnnnN', 'NnnnkknnnN', 'NNNNNNNNNN'];
const QBLOCK_HIT = ['BBBBBBBBBB', 'BbbbbbbbbB', 'BbbbbbbbbB', 'BbbbbbbbbB', 'BbbbbbbbbB', 'BbbbbbbbbB', 'BbbbbbbbbB', 'BbbbbbbbbB', 'BbbbbbbbbB', 'BBBBBBBBBB'];
const COIN = ['.nnn.', 'nnwnn', 'nnwnn', 'nnNnn', '.nnn.'];
const BALLOON = ['..RRRRRR..', '.RRRRRRRR.', 'RRwwRRwwRR', 'RRwkRRwkRR', 'RRRRRRRRRR', 'RRRkkkkRRR', 'RRRRRRRRRR', '.RRRRRRRR.', '..yy..yy..', '..yy..yy..'];
const DUCK = ['......GG...', '.....GGkG..', '.....GGGoo.', '..bbbbGG...', 'bbbbbbbb...', '.bwwwbbbb..', '..bbbbbbb..', '...oo.oo...'];
const DUCK_FLAP = ['.ww...GG...', 'www..GGkG..', '.wwb.GGGoo.', '..bbbbGG...', 'bbbbbbbb...', '.bbbbbbbb..', '..bbbbbbb..', '...oo.oo...'];
const DUCK_HIT = ['...oo.oo...', '..bbbbbbb..', '.bwwwbbbb..', 'bbbbbbbb...', '..bbbbGG...', '.....GGGoo.', '.....GGkG..', '......GG...'];
const CONE = ['..oo..', '..oo..', '.owwo.', '.oooo.', 'owwwwo', 'oooooo'];
const FISH = ['..uuuu...u', '.uuuuuu.uu', 'uukuuuuuuu', 'uuuuuuuuuu', '.uuuuuu.uu', '..uuuu...u'];
const ROCK = ['..ssss..', '.sCssss.', 'ssssCsss', 'sCssssss', 'sssssCss', '.sssCss.', '..ssss..'];

// ---------- the microgames ----------
export default [
  // 1. Jump the rolling barrels.
  {
    id: 'cl-barrel', cmd: 'Jump!', theme: 'classic',
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const v = 38 * speed, n = speed > 1.5 ? 3 : 2;
      const s = expose({ hx: 22, jt: -1, v, barrels: Array.from({ length: n }, (_, i) => ({ x: 105 + i * v * 0.95, passed: false, rot: 0 })) });
      const hy = () => (s.jt >= 0 ? Math.sin((Math.PI * s.jt) / 0.55) * 24 : 0);
      tapper(stage, () => { if (s.jt < 0) { s.jt = 0; sfx('swap'); } });
      frame(dt => {
        if (s.jt >= 0 && (s.jt += dt) > 0.55) s.jt = -1;
        for (const b of s.barrels) {
          b.x -= v * dt; b.rot += dt * speed * 8;
          if (!b.passed && Math.abs(b.x - s.hx) < 7 && hy() < 8) { sfx('nope'); return lose(); }
          if (!b.passed && b.x < s.hx - 8) { b.passed = true; sfx('coin'); }
        }
        if (s.barrels.every(b => b.passed)) return win();
        // draw: girders and a ladder under a starry sky
        R(ctx, 0, 0, 100, 100, '#141c34'); stars(ctx, 1);
        for (const y of [30, 82]) {
          R(ctx, 0, y, 100, 5, '#d0463c');
          for (let x = 0; x < 100; x += 8) R(ctx, x + 2, y + 1, 4, 3, '#141c34');
        }
        R(ctx, 70, 35, 2, 47, '#4f8fd0'); R(ctx, 78, 35, 2, 47, '#4f8fd0');
        for (let y = 38; y < 82; y += 6) R(ctx, 70, y, 10, 1, '#4f8fd0');
        for (const b of s.barrels) if (b.x < 104) put(ctx, spr(Math.floor(b.rot) % 2 ? BARREL2 : BARREL), b.x, 78, 1.2);
        put(ctx, spr(s.jt >= 0 ? HERO_JUMP : HERO), s.hx, 76 - hy(), 1.2);
        txt(ctx, 'TAP TO JUMP', 50, 94, '#9fb4d0', 8);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const nb = s.barrels.find(x => !x.passed);
        if (nb && s.jt < 0 && nb.x - s.hx > 0 && nb.x - s.hx <= s.v * 0.27) await b.tap({ x: 50, y: 50 });
        await b.wait(8);
      }
    },
  },

  // 2. Eat every dot before the ghost gets you.
  {
    id: 'cl-dots', cmd: 'Chomp ’em!', theme: 'classic', time: 8,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const g0 = { x: 85, y: 15 };
      const dots = spots(4 + Math.round(speed), 14, 10).filter(p => dist(p, g0) > 22 && dist(p, { x: 15, y: 85 }) > 8);
      while (dots.length < 4) dots.push({ x: 20 + rnd(60), y: 40 + rnd(40) });
      const s = expose({ c: { x: 15, y: 85 }, t: { x: 15, y: 85 }, g: { ...g0 }, dots: dots.map(d => ({ ...d, eaten: false })) });
      follow(stage, pos, (p, phase) => { if (phase !== 'up') s.t = { x: clamp(p.x, 5, 95), y: clamp(p.y, 5, 95) }; });
      let face = 1, ft = 0;
      frame(dt => {
        ft += dt;
        const dx = s.t.x - s.c.x, dy = s.t.y - s.c.y, d = Math.hypot(dx, dy), step = 70 * dt;
        if (d > 0.5) { const k = Math.min(1, step / d); s.c.x += dx * k; s.c.y += dy * k; if (Math.abs(dx) > 0.5) face = dx > 0 ? 1 : -1; }
        const gx = s.c.x - s.g.x, gy = s.c.y - s.g.y, gd = Math.hypot(gx, gy) || 1, gv = (10 + 5 * speed) * dt;
        s.g.x += (gx / gd) * gv; s.g.y += (gy / gd) * gv;
        for (const o of s.dots) if (!o.eaten && dist(o, s.c) < 6) { o.eaten = true; sfx('peg', s.dots.filter(q => q.eaten).length); }
        if (dist(s.g, s.c) < 7) { sfx('nope'); return lose(); }
        if (s.dots.every(o => o.eaten)) return win();
        R(ctx, 0, 0, 100, 100, '#0c0c24');
        ctx.strokeStyle = '#2c5a9a'; ctx.lineWidth = 2;
        ctx.strokeRect(3, 3, 94, 94); ctx.strokeRect(30, 30, 40, 4); ctx.strokeRect(30, 66, 40, 4);
        for (const o of s.dots) if (!o.eaten) { R(ctx, o.x - 1.5, o.y - 1.5, 3, 3, '#ffe27a'); R(ctx, o.x - 0.5, o.y - 0.5, 1, 1, '#fff4e0'); }
        put(ctx, spr(Math.floor(ft * 8) % 2 ? CHOMP_SHUT : CHOMP_OPEN), s.c.x, s.c.y, 1.3, face < 0);
        put(ctx, spr(GHOST), s.g.x, s.g.y + Math.sin(ft * 10), 1.3);
        txt(ctx, 'DRAG TO MOVE', 50, 94, '#4f8fd0', 7);
      });
    },
    async solve(b, s) {
      // distance from the ghost to the straight path c -> p
      const segD = (p, g) => {
        const vx = p.x - s.c.x, vy = p.y - s.c.y, L = vx * vx + vy * vy || 1;
        const k = clamp(((g.x - s.c.x) * vx + (g.y - s.c.y) * vy) / L, 0, 1);
        return Math.hypot(s.c.x + vx * k - g.x, s.c.y + vy * k - g.y);
      };
      b.down({ ...s.c });
      while (!b.over()) {
        let tgt;
        const left = s.dots.filter(o => !o.eaten);
        if (dist(s.g, s.c) < 11) {
          // flee away from the ghost, towards open space
          let best = null, bs = -1;
          for (let a = 0; a < 16; a++) {
            const p = { x: clamp(s.c.x + Math.cos((a / 16) * Math.PI * 2) * 20, 6, 94), y: clamp(s.c.y + Math.sin((a / 16) * Math.PI * 2) * 20, 6, 94) };
            const sc = segD(p, s.g) + dist(p, s.g) * 0.5;
            if (sc > bs) { bs = sc; best = p; }
          }
          tgt = best;
        } else {
          const cost = o => dist(o, s.c) + (segD(o, s.g) < 10 ? 80 : 0);
          tgt = left.sort((p, q) => cost(p) - cost(q))[0] || s.c;
        }
        b.move(tgt);
        await b.wait(20);
      }
      b.up(s.c);
    },
  },

  // 3. Stomp the walking mushroom.
  {
    id: 'cl-stomp', cmd: 'Stomp it!', theme: 'classic',
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const s = expose({ hx: 12, mx: 88, jt: -1, vr: 22 + 14 * speed, flat: false });
      const hy = () => (s.jt >= 0 ? Math.sin((Math.PI * s.jt) / 0.7) * 26 : 0);
      tapper(stage, () => { if (s.jt < 0 && !s.flat) { s.jt = 0; sfx('swap'); } });
      let ft = 0, done = 0;
      frame(dt => {
        ft += dt;
        if (s.flat) { done += dt; if (done > 0.25) win(); }
        else {
          s.hx += 22 * dt; s.mx -= 14 * speed * dt;
          if (s.jt >= 0 && (s.jt += dt) > 0.7) s.jt = -1;
          const dx = s.mx - s.hx, k = s.jt / 0.7;
          if (s.jt >= 0 && k > 0.5 && Math.abs(dx) < 8 && hy() < 14) { s.flat = true; sfx('pop'); }
          else if (hy() < 4 && Math.abs(dx) < 6) { sfx('nope'); return lose(); }
          else if (dx < -10) { sfx('nope'); return lose(); }
        }
        R(ctx, 0, 0, 100, 100, '#6fb0e8');
        R(ctx, 10, 18, 14, 4, '#fff4e0'); R(ctx, 13, 15, 8, 3, '#fff4e0'); R(ctx, 64, 26, 18, 4, '#fff4e0'); R(ctx, 68, 23, 9, 3, '#fff4e0');
        R(ctx, 0, 82, 100, 18, '#a0663a');
        for (let x = 0; x < 100; x += 10) { R(ctx, x, 82, 10, 1, '#c79a5a'); R(ctx, x, 82, 1, 18, '#6b3d22'); R(ctx, x + 5, 91, 1, 9, '#6b3d22'); R(ctx, x, 91, 10, 1, '#6b3d22'); }
        R(ctx, 74, 66, 12, 16, '#3d7a34'); R(ctx, 72, 62, 16, 5, '#6fb04a');
        put(ctx, spr(s.flat ? MUSH_FLAT : MUSH), s.mx, s.flat ? 80 : 77 + (Math.floor(ft * 6) % 2 ? 0 : -0.5), 1.2, Math.floor(ft * 6) % 2 === 1);
        if (!s.flat || done < 0.25) put(ctx, spr(s.jt >= 0 ? HERO_JUMP : HERO), s.hx, 76 - hy(), 1.2);
        txt(ctx, 'TAP TO JUMP', 50, 94, '#fff4e0', 8);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        if (s.jt < 0 && !s.flat && s.mx - s.hx <= s.vr * 0.64) { await b.tap({ x: 50, y: 50 }); break; }
        await b.wait(8);
      }
    },
  },

  // 4. Pong: block the ball twice.
  {
    id: 'cl-pong', cmd: 'Block it!', theme: 'classic', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const vy0 = (20 + Math.random() * 20) * speed * (Math.random() < 0.5 ? -1 : 1);
      const s = expose({ py: 50, ball: { x: 20, y: 30 + Math.random() * 40, vx: 50 * speed, vy: vy0 }, hits: 0 });
      const HH = 9;
      follow(stage, pos, p => (s.py = clamp(p.y, HH, 100 - HH)));
      frame(dt => {
        const o = s.ball;
        o.x += o.vx * dt; o.y += o.vy * dt;
        if (o.y < 4) { o.y = 4; o.vy = Math.abs(o.vy); }
        if (o.y > 96) { o.y = 96; o.vy = -Math.abs(o.vy); }
        if (o.x < 6) { o.x = 6; o.vx = Math.abs(o.vx); sfx('land'); }
        if (o.vx > 0 && o.x >= 84 && o.x < 90) {
          if (Math.abs(o.y - s.py) < HH + 2) {
            o.x = 84; o.vx = -o.vx; o.vy = clamp(o.vy + (o.y - s.py) * 3, -55 * speed, 55 * speed);
            sfx('peg', ++s.hits);
            if (s.hits >= 2) return win();
          }
        }
        if (o.x > 97) { sfx('nope'); return lose(); }
        R(ctx, 0, 0, 100, 100, '#101010');
        for (let y = 2; y < 100; y += 8) R(ctx, 49, y, 2, 4, '#5a5a5a');
        txt(ctx, String(s.hits), 62, 12, '#fff4e0', 16); txt(ctx, '0', 38, 12, '#fff4e0', 16);
        R(ctx, 4, 40, 3, 20, '#5a5a5a');
        R(ctx, 85, s.py - HH, 4, HH * 2, '#fff4e0');
        R(ctx, o.x - 2, o.y - 2, 4, 4, '#fff4e0');
      });
    },
    async solve(b, s) {
      b.down({ x: 88, y: s.py });
      while (!b.over()) { b.move({ x: 88, y: s.ball.y }); await b.wait(16); }
      b.up({ x: 88, y: s.py });
    },
  },

  // 5. Shoot down the descending invaders.
  {
    id: 'cl-invaders', cmd: 'Zap ’em!', theme: 'classic', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const n = speed > 1.5 ? 3 : 2;
      const s = expose({
        sx: 50,
        inv: Array.from({ length: n }, (_, i) => ({ x: 15 + rnd(70), y: 12 + i * 11, vx: (20 + 8 * i) * speed * (Math.random() < 0.5 ? -1 : 1), dead: false })),
        shots: [],
      });
      follow(stage, pos, (p, phase) => {
        s.sx = clamp(p.x, 6, 94);
        if (phase === 'down' && s.shots.length < 3) { s.shots.push({ x: s.sx, y: 82 }); sfx('swap'); }
      });
      let ft = 0;
      frame(dt => {
        ft += dt;
        for (const a of s.inv) {
          if (a.dead) continue;
          a.x += a.vx * dt;
          if (a.x < 8) { a.x = 8; a.vx = Math.abs(a.vx); } else if (a.x > 92) { a.x = 92; a.vx = -Math.abs(a.vx); }
          a.y += 3 * speed * dt;
          if (a.y > 76) { sfx('nope'); return lose(); }
        }
        for (const sh of s.shots) {
          sh.y -= 150 * dt;
          for (const a of s.inv) if (!a.dead && Math.abs(sh.x - a.x) < 6 && Math.abs(sh.y - a.y) < 5) { a.dead = true; sh.y = -10; sfx('pop'); }
        }
        s.shots = s.shots.filter(sh => sh.y > -5);
        if (s.inv.every(a => a.dead)) return win();
        R(ctx, 0, 0, 100, 100, '#08081c'); stars(ctx, 5, 30, '#3a3a6a');
        for (const a of s.inv) if (!a.dead) put(ctx, spr(Math.floor(ft * 4) % 2 ? INVADER2 : INVADER), a.x, a.y, 1);
        for (const sh of s.shots) R(ctx, sh.x - 0.5, sh.y - 3, 1, 5, '#ffe27a');
        R(ctx, 0, 78, 100, 1, '#d0463c');
        put(ctx, spr(SHIP), s.sx, 88, 1.2);
        txt(ctx, 'TAP TO FIRE', 50, 96, '#6a9ae0', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const a = s.inv.filter(x => !x.dead).sort((p, q) => q.y - p.y)[0];
        if (!a) break;
        const tt = (82 - a.y) / 150 + 0.03;
        const px = reflect(a.x + a.vx * tt, 8, 92);
        await b.tap({ x: px, y: 88 });
        await b.until(() => a.dead || !s.shots.length, 900);
        await b.wait(20);
      }
    },
  },

  // 6. Falling blocks: slide the bar into the gap.
  {
    id: 'cl-block', cmd: 'Fill the gap!', theme: 'classic', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const COLS = 10, C = 8, X0 = 10, Y0 = 10;
      const gap = rnd(COLS);
      let c0 = rnd(COLS); while (Math.abs(c0 - gap) < 2) c0 = rnd(COLS);
      const s = expose({ gap, col: c0, row: 0, locked: false });
      const COLORS = ['#d0463c', '#6fb04a', '#4f8fd0', '#ffe27a', '#a46ad0', '#f39a3a'];
      const floor = Array.from({ length: COLS }, (_, i) => (i === gap ? null : pick(COLORS)));
      tapper(stage, e => {
        if (s.locked) return;
        const p = pos(e), d = p.x < 50 ? -1 : 1;
        s.col = clamp(s.col + d, 0, COLS - 1);
        sfx('select');
      });
      let flash = 0;
      frame(dt => {
        if (!s.locked) {
          s.row += 2.5 * speed * dt;
          // the bar is 3 tall; it lands on the floor row (row 9) or on a filled floor cell (row 8 bottom)
          const bottom = s.row + 3;
          const stop = floor[s.col] ? 9 : 10;
          if (bottom >= stop) {
            s.row = stop - 3; s.locked = true;
            if (s.col === gap) { sfx('coin'); flash = 0.01; } else { sfx('nope'); lose(); }
          }
        } else if (flash > 0) { flash += dt; if (flash > 0.3) return win(); }
        R(ctx, 0, 0, 100, 100, '#1a1430');
        R(ctx, X0 - 2, Y0 - 2, COLS * C + 4, 84, '#3a2a5c');
        R(ctx, X0, Y0, COLS * C, 80, '#0c0c1c');
        const cell = (c, r, col) => { R(ctx, X0 + c * C, Y0 + r * C, C, C, col); R(ctx, X0 + c * C, Y0 + r * C, C, 1, '#ffffff55'); R(ctx, X0 + c * C, Y0 + r * C + C - 1, C, 1, '#00000055'); };
        floor.forEach((col, c) => col && cell(c, 9, flash > 0 ? '#fff4e0' : col));
        for (let k = 0; k < 3; k++) cell(s.col, Math.floor(s.row) + k, flash > 0 ? '#fff4e0' : '#9fd3f2');
        if (!s.locked) { ctx.fillStyle = '#ffffff18'; ctx.fillRect(X0 + s.col * C, Y0 + Math.floor(s.row) * C, C, 80 - Math.floor(s.row) * C); }
        txt(ctx, '◀ TAP', 18, 5, '#9fb4d0', 7); txt(ctx, 'TAP ▶', 82, 5, '#9fb4d0', 7);
      });
    },
    async solve(b, s) {
      while (!b.over() && s.col !== s.gap) { await b.tap({ x: s.col > s.gap ? 25 : 75, y: 50 }); await b.wait(40); }
    },
  },

  // 7. Hop the frog across the traffic.
  {
    id: 'cl-frog', cmd: 'Cross!', theme: 'classic', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, time, expose }) {
      const ctx = scene(stage);
      const L = speed > 1.6 ? 4 : 3;
      const ys = [88, ...Array.from({ length: L }, (_, i) => 72 - i * (L === 4 ? 14 : 18)), 10];
      let lanes;
      for (let tries = 0; tries < 60; tries++) {
        lanes = Array.from({ length: L }, (_, i) => {
          const v = (24 + rnd(16) + i * 6) * speed * (i % 2 ? -1 : 1);
          const x0 = rnd(140);
          return { v, cars: [x0, (x0 + 55 + rnd(25)) % 140], col: pick(['#d0463c', '#4f8fd0', '#ffe27a', '#a46ad0', '#f39a3a']) };
        });
        if (plan(lanes, 0, 0, time * 0.8)) break;
      }
      const s = expose({ lane: 0, t: 0, lanes, L, hop: 0 });
      tapper(stage, () => {
        if (s.lane > L) return;
        s.lane++; s.hop = 0.12; sfx('swap');
        if (s.lane > L) { sfx('coin'); win(); }
      });
      frame(dt => {
        s.t += dt; s.hop = Math.max(0, s.hop - dt);
        if (s.lane >= 1 && s.lane <= L && danger(lanes[s.lane - 1], s.t)) { sfx('nope'); return lose(); }
        R(ctx, 0, 0, 100, 100, '#2a2a34');
        R(ctx, 0, 0, 100, 18, '#3d7a34'); R(ctx, 0, 82, 100, 18, '#6b6b7a');
        for (let i = 0; i < L; i++) {
          const y = ys[i + 1];
          for (let x = 0; x < 100; x += 12) R(ctx, x, y - 8, 6, 1, '#5a5a5a');
          for (const x0 of lanes[i].cars) {
            const x = carX(lanes[i], x0, s.t);
            R(ctx, x - 8, y - 4, 16, 8, lanes[i].col);
            R(ctx, x + (lanes[i].v > 0 ? 3 : -7), y - 3, 4, 6, '#9fd3f2');
            R(ctx, x - 7, y + 3, 4, 2, '#1a1220'); R(ctx, x + 3, y + 3, 4, 2, '#1a1220');
          }
        }
        put(ctx, spr(FROG), 50, ys[Math.min(s.lane, L + 1)] + (s.hop > 0 ? -2 : 0), 1.2);
        txt(ctx, 'TAP TO HOP', 50, 95, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      const steps = plan(s.lanes, s.lane, s.t, 20);
      if (!steps) return;
      for (const at of steps) {
        await b.until(() => s.t >= at);
        await b.tap({ x: 50, y: 50 });
      }
    },
  },

  // 8. Breakout: knock out the last brick.
  {
    id: 'cl-bricks', cmd: 'Break it!', theme: 'classic', time: 8,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const spd = 65 * speed;
      const a0 = (Math.random() - 0.5) * 0.6;
      const s = expose({ px: 50, ball: { x: 50, y: 86, vx: Math.sin(a0) * spd, vy: -Math.cos(a0) * spd }, brick: { x: 20 + rnd(60), y: 14 }, spd });
      follow(stage, pos, p => (s.px = clamp(p.x, 11, 89)));
      frame(dt => {
        const o = s.ball, br = s.brick;
        for (let k = 0; k < 2; k++) {
          const d = dt / 2;
          o.x += o.vx * d; o.y += o.vy * d;
          if (o.x < 3) { o.x = 3; o.vx = Math.abs(o.vx); }
          if (o.x > 97) { o.x = 97; o.vx = -Math.abs(o.vx); }
          if (o.y < 3) { o.y = 3; o.vy = Math.abs(o.vy); }
          if (Math.abs(o.x - br.x) < 9.5 && Math.abs(o.y - br.y) < 4.5) { sfx('pop'); return win(); }
          if (o.vy > 0 && o.y >= 87 && o.y <= 93 && Math.abs(o.x - s.px) <= 12) {
            const off = clamp((o.x - s.px) / 11, -1, 1);
            o.vx = off * 0.75 * spd; o.vy = -Math.sqrt(spd * spd - o.vx * o.vx); o.y = 87;
            sfx('land');
          }
          if (o.y > 101) { sfx('nope'); return lose(); }
        }
        R(ctx, 0, 0, 100, 100, '#141028');
        R(ctx, 0, 0, 2, 100, '#5a5a7a'); R(ctx, 98, 0, 2, 100, '#5a5a7a'); R(ctx, 0, 0, 100, 2, '#5a5a7a');
        R(ctx, br.x - 8, br.y - 3, 16, 6, '#f08ab0'); R(ctx, br.x - 8, br.y - 3, 16, 1, '#fff4e0'); R(ctx, br.x - 8, br.y + 2, 16, 1, '#c0507a');
        R(ctx, s.px - 11, 89, 22, 3, '#9fd3f2'); R(ctx, s.px - 11, 89, 22, 1, '#fff4e0');
        R(ctx, o.x - 1.5, o.y - 1.5, 3, 3, '#fff4e0');
        txt(ctx, 'LAST BRICK!', 50, 30, '#5a4a7a', 9);
      });
    },
    async solve(b, s) {
      const sim = (x, y, vx, vy, stopY, up) => {
        // step the ball until it reaches the paddle line (or hits the brick when going up)
        for (let i = 0; i < 2000; i++) {
          const d = 1 / 240;
          x += vx * d; y += vy * d;
          if (x < 3) { x = 3; vx = Math.abs(vx); }
          if (x > 97) { x = 97; vx = -Math.abs(vx); }
          if (y < 3) { y = 3; vy = Math.abs(vy); }
          if (up && Math.abs(x - s.brick.x) < 7 && Math.abs(y - s.brick.y) < 3) return { hit: true };
          if (vy > 0 && y >= stopY) return { x, hit: false };
        }
        return { hit: false };
      };
      b.down({ x: s.px, y: 90 });
      let aimed = null;
      while (!b.over()) {
        const o = s.ball;
        if (o.vy > 0 && o.y < 86) {
          const land = sim(o.x, o.y, o.vx, o.vy, 87, false);
          if (land.x !== undefined) {
            let best = null;
            for (let off = -0.95; off <= 0.95; off += 0.05) {
              const px = land.x - off * 11;
              if (px < 11 || px > 89) continue;
              const vx = off * 0.75 * s.spd, vy = -Math.sqrt(s.spd * s.spd - vx * vx);
              if (sim(land.x, 87, vx, vy, 88, true).hit && (!best || Math.abs(off) < Math.abs(best.off))) best = { off, px };
            }
            aimed = best ? best.px : clamp(land.x, 11, 89);
          }
        }
        if (aimed !== null) b.move({ x: aimed, y: 90 });
        await b.wait(16);
      }
      b.up({ x: s.px, y: 90 });
    },
  },

  // 9. Flap through the pipe gaps.
  {
    id: 'cl-flap', cmd: 'Flap!', theme: 'classic', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const gapH = speed > 1.6 ? 30 : 34;
      const g1 = 35 + rnd(30);
      const s = expose({ y: 50, vy: 0, bx: 28, pipes: [{ x: 75, gy: g1 }, { x: 125, gy: clamp(g1 + (rnd(50) - 25), 30, 70) }], gapH, flapT: 0 });
      tapper(stage, () => { s.vy = -55; s.flapT = 0.15; sfx('swap'); });
      frame(dt => {
        s.vy += 170 * dt; s.y += s.vy * dt; s.flapT -= dt;
        if (s.y > 90 || s.y < 2) { sfx('nope'); return lose(); }
        for (const p of s.pipes) {
          p.x -= 32 * speed * dt;
          if (Math.abs(p.x - s.bx) < 5 + 3.5 && Math.abs(s.y - p.gy) > gapH / 2 - 3.5) { sfx('nope'); return lose(); }
          if (!p.passed && p.x < s.bx - 9) { p.passed = true; sfx('coin'); }
        }
        if (s.pipes.every(p => p.passed)) return win();
        R(ctx, 0, 0, 100, 100, '#6fc0e8');
        R(ctx, 0, 70, 100, 22, '#a8d870'); for (let x = 0; x < 100; x += 14) R(ctx, x, 66, 10, 6, '#a8d870');
        for (const p of s.pipes) {
          const top = p.gy - gapH / 2, bot = p.gy + gapH / 2;
          R(ctx, p.x - 5, 0, 10, top, '#3d7a34'); R(ctx, p.x - 6, top - 4, 12, 4, '#6fb04a');
          R(ctx, p.x - 5, bot, 10, 92 - bot, '#3d7a34'); R(ctx, p.x - 6, bot, 12, 4, '#6fb04a');
          R(ctx, p.x - 3, 0, 1, top - 4, '#a8d870'); R(ctx, p.x - 3, bot + 4, 1, 88 - bot, '#a8d870');
        }
        R(ctx, 0, 92, 100, 8, '#c79a5a'); for (let x = 0; x < 100; x += 6) R(ctx, x, 92, 3, 2, '#e8d070');
        put(ctx, spr(s.flapT > 0 ? BIRD_UP : BIRD), s.bx, s.y, 1.2);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const p = s.pipes.find(q => q.x > s.bx - 10) || s.pipes[s.pipes.length - 1];
        if (s.y > p.gy + 2 && s.vy > -15) await b.tap({ x: 50, y: 50 });
        else await b.wait(10);
      }
    },
  },

  // 10. Blast the asteroids before they hit your ship.
  {
    id: 'cl-rocks', cmd: 'Blast ’em!', theme: 'classic', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const n = 3 + Math.round(speed);
      const C = { x: 50, y: 50 };
      const s = expose({
        rocks: Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2 + Math.random() * 0.8, v = (8 + 3 * i) * speed;
          return { x: 50 + Math.cos(a) * 48, y: 50 + Math.sin(a) * 48, vx: -Math.cos(a) * v, vy: -Math.sin(a) * v, dead: false };
        }),
        shots: [], aim: 0,
      });
      tapper(stage, e => {
        const p = pos(e), d = Math.hypot(p.x - C.x, p.y - C.y) || 1;
        s.aim = Math.atan2(p.y - C.y, p.x - C.x);
        s.shots.push({ x: C.x, y: C.y, vx: ((p.x - C.x) / d) * 130, vy: ((p.y - C.y) / d) * 130 });
        sfx('swap');
      });
      frame(dt => {
        for (const r of s.rocks) {
          if (r.dead) continue;
          r.x += r.vx * dt; r.y += r.vy * dt;
          if (dist(r, C) < 9) { sfx('nope'); return lose(); }
        }
        for (const sh of s.shots) {
          sh.x += sh.vx * dt; sh.y += sh.vy * dt;
          for (const r of s.rocks) if (!r.dead && dist(sh, r) < 6) { r.dead = true; sh.x = -99; sfx('pop'); }
        }
        s.shots = s.shots.filter(sh => sh.x > -5 && sh.x < 105 && sh.y > -5 && sh.y < 105);
        if (s.rocks.every(r => r.dead)) return win();
        R(ctx, 0, 0, 100, 100, '#000010'); stars(ctx, 9, 40, '#4a4a7a');
        for (const r of s.rocks) if (!r.dead) put(ctx, spr(ROCK), r.x, r.y, 1.3);
        for (const sh of s.shots) R(ctx, sh.x - 1, sh.y - 1, 2, 2, '#fff4e0');
        // the ship, pointing where you last fired
        ctx.save(); ctx.translate(50, 50); ctx.rotate(s.aim + Math.PI / 2);
        ctx.fillStyle = '#fff4e0'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 4); ctx.lineTo(0, 2); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
        ctx.restore();
        txt(ctx, 'TAP A ROCK', 50, 95, '#6a6aa0', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const r = s.rocks.filter(x => !x.dead).sort((p, q) => dist(p, { x: 50, y: 50 }) - dist(q, { x: 50, y: 50 }))[0];
        if (!r) break;
        let t = dist(r, { x: 50, y: 50 }) / 130;
        for (let k = 0; k < 4; k++) t = dist({ x: r.x + r.vx * t, y: r.y + r.vy * t }, { x: 50, y: 50 }) / 130;
        t += 0.03;
        await b.tap({ x: r.x + r.vx * t, y: r.y + r.vy * t });
        await b.until(() => r.dead, 500);
      }
    },
  },

  // 11. Run and grab the rings.
  {
    id: 'cl-rings', cmd: 'Grab 5 rings!', theme: 'classic', time: 8,
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const v = 40 * speed, gapT = 0.85 / Math.sqrt(speed), dur = 0.6 / Math.sqrt(speed);
      const s = expose({
        hx: 25, jt: -1, v, dur, got: 0, miss: 0,
        rings: Array.from({ length: 6 }, (_, i) => ({ x: 105 + i * v * gapT, air: Math.random() < 0.5, done: false })),
      });
      const hy = () => (s.jt >= 0 ? Math.sin((Math.PI * s.jt) / dur) * 28 : 0);
      tapper(stage, () => { if (s.jt < 0) { s.jt = 0; sfx('swap'); } });
      let ft = 0;
      frame(dt => {
        ft += dt;
        if (s.jt >= 0 && (s.jt += dt) > dur) s.jt = -1;
        const cy = 76 - hy();
        for (const r of s.rings) {
          if (r.done) continue;
          r.x -= v * dt;
          const ry = r.air ? 52 : 76;
          if (Math.abs(r.x - s.hx) < 6 && Math.abs(ry - cy) < 9) { r.done = true; s.got++; sfx('coin'); if (s.got >= 5) return win(); }
          else if (r.x < s.hx - 8) { r.done = true; s.miss++; if (s.miss > 1) { sfx('nope'); return lose(); } }
        }
        R(ctx, 0, 0, 100, 100, '#4f9fe0');
        R(ctx, 0, 60, 100, 22, '#3d7a34');
        for (let x = -((ft * v * 0.3) % 20); x < 100; x += 20) { R(ctx, x, 50, 10, 10, '#6fb04a'); R(ctx, x + 10, 54, 10, 6, '#6fb04a'); }
        R(ctx, 0, 82, 100, 18, '#a0663a');
        for (let x = -((ft * v) % 10); x < 100; x += 10) { R(ctx, x, 82, 5, 5, '#c79a5a'); R(ctx, x + 5, 87, 5, 5, '#c79a5a'); }
        for (const r of s.rings) if (!r.done && r.x < 104) put(ctx, spr(RING), r.x, r.air ? 52 : 76, 1.3);
        put(ctx, spr(s.jt >= 0 ? HERO_JUMP : HERO), s.hx, 76 - hy(), 1.2);
        txt(ctx, `${s.got}/5`, 88, 8, '#ffe27a', 10);
        txt(ctx, 'TAP TO JUMP', 50, 95, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const r = s.rings.find(q => !q.done);
        if (r && r.air && s.jt < 0) {
          const tt = (r.x - s.hx) / s.v;
          if (tt <= s.dur / 2 && tt > 0) await b.tap({ x: 50, y: 50 });
        }
        await b.wait(8);
      }
    },
  },

  // 12. Headbutt the ? block three times.
  {
    id: 'cl-qblock', cmd: 'Bonk it!', theme: 'classic', time: 7,
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ bx: 20 + rnd(60), bvx: 22 * speed * (Math.random() < 0.5 ? -1 : 1), hx: 50, tx: 50, jt: -1, coins: 0, bump: 0, pop: [] });
      const DUR = 0.6;
      const hy = () => (s.jt >= 0 ? Math.sin((Math.PI * s.jt) / DUR) * 52 : 0);
      tapper(stage, e => {
        if (s.jt >= 0) return;
        s.tx = clamp(pos(e).x, 6, 94); s.jt = 0; sfx('swap');
      });
      frame(dt => {
        s.bx += s.bvx * dt;
        if (s.bx < 12) { s.bx = 12; s.bvx = Math.abs(s.bvx); } else if (s.bx > 88) { s.bx = 88; s.bvx = -Math.abs(s.bvx); }
        s.bump = Math.max(0, s.bump - dt);
        if (s.jt >= 0) {
          const k = s.jt / DUR;
          s.jt += dt;
          const dx = s.tx - s.hx;
          s.hx += Math.sign(dx) * Math.min(Math.abs(dx), 160 * dt);
          const head = 78 - hy();
          if (k < 0.5 && head <= 33 && Math.abs(s.hx - s.bx) < 8) {
            s.coins++; s.bump = 0.15; s.pop.push({ x: s.bx, y: 20, t: 0 }); sfx('coin');
            s.jt = DUR - s.jt; // start falling from the same height
            if (s.coins >= 3) return win();
          }
          if (s.jt > DUR) s.jt = -1;
        }
        for (const p of s.pop) { p.t += dt; p.y -= 30 * dt; }
        R(ctx, 0, 0, 100, 100, '#5c94fc');
        R(ctx, 8, 50, 16, 5, '#fff4e0'); R(ctx, 11, 47, 9, 3, '#fff4e0'); R(ctx, 70, 60, 18, 5, '#fff4e0');
        R(ctx, 0, 88, 100, 12, '#c84c0c'); for (let x = 0; x < 100; x += 8) { R(ctx, x, 88, 8, 1, '#fcbcb0'); R(ctx, x, 88, 1, 12, '#000000'); }
        put(ctx, spr(s.coins >= 3 ? QBLOCK_HIT : QBLOCK), s.bx, 28 - (s.bump > 0 ? 3 : 0), 1);
        for (const p of s.pop) if (p.t < 0.5) put(ctx, spr(COIN), p.x, p.y, 1);
        put(ctx, spr(s.jt >= 0 ? HERO_JUMP : HERO), s.hx, 83 - hy(), 1.2);
        txt(ctx, `${s.coins}/3`, 90, 8, '#ffe27a', 10);
        txt(ctx, 'TAP UNDER IT', 50, 95, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        await b.until(() => s.jt < 0);
        if (b.over()) break;
        const px = reflect(s.bx + s.bvx * 0.22, 12, 88);
        if (Math.abs(px - s.hx) > 40) { await b.tap({ x: px, y: 80 }); await b.until(() => s.jt < 0); continue; }
        await b.tap({ x: px, y: 80 });
        await b.wait(80);
      }
    },
  },

  // 13. Pump up the balloon monster until it pops.
  {
    id: 'cl-pump', cmd: 'Pump it!', theme: 'classic',
    setup({ stage, win, lose, sfx, speed, frame }) {
      const ctx = scene(stage);
      const need = 7 + Math.round(speed * 2);
      let air = 0, mx = 85, popT = -1;
      tapper(stage, () => { if (popT >= 0) return; air++; sfx('tap'); if (air >= need) { popT = 0; sfx('pop'); } });
      frame(dt => {
        if (popT >= 0) { popT += dt; if (popT > 0.3) return win(); }
        else {
          air = Math.max(0, air - 0.8 * speed * dt);
          mx -= 14 * speed * dt * (1 - Math.min(0.8, air / need));
          if (mx < 24) { sfx('nope'); return lose(); }
        }
        R(ctx, 0, 0, 100, 100, '#1a0c08');
        R(ctx, 0, 40, 100, 30, '#6b3d22'); R(ctx, 0, 38, 100, 2, '#a0663a'); R(ctx, 0, 70, 100, 2, '#a0663a');
        R(ctx, 0, 0, 100, 38, '#c84c0c'); R(ctx, 0, 72, 100, 28, '#8e2a2a');
        for (let i = 0; i < 12; i++) R(ctx, (i * 29) % 96, 4 + ((i * 17) % 30), 3, 2, '#e8803c');
        put(ctx, spr(HERO), 14, 56, 1.2);
        ctx.strokeStyle = '#fff4e0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(19, 56); ctx.lineTo(mx - 6, 56); ctx.stroke();
        const sc = 1 + Math.min(1.6, (air / need) * 1.6);
        if (popT < 0) put(ctx, spr(BALLOON), mx, 56 - (sc - 1) * 3, sc);
        else for (let i = 0; i < 10; i++) R(ctx, mx + Math.cos(i) * popT * 60, 56 + Math.sin(i) * popT * 60, 3, 3, i % 2 ? '#d0463c' : '#ffe27a');
        R(ctx, 30, 88, 40, 4, '#1a1220'); R(ctx, 30, 88, 40 * Math.min(1, air / need), 4, '#ffe27a');
        txt(ctx, 'TAP FAST!', 50, 82, '#fff4e0', 8);
      });
    },
    async solve(b) { while (!b.over()) await b.tap({ x: 50, y: 50 }); },
  },

  // 14. Light-gun: shoot the ducks.
  {
    id: 'cl-duck', cmd: 'Shoot!', theme: 'classic', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const n = speed > 1.6 ? 3 : 2;
      const s = expose({
        ducks: Array.from({ length: n }, (_, i) => ({ x: 20 + rnd(60), y: 70, vx: (24 + rnd(12)) * speed * (Math.random() < 0.5 ? -1 : 1), vy: -(22 + rnd(10)) * speed, hit: false, fall: 0 })),
        shells: n + 2, flash: 0,
      });
      tapper(stage, e => {
        if (s.shells <= 0) return;
        const p = pos(e);
        s.shells--; s.flash = 0.06; sfx('boom');
        const d = s.ducks.find(q => !q.hit && dist(q, p) < 8);
        if (d) { d.hit = true; sfx('pop'); }
        if (s.ducks.every(q => q.hit)) return;
        if (s.shells <= 0) { setTimeout(() => lose(), 150); }
      });
      let ft = 0;
      frame(dt => {
        ft += dt; s.flash = Math.max(0, s.flash - dt);
        for (const d of s.ducks) {
          if (d.hit) { d.fall += dt; d.y += 80 * dt; continue; }
          d.x += d.vx * dt; d.y += d.vy * dt;
          if (d.x < 8) { d.x = 8; d.vx = Math.abs(d.vx); } else if (d.x > 92) { d.x = 92; d.vx = -Math.abs(d.vx); }
          if (d.y < 8) { d.y = 8; d.vy = Math.abs(d.vy); } else if (d.y > 66) { d.y = 66; d.vy = -Math.abs(d.vy); }
        }
        if (s.ducks.every(q => q.hit && q.fall > 0.35)) return win();
        R(ctx, 0, 0, 100, 100, s.flash > 0 ? '#ffffff' : '#64b0ff');
        if (!s.flash) {
          R(ctx, 70, 40, 14, 34, '#3d7a34'); R(ctx, 64, 30, 26, 14, '#6fb04a');
          for (const d of s.ducks) if (d.y < 76) put(ctx, spr(d.hit ? DUCK_HIT : Math.floor(ft * 8) % 2 ? DUCK_FLAP : DUCK), d.x, d.y, 1.3, d.vx < 0);
          R(ctx, 0, 72, 100, 28, '#3d7a34'); for (let x = 0; x < 100; x += 6) R(ctx, x, 70, 3, 4, '#6fb04a');
          R(ctx, 0, 86, 100, 14, '#a0663a');
          for (let i = 0; i < s.shells; i++) R(ctx, 6 + i * 5, 90, 3, 6, '#d0463c');
          txt(ctx, 'TAP THE DUCKS', 64, 93, '#fff4e0', 7);
        }
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const d = s.ducks.find(q => !q.hit);
        if (!d) break;
        await b.tap({ x: d.x + d.vx * 0.02, y: d.y + d.vy * 0.02 });
        await b.wait(60);
      }
    },
  },

  // 15. Boxing: dodge the punch, then counter.
  {
    id: 'cl-punch', cmd: 'Counter!', theme: 'classic', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ state: 'idle', t: 0, side: 'L', dodge: null, hits: 0 });
      const wind = 0.9 / Math.sqrt(speed), idle = 0.45 / Math.sqrt(speed);
      tapper(stage, e => {
        const x = pos(e).x;
        if (s.state === 'wind' && !s.dodge && (x < 35 || x > 65)) { s.dodge = x < 35 ? 'L' : 'R'; sfx('swap'); }
        else if (s.state === 'dizzy' && x >= 30 && x <= 70) {
          s.hits++; sfx('boom'); s.state = s.hits >= 2 ? 'ko' : 'hurt'; s.t = 0;
        }
      });
      frame(dt => {
        s.t += dt;
        if (s.state === 'idle' && s.t > idle) { s.state = 'wind'; s.t = 0; s.side = Math.random() < 0.5 ? 'L' : 'R'; s.dodge = null; sfx('select'); }
        else if (s.state === 'wind' && s.t > wind) {
          // the punch lands; you must have dodged away from the glowing fist
          s.state = 'punch'; s.t = 0;
          if (s.dodge !== (s.side === 'L' ? 'R' : 'L')) { sfx('nope'); return lose(); }
          sfx('fizzle');
        } else if (s.state === 'punch' && s.t > 0.2) { s.state = 'dizzy'; s.t = 0; }
        else if (s.state === 'dizzy' && s.t > 0.9 / Math.sqrt(speed)) { s.state = 'idle'; s.t = 0; s.dodge = null; }
        else if (s.state === 'hurt' && s.t > 0.3) { s.state = 'idle'; s.t = 0; s.dodge = null; }
        else if (s.state === 'ko' && s.t > 0.35) return win();
        // ring
        R(ctx, 0, 0, 100, 100, '#2a1838');
        for (let i = 0; i < 20; i++) R(ctx, (i * 13) % 100, 4 + ((i * 7) % 20), 2, 2, '#5a3a7a');
        R(ctx, 0, 70, 100, 30, '#4f8fd0'); R(ctx, 0, 70, 100, 2, '#fff4e0');
        R(ctx, 0, 44, 100, 1, '#d0463c'); R(ctx, 0, 52, 100, 1, '#fff4e0'); R(ctx, 0, 60, 100, 1, '#d0463c');
        // opponent
        const ox = 50 + (s.state === 'hurt' || s.state === 'ko' ? (Math.random() - 0.5) * 4 : 0);
        const lean = s.state === 'ko' ? 8 : 0;
        R(ctx, ox - 9, 40 + lean, 18, 26, '#3d7a34');
        R(ctx, ox - 7, 22 + lean, 14, 16, '#c79a5a');
        R(ctx, ox - 4, 27 + lean, 2, 2, '#1a1220'); R(ctx, ox + 2, 27 + lean, 2, 2, '#1a1220');
        R(ctx, ox - 3, 33 + lean, 6, 1, s.state === 'dizzy' ? '#fff4e0' : '#8e2a2a');
        if (s.state === 'dizzy') txt(ctx, '★ ★', ox, 18, '#ffe27a', 8);
        const glow = s.state === 'wind' && Math.floor(s.t * 12) % 2 === 0;
        const fist = (side, x) => {
          const punching = s.state === 'punch' && s.side === side;
          const lit = s.state === 'wind' && s.side === side;
          R(ctx, x - 6, punching ? 50 : 42, 12, punching ? 18 : 10, lit && glow ? '#ffe27a' : '#d0463c');
          R(ctx, x - 6, punching ? 50 : 42, 12, 2, '#fff4e0');
        };
        fist('L', ox - 16); fist('R', ox + 16);
        // you: gloves at the bottom, shifted when dodging
        const you = s.dodge === 'L' ? 22 : s.dodge === 'R' ? 78 : 50;
        R(ctx, you - 16, 82, 10, 10, '#d0463c'); R(ctx, you + 6, 82, 10, 10, '#d0463c');
        R(ctx, you - 5, 86, 10, 14, '#c79a5a');
        txt(ctx, s.state === 'dizzy' ? 'PUNCH! (TAP MIDDLE)' : 'DODGE AWAY FROM THE GLOW', 50, 8, '#fff4e0', 7);
        txt(ctx, `${s.hits}/2`, 90, 18, '#ffe27a', 9);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        if (s.state === 'wind' && !s.dodge && s.t > 0.05) await b.tap({ x: s.side === 'L' ? 85 : 15, y: 60 });
        else if (s.state === 'dizzy') { await b.tap({ x: 50, y: 50 }); await b.wait(60); }
        else await b.wait(10);
      }
    },
  },

  // 16. Kart: hit the boost pads, miss the oil.
  {
    id: 'cl-kart', cmd: 'Boost!', theme: 'classic', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const LANES = [30, 50, 70];
      const rows = Array.from({ length: 7 }, (_, i) => {
        const a = rnd(3); let o = rnd(3); while (o === a) o = rnd(3);
        return { y: -6 - i * 30, boost: a, oil: o, got: false, passed: false };
      });
      const s = expose({ lane: 1, rows, boosts: 0, LANES });
      follow(stage, pos, p => (s.lane = p.x < 40 ? 0 : p.x > 60 ? 2 : 1));
      let scroll = 0;
      frame(dt => {
        const v = 60 * speed;
        scroll += v * dt;
        for (const r of rows) {
          r.y += v * dt;
          if (!r.passed && Math.abs(r.y - 82) < 6) {
            if (s.lane === r.oil) { sfx('nope'); return lose(); }
            if (s.lane === r.boost && !r.got) { r.got = true; s.boosts++; sfx('coin'); if (s.boosts >= 3) return win(); }
          }
          if (r.y > 90) r.passed = true;
        }
        R(ctx, 0, 0, 100, 100, '#3d7a34');
        R(ctx, 18, 0, 64, 100, '#5a5a6a');
        for (let y = (scroll % 20) - 20; y < 100; y += 20) { R(ctx, 39, y, 2, 10, '#fff4e0'); R(ctx, 59, y, 2, 10, '#fff4e0'); R(ctx, 16, y, 2, 10, '#d0463c'); R(ctx, 82, y, 2, 10, '#d0463c'); R(ctx, 16, y + 10, 2, 10, '#fff4e0'); R(ctx, 82, y + 10, 2, 10, '#fff4e0'); }
        for (const r of rows) {
          if (r.y < -10 || r.y > 105) continue;
          if (!r.got) {
            const x = LANES[r.boost];
            R(ctx, x - 7, r.y - 5, 14, 10, '#ffe27a');
            ctx.fillStyle = '#f39a3a'; ctx.beginPath(); ctx.moveTo(x, r.y - 4); ctx.lineTo(x + 5, r.y + 2); ctx.lineTo(x - 5, r.y + 2); ctx.closePath(); ctx.fill();
          }
          const ox = LANES[r.oil];
          R(ctx, ox - 6, r.y - 3, 12, 6, '#1a1220'); R(ctx, ox - 4, r.y - 4, 7, 8, '#1a1220'); R(ctx, ox - 2, r.y - 2, 3, 1, '#6a3e94');
        }
        const kx = LANES[s.lane];
        R(ctx, kx - 5, 76, 10, 13, '#d0463c'); R(ctx, kx - 3, 79, 6, 5, '#9fd3f2');
        R(ctx, kx - 7, 77, 2, 4, '#1a1220'); R(ctx, kx + 5, 77, 2, 4, '#1a1220'); R(ctx, kx - 7, 85, 2, 4, '#1a1220'); R(ctx, kx + 5, 85, 2, 4, '#1a1220');
        txt(ctx, `BOOST ${s.boosts}/3`, 50, 6, '#ffe27a', 8);
      });
    },
    async solve(b, s) {
      b.down({ x: 50, y: 80 });
      while (!b.over()) {
        const r = s.rows.filter(q => !q.passed && q.y < 89).sort((p, q) => q.y - p.y)[0];
        if (r) b.move({ x: s.LANES[r.got ? (s.lane !== r.oil ? s.lane : (r.oil + 1) % 3) : r.boost], y: 80 });
        await b.wait(16);
      }
      b.up({ x: 50, y: 80 });
    },
  },

  // 17. Fishing: strike when the bobber dips.
  {
    id: 'cl-fish', cmd: 'Reel it in!', theme: 'classic',
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const wait = (0.8 + Math.random() * 1.4) / speed;
      const fake = Math.random() < 0.6 ? wait * (0.3 + Math.random() * 0.3) : -1;
      const s = expose({ state: 'wait', t: 0 });
      const dip = 0.65 / Math.sqrt(speed);
      let caught = -1;
      tapper(stage, () => {
        if (s.state === 'dip') { s.state = 'caught'; caught = 0; sfx('coin'); }
        else if (s.state === 'wait') { s.state = 'gone'; sfx('nope'); lose(); }
      });
      frame(dt => {
        s.t += dt;
        if (s.state === 'wait' && s.t > wait) { s.state = 'dip'; s.t = 0; sfx('drip'); }
        else if (s.state === 'dip' && s.t > dip) { s.state = 'gone'; sfx('fizzle'); return lose(); }
        if (caught >= 0) { caught += dt; if (caught > 0.45) return win(); }
        R(ctx, 0, 0, 100, 100, '#f8c8a8'); R(ctx, 0, 0, 100, 20, '#f39a3a');
        R(ctx, 60, 8, 14, 14, '#ffe27a');
        R(ctx, 0, 40, 100, 60, '#2c5a9a');
        for (let i = 0; i < 8; i++) R(ctx, ((i * 23 + s.t * 10) % 110) - 5, 46 + i * 7, 8, 1, '#4f8fd0');
        R(ctx, 0, 34, 40, 8, '#6b3d22'); R(ctx, 0, 30, 40, 4, '#a0663a');
        put(ctx, spr(HERO), 14, 23, 1.1);
        // rod and line
        const wig = s.state === 'wait' && fake > 0 && s.t > fake && s.t < fake + 0.25 ? Math.sin(s.t * 60) * 1 : 0;
        const by = s.state === 'dip' ? 52 : s.state === 'caught' ? 52 - caught * 80 : 44 + Math.sin(s.t * 3) * 0.8 + wig;
        ctx.strokeStyle = '#6b3d22'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(18, 22); ctx.lineTo(40, 6); ctx.stroke();
        ctx.strokeStyle = '#fff4e0'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(40, 6); ctx.lineTo(66, by - 3); ctx.stroke();
        if (s.state !== 'caught') { R(ctx, 64, by - 3, 4, 3, '#d0463c'); R(ctx, 64, by, 4, 3, '#fff4e0'); }
        if (s.state === 'dip') { R(ctx, 58, 44, 2, 2, '#fff4e0'); R(ctx, 72, 44, 2, 2, '#fff4e0'); txt(ctx, '!', 66, 34, '#ffe27a', 14); }
        if (s.state === 'caught') put(ctx, spr(FISH), 66, by + 4, 1.6);
        txt(ctx, 'TAP WHEN IT DIPS', 50, 94, '#fff4e0', 7);
      });
    },
    async solve(b, s) { await b.until(() => s.state === 'dip'); await b.wait(40); await b.tap({ x: 50, y: 50 }); },
  },

  // 18. Rhythm: hit the falling notes.
  {
    id: 'cl-rhythm', cmd: 'Hit the notes!', theme: 'classic', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const XS = [25, 50, 75], COLS = ['#f08ab0', '#ffe27a', '#9fd3f2'];
      const v = 55 * speed, gap = 0.45 / Math.sqrt(speed);
      const s = expose({ notes: Array.from({ length: 6 }, (_, i) => ({ lane: rnd(3), y: -6 - i * v * gap, hit: false, gone: false })), hits: 0, miss: 0, flash: [0, 0, 0] });
      const LINE = 82;
      tapper(stage, e => {
        const lane = clamp(Math.floor(pos(e).x / 33.4), 0, 2);
        s.flash[lane] = 0.12;
        const n = s.notes.find(q => !q.hit && !q.gone && q.lane === lane && Math.abs(q.y - LINE) < 7);
        if (n) { n.hit = true; s.hits++; sfx('peg', s.hits); if (s.hits >= 5) return win(); }
        else { s.miss++; sfx('nope'); if (s.miss >= 2) return lose(); }
      });
      frame(dt => {
        s.flash = s.flash.map(f => Math.max(0, f - dt));
        for (const n of s.notes) {
          if (n.hit || n.gone) continue;
          n.y += v * dt;
          if (n.y > LINE + 9) { n.gone = true; s.miss++; sfx('nope'); if (s.miss >= 2) return lose(); }
        }
        R(ctx, 0, 0, 100, 100, '#1a0c2c');
        for (let i = 0; i < 3; i++) {
          R(ctx, XS[i] - 10, 0, 20, 100, s.flash[i] > 0 ? '#3a2a5c' : '#24183a');
          R(ctx, XS[i] - 10, LINE - 4, 20, 8, '#5a3a7a');
          ctx.strokeStyle = COLS[i]; ctx.lineWidth = 1; ctx.strokeRect(XS[i] - 9.5, LINE - 3.5, 19, 7);
        }
        for (const n of s.notes) if (!n.hit && !n.gone && n.y > -8) { R(ctx, XS[n.lane] - 8, n.y - 3, 16, 6, COLS[n.lane]); R(ctx, XS[n.lane] - 8, n.y - 3, 16, 1, '#fff4e0'); }
        txt(ctx, `${s.hits}/5`, 90, 6, '#ffe27a', 9);
        txt(ctx, 'TAP THE LANE', 40, 95, '#c8a0ec', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const n = s.notes.find(q => !q.hit && !q.gone && Math.abs(q.y - 82) < 3.5);
        if (n) await b.tap({ x: [25, 50, 75][n.lane], y: 60 });
        else await b.wait(6);
      }
    },
  },

  // 19. Skateboard: hold for a big ollie, tap for a small one.
  {
    id: 'cl-ollie', cmd: 'Ollie!', theme: 'classic', time: 7,
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const v = 40 * speed, n = speed > 1.6 ? 3 : 2;
      const kinds = shuffle(['cone', 'bin', ...(n === 3 ? [pick(['cone', 'bin'])] : [])]);
      const s = expose({ hx: 25, v, jt: -1, H: 12, crouch: false, obs: kinds.map((k, i) => ({ k, x: 108 + i * v * 1.4, passed: false })) });
      const AIR = 0.7;
      const hy = () => (s.jt >= 0 ? Math.sin((Math.PI * s.jt) / AIR) * s.H : 0);
      holdable(stage, () => { if (s.jt < 0) { s.crouch = true; sfx('select'); } }, held => {
        if (!s.crouch) return;
        s.crouch = false; s.jt = 0; s.H = clamp(12 + held * 80, 12, 38); sfx('swap');
      });
      let ft = 0;
      frame(dt => {
        ft += dt;
        if (s.jt >= 0 && (s.jt += dt) > AIR) s.jt = -1;
        for (const o of s.obs) {
          o.x -= v * dt;
          const half = o.k === 'cone' ? 5 : 6, tall = o.k === 'cone' ? 8 : 20;
          if (!o.passed && Math.abs(o.x - s.hx) < half && hy() < tall) { sfx('nope'); return lose(); }
          if (!o.passed && o.x < s.hx - half - 2) { o.passed = true; sfx('coin'); }
        }
        if (s.obs.every(o => o.passed)) return win();
        R(ctx, 0, 0, 100, 100, '#f8b0d4');
        R(ctx, 0, 30, 100, 50, '#c8a0ec');
        for (let x = -((ft * v * 0.4) % 25); x < 100; x += 25) { R(ctx, x, 40, 16, 40, '#a46ad0'); R(ctx, x + 3, 45, 4, 4, '#ffe27a'); R(ctx, x + 9, 55, 4, 4, '#ffe27a'); }
        R(ctx, 0, 80, 100, 20, '#5a5a6a'); for (let x = -((ft * v) % 16); x < 100; x += 16) R(ctx, x, 89, 8, 1, '#8a8a9a');
        for (const o of s.obs) {
          if (o.x > 104) continue;
          if (o.k === 'cone') put(ctx, spr(CONE), o.x, 77, 1.4);
          else { R(ctx, o.x - 6, 60, 12, 20, '#3d7a34'); R(ctx, o.x - 7, 58, 14, 3, '#6fb04a'); R(ctx, o.x - 3, 64, 1, 14, '#6fb04a'); R(ctx, o.x + 2, 64, 1, 14, '#6fb04a'); }
        }
        const yy = 72 - hy() + (s.crouch ? 2 : 0);
        put(ctx, spr(s.jt >= 0 ? HERO_JUMP : HERO), s.hx, yy, 1.1);
        R(ctx, s.hx - 6, yy + 6, 12, 2, '#d0463c'); R(ctx, s.hx - 5, yy + 8, 2, 2, '#1a1220'); R(ctx, s.hx + 3, yy + 8, 2, 2, '#1a1220');
        txt(ctx, 'TAP = HOP · HOLD = BIG OLLIE', 50, 95, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      for (const o of s.obs) {
        const hold = o.k === 'cone' ? 0.04 : 0.4;
        await b.until(() => s.jt < 0 && (o.x - s.hx) / s.v <= 0.35 + hold);
        if (b.over()) return;
        b.down({ x: 50, y: 50 });
        await b.wait(hold * 1000);
        b.up({ x: 50, y: 50 });
        await b.until(() => o.passed);
      }
    },
  },

  // 20. Boss fight: shoot the weak spot three times.
  {
    id: 'cl-boss', cmd: 'Beat the boss!', theme: 'classic', time: 12, boss: true,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({
        bx: 50, bvx: 20 * speed, open: false, ct: 0, hp: 3, me: 3, hx: 50, shots: [], fire: [], inv: 0, ft: 0,
        openFor: 1.2, closedFor: 1.3 / Math.sqrt(speed),
      });
      follow(stage, pos, (p, phase) => {
        s.hx = clamp(p.x, 6, 94);
        if (phase === 'down' && s.shots.length < 2) { s.shots.push({ x: s.hx, y: 82 }); sfx('swap'); }
      });
      let hurt = 0;
      frame(dt => {
        s.ft += dt; s.inv = Math.max(0, s.inv - dt); hurt = Math.max(0, hurt - dt);
        s.bx += s.bvx * dt;
        if (s.bx < 20) { s.bx = 20; s.bvx = Math.abs(s.bvx); } else if (s.bx > 80) { s.bx = 80; s.bvx = -Math.abs(s.bvx); }
        s.ct += dt;
        if (s.open ? s.ct > s.openFor : s.ct > s.closedFor) { s.open = !s.open; s.ct = 0; }
        if (s.ft > 0.6 && Math.floor((s.ft - dt) / (0.95 / speed)) !== Math.floor(s.ft / (0.95 / speed))) s.fire.push({ x: s.bx, y: 32 });
        for (const f of s.fire) f.y += 42 * speed * dt;
        s.fire = s.fire.filter(f => f.y < 104);
        for (const f of s.fire) if (!f.spent && s.inv <= 0 && Math.abs(f.x - s.hx) < 6 && f.y > 80 && f.y < 94) {
          f.spent = true; s.me--; s.inv = 0.8; sfx('nope');
          if (s.me <= 0) return lose();
        }
        for (const sh of s.shots) {
          sh.y -= 140 * dt;
          if (!sh.spent && sh.y <= 30 && Math.abs(sh.x - s.bx) < 6) {
            sh.spent = true;
            if (s.open) { s.hp--; hurt = 0.25; sfx('boom'); if (s.hp <= 0) return win(); }
            else sfx('land');
          } else if (!sh.spent && sh.y <= 30 && Math.abs(sh.x - s.bx) < 16) { sh.spent = true; sfx('land'); }
        }
        s.shots = s.shots.filter(sh => !sh.spent && sh.y > -5);
        // draw
        R(ctx, 0, 0, 100, 100, '#1a0820'); stars(ctx, 4, 30, '#4a2a5a');
        R(ctx, 0, 92, 100, 8, '#3a2a5c');
        const bx = s.bx + (hurt > 0 ? (Math.random() - 0.5) * 4 : 0);
        R(ctx, bx - 18, 10, 36, 22, hurt > 0 ? '#ffffff' : '#6a3e94'); R(ctx, bx - 18, 10, 36, 2, '#a46ad0');
        R(ctx, bx - 22, 16, 4, 10, '#6a3e94'); R(ctx, bx + 18, 16, 4, 10, '#6a3e94');
        R(ctx, bx - 12, 14, 6, 4, '#d0463c'); R(ctx, bx + 6, 14, 6, 4, '#d0463c');
        R(ctx, bx - 6, 22, 12, 8, s.open ? (Math.floor(s.ft * 10) % 2 ? '#ffe27a' : '#f39a3a') : '#3a2a5c');
        if (!s.open) { R(ctx, bx - 6, 22, 12, 1, '#a46ad0'); R(ctx, bx - 1, 22, 2, 8, '#a46ad0'); }
        for (let i = 0; i < 3; i++) R(ctx, 30 + i * 14, 4, 12, 3, i < s.hp ? '#d0463c' : '#3a2a5c');
        for (const f of s.fire) { R(ctx, f.x - 2, f.y - 2, 4, 4, '#f39a3a'); R(ctx, f.x - 1, f.y - 1, 2, 2, '#ffe27a'); }
        for (const sh of s.shots) R(ctx, sh.x - 0.5, sh.y - 3, 1, 5, '#9fd3f2');
        if (!(s.inv > 0 && Math.floor(s.ft * 16) % 2)) put(ctx, spr(SHIP), s.hx, 87, 1.2);
        for (let i = 0; i < s.me; i++) R(ctx, 4 + i * 5, 95, 3, 3, '#f08ab0');
        txt(ctx, s.open ? 'SHOOT THE CORE!' : 'WAIT FOR THE CORE…', 60, 96, s.open ? '#ffe27a' : '#8a6aa8', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const tt = (82 - 30) / 140;
        const aim = reflect(s.bx + s.bvx * tt, 20, 80);
        const threat = s.fire.some(f => !f.spent && f.y > 50 && f.y < 95 && Math.abs(f.x - s.hx) < 9);
        const aimSafe = !s.fire.some(f => !f.spent && f.y > 45 && f.y < 95 && Math.abs(f.x - aim) < 9);
        if (s.open && s.openFor - s.ct > tt + 0.08 && aimSafe && !s.shots.length) { await b.tap({ x: aim, y: 88 }); await b.wait(60); }
        else if (threat) {
          let best = s.hx, bd = -1;
          for (let x = 8; x <= 92; x += 4) {
            const d = Math.min(...s.fire.filter(f => !f.spent && f.y > 45).map(f => Math.abs(f.x - x)), 99);
            if (d > bd) { bd = d; best = x; }
          }
          await b.tap({ x: best, y: 88 });
        } else await b.wait(10);
      }
    },
  },

  // 21. Swipe in the secret code.
  {
    id: 'cl-code', cmd: 'Enter the code!', theme: 'classic', time: 8,
    setup({ stage, win, lose, sfx, pos, expose }) {
      const code = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right'];
      const ARROW = { up: '↑', down: '↓', left: '←', right: '→' };
      const cells = code.map(d => h('b', {}, ARROW[d]));
      stage.style.background = '#1a1220';
      stage.append(h('p', { class: 'cl-code-title' }, 'SECRET CODE'), h('div', { class: 'cl-code' }, cells), h('p', { class: 'mc-note' }, 'Swipe each arrow in order'));
      const s = expose({ code, i: 0 });
      cells[0].classList.add('next');
      swipe(stage, pos, dir => {
        if (s.i >= code.length) return;
        if (dir !== code[s.i]) { sfx('nope'); cells[s.i].style.background = '#d0463c'; return lose(); }
        cells[s.i].classList.remove('next'); cells[s.i].classList.add('on'); sfx('type');
        s.i++;
        if (s.i >= code.length) { sfx('coin'); return win(); }
        cells[s.i].classList.add('next');
      });
    },
    async solve(b, s) { for (const d of s.code) { await b.swipe(d); await b.wait(40); } },
  },
];

// ---------- Cross! helpers ----------
function carX(lane, x0, t) {
  let x = (x0 + lane.v * t) % 140;
  if (x < 0) x += 140;
  return x - 20;
}
function danger(lane, t, r = 10) { return lane.cars.some(x0 => Math.abs(carX(lane, x0, t) - 50) < r); }
// Find hop times that get the frog from lane `from` (0 = kerb) to the far side by `limit` seconds.
function plan(lanes, from, t0, limit) {
  const L = lanes.length, DT = 0.05, HOP = 3;
  const steps = Math.ceil((limit - t0) / DT);
  const safe = (lane, k) => lane === 0 || lane > L || !danger(lanes[lane - 1], t0 + k * DT, 13);
  const seen = new Set();
  const stack = [[from, 0, []]];
  while (stack.length) {
    const [lane, k, hops] = stack.pop();
    if (lane > L) return hops;
    if (k >= steps) continue;
    const key = lane * 10000 + k;
    if (seen.has(key)) continue;
    seen.add(key);
    // stay put one step
    if (safe(lane, k + 1)) stack.push([lane, k + 1, hops]);
    // hop: the next lane must be clear now and for a short while after
    let ok = true;
    for (let j = 0; j <= HOP; j++) if (!safe(lane + 1, k + j)) { ok = false; break; }
    if (ok) stack.push([lane + 1, k + HOP, [...hops, t0 + k * DT + 0.02]]);
  }
  return null;
}
