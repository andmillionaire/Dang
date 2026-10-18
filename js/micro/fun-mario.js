import { h } from '../ui.js';
import { rnd, pick, shuffle, clamp, dist, tapper, follow, art, canvas, addStyle } from './kit.js';

// Funtendo: Mushroom Kingdom, falling blocks and capsule doctoring, as quick microgames.
// Everything is drawn on a 100x100 pixel canvas that fills the stage, so canvas units == stage %.

addStyle('fun-mario', `
[class*="mcs-fm-"] .mc-canvas { position: absolute; inset: 0; width: 100% !important; height: 100% !important; display: block; image-rendering: pixelated; }
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
// a sprite centred on (x, y), optionally scaled, mirrored, or squashed to a fraction of its height
function put(ctx, s, x, y, sc = 1, flip = false, squash = 1) {
  if (!s.i.complete) return;
  const w = s.w * sc, hh = s.h * sc;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y + (hh * (1 - squash)) / 2));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(s.i, Math.round(-w / 2), Math.round(-(hh * squash) / 2), w, hh * squash);
  ctx.restore();
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
const scene = stage => canvas(stage, 100, 100).ctx;

// Sky, clouds, hills and the brick ground. gy = top of the ground.
function overworld(ctx, gy = 86, t = 0) {
  R(ctx, 0, 0, 100, 100, '#6b8cff');
  for (const [x, y] of [[14, 14], [62, 9], [88, 22]]) {
    const cx = ((x - t * 3) % 120 + 120) % 120 - 10;
    R(ctx, cx - 7, y, 14, 4, '#fff4e0'); R(ctx, cx - 4, y - 3, 8, 3, '#fff4e0');
  }
  R(ctx, 4, gy - 10, 16, 10, '#3d7a34'); R(ctx, 8, gy - 14, 8, 4, '#3d7a34'); R(ctx, 10, gy - 12, 1, 2, '#1a1220'); R(ctx, 13, gy - 12, 1, 2, '#1a1220');
  R(ctx, 0, gy, 100, 100 - gy, '#c84c0c');
  R(ctx, 0, gy, 100, 1, '#f8b878');
  for (let y = gy + 4; y < 100; y += 5) R(ctx, 0, y, 100, 1, '#7a2a00');
  for (let y = gy, k = 0; y < 100; y += 5, k++) for (let x = (k % 2) * 4; x < 100; x += 8) R(ctx, x, y + 1, 1, 4, '#7a2a00');
}
function pipe(ctx, x, top, bottom = 100, w = 14) {
  R(ctx, x - w / 2 + 1, top + 5, w - 2, bottom - top - 5, '#00a800'); R(ctx, x - w / 2 + 2, top + 5, 2, bottom - top - 5, '#80f080');
  R(ctx, x - w / 2 - 1, top, w + 2, 6, '#00a800'); R(ctx, x - w / 2, top + 1, 2, 4, '#80f080'); R(ctx, x - w / 2 - 1, top + 5, w + 2, 1, '#005000');
}
function castleBg(ctx) {
  R(ctx, 0, 0, 100, 100, '#1a0a10');
  for (let y = 4; y < 60; y += 8) for (let x = (y / 8) % 2 ? 0 : 6; x < 100; x += 12) R(ctx, x, y, 10, 6, '#2a1420');
}
function lava(ctx, y, t) {
  R(ctx, 0, y, 100, 100 - y, '#d0463c');
  for (let x = 0; x < 100; x += 10) R(ctx, x + ((t * 12) % 10), y, 5, 2, '#f39a3a');
  R(ctx, 0, y + 4, 100, 100, '#a02a1a');
}

// ---------- sprites ----------
const PLUM = ['..rrrr..', '.rrrrrrr', '.Bcckck.', '.Bcccccc', '..cBBBc.', '.rUrrUr.', 'rrUUUUrr', 'ccUyyUcc', '.UUUUUU.', 'BBB..BBB'];
const PLUM_J = ['..rrrr..', '.rrrrrrr', '.Bcckck.', '.Bcccccc', 'c.cBBBc.', 'crUrrUrc', '.rUUUUr.', '.UUyyUU.', 'UU....UU', 'BB....BB'];
const RIVAL = ['..GGGG..', '.GGGGGGG', '.Bcckck.', '.Bcccccc', '..cBBBc.', '.GUGGUG.', 'GGUUUUGG', 'ccUyyUcc', '.UUUUUU.', 'BBB..BBB'];
const GIRL = ['..fyyf..', '.ffffff.', 'ffkcckff', 'ffccccff', 'f.cccc.f', '.uwrrwu.', 'cuuwwuuc', '.UUUUUU.', 'UUUUUUUU', '.cc..cc.', 'ff....ff'];
const GOOMBA = ['...BBBB...', '.BBbbbbBB.', 'BbkwbbwkbB', 'BbbbbbbbbB', '.BbkkkkbB.', '..cccccc..', '.kk....kk.', 'kkk....kkk'];
const GOOMBA2 = ['...BBBB...', '.BBbbbbBB.', 'BbkwbbwkbB', 'BbbbbbbbbB', '.BbkkkkbB.', '..cccccc..', '..kk..kk..', '.kkk..kkk.'];
const GOOMBA_FLAT = ['.BBBBBBBB.', 'BbkwbbwkbB', 'BBBBBBBBBB', 'kkkk..kkkk'];
const SHELL = ['..GGGG..', '.GgGgGG.', 'GgGgGgGG', 'GGgGgGgG', 'wwwwwwww', '.wwwwww.'];
const BOO = ['..wwwww..', '.wwwwwww.', 'wwkwwwkww', 'wwkwwwkww', 'wwwwwwwww', 'wwfkkkfww', '.wwwwwww.', 'w.ww.ww.w'];
const BOO_SHY = ['..wwwww..', '.wwwwwww.', 'wcwwwwwcw', 'ccwwwwwcc', 'wwwwwwwww', 'wwwfkfwww', '.wwwwwww.', 'w.ww.ww.w'];
const COIN = ['.nnn.', 'nnwnn', 'nnwnn', 'nnwnn', 'nnwnn', 'nnNnn', '.nnn.'];
const QBLOCK = ['NNNNNNNNNN', 'NnnnnnnnnN', 'NnnkkkknnN', 'NnkknnkknN', 'NnnnnkknnN', 'NnnnkknnnN', 'NnnnkknnnN', 'NnnnnnnnnN', 'NnnnkknnnN', 'NNNNNNNNNN'];
const USED = ['BBBBBBBBBB', 'BbbbbbbbbB', 'BbBbbbbBbB', 'BbbbbbbbbB', 'BbbbbbbbbB', 'BbbbbbbbbB', 'BbbbbbbbbB', 'BbBbbbbBbB', 'BbbbbbbbbB', 'BBBBBBBBBB'];
const BRICK = ['QQQQQQQQ', 'qqqQqqqQ', 'qqqQqqqQ', 'QQQQQQQQ', 'QqqqQqqq', 'QqqqQqqq', 'QQQQQQQQ'];
const STAR = ['....y....', '...yyy...', 'yyyyyyyyy', '.yykykyy.', '..yyyyy..', '.yyyyyyy.', '.yy...yy.', 'yy.....yy'];
const APPLE = ['...G..', '.rrRr.', 'rrwrrr', 'rrrrrr', 'rrrrrr', '.rrrr.'];
const MELON = ['.gggg.', 'gGgGgg', 'gggGgg', 'gGgggG', '.gggg.'];
const SPINY = ['w.w.w.w', 'rrrrrrr', 'rrkrkrr', 'rrrrrrr', '.ccccc.'];
const BROOCH = ['..yyyy..', '.yfffFy.', 'yffyyfFy', 'yfyyyyFy', 'yfyyyyFy', 'yffyyfFy', '.yfffFy.', '..yyyy..'];
const TIARA = ['....r....', '...yry...', 'y.yyyyy.y', 'yyyyyyyyy', '.nnnnnnn.'];
const MUSH = ['..rrrr..', '.rwrrwr.', 'rwwrrwwr', 'rrrrrrrr', '.cckkcc.', '.cccccc.', '..cccc..'];
const BANANA = ['......yN', '.....yy.', '....yyy.', 'y..yyyy.', 'yyyyyy..', '.yyyy...'];
const BOMB = ['.....yo', '....k..', '..kkkk.', '.kkwkkk', 'kkwkkkk', 'kkkkkkk', '.kkkkk.', '..kkk..'];
const PSWITCH = ['..UUUU..', '.UUwwUU.', '.UwUUwU.', '.UwwwUU.', '.UwUUUU.', 'UUUUUUUU', 'ssssssss'];

const heroHy = (jt, T, H) => (jt >= 0 ? Math.sin((Math.PI * jt) / T) * H : 0);

// Tap, swipe and drag on one stage. tap(p) fires on release for short, still presses.
function gestures(stage, pos, { tap, swipe, drag }) {
  let st = null;
  stage.addEventListener('pointerdown', e => {
    e.preventDefault();
    const p = pos(e);
    st = { p, t: performance.now() };
    try { stage.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    drag && drag(p, 'down');
  });
  stage.addEventListener('pointermove', e => { if (st && drag) drag(pos(e), 'move'); });
  const up = e => {
    if (!st) return;
    const p = pos(e), dx = p.x - st.p.x, dy = p.y - st.p.y, d = Math.hypot(dx, dy), held = performance.now() - st.t, s0 = st;
    st = null;
    drag && drag(p, 'up', d < 5 && held < 350);
    if (d < 5 && held < 350) tap && tap(s0.p);
    else if (d >= 12 && swipe) swipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), dx, dy);
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', () => (st = null));
}

// ---------- falling-block helpers ----------
const SHAPES = {
  I: [[0, 0], [0, 1], [0, 2], [0, 3]], O: [[0, 0], [0, 1], [1, 0], [1, 1]], T: [[0, 0], [0, 1], [0, 2], [1, 1]],
  L: [[0, 0], [1, 0], [2, 0], [2, 1]], J: [[0, 1], [1, 1], [2, 1], [2, 0]], S: [[0, 1], [0, 2], [1, 0], [1, 1]], Z: [[0, 0], [0, 1], [1, 1], [1, 2]],
};
const BCOL = { I: '#4fd0e0', O: '#ffe27a', T: '#a46ad0', L: '#f39a3a', J: '#4f8fd0', S: '#6fb04a', Z: '#d0463c' };
const norm = cells => {
  const mr = Math.min(...cells.map(c => c[0])), mc = Math.min(...cells.map(c => c[1]));
  return cells.map(([r, c]) => [r - mr, c - mc]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
};
const rotations = shape => { const out = [norm(SHAPES[shape])]; for (let i = 0; i < 3; i++) out.push(norm(out[i].map(([r, c]) => [c, -r]))); return out; };
const keyOf = cells => norm(cells).map(c => c.join(',')).join(';');
// every column of the shape starts at its top row and has no gaps, so it drops cleanly into a hole
const openTop = cells => {
  const cols = {};
  for (const [r, c] of cells) (cols[c] ||= []).push(r);
  return Object.values(cols).every(rs => { rs.sort((a, b) => a - b); return rs[0] === 0 && rs.every((r, i) => r === i); });
};
function block(ctx, x, y, s, col) {
  R(ctx, x, y, s, s, col);
  R(ctx, x, y, s, 1, 'rgba(255,255,255,0.45)'); R(ctx, x, y, 1, s, 'rgba(255,255,255,0.3)');
  R(ctx, x, y + s - 1, s, 1, 'rgba(0,0,0,0.35)'); R(ctx, x + s - 1, y, 1, s, 'rgba(0,0,0,0.3)');
}
function well(ctx, x0, y0, cols, rows, cs) {
  R(ctx, 0, 0, 100, 100, '#141c34');
  for (let i = 0; i < 26; i++) R(ctx, (i * 37) % 100, (i * 53) % 100, 1, 1, '#2a3a5c');
  R(ctx, x0 - 2, y0, cols * cs + 4, rows * cs + 2, '#9fb4d0');
  R(ctx, x0, y0, cols * cs, rows * cs, '#0a0e1c');
}

// ---------- capsule-doctor helpers ----------
const VCOL = { r: '#d0463c', b: '#4f8fd0', y: '#ffe27a' };
function virus(ctx, x, y, s, col, t = 0) {
  const bob = Math.sin(t * 8 + x) > 0 ? 0 : 1;
  R(ctx, x + 1, y + 1 + bob, s - 2, s - 2, col);
  R(ctx, x, y + 2 + bob, s, s - 4, col);
  R(ctx, x + 2, y + 2 + bob, 2, 2, '#fff4e0'); R(ctx, x + s - 4, y + 2 + bob, 2, 2, '#fff4e0');
  R(ctx, x + 2, y + 3 + bob, 1, 1, '#1a1220'); R(ctx, x + s - 3, y + 3 + bob, 1, 1, '#1a1220');
  R(ctx, x + 2, y + s - 3 + bob, s - 4, 1, '#1a1220');
}
function pill(ctx, x, y, s, col) {
  R(ctx, x + 1, y, s - 2, s, col); R(ctx, x, y + 1, s, s - 2, col);
  R(ctx, x + 1, y + 1, 2, 1, 'rgba(255,255,255,0.6)');
}
function bottle(ctx, x0, y0, cols, rows, cs) {
  R(ctx, 0, 0, 100, 100, '#1a2440');
  for (let y = 0; y < 100; y += 6) for (let x = (y / 6) % 2 ? 0 : 3; x < 100; x += 6) R(ctx, x, y, 2, 2, '#22305a');
  R(ctx, x0 - 3, y0 - 3, cols * cs + 6, rows * cs + 6, '#9fd3f2');
  R(ctx, x0 - 1, y0 - 1, cols * cs + 2, rows * cs + 2, '#0a0e1c');
  R(ctx, x0 + (cols * cs) / 2 - 8, y0 - 9, 16, 7, '#9fd3f2'); R(ctx, x0 + (cols * cs) / 2 - 6, y0 - 7, 12, 5, '#0a0e1c');
}

// ---------- the turtle king (castle boss) ----------
function king(ctx, x, y, flash = false, dizzy = false, t = 0) {
  const sh = flash ? '#ffffff' : '#3d7a34', body = flash ? '#ffffff' : '#f2c84b';
  R(ctx, x - 10, y - 14, 22, 18, sh); // shell
  for (let i = 0; i < 4; i++) { R(ctx, x - 7 + i * 5, y - 17, 2, 3, '#fff4e0'); }
  R(ctx, x - 8, y - 12, 18, 2, '#6fb04a');
  R(ctx, x - 14, y - 6, 10, 12, body); // belly
  R(ctx, x - 20, y - 20, 12, 11, body); // head
  R(ctx, x - 18, y - 24, 10, 5, '#d0463c'); // hair
  R(ctx, x - 20, y - 25, 2, 4, '#fff4e0'); R(ctx, x - 11, y - 25, 2, 4, '#fff4e0'); // horns
  R(ctx, x - 18, y - 17, 2, 2, dizzy && Math.floor(t * 8) % 2 ? '#fff4e0' : '#1a1220');
  R(ctx, x - 22, y - 13, 4, 2, '#fff4e0'); // snout
  R(ctx, x - 12, y + 4, 6, 4, '#c84c0c'); R(ctx, x + 2, y + 4, 6, 4, '#c84c0c'); // feet
  if (dizzy) for (let i = 0; i < 3; i++) R(ctx, x - 14 + Math.cos(t * 6 + i * 2) * 8, y - 30 + Math.sin(t * 6 + i * 2) * 2, 2, 2, '#ffe27a');
}

// ---------- the microgames ----------
export default [
  // 1. Leap for the top of the flagpole.
  {
    id: 'fm-flag', cmd: 'Grab the flagpole!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const T = 0.8, H = 46, POLE = 76;
      const s = expose({ hx: 6, jt: -1, v: 26 * speed, T, POLE, done: 0, grab: 0, ok: false });
      tapper(stage, () => { if (s.jt < 0 && !s.done) { s.jt = 0; sfx('swap'); } });
      let tt = 0;
      frame(dt => {
        tt += dt;
        if (!s.done) {
          s.hx += s.v * dt;
          if (s.jt >= 0 && (s.jt += dt) > T) s.jt = -1;
          if (s.hx >= POLE - 3) {
            s.done = 1; s.grab = heroHy(s.jt, T, H); s.ok = s.grab >= 26;
            if (s.ok) { sfx('coin'); win(); } else { sfx('nope'); lose(); }
          }
        } else if (s.ok) s.grab = Math.max(0, s.grab - 50 * dt);
        overworld(ctx, 86, tt);
        // castle
        R(ctx, 84, 62, 16, 24, '#c84c0c'); R(ctx, 88, 54, 10, 8, '#c84c0c'); R(ctx, 90, 74, 6, 12, '#1a1220');
        for (let x = 84; x < 100; x += 4) R(ctx, x, 60, 2, 2, '#c84c0c');
        // pole with its gold "top grab" zone and the flag
        R(ctx, POLE, 14, 2, 72, '#80f080'); R(ctx, POLE - 1, 10, 4, 4, '#00a800');
        R(ctx, POLE + 2, 14, 1, 36, '#ffe27a');
        const fy = s.ok ? 16 + (46 - s.grab) * 1.2 : 16;
        R(ctx, POLE - 12, fy, 12, 8, '#fff4e0'); R(ctx, POLE - 9, fy + 2, 5, 4, '#00a800');
        R(ctx, POLE - 3, 84, 8, 2, '#7a2a00');
        const y = 79 - (s.done ? s.grab : heroHy(s.jt, T, H));
        put(ctx, spr(s.jt >= 0 || s.done ? PLUM_J : PLUM), s.done ? POLE - 3 : s.hx, y, 1.3);
        txt(ctx, 'TAP TO JUMP — GRAB IT HIGH!', 50, 95, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      await b.until(() => s.hx >= s.POLE - 3 - (s.v * s.T) / 2);
      await b.tap({ x: 50, y: 50 });
    },
  },

  // 2. Bonk a multi-coin block over and over.
  {
    id: 'fm-coinblock', cmd: 'Bonk for coins!', theme: 'funtendo',
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const need = 8 + Math.round(speed * 3);
      const s = expose({ bx: 50, vx: speed > 1.2 ? 14 * speed : 0, n: 0, need, bump: 0 });
      const coins = [];
      tapper(stage, e => {
        const p = pos(e);
        if (Math.abs(p.x - s.bx) < 13 && p.y > 18 && p.y < 66) {
          s.n++; s.bump = 0.12; coins.push({ x: s.bx, y: 30, t: 0 }); sfx('coin');
          if (s.n >= need) win();
        } else sfx('tap');
      });
      let tt = 0;
      frame(dt => {
        tt += dt;
        s.bx += s.vx * dt;
        if (s.bx < 25) { s.bx = 25; s.vx = Math.abs(s.vx); } else if (s.bx > 75) { s.bx = 75; s.vx = -Math.abs(s.vx); }
        s.bump = Math.max(0, s.bump - dt);
        overworld(ctx, 86, tt);
        for (const c of coins) { c.t += dt; c.y -= 60 * dt; }
        for (const c of coins) if (c.t < 0.4) put(ctx, spr(COIN), c.x, c.y, 1.4);
        put(ctx, spr(s.n >= need ? USED : QBLOCK), s.bx, 40 - s.bump * 40, 1.6);
        put(ctx, spr(s.bump > 0 ? PLUM_J : PLUM), s.bx, s.bump > 0 ? 62 : 79, 1.3);
        put(ctx, spr(COIN), 8, 8, 1); txt(ctx, `×${s.n}/${need}`, 22, 8, '#fff4e0', 8);
        txt(ctx, 'TAP THE BLOCK FAST!', 50, 95, '#fff4e0', 7);
      });
    },
    async solve(b, s) { while (!b.over()) { await b.tap({ x: s.bx + s.vx * 0.03, y: 40 }); await b.wait(30); } },
  },

  // 3. Stomp the mushroom marchers before they reach you.
  {
    id: 'fm-goomba', cmd: 'Stomp ’em!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const n = speed > 1.5 ? 4 : 3;
      const s = expose({ gs: Array.from({ length: n }, (_, i) => ({ x: 50 + i * 16 + rnd(5), v: (8 + rnd(5)) * speed, dead: 0, ft: 0 })) });
      tapper(stage, e => {
        const p = pos(e);
        const g = s.gs.filter(g => !g.dead && Math.abs(p.x - g.x) < 9 && p.y > 60 && p.y < 96).sort((a, c) => a.x - c.x)[0];
        if (!g) return sfx('tap');
        g.dead = 1; sfx('pop');
        if (s.gs.every(g => g.dead)) win();
      });
      let tt = 0;
      frame(dt => {
        tt += dt;
        for (const g of s.gs) {
          if (g.dead) { g.ft += dt; continue; }
          g.x -= g.v * dt;
          if (g.x < 17) { sfx('nope'); return lose(); }
        }
        overworld(ctx, 86, tt);
        put(ctx, spr(PLUM), 9, 79, 1.3);
        for (const g of s.gs) {
          if (!g.dead) put(ctx, spr(Math.floor(tt * 6 + g.x) % 2 ? GOOMBA : GOOMBA2), g.x, 81, 1.2);
          else if (g.ft < 0.4) put(ctx, spr(GOOMBA_FLAT), g.x, 84, 1.2);
        }
        txt(ctx, 'TAP THEM TO STOMP!', 50, 94, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const g = s.gs.filter(g => !g.dead).sort((a, c) => a.x - c.x)[0];
        if (g) await b.tap({ x: g.x - g.v * 0.02, y: 80 });
        await b.wait(40);
      }
    },
  },

  // 4. Kick the shell down the line, then hop it on the rebound.
  {
    id: 'fm-shell', cmd: 'Kick the shell!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const T = 0.55, H = 22;
      const s = expose({
        hx: 14, jt: -1, sx: 24, svx: 0, kicked: false, back: false, ret: 70 + 20 * speed,
        gs: [56, 70, 84].map(x => ({ x, dead: 0, ft: 0 })), gv: 7 * speed,
      });
      const hy = () => heroHy(s.jt, T, H);
      gestures(stage, pos, {
        tap: () => { if (s.jt < 0) { s.jt = 0; sfx('swap'); } },
        swipe: dir => { if (dir === 'right' && !s.kicked) { s.kicked = true; s.svx = 85; sfx('swap'); } },
      });
      let tt = 0;
      frame(dt => {
        tt += dt;
        if (s.jt >= 0 && (s.jt += dt) > T) s.jt = -1;
        for (const g of s.gs) {
          if (g.dead) { g.ft += dt; continue; }
          g.x -= s.gv * dt;
          if (s.kicked && Math.abs(g.x - s.sx) < 7) { g.dead = 1; sfx('pop'); }
          else if (g.x - s.hx < 7) { sfx('nope'); return lose(); }
        }
        if (s.kicked) {
          s.sx += s.svx * dt;
          if (s.sx >= 88 && s.svx > 0) { s.svx = -s.ret; s.back = true; sfx('land'); }
          if (s.back && Math.abs(s.sx - s.hx) < 6 && hy() < 8) { sfx('nope'); return lose(); }
          if (s.back && s.sx < -4) { sfx('coin'); return win(); }
        }
        overworld(ctx, 86, tt);
        pipe(ctx, 95, 64, 86);
        for (const g of s.gs) {
          if (!g.dead) put(ctx, spr(Math.floor(tt * 6 + g.x) % 2 ? GOOMBA : GOOMBA2), g.x, 81, 1.2);
          else if (g.ft < 0.5) put(ctx, spr(GOOMBA), g.x, 81 - g.ft * 80, 1.2, false);
        }
        put(ctx, spr(SHELL), s.sx, 83, 1.3);
        put(ctx, spr(s.jt >= 0 ? PLUM_J : PLUM), s.hx, 79 - hy(), 1.3);
        txt(ctx, s.kicked ? 'TAP TO HOP THE SHELL!' : 'SWIPE RIGHT TO KICK!', 50, 94, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      await b.swipe('right', { x: 30, y: 60 });
      await b.until(() => s.back && s.sx - s.hx < s.ret * 0.22);
      await b.tap({ x: 50, y: 50 });
    },
  },

  // 5. Fling bouncing fireballs at the incoming enemies.
  {
    id: 'fm-fire', cmd: 'Fireball!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const n = speed > 1.6 ? 4 : 3;
      const s = expose({ es: [], fb: [], n, hx: 12 });
      const times = Array.from({ length: n }, (_, i) => 0.2 + (i * 0.85) / speed);
      tapper(stage, () => { if (s.fb.length < 2) { s.fb.push({ x: 19, y: 78, vy: -30 }); sfx('swap'); } });
      let tt = 0;
      frame(dt => {
        tt += dt;
        while (s.es.length < n && tt >= times[s.es.length]) s.es.push({ x: 104, dead: 0, ft: 0, kind: s.es.length % 2 });
        for (const f of s.fb) { f.x += 72 * dt; f.vy += 320 * dt; f.y += f.vy * dt; if (f.y > 82) { f.y = 82; f.vy = -62; } }
        for (const e of s.es) {
          if (e.dead) { e.ft += dt; continue; }
          e.x -= (11 + 4 * speed) * dt;
          const f = s.fb.find(f => Math.abs(f.x - e.x) < 5);
          if (f) { e.dead = 1; f.gone = true; sfx('pop'); }
          else if (e.x < 20) { sfx('nope'); return lose(); }
        }
        s.fb = s.fb.filter(f => !f.gone && f.x < 104);
        if (s.es.length === n && s.es.every(e => e.dead)) return win();
        overworld(ctx, 86, tt);
        put(ctx, spr(PLUM, { r: '#fff4e0', U: '#d0463c' }), s.hx, 79, 1.3);
        for (const e of s.es) {
          if (!e.dead) put(ctx, spr(e.kind ? SHELL : (Math.floor(tt * 6 + e.x) % 2 ? GOOMBA : GOOMBA2)), e.x, e.kind ? 83 : 81, 1.2);
          else if (e.ft < 0.4) { R(ctx, e.x - 4, 76, 8, 8, '#f39a3a'); R(ctx, e.x - 2, 78, 4, 4, '#ffe27a'); }
        }
        for (const f of s.fb) { R(ctx, f.x - 2, f.y - 2, 4, 4, '#f39a3a'); R(ctx, f.x - 1, f.y - 1, 2, 2, '#ffe27a'); }
        // the fire flower power-up badge
        R(ctx, 4, 4, 9, 9, '#1a1220'); R(ctx, 5, 5, 7, 4, '#f39a3a'); R(ctx, 7, 6, 3, 2, '#ffe27a'); R(ctx, 8, 9, 1, 3, '#3d7a34');
        txt(ctx, 'TAP TO THROW FIRE!', 50, 94, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        if (s.es.some(e => !e.dead && e.x < 102) && s.fb.length < 2) await b.tap({ x: 50, y: 50 });
        await b.wait(110);
      }
    },
  },

  // 6. Drop down the right warp pipe as it scrolls by.
  {
    id: 'fm-pipe', cmd: 'Take the warp pipe!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const mark = 1 + rnd(2);
      const s = expose({ v: 20 * speed, pipes: Array.from({ length: 4 }, (_, i) => ({ x: 60 + i * 22, tall: 58 + rnd(3) * 6, mark: i === mark })), hx: 40, dive: 0, done: false });
      const mk = () => s.pipes.find(p => p.mark);
      gestures(stage, pos, {
        swipe: dir => {
          if (dir !== 'down' || s.done) return;
          s.done = true;
          const under = s.pipes.find(p => Math.abs(p.x - s.hx) < 7);
          if (under && under.mark) { s.dive = 0.01; sfx('land'); setTimeout(win, 300); } else { sfx('nope'); lose(); }
        },
      });
      let tt = 0;
      frame(dt => {
        tt += dt;
        if (!s.done) for (const p of s.pipes) p.x -= s.v * dt;
        if (s.dive) s.dive += dt;
        if (!s.done && mk().x < s.hx - 8) { s.done = true; sfx('nope'); lose(); }
        overworld(ctx, 86, tt);
        for (const p of s.pipes) {
          pipe(ctx, p.x, p.tall, 86);
          if (p.mark) { const a = Math.floor(tt * 6) % 2; R(ctx, p.x - 3, p.tall - 9 - a, 6, 2, '#ffe27a'); R(ctx, p.x - 2, p.tall - 7 - a, 4, 2, '#ffe27a'); R(ctx, p.x - 1, p.tall - 5 - a, 2, 1, '#ffe27a'); }
        }
        // the hero rides a little cloud above the pipes
        const cy = 30 + Math.sin(tt * 4) * 1.5;
        R(ctx, s.hx - 8, cy + 6, 16, 4, '#fff4e0'); R(ctx, s.hx - 5, cy + 4, 10, 2, '#fff4e0');
        const hy = s.dive ? cy + s.dive * 120 : cy;
        if (!s.dive || s.dive < 0.25) put(ctx, spr(PLUM), s.hx, hy, 1.3);
        txt(ctx, 'SWIPE DOWN OVER THE ARROW PIPE', 50, 94, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      const m = s.pipes.find(p => p.mark);
      await b.until(() => m.x <= s.hx + s.v * 0.07);
      await b.swipe('down', { x: 50, y: 30 });
    },
  },

  // 7. Drop the bridge when the turtle king is right over the lava.
  {
    id: 'fm-axe', cmd: 'Cut the bridge!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const s = expose({ kx: 96, v: 13 * speed, zone: [36, 68], cut: 0, kfall: 0 });
      tapper(stage, () => {
        if (s.cut) return;
        s.cut = 0.01;
        if (s.kx >= s.zone[0] && s.kx <= s.zone[1]) { sfx('boom'); setTimeout(win, 400); } else { sfx('nope'); lose(); }
      });
      let tt = 0;
      frame(dt => {
        tt += dt;
        if (!s.cut) {
          s.kx -= s.v * (0.7 + 0.5 * Math.abs(Math.sin(tt * 2))) * dt;
          if (s.kx < 22) { sfx('nope'); return lose(); }
        } else { s.cut += dt; s.kfall += dt * 90; }
        castleBg(ctx);
        lava(ctx, 78, tt);
        // ledges and the bridge
        R(ctx, 0, 62, 18, 40, '#7a2a00'); R(ctx, 86, 62, 14, 40, '#7a2a00');
        const fallen = s.cut && s.kx >= s.zone[0] && s.kx <= s.zone[1];
        for (let x = 18; x < 86; x += 4) {
          const dy = fallen ? Math.max(0, s.cut * 120 - (x - 18) * 0.6) : 0;
          R(ctx, x, 62 + dy, 3, 4, '#c84c0c');
        }
        R(ctx, s.zone[0], 67, s.zone[1] - s.zone[0], 1, 'rgba(255,226,122,0.6)');
        // chain and axe
        R(ctx, 90, 44, 1, 18, '#9fb4d0'); R(ctx, 89, 40, 6, 6, '#9fb4d0'); R(ctx, 94, 41, 3, 4, '#fff4e0');
        put(ctx, spr(PLUM), 10, 55, 1.3);
        king(ctx, s.kx + 8, 58 + (fallen ? s.kfall : 0), false, false, tt);
        txt(ctx, 'TAP TO CUT WHEN HE’S OVER THE GOLD', 50, 94, '#fff4e0', 7);
      });
    },
    async solve(b, s) { await b.until(() => s.kx <= (s.zone[0] + s.zone[1]) / 2 + 4); await b.tap({ x: 50, y: 50 }); },
  },

  // 8. Ghosts only creep up when you're not looking. Keep turning to face them.
  {
    id: 'fm-boo', cmd: 'Face the ghosts!', theme: 'funtendo', timeoutWins: true,
    setup({ stage, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const v = 10 * speed;
      const s = expose({ face: 1, boos: [{ x: 10, y: 62 }, { x: 90, y: 56 }] });
      tapper(stage, e => { const f = pos(e).x < 50 ? -1 : 1; if (f !== s.face) { s.face = f; sfx('select'); } });
      let tt = 0;
      frame(dt => {
        tt += dt;
        for (const bo of s.boos) {
          const side = Math.sign(bo.x - 50), faced = side === s.face;
          bo.faced = faced;
          if (faced) bo.x = clamp(bo.x + side * 8 * dt, 6, 94);
          else bo.x -= side * v * dt;
          if (Math.abs(bo.x - 50) < 9) { sfx('nope'); return lose(); }
        }
        R(ctx, 0, 0, 100, 100, '#1a1430');
        for (let y = 0; y < 86; y += 10) for (let x = (y / 10) % 2 ? 0 : 5; x < 100; x += 10) R(ctx, x, y, 6, 6, '#221a3c');
        R(ctx, 0, 86, 100, 14, '#3a2a5c'); R(ctx, 0, 86, 100, 1, '#6a4a9a');
        put(ctx, spr(PLUM), 50, 79, 1.4, s.face < 0);
        for (const bo of s.boos) put(ctx, spr(bo.faced ? BOO_SHY : BOO), bo.x, bo.y + Math.sin(tt * 3 + bo.x) * 2, 1.4, bo.x > 50);
        txt(ctx, 'TAP A SIDE TO LOOK THAT WAY', 50, 94, '#c8a0ec', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const near = s.boos.reduce((a, c) => (Math.abs(c.x - 50) < Math.abs(a.x - 50) ? c : a));
        const want = Math.sign(near.x - 50);
        if (want !== s.face) await b.tap({ x: want < 0 ? 20 : 80, y: 40 });
        await b.wait(25);
      }
    },
  },

  // 9. Stone crushers slam down; slide out from under them.
  {
    id: 'fm-thwomp', cmd: 'Dodge the crusher!', theme: 'funtendo', timeoutWins: true,
    setup({ stage, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const LANES = [22, 50, 78];
      const shake = 0.6 / Math.sqrt(speed);
      const s = expose({ hx: 50, LANES, th: LANES.map(x => ({ x, y: 18, st: 'idle', t: 0 })) });
      follow(stage, pos, p => { s.hx = clamp(p.x, 10, 90); });
      let tt = 0, next = 0.35;
      frame(dt => {
        tt += dt;
        const busy = s.th.some(t => t.st !== 'idle');
        if (!busy && tt >= next) {
          const near = LANES.reduce((a, c, i) => (Math.abs(c - s.hx) < Math.abs(LANES[a] - s.hx) ? i : a), 0);
          const lane = Math.random() < 0.7 ? near : rnd(3);
          Object.assign(s.th[lane], { st: 'shake', t: 0 });
        }
        for (const t of s.th) {
          t.t += dt;
          if (t.st === 'shake' && t.t > shake) { t.st = 'fall'; t.t = 0; }
          else if (t.st === 'fall') { t.y = Math.min(68, t.y + 520 * dt); if (t.y >= 68) { t.st = 'down'; t.t = 0; sfx('land'); } }
          else if (t.st === 'down' && t.t > 0.35) { t.st = 'rise'; t.t = 0; }
          else if (t.st === 'rise') { t.y = Math.max(18, t.y - 90 * dt); if (t.y <= 18) { t.st = 'idle'; next = tt + 0.25; } }
          if ((t.st === 'fall' || t.st === 'down') && t.y > 58 && Math.abs(s.hx - t.x) < 14) { sfx('nope'); return lose(); }
        }
        castleBg(ctx);
        R(ctx, 0, 86, 100, 14, '#6a6a7a'); R(ctx, 0, 86, 100, 1, '#9a9aaa');
        for (const t of s.th) {
          const jx = t.st === 'shake' ? (Math.random() - 0.5) * 2 : 0, x = t.x + jx;
          R(ctx, x - 9, t.y - 10, 18, 20, '#9a9aaa'); R(ctx, x - 9, t.y - 10, 18, 2, '#c8c8d8');
          for (const sx of [-11, 9]) R(ctx, x + sx, t.y - 6, 2, 12, '#9a9aaa');
          R(ctx, x - 6, t.y - 4, 4, 3, '#fff4e0'); R(ctx, x + 2, t.y - 4, 4, 3, '#fff4e0');
          R(ctx, x - 5, t.y - 3, 2, 2, '#1a1220'); R(ctx, x + 3, t.y - 3, 2, 2, '#1a1220');
          R(ctx, x - 7, t.y - 6, 5, 1, '#1a1220'); R(ctx, x + 2, t.y - 6, 5, 1, '#1a1220');
          R(ctx, x - 5, t.y + 3, 10, 2, '#1a1220');
          if (t.st === 'shake') txt(ctx, '!', t.x, t.y + 18, '#d0463c', 10);
        }
        put(ctx, spr(PLUM), s.hx, 79, 1.3);
        txt(ctx, 'DRAG TO DODGE', 50, 94, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      b.down({ x: s.hx, y: 80 });
      while (!b.over()) {
        const a = s.th.find(t => t.st === 'shake' || t.st === 'fall' || t.st === 'down');
        if (a && Math.abs(s.hx - a.x) < 20) {
          const safe = s.LANES.filter(x => x !== a.x).sort((p, q) => Math.abs(p - s.hx) - Math.abs(q - s.hx))[0];
          b.move({ x: safe, y: 80 });
        }
        await b.wait(20);
      }
      b.up({ x: s.hx, y: 80 });
    },
  },

  // 10. Bullets fly in high and low: duck the high ones, hop the low ones.
  {
    id: 'fm-bullet', cmd: 'Duck and jump!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const T = 0.6, H = 22, v = 55 * speed;
      const kinds = shuffle(['low', 'high', pick(['low', 'high'])]);
      const s = expose({ hx: 22, jt: -1, duck: 0, v, bs: kinds.map((k, i) => ({ k, at: 0.55 + i * Math.max(0.9, 1.0 / speed), x: 110, on: false, passed: false })) });
      const hy = () => heroHy(s.jt, T, H);
      gestures(stage, pos, {
        tap: () => { if (s.jt < 0 && s.duck <= 0) { s.jt = 0; sfx('swap'); } },
        swipe: dir => { if (dir === 'down' && s.jt < 0) { s.duck = 0.7; sfx('select'); } },
      });
      let tt = 0;
      frame(dt => {
        tt += dt;
        if (s.jt >= 0 && (s.jt += dt) > T) s.jt = -1;
        s.duck = Math.max(0, s.duck - dt);
        for (const bl of s.bs) {
          if (!bl.on && tt >= bl.at) bl.on = true;
          if (!bl.on || bl.passed) continue;
          bl.x -= v * dt;
          if (Math.abs(bl.x - s.hx) < 7) {
            if (bl.k === 'low' && hy() < 9) { sfx('nope'); return lose(); }
            if (bl.k === 'high' && s.duck <= 0) { sfx('nope'); return lose(); }
          }
          if (bl.x < s.hx - 8) { bl.passed = true; sfx('coin'); }
        }
        if (s.bs.every(b => b.passed)) return win();
        overworld(ctx, 86, tt);
        for (const bl of s.bs) {
          const y = bl.k === 'low' ? 81 : 70;
          if (!bl.on && bl.at - tt < 0.45) txt(ctx, '!', 95, y, '#d0463c', 10);
          if (bl.on && !bl.passed && bl.x < 106) {
            R(ctx, bl.x - 5, y - 3, 10, 6, '#1a1220'); R(ctx, bl.x - 6, y - 2, 1, 4, '#1a1220'); R(ctx, bl.x + 5, y - 3, 2, 6, '#3a3a4a');
            R(ctx, bl.x - 3, y - 2, 2, 2, '#fff4e0'); R(ctx, bl.x - 1, y + 1, 3, 1, '#fff4e0');
          }
        }
        if (s.duck > 0) put(ctx, spr(PLUM), s.hx, 79, 1.3, false, 0.5);
        else put(ctx, spr(s.jt >= 0 ? PLUM_J : PLUM), s.hx, 79 - hy(), 1.3);
        txt(ctx, 'TAP = JUMP · SWIPE DOWN = DUCK', 50, 94, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const bl = s.bs.find(x => x.on && !x.passed);
        if (bl) {
          const ttc = (bl.x - s.hx - 7) / s.v;
          if (bl.k === 'low' && ttc < 0.2 && s.jt < 0) await b.tap({ x: 50, y: 40 });
          else if (bl.k === 'high' && ttc < 0.38 && s.duck <= 0 && s.jt < 0) await b.swipe('down', { x: 50, y: 30 });
        }
        await b.wait(8);
      }
    },
  },

  // 11. Invincible! Plough through every enemy before the star wears off.
  {
    id: 'fm-star', cmd: 'Star power!', theme: 'funtendo', time: 6,
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const n = 4 + Math.round(speed);
      const s = expose({
        hx: 50, hy: 70, tx: 50, ty: 70,
        es: Array.from({ length: n }, (_, i) => ({ x: 12 + ((i * 37) % 76), y: 20 + ((i * 23) % 50), vx: (Math.random() < 0.5 ? -1 : 1) * (10 + rnd(10)) * speed, vy: (Math.random() < 0.5 ? -1 : 1) * (8 + rnd(8)) * speed, dead: 0, ft: 0 })),
      });
      follow(stage, pos, p => { s.tx = clamp(p.x, 6, 94); s.ty = clamp(p.y, 12, 90); });
      let tt = 0;
      frame(dt => {
        tt += dt;
        const d = Math.hypot(s.tx - s.hx, s.ty - s.hy), step = Math.min(d, 95 * dt);
        if (d > 0.01) { s.hx += ((s.tx - s.hx) / d) * step; s.hy += ((s.ty - s.hy) / d) * step; }
        for (const e of s.es) {
          if (e.dead) { e.ft += dt; e.y -= 60 * dt; continue; }
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (e.x < 6 || e.x > 94) e.vx *= -1;
          if (e.y < 14 || e.y > 88) e.vy *= -1;
          e.x = clamp(e.x, 6, 94); e.y = clamp(e.y, 14, 88);
          if (Math.hypot(e.x - s.hx, e.y - s.hy) < 9) { e.dead = 1; sfx('peg', s.es.filter(x => x.dead).length); }
        }
        if (s.es.every(e => e.dead)) return win();
        const hue = Math.floor(tt * 12) % 4;
        R(ctx, 0, 0, 100, 100, ['#2a1440', '#14284a', '#2a3a14', '#4a2a14'][hue]);
        for (let i = 0; i < 30; i++) R(ctx, (i * 37 + tt * 20) % 100, (i * 53) % 100, 1, 1, '#fff4e0');
        for (const e of s.es) if (!e.dead || e.ft < 0.5) put(ctx, spr(GOOMBA), e.x, e.y, 1.1, false, e.dead ? -1 : 1);
        put(ctx, spr(PLUM, { r: ['#ffe27a', '#f08ab0', '#9fd3f2', '#fff4e0'][hue], U: ['#d0463c', '#4f8fd0', '#6fb04a', '#a46ad0'][hue] }), s.hx, s.hy, 1.4);
        put(ctx, spr(STAR), 8, 8, 0.9); txt(ctx, `${s.es.filter(e => !e.dead).length} LEFT`, 26, 8, '#fff4e0', 8);
      });
    },
    async solve(b, s) {
      b.down({ x: s.hx, y: s.hy });
      while (!b.over()) {
        const e = s.es.filter(e => !e.dead).sort((p, q) => Math.hypot(p.x - s.hx, p.y - s.hy) - Math.hypot(q.x - s.hx, q.y - s.hy))[0];
        if (e) b.move({ x: e.x + e.vx * 0.08, y: e.y + e.vy * 0.08 });
        await b.wait(20);
      }
      b.up({ x: s.hx, y: s.hy });
    },
  },

  // 12. Count the coins that fly out of the block.
  {
    id: 'fm-count', cmd: 'How many coins?', theme: 'funtendo', time: 7,
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const k = 4 + rnd(4 + Math.round(speed * 2));
      const iv = 0.34 / Math.sqrt(speed);
      const s = expose({ k, el: null });
      const coins = [];
      let tt = 0, out = 0, asked = false;
      frame(dt => {
        tt += dt;
        if (out < k && tt > 0.4 + out * iv) { out++; coins.push({ y: 34, t: 0, x: 50 + (Math.random() - 0.5) * 6 }); sfx('coin'); }
        if (!asked && out === k && tt > 0.4 + k * iv + 0.35) {
          asked = true;
          const opts = shuffle([...new Set([k, k + 1, k - 1 > 0 ? k - 1 : k + 2])]);
          const btns = opts.map(v => tapper(h('button', { type: 'button', class: 'btn' }, String(v)), () => { sfx(v === k ? 'coin' : 'nope'); v === k ? win() : lose(); }));
          stage.append(h('div', { class: 'mc-answers' }, btns));
          s.el = btns[opts.indexOf(k)];
        }
        overworld(ctx, 86, tt);
        for (const c of coins) { c.t += dt; c.y -= 70 * dt; }
        for (const c of coins) if (c.t < 0.3) put(ctx, spr(COIN), c.x, c.y, 1.6);
        put(ctx, spr(out >= k ? USED : QBLOCK), 50, 44, 1.6);
        put(ctx, spr(PLUM_J), 50, 64, 1.3);
        if (!asked) txt(ctx, 'COUNT THE COINS!', 50, 94, '#fff4e0', 8);
      });
    },
    async solve(b, s) { await b.until(() => s.el); await b.tap(s.el); },
  },

  // 13. Tongue-grab the fruit, never the spiky shell.
  {
    id: 'fm-gulp', cmd: 'Gulp the fruit!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ items: [], eaten: 0, need: 3 });
      let tongue = null, spawned = 0, tt = 0, next = 0.15;
      const mouth = { x: 20, y: 66 };
      tapper(stage, e => {
        const p = pos(e);
        const it = s.items.filter(i => !i.gone && Math.hypot(i.x - p.x, i.y - p.y) < 10).sort((a, c) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(c.x - p.x, c.y - p.y))[0];
        if (!it) return sfx('tap');
        tongue = { x: it.x, y: it.y, t: 0 };
        if (it.spiny) { it.gone = true; sfx('nope'); return lose(); }
        it.gone = true; s.eaten++; sfx('pop');
        if (s.eaten >= s.need) win();
      });
      frame(dt => {
        tt += dt;
        if (tt >= next) {
          next = tt + 0.55 / speed;
          const spiny = spawned >= 2 && Math.random() < 0.3;
          s.items.push({ x: 104, y: 26 + rnd(40), vx: -(20 + 8 * speed), ph: Math.random() * 6, spiny, kind: rnd(2) });
          spawned++;
        }
        for (const i of s.items) { i.x += i.vx * dt; i.yy = i.y + Math.sin(tt * 3 + i.ph) * 3; }
        s.items = s.items.filter(i => i.x > -8 && !i.gone);
        if (tongue) tongue.t += dt;
        overworld(ctx, 86, tt);
        // the green dino
        R(ctx, 4, 64, 14, 22, '#6fb04a'); R(ctx, 8, 56, 14, 12, '#6fb04a'); R(ctx, 16, 58, 6, 8, '#6fb04a');
        R(ctx, 12, 58, 3, 3, '#fff4e0'); R(ctx, 13, 59, 1, 2, '#1a1220'); R(ctx, 4, 72, 6, 10, '#fff4e0');
        R(ctx, 2, 60, 4, 4, '#d0463c'); R(ctx, 6, 84, 6, 2, '#f39a3a'); R(ctx, 14, 84, 6, 2, '#f39a3a');
        if (tongue && tongue.t < 0.2) {
          ctx.strokeStyle = '#f08ab0'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(mouth.x, mouth.y); ctx.lineTo(tongue.x, tongue.y); ctx.stroke();
          R(ctx, tongue.x - 2, tongue.y - 2, 4, 4, '#f08ab0');
        }
        for (const i of s.items) put(ctx, spr(i.spiny ? SPINY : i.kind ? MELON : APPLE), i.x, i.yy, 1.6);
        txt(ctx, `TAP FRUIT · ${s.eaten}/${s.need} · NOT THE SPIKY ONE`, 50, 94, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const f = s.items.filter(i => !i.spiny && !i.gone && i.x > 12 && i.x < 96).sort((a, c) => a.x - c.x)[0];
        if (f) {
          const near = s.items.some(i => i.spiny && Math.hypot(i.x - f.x, (i.yy ?? i.y) - (f.yy ?? f.y)) < 12);
          if (!near) await b.tap({ x: f.x + f.vx * 0.02, y: f.yy ?? f.y });
        }
        await b.wait(50);
      }
    },
  },

  // 14. The winged blue shell homes in. Boost at the last second.
  {
    id: 'fm-blueshell', cmd: 'Dodge the blue shell!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const s = expose({ sy: -12, sx: 50, ky: 78, v: 30 + 12 * speed, used: false, dodged: 0, dist: 99 });
      tapper(stage, () => {
        if (s.used) return;
        s.used = true;
        if (s.dist <= 20 && s.dist >= 5) { s.dodged = 0.01; sfx('ring'); } else sfx('nope');
      });
      let tt = 0;
      frame(dt => {
        tt += dt;
        s.sy += s.v * dt;
        s.sx = 50 + Math.sin(tt * 5) * 10 * Math.max(0, 1 - s.sy / 70);
        s.dist = s.ky - s.sy;
        if (s.dodged) { s.dodged += dt; s.ky -= 120 * dt; if (s.dodged > 0.45) { sfx('boom'); return win(); } }
        else if (s.dist <= 3) { sfx('boom'); return lose(); }
        // road scrolling toward you
        R(ctx, 0, 0, 100, 100, '#3d7a34');
        R(ctx, 18, 0, 64, 100, '#6a6a7a');
        for (let y = -10; y < 100; y += 14) { const yy = (y + tt * 90) % 112 - 6; R(ctx, 49, yy, 2, 7, '#fff4e0'); R(ctx, 16, yy, 2, 7, '#d0463c'); R(ctx, 82, yy, 2, 7, '#d0463c'); }
        const ring = s.dist <= 20 && s.dist >= 5 && !s.used;
        // kart
        const ky = s.ky;
        R(ctx, 43, ky - 7, 14, 16, '#d0463c'); R(ctx, 40, ky - 5, 3, 5, '#1a1220'); R(ctx, 57, ky - 5, 3, 5, '#1a1220'); R(ctx, 40, ky + 4, 3, 5, '#1a1220'); R(ctx, 57, ky + 4, 3, 5, '#1a1220');
        R(ctx, 46, ky - 4, 8, 6, '#d0463c'); R(ctx, 47, ky - 6, 6, 3, '#ffe27a');
        if (s.dodged) for (let i = 0; i < 4; i++) R(ctx, 44 + i * 4, ky + 10 + rnd(6), 2, 4, '#f39a3a');
        if (ring) { ctx.strokeStyle = Math.floor(tt * 12) % 2 ? '#6fb04a' : '#ffe27a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(50, ky, 16, 0, Math.PI * 2); ctx.stroke(); }
        // the shell
        if (s.sy > -10 && !(s.dodged > 0.3)) {
          R(ctx, s.sx - 6, s.sy - 4, 12, 8, '#4f8fd0'); R(ctx, s.sx - 4, s.sy - 6, 8, 2, '#4f8fd0'); R(ctx, s.sx - 3, s.sy - 3, 2, 2, '#fff4e0'); R(ctx, s.sx + 1, s.sy - 1, 2, 2, '#fff4e0');
          const w = Math.floor(tt * 12) % 2 ? 3 : 1;
          R(ctx, s.sx - 11, s.sy - 4 - w, 5, 3, '#fff4e0'); R(ctx, s.sx + 6, s.sy - 4 - w, 5, 3, '#fff4e0');
        }
        put(ctx, spr(MUSH), 10, 10, 1.2); txt(ctx, s.used ? 'USED' : '×1', 22, 10, '#fff4e0', 8);
        txt(ctx, 'TAP TO BOOST WHEN THE RING GOES GREEN', 50, 95, '#fff4e0', 6);
      });
    },
    async solve(b, s) { await b.until(() => s.dist <= 13); await b.tap({ x: 50, y: 50 }); },
  },

  // 15. Item roulette — stop it on the magical tiara.
  {
    id: 'fm-roulette', cmd: 'Get the tiara!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const ITEMS = [[MUSH, 'mush'], [BANANA, 'banana'], [SHELL, 'shell'], [TIARA, 'tiara'], [COIN, 'coin'], [BOMB, 'bomb']];
      const s = expose({ idx: rnd(6), t: 0, iv: Math.max(0.12, 0.24 / speed), stopped: false, items: ITEMS.map(i => i[1]) });
      tapper(stage, () => {
        if (s.stopped) return;
        s.stopped = true;
        if (s.items[s.idx] === 'tiara') { sfx('sparkle'); win(); } else { sfx('nope'); lose(); }
      });
      let tt = 0;
      frame(dt => {
        tt += dt;
        if (!s.stopped) { s.t += dt; if (s.t >= s.iv) { s.t = 0; s.idx = (s.idx + 1) % 6; sfx('blip'); } }
        R(ctx, 0, 0, 100, 100, '#3a2a5c');
        for (let i = 0; i < 12; i++) R(ctx, 0, i * 9 + ((tt * 30) % 9), 100, 1, '#4a3a6c');
        // rainbow item box
        const cols = ['#d0463c', '#f39a3a', '#ffe27a', '#6fb04a', '#4f8fd0', '#a46ad0'];
        for (let i = 0; i < 6; i++) R(ctx, 30 + i, 22 + i, 40 - i * 2, 40 - i * 2, cols[(i + Math.floor(tt * 10)) % 6]);
        R(ctx, 36, 28, 28, 28, '#1a1220');
        put(ctx, spr(ITEMS[s.idx][0]), 50, 42, 2.4);
        put(ctx, spr(GIRL), 18, 78, 1.5);
        put(ctx, spr(TIARA), 82, 74, 1.6); txt(ctx, 'WANT', 82, 84, '#ffe27a', 7);
        txt(ctx, 'TAP TO STOP ON THE TIARA!', 50, 95, '#fff4e0', 7);
      });
    },
    async solve(b, s) { await b.until(() => s.items[s.idx] === 'tiara' && s.t < s.iv * 0.5); await b.tap({ x: 50, y: 50 }); },
  },

  // 16. Party-style tug of war. Mash!
  {
    id: 'fm-tug', cmd: 'Tug of war!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const s = expose({ f: 50 });
      tapper(stage, () => { s.f -= 2.2; sfx('tap'); if (s.f <= 30) win(); });
      let tt = 0;
      frame(dt => {
        tt += dt;
        s.f += (1.6 * speed + Math.sin(tt * 5) * 0.8) * dt;
        if (s.f >= 70) { sfx('nope'); return lose(); }
        R(ctx, 0, 0, 100, 100, '#6b8cff');
        R(ctx, 0, 72, 100, 28, '#6fb04a'); R(ctx, 0, 72, 100, 1, '#a8d870');
        R(ctx, 30, 72, 1, 28, '#fff4e0'); R(ctx, 70, 72, 1, 28, '#fff4e0'); R(ctx, 50, 66, 1, 34, '#d0463c');
        const off = s.f - 50;
        R(ctx, 8 + off, 62, 84, 2, '#c79a5a');
        R(ctx, s.f - 1, 58, 2, 10, '#1a1220'); R(ctx, s.f + 1, 58, 6, 4, '#d0463c');
        const lean = Math.sin(tt * 20) * 1;
        put(ctx, spr(PLUM), 12 + off + lean, 62, 1.5, true);
        put(ctx, spr(RIVAL), 88 + off - lean, 62, 1.5, false);
        txt(ctx, 'MASH!', 50, 20, '#ffe27a', 14);
        txt(ctx, 'PULL THE FLAG TO YOUR LINE', 50, 94, '#fff4e0', 7);
      });
    },
    async solve(b) { while (!b.over()) await b.tap({ x: 50, y: 50 }); },
  },

  // 17. Rotate and slide the falling block into its hole.
  {
    id: 'fm-fit', cmd: 'Rotate to fit!', theme: 'funtendo', time: 8,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const COLS = 8, ROWS = 12, CS = 7, X0 = 22, Y0 = 6;
      let shape, rots, tr;
      for (let tries = 0; tries < 50; tries++) {
        shape = pick(Object.keys(SHAPES));
        rots = rotations(shape);
        const ok = rots.map((r, i) => i).filter(i => openTop(rots[i]) && Math.max(...rots[i].map(c => c[0])) < 3);
        if (ok.length) { tr = pick(ok); break; }
      }
      const tw = Math.max(...rots[tr].map(c => c[1])) + 1;
      const tc = rnd(COLS - tw + 1);
      const target = rots[tr].map(([r, c]) => [r + 9, c + tc]);
      const tkey = target.map(c => c.join(',')).sort().join(';');
      const filled = new Set();
      for (let r = 9; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!target.some(t => t[0] === r && t[1] === c)) filled.add(r * COLS + c);
      const others = [0, 1, 2, 3].filter(i => keyOf(rots[i]) !== keyOf(rots[tr]));
      const p = { rot: others.length ? pick(others) : tr, row: 0, col: 0 };
      p.col = Math.floor((COLS - (Math.max(...rots[p.rot].map(c => c[1])) + 1)) / 2);
      const s = expose({ p, rots, tr, tc, done: false });
      const cells = (q = p) => rots[q.rot].map(([r, c]) => [r + q.row, c + q.col]);
      const fits = q => cells(q).every(([r, c]) => r >= 0 && r < ROWS && c >= 0 && c < COLS && !filled.has(r * COLS + c));
      const tryMove = d => { const q = { ...p, ...d }; if (fits(q)) { Object.assign(p, q); return true; } return false; };
      let clearT = 0;
      const lock = () => {
        s.done = true;
        const k = cells().map(c => c.join(',')).sort().join(';');
        if (k === tkey) { clearT = 0.01; sfx('ring'); setTimeout(win, 300); } else { sfx('nope'); lose(); }
      };
      gestures(stage, pos, {
        tap: q => {
          if (s.done) return;
          if (q.x < 33) tryMove({ col: p.col - 1 }) && sfx('select');
          else if (q.x > 67) tryMove({ col: p.col + 1 }) && sfx('select');
          else {
            const nr = (p.rot + 1) % 4, w = Math.max(...rots[nr].map(c => c[1])) + 1;
            const q2 = { ...p, rot: nr, col: Math.min(p.col, COLS - w) };
            if (fits(q2)) { Object.assign(p, q2); sfx('select'); }
          }
        },
        swipe: dir => { if (dir === 'down' && !s.done) { while (tryMove({ row: p.row + 1 })); sfx('land'); lock(); } },
      });
      let tt = 0, g = 0;
      frame(dt => {
        tt += dt;
        if (!s.done && (g += dt) > 0.75 / speed) { g = 0; if (!tryMove({ row: p.row + 1 })) lock(); }
        if (clearT) clearT += dt;
        well(ctx, X0, Y0, COLS, ROWS, CS);
        for (let r = 9; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          if (filled.has(r * COLS + c)) block(ctx, X0 + c * CS, Y0 + r * CS, CS, clearT && Math.floor(clearT * 20) % 2 ? '#fff4e0' : '#6a6a7a');
        }
        for (const [r, c] of target) R(ctx, X0 + c * CS + 2, Y0 + r * CS + 2, CS - 4, CS - 4, 'rgba(255,226,122,0.18)');
        for (const [r, c] of cells()) block(ctx, X0 + c * CS, Y0 + r * CS, CS, clearT && Math.floor(clearT * 20) % 2 ? '#fff4e0' : BCOL[shape]);
        txt(ctx, '◀', 8, 50, '#9fb4d0', 12); txt(ctx, '▶', 92, 50, '#9fb4d0', 12);
        txt(ctx, 'SIDES MOVE · MIDDLE SPINS · SWIPE ↓', 50, 96, '#fff4e0', 6);
      });
    },
    async solve(b, s) {
      const p = s.p;
      for (let i = 0; i < 4 && keyOf(s.rots[p.rot]) !== keyOf(s.rots[s.tr]); i++) { await b.tap({ x: 50, y: 50 }); await b.wait(30); }
      while (!b.over() && p.col !== s.tc) { await b.tap({ x: p.col > s.tc ? 15 : 85, y: 50 }); await b.wait(30); }
      await b.swipe('down', { x: 50, y: 30 });
    },
  },

  // 18. Line up the long bar for a four-line clear.
  {
    id: 'fm-tetris', cmd: 'Clear four lines!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const COLS = 8, ROWS = 12, CS = 7, X0 = 22, Y0 = 6;
      const gap = rnd(COLS);
      const s = expose({ col: gap > 3 ? 1 : 6, row: 0, gap, X0, CS, done: false });
      const blocked = c => c !== gap;
      const landRow = c => (blocked(c) ? 4 : 8); // top row the bar settles at
      let clearT = 0;
      const lock = () => {
        s.done = true;
        s.row = landRow(s.col);
        if (s.col === gap) { clearT = 0.01; sfx('ring'); setTimeout(win, 350); } else { sfx('nope'); lose(); }
      };
      follow(stage, pos, (p, ph) => {
        if (s.done) return;
        s.col = clamp(Math.floor((p.x - X0) / CS), 0, COLS - 1);
        if (ph === 'up') { sfx('land'); lock(); }
      });
      let tt = 0, g = 0;
      frame(dt => {
        tt += dt;
        if (!s.done && (g += dt) > 0.6 / speed) { g = 0; s.row++; if (s.row >= landRow(s.col)) lock(); }
        if (clearT) clearT += dt;
        well(ctx, X0, Y0, COLS, ROWS, CS);
        const flash = clearT && Math.floor(clearT * 20) % 2;
        for (let r = 8; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (c !== gap) block(ctx, X0 + c * CS, Y0 + r * CS, CS, flash ? '#fff4e0' : ['#d0463c', '#6fb04a', '#4f8fd0', '#f39a3a'][(r + c) % 4]);
        for (let r = 0; r < 4; r++) block(ctx, X0 + s.col * CS, Y0 + (s.row + r) * CS, CS, flash ? '#fff4e0' : BCOL.I);
        R(ctx, X0 + s.col * CS + 3, Y0, 1, (s.row) * CS, 'rgba(79,208,224,0.25)');
        if (clearT) txt(ctx, 'FOUR LINES!', 50, 40, '#ffe27a', 12);
        txt(ctx, 'DRAG THE BAR · LET GO TO DROP', 50, 96, '#fff4e0', 6);
      });
    },
    async solve(b, s) {
      const x = c => s.X0 + c * s.CS + s.CS / 2;
      await b.drag({ x: x(s.col), y: 30 }, { x: x(s.gap), y: 30 }, 200, 6);
    },
  },

  // 19. The falling piece won't fit — swap in the held bar.
  {
    id: 'fm-hold', cmd: 'Hold it!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const COLS = 8, ROWS = 12, CS = 7, X0 = 30, Y0 = 6;
      const gap = 1 + rnd(COLS - 2);
      const s = expose({ held: false, done: false });
      let piece = { shape: 'S', cells: rotations('S')[0], row: 0, col: clamp(gap - 1, 0, COLS - 3) };
      let clearT = 0, g = 0;
      const landAt = pc => {
        let r = pc.row;
        const ok = rr => pc.cells.every(([y, x]) => { const R2 = y + rr, C = x + pc.col; return R2 < ROWS && !(R2 >= 8 && C !== gap); });
        while (ok(r + 1)) r++;
        return r;
      };
      tapper(stage, e => {
        const p = pos(e);
        if (s.done || s.held) return;
        if (p.x < 26 && p.y < 34) {
          s.held = true; sfx('select');
          piece = { shape: 'I', cells: [[0, 0], [1, 0], [2, 0], [3, 0]], row: 0, col: gap };
          g = 0;
        } else sfx('tap');
      });
      frame(dt => {
        if (!s.done && (g += dt) > (s.held ? 0.07 : 0.3 / speed)) {
          g = 0;
          if (piece.row < landAt(piece)) piece.row++;
          else { s.done = true; if (piece.shape === 'I') { clearT = 0.01; sfx('ring'); setTimeout(win, 350); } else { sfx('nope'); lose(); } }
        }
        if (clearT) clearT += dt;
        well(ctx, X0, Y0, COLS, ROWS, CS);
        const flash = clearT && Math.floor(clearT * 20) % 2;
        for (let r = 8; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (c !== gap) block(ctx, X0 + c * CS, Y0 + r * CS, CS, flash ? '#fff4e0' : '#6a6a7a');
        for (const [r, c] of piece.cells) block(ctx, X0 + (c + piece.col) * CS, Y0 + (r + piece.row) * CS, CS, flash ? '#fff4e0' : BCOL[piece.shape]);
        // the hold box
        R(ctx, 3, 8, 22, 26, s.held ? '#3a3a4a' : '#ffe27a'); R(ctx, 5, 10, 18, 22, '#0a0e1c');
        txt(ctx, 'HOLD', 14, 5, '#ffe27a', 7);
        const hp = s.held ? { cells: rotations('S')[0], col: BCOL.S } : { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], col: BCOL.I };
        for (const [r, c] of hp.cells) block(ctx, 12 + c * 4 - (s.held ? 2 : 0), 13 + r * 4, 4, hp.col);
        if (!s.held && Math.floor(tt() * 4) % 2) txt(ctx, 'TAP!', 14, 40, '#fff4e0', 8);
        txt(ctx, 'IT WON’T FIT — TAP HOLD!', 58, 96, '#fff4e0', 6);
      });
      let t0 = performance.now();
      const tt = () => (performance.now() - t0) / 1000;
    },
    async solve(b) { await b.wait(150); await b.tap({ x: 14, y: 20 }); },
  },

  // 20. Drop a capsule on the virus to make four of a colour.
  {
    id: 'fm-virus', cmd: 'Zap the virus!', theme: 'funtendo', time: 7,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const COLS = 6, ROWS = 10, CS = 8, X0 = 26, Y0 = 12;
      const X = pick(['r', 'b', 'y']);
      const k = rnd(COLS);
      const grid = {};
      grid[`${ROWS - 1},${k}`] = { col: X, virus: true };
      grid[`${ROWS - 2},${k}`] = { col: X, virus: false };
      const others = ['r', 'b', 'y'].filter(c => c !== X);
      for (let i = 0; i < 4; i++) {
        const c = (k + 1 + rnd(COLS - 1)) % COLS, r = ROWS - 1 - rnd(3);
        if (!grid[`${r},${c}`]) grid[`${r},${c}`] = { col: pick(others), virus: true };
      }
      const cap = { r: 0, c: 2, vert: false };
      const s = expose({ cap, k, done: false });
      const cellsOf = q => (q.vert ? [[q.r, q.c], [q.r + 1, q.c]] : [[q.r, q.c], [q.r, q.c + 1]]);
      const fits = q => cellsOf(q).every(([r, c]) => r >= 0 && r < ROWS && c >= 0 && c < COLS && !grid[`${r},${c}`]);
      const tryMove = d => { const q = { ...cap, ...d }; if (fits(q)) { Object.assign(cap, q); return true; } return false; };
      let clearT = 0;
      const lock = () => {
        s.done = true;
        for (const [r, c] of cellsOf(cap)) grid[`${r},${c}`] = { col: X, virus: false };
        let run = 0;
        for (let r = 0; r < ROWS; r++) run = grid[`${r},${k}`]?.col === X ? run + 1 : run >= 4 ? run : 0;
        if (run >= 4) { clearT = 0.01; sfx('ring'); setTimeout(win, 350); } else { sfx('nope'); lose(); }
      };
      gestures(stage, pos, {
        tap: q => {
          if (s.done) return;
          if (q.x < 33) tryMove({ c: cap.c - 1 }) && sfx('select');
          else if (q.x > 67) tryMove({ c: cap.c + 1 }) && sfx('select');
          else if (!tryMove({ vert: !cap.vert })) tryMove({ vert: !cap.vert, c: cap.c - 1 }) && sfx('select');
          else sfx('select');
        },
        swipe: dir => { if (dir === 'down' && !s.done) { while (tryMove({ r: cap.r + 1 })); sfx('land'); lock(); } },
      });
      let tt = 0, g = 0;
      frame(dt => {
        tt += dt;
        if (!s.done && (g += dt) > 0.7 / speed) { g = 0; if (!tryMove({ r: cap.r + 1 })) lock(); }
        if (clearT) clearT += dt;
        bottle(ctx, X0, Y0, COLS, ROWS, CS);
        for (const [key, v] of Object.entries(grid)) {
          const [r, c] = key.split(',').map(Number);
          const flash = clearT && c === k && Math.floor(clearT * 20) % 2;
          if (flash) R(ctx, X0 + c * CS, Y0 + r * CS, CS, CS, '#fff4e0');
          else if (v.virus) virus(ctx, X0 + c * CS, Y0 + r * CS, CS, VCOL[v.col], tt);
          else pill(ctx, X0 + c * CS, Y0 + r * CS, CS, VCOL[v.col]);
        }
        if (!s.done) for (const [r, c] of cellsOf(cap)) pill(ctx, X0 + c * CS, Y0 + r * CS, CS, VCOL[X]);
        // the doctor
        R(ctx, 84, 30, 12, 16, '#fff4e0'); R(ctx, 86, 22, 8, 8, '#e8b088'); R(ctx, 85, 20, 10, 3, '#fff4e0'); R(ctx, 88, 21, 4, 2, '#9fd3f2');
        txt(ctx, '◀', 8, 50, '#9fb4d0', 12); txt(ctx, '▶', 92, 60, '#9fb4d0', 12);
        txt(ctx, 'MAKE FOUR OF A COLOUR IN A LINE', 50, 96, '#fff4e0', 6);
      });
    },
    async solve(b, s) {
      const cap = s.cap;
      if (!cap.vert) { await b.tap({ x: 50, y: 50 }); await b.wait(30); }
      while (!b.over() && cap.c !== s.k) { await b.tap({ x: cap.c > s.k ? 15 : 85, y: 50 }); await b.wait(30); }
      await b.swipe('down', { x: 50, y: 30 });
    },
  },

  // 21. Zap the virus that matches the capsule's colour, three times.
  {
    id: 'fm-colour', cmd: 'Match the colour!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ vs: [], want: 'r', round: 0, need: 3 });
      const deal = () => {
        const xs = shuffle([24, 50, 76]), ys = shuffle([44, 60, 72]);
        s.vs = ['r', 'b', 'y'].map((c, i) => ({ col: c, x: xs[i], y: ys[i], ph: Math.random() * 6 }));
        s.want = pick(['r', 'b', 'y']);
      };
      deal();
      tapper(stage, e => {
        const p = pos(e);
        const v = s.vs.find(v => Math.hypot(v.x + (v.dx || 0) - p.x, v.y + (v.dy || 0) - p.y) < 10);
        if (!v) return sfx('tap');
        if (v.col !== s.want) { sfx('nope'); return lose(); }
        sfx('pop');
        if (++s.round >= s.need) return win();
        deal();
      });
      let tt = 0;
      frame(dt => {
        tt += dt;
        for (const v of s.vs) { v.dx = Math.sin(tt * 3 * speed + v.ph) * 6; v.dy = Math.cos(tt * 2.4 * speed + v.ph) * 3; }
        bottle(ctx, 10, 30, 10, 6, 8);
        for (const v of s.vs) virus(ctx, v.x + (v.dx || 0) - 6, v.y + (v.dy || 0) - 6, 12, VCOL[v.col], tt);
        pill(ctx, 42, 8, 8, VCOL[s.want]); pill(ctx, 50, 8, 8, VCOL[s.want]);
        txt(ctx, `${s.round}/${s.need}`, 80, 12, '#fff4e0', 9);
        txt(ctx, 'TAP THE VIRUS THAT MATCHES THE PILL', 50, 96, '#fff4e0', 6);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const v = s.vs.find(v => v.col === s.want);
        if (v) await b.tap({ x: v.x + (v.dx || 0), y: v.y + (v.dy || 0) });
        await b.wait(90);
      }
    },
  },

  // 22. A magical girl throws her tiara like a boomerang.
  {
    id: 'fm-tiara', cmd: 'Tiara boomerang!', theme: 'funtendo',
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const G = { x: 14, y: 72 };
      const s = expose({
        G, ti: null,
        es: [0, 1, 2].map(i => ({ x: 48 + i * 18 + rnd(6), y: 24 + rnd(48), ph: Math.random() * 6, dead: 0, ft: 0 })),
      });
      const throwAt = (dx, dy) => {
        if (s.ti) return;
        const d = Math.hypot(dx, dy) || 1;
        s.ti = { x: G.x, y: G.y, vx: (dx / d) * 110, vy: (dy / d) * 110, out: 0, back: false };
        sfx('swap');
      };
      gestures(stage, pos, { tap: p => throwAt(p.x - G.x, p.y - G.y), swipe: (dir, dx, dy) => throwAt(dx, dy) });
      let tt = 0;
      frame(dt => {
        tt += dt;
        for (const e of s.es) { if (e.dead) e.ft += dt; e.yy = e.y + Math.sin(tt * 2 * speed + e.ph) * 3; }
        const t = s.ti;
        if (t) {
          if (!t.back) { t.x += t.vx * dt; t.y += t.vy * dt; t.out += 110 * dt; if (t.out > 90 || t.x > 98 || t.x < 2 || t.y < 2 || t.y > 92) t.back = true; }
          else { const d = Math.hypot(G.x - t.x, G.y - t.y); if (d < 5) s.ti = null; else { t.x += ((G.x - t.x) / d) * 140 * dt; t.y += ((G.y - t.y) / d) * 140 * dt; } }
          for (const e of s.es) if (!e.dead && s.ti && Math.hypot(e.x - t.x, e.yy - t.y) < 8) { e.dead = 1; sfx('pop'); }
          if (s.es.every(e => e.dead)) return win();
        }
        overworld(ctx, 86, tt);
        R(ctx, 0, 0, 100, 86, 'rgba(42,20,64,0.35)');
        for (const e of s.es) if (!e.dead || e.ft < 0.4) put(ctx, spr(GOOMBA), e.x, e.yy - (e.dead ? e.ft * 60 : 0), 1.2);
        put(ctx, spr(GIRL), G.x, G.y + 6, 1.4);
        if (s.ti) put(ctx, spr(TIARA), s.ti.x, s.ti.y, 1.3, Math.floor(tt * 16) % 2 === 1);
        else put(ctx, spr(TIARA), G.x, G.y - 4, 0.8);
        txt(ctx, 'TAP OR SWIPE TO THROW YOUR TIARA', 50, 94, '#fff4e0', 6);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        if (!s.ti) {
          const e = s.es.find(e => !e.dead);
          if (e) await b.tap({ x: e.x, y: e.yy ?? e.y });
        }
        await b.wait(40);
      }
    },
  },

  // 23. The moon brooch power-up slides away — catch it before it drops in the pit.
  {
    id: 'fm-brooch', cmd: 'Catch the brooch!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ gx: 30, tx: 30, bx: 50, by: 40, vx: 0, st: 'rise', t: 0, done: false });
      follow(stage, pos, p => { s.tx = clamp(p.x, 14, 94); });
      let tt = 0;
      frame(dt => {
        tt += dt;
        const d = s.tx - s.gx;
        s.gx += Math.sign(d) * Math.min(Math.abs(d), 60 * dt);
        s.t += dt;
        if (s.st === 'rise') { s.by = 40 - Math.min(1, s.t / 0.35) * 9; if (s.t > 0.35) { s.st = 'slide'; s.vx = 26 * speed; } }
        else if (s.st === 'slide') {
          s.bx += s.vx * dt;
          s.by = Math.min(81, s.by + (s.by < 81 && (s.bx > 57 || s.bx < 43) ? 120 * dt : 0));
          if (s.bx > 84 && s.vx > 0) { s.vx = -s.vx; sfx('land'); }
          if (s.by >= 81 && s.bx < 10) { s.st = 'fall'; }
        } else if (s.st === 'fall') { s.by += 100 * dt; if (!s.done) { s.done = true; sfx('nope'); return lose(); } }
        if (!s.done && s.st === 'slide' && s.by >= 75 && Math.abs(s.gx - s.bx) < 7) { s.done = true; s.st = 'got'; sfx('sparkle'); return win(); }
        overworld(ctx, 86, tt);
        R(ctx, 0, 86, 10, 14, '#1a1220'); // the pit
        pipe(ctx, 92, 66, 86);
        put(ctx, spr(USED), 50, 40, 1.6);
        if (s.st !== 'got') put(ctx, spr(BROOCH), s.bx, s.by, 1.3);
        put(ctx, spr(GIRL), s.gx, 79, 1.4);
        txt(ctx, 'DRAG TO RUN AND CATCH IT', 50, 94, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      b.down({ x: s.gx, y: 80 });
      while (!b.over()) { b.move({ x: s.bx + s.vx * 0.15, y: 80 }); await b.wait(20); }
      b.up({ x: s.gx, y: 80 });
    },
  },

  // 24. Hit the P switch, then run through the coins before they turn back into bricks.
  {
    id: 'fm-pswitch', cmd: 'P-Switch!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const need = 6;
      const s = expose({ hx: 12, tx: 12, on: 0, dur: 2.6 / Math.sqrt(speed), got: 0, need, bricks: Array.from({ length: 8 }, (_, i) => ({ x: 24 + i * 9, got: false })) });
      follow(stage, pos, (p, ph) => {
        if (ph === 'down' && p.y < 40 && Math.abs(p.x - 50) < 12) { if (!s.on) { s.on = 0.001; sfx('ring'); } return; }
        s.tx = clamp(p.x, 6, 96);
      });
      let tt = 0;
      frame(dt => {
        tt += dt;
        const d = s.tx - s.hx;
        let nx = s.hx + Math.sign(d) * Math.min(Math.abs(d), 75 * dt);
        if (!s.on) { const wall = s.bricks.find(b => b.x - 4 > s.hx && nx > b.x - 6); if (wall) nx = wall.x - 6; }
        s.hx = nx;
        if (s.on) {
          s.on += dt;
          for (const b of s.bricks) if (!b.got && Math.abs(b.x - s.hx) < 5) { b.got = true; s.got++; sfx('coin'); }
          if (s.got >= need) return win();
          if (s.on > s.dur) { sfx('nope'); return lose(); }
        }
        overworld(ctx, 86, tt);
        R(ctx, 42, 30, 16, 4, '#c84c0c');
        if (!s.on) put(ctx, spr(PSWITCH), 50, 25, 1.4); else R(ctx, 44, 30, 12, 1, '#4f8fd0');
        for (const b of s.bricks) {
          if (b.got) continue;
          put(ctx, spr(s.on ? COIN : BRICK), b.x, 81, s.on ? 1.4 : 1.1);
        }
        put(ctx, spr(PLUM), s.hx, 79, 1.3);
        if (s.on) { R(ctx, 10, 6, 80 * Math.max(0, 1 - s.on / s.dur), 3, '#4f8fd0'); }
        txt(ctx, s.on ? `RUN! ${s.got}/${need} COINS` : 'TAP THE P SWITCH, THEN RUN!', 50, 94, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      await b.tap({ x: 50, y: 25 });
      b.down({ x: s.hx, y: 80 });
      b.move({ x: 96, y: 80 });
      await b.until(() => b.over());
      b.up({ x: s.hx, y: 80 });
    },
  },

  // 25. Whack the biting plants as they pop out of the pipes.
  {
    id: 'fm-piranha', cmd: 'Bonk the plants!', theme: 'funtendo',
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const need = speed > 1.5 ? 5 : 4;
      const s = expose({ need, got: 0, ps: [16, 38, 60, 82].map(x => ({ x, ext: 0, st: 'down', t: 0 })) });
      tapper(stage, e => {
        const p = pos(e);
        const pl = s.ps.find(q => Math.abs(q.x - p.x) < 10 && q.ext > 0.4 && p.y > 32 && p.y < 76);
        if (!pl) return sfx('tap');
        pl.st = 'bonk'; pl.t = 0; s.got++; sfx('pop');
        if (s.got >= need) win();
      });
      let tt = 0, next = 0.2;
      frame(dt => {
        tt += dt;
        if (tt >= next) {
          next = tt + 0.5 / speed;
          const down = s.ps.filter(q => q.st === 'down');
          if (down.length) Object.assign(pick(down), { st: 'up', t: 0 });
        }
        for (const q of s.ps) {
          q.t += dt;
          if (q.st === 'up') { q.ext = Math.min(1, q.t / 0.18); if (q.t > 0.18 + 0.9 / Math.sqrt(speed)) { q.st = 'sink'; q.t = 0; } }
          else if (q.st === 'sink' || q.st === 'bonk') { q.ext = Math.max(0, q.ext - dt * (q.st === 'bonk' ? 8 : 5)); if (q.ext <= 0) { q.st = 'down'; } }
        }
        overworld(ctx, 86, tt);
        for (const q of s.ps) {
          const top = 70 - q.ext * 24;
          if (q.ext > 0) {
            R(ctx, q.x - 1, top + 8, 2, 70 - top, '#3d7a34'); R(ctx, q.x - 5, top + 12, 4, 2, '#6fb04a'); R(ctx, q.x + 1, top + 14, 4, 2, '#6fb04a');
            const open = Math.floor(tt * 6 + q.x) % 2 ? 2 : 0;
            R(ctx, q.x - 6, top - 2 - open, 12, 6, q.st === 'bonk' ? '#fff4e0' : '#d0463c'); R(ctx, q.x - 6, top + 4 + open, 12, 5, q.st === 'bonk' ? '#fff4e0' : '#d0463c');
            R(ctx, q.x - 4, top - 1 - open, 2, 2, '#fff4e0'); R(ctx, q.x + 2, top + 6 + open, 2, 2, '#fff4e0');
            R(ctx, q.x - 5, top + 3, 10, 1 + open, '#1a1220');
          }
          pipe(ctx, q.x, 70, 86, 14);
        }
        txt(ctx, `TAP THEM! ${s.got}/${need}`, 50, 94, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const q = s.ps.find(q => q.ext > 0.6 && q.st === 'up');
        if (q) await b.tap({ x: q.x, y: 70 - q.ext * 24 + 2 });
        await b.wait(30);
      }
    },
  },

  // 26. BOSS: castle showdown with the turtle king.
  {
    id: 'fm-boss', cmd: 'Castle showdown!', theme: 'funtendo', time: 26, boss: true,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose, phase }) {
      const ctx = scene(stage);
      const T = 0.7, H = 30;
      const s = expose({
        ph: 0, pause: 0.9, hearts: 3, inv: 0,
        hx: 20, tx: 20, jt: -1, jT: T,
        kx: 72, kvx: -14 * speed, khp: 3, kflash: 0,
        fire: [], fireLeft: 3, fireT: 0.4, spd: speed,
        drops: [], dropT: 0, axe: 92,
      });
      const hy = () => heroHy(s.jt, T, s.ph === 1 ? 22 : H);
      const hurt = () => {
        if (s.inv > 0) return;
        s.hearts--; s.inv = 1; sfx('nope');
        if (s.ph === 2) { s.hx = s.tx = 12; s.jt = -1; }
        if (s.hearts <= 0) lose();
      };
      const jump = () => { if (s.jt < 0 && s.ph > 0 && s.pause <= 0) { s.jt = 0; sfx('swap'); } };
      gestures(stage, pos, {
        drag: (p, ph, isTap) => {
          if (s.ph < 2) return;
          if (ph === 'down' || ph === 'move') s.tx = clamp(p.x, 6, 96);
          if (ph === 'up' && isTap && s.ph === 2) jump();
        },
        tap: () => { if (s.ph === 1) jump(); },
      });
      const next = n => {
        s.ph = n; s.pause = 1.2; s.fire = []; s.drops = []; s.jt = -1;
        phase(n, ['', 'Dodge the fire!', 'Stomp him 3×!', 'Grab the axe!'][n]);
        if (n === 2) { s.kx = 72; s.khp = 3; }
        if (n === 3) { s.kx = 60; }
      };
      let tt = 0;
      frame(dt => {
        tt += dt;
        if (s.ph === 0) { s.pause -= dt; if (s.pause <= 0) next(1); }
        s.inv = Math.max(0, s.inv - dt); s.kflash = Math.max(0, s.kflash - dt);
        if (s.pause > 0 && s.ph > 0) s.pause -= dt;
        const active = s.pause <= 0 && s.ph > 0;
        if (s.jt >= 0 && (s.jt += dt) > T) s.jt = -1;
        const move = mx => { const d = s.tx - s.hx; s.hx += Math.sign(d) * Math.min(Math.abs(d), mx * dt); };

        if (s.ph === 1) {
          s.hx = 20;
          if (active) {
            s.fireT -= dt;
            if (s.fireT <= 0 && s.fireLeft > 0) { s.fireLeft--; s.fireT = Math.max(0.95, 1.1 / speed); s.fire.push({ x: 64, k: Math.random() < 0.5 ? 'low' : 'high', passed: false }); sfx('alarm'); }
            for (const f of s.fire) {
              if (f.passed) continue;
              f.x -= 55 * speed * dt;
              if (Math.abs(f.x - s.hx) < 6) {
                if (f.k === 'low' && hy() < 9) { f.passed = true; hurt(); }
                else if (f.k === 'high' && hy() > 5) { f.passed = true; hurt(); }
              }
              if (f.x < s.hx - 8) f.passed = true;
            }
            if (s.fireLeft === 0 && s.fire.every(f => f.passed)) next(2);
          }
        } else if (s.ph === 2) {
          move(50);
          if (active) {
            s.kx += s.kvx * dt;
            if (s.kx < 46) { s.kx = 46; s.kvx = Math.abs(s.kvx); } else if (s.kx > 86) { s.kx = 86; s.kvx = -Math.abs(s.kvx); }
            const h2 = hy();
            if (s.kflash <= 0 && s.jt > T / 2 && Math.abs(s.hx - s.kx) < 11 && h2 > 8 && h2 < 32) {
              // stomp! he staggers away and you bounce off the other way
              const away = Math.sign(s.hx - s.kx) || -1;
              s.khp--; s.kflash = 0.7; sfx('boom'); s.jt = 0.08;
              s.kvx = -away * Math.abs(s.kvx); s.kx = clamp(s.kx - away * 12, 46, 86);
              s.tx = clamp(s.hx + away * 24, 6, 96);
              if (s.khp <= 0) next(3);
            } else if (s.kflash <= 0 && Math.abs(s.hx - s.kx) < 11 && h2 < 8) hurt();
          }
        } else if (s.ph === 3) {
          move(45);
          if (active) {
            s.dropT -= dt;
            if (s.dropT <= 0) { s.dropT = 0.5 / speed; s.drops.push({ x: 20 + Math.random() * 70, y: -6, warn: 0.45 }); }
            for (const d of s.drops) {
              if (d.warn > 0) { d.warn -= dt; continue; }
              d.y += 70 * speed * dt;
              if (!d.hit && d.y > 68 && d.y < 84 && Math.abs(d.x - s.hx) < 5) { d.hit = true; hurt(); }
            }
            s.drops = s.drops.filter(d => d.y < 100);
            if (s.hx >= 88) { s.ph = 4; sfx('boom'); setTimeout(win, 500); }
          }
        }

        // ---- draw ----
        castleBg(ctx);
        lava(ctx, 90, tt);
        for (let x = 0; x < 100; x += 4) R(ctx, x, 86, 3, 4, '#c84c0c');
        R(ctx, 0, 86, 100, 1, '#f39a3a');
        if (s.ph >= 3) { R(ctx, 91, 66, 1, 20, '#9fb4d0'); R(ctx, 90, 62, 6, 6, '#9fb4d0'); R(ctx, 95, 63, 3, 4, '#fff4e0'); }
        const kx = s.ph === 1 ? 72 : s.kx;
        king(ctx, kx + 4, 76, s.kflash > 0, s.ph >= 3, tt);
        for (const f of s.fire) if (!f.passed || f.x > -4) {
          const y = f.k === 'low' ? 81 : 66;
          if (f.x > -4) { R(ctx, f.x - 4, y - 2, 8, 4, '#f39a3a'); R(ctx, f.x - 2, y - 1, 6, 2, '#ffe27a'); R(ctx, f.x + 4, y - 1, 4, 2, '#d0463c'); }
        }
        for (const d of s.drops) {
          if (d.warn > 0) R(ctx, d.x - 3, 85, 6, 1, Math.floor(tt * 12) % 2 ? '#d0463c' : '#ffe27a');
          else { R(ctx, d.x - 2, d.y - 3, 4, 6, '#f39a3a'); R(ctx, d.x - 1, d.y - 1, 2, 3, '#ffe27a'); }
        }
        if (!(s.inv > 0 && Math.floor(tt * 16) % 2)) put(ctx, spr(s.jt >= 0 ? PLUM_J : PLUM), s.hx, 79 - hy(), 1.3);
        for (let i = 0; i < 3; i++) R(ctx, 4 + i * 6, 4, 4, 4, i < s.hearts ? '#f08ab0' : '#3a2a3a');
        if (s.ph === 2) for (let i = 0; i < 3; i++) R(ctx, 70 + i * 9, 4, 7, 3, i < s.khp ? '#d0463c' : '#3a2a3a');
        const tip = ['', 'TAP TO JUMP THE LOW FIRE', 'DRAG TO MOVE · TAP TO JUMP ON HIM', 'DRAG TO THE AXE · DODGE THE FIRE'][Math.min(3, s.ph)] || '';
        txt(ctx, tip, 50, 95, '#fff4e0', 6);
      });
    },
    async solve(b, s) {
      // phase 1: jump only the low fireballs
      while (!b.over() && s.ph < 2) {
        const f = s.fire.find(f => !f.passed);
        if (f && f.k === 'low' && s.jt < 0 && (f.x - s.hx - 6) / (55 * s.spd) < 0.2) await b.tap({ x: 50, y: 40 });
        await b.wait(8);
      }
      // phase 2: stand off to one side, then hop onto his head
      while (!b.over() && s.ph === 2) {
        if (s.pause > 0 || s.jt >= 0) { await b.wait(15); continue; }
        let px = s.kx + s.kvx * 0.47;
        if (px < 46) px = 92 - px; else if (px > 86) px = 172 - px;
        if (Math.abs(s.hx - px) <= 22 && Math.abs(s.hx - s.kx) >= 12) {
          await b.tap({ x: px, y: 80 });
          await b.wait(120);
          continue;
        }
        const stand = clamp(px + (s.hx < px ? -18 : 18), 8, 94);
        if (Math.abs(stand - s.hx) > 6) {
          b.down({ x: s.hx, y: 80 }); b.move({ x: stand, y: 80 });
          await b.wait(90);
          b.up({ x: stand, y: 80 });
        }
        await b.wait(30);
      }
      // phase 3: run for the axe, waiting out falling fire
      b.down({ x: s.hx, y: 80 });
      while (!b.over()) {
        const danger = s.drops.some(d => {
          const tLand = d.warn > 0 ? d.warn + (76 - d.y) / 70 : (76 - d.y) / 70;
          return tLand > -0.1 && tLand < 0.5 && Math.abs(d.x - (s.hx + 8)) < 8;
        });
        b.move({ x: danger ? s.hx - 6 : 96, y: 80 });
        await b.wait(20);
      }
      b.up({ x: s.hx, y: 80 });
    },
  },
];
