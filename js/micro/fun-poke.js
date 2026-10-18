import { rnd, pick, shuffle, clamp, dist, tapper, follow, swipe, art, canvas, addStyle } from './kit.js';

// Funtendo: pocket-monster and island-life microgames (our own pixel art, parody takes on the
// classics). Everything draws on a 100x100 pixel canvas that fills the stage, so canvas units ==
// stage %, and taps are hit-tested against what's drawn.

addStyle('fun-poke', `
[class*="mcs-fp-"] .mc-canvas { position: absolute; inset: 0; width: 100% !important; height: 100% !important; display: block; image-rendering: pixelated; }
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
function circle(ctx, x, y, r, col, fill = false, lw = 1) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = col; ctx.fill(); } else { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); }
}
const scene = stage => canvas(stage, 100, 100).ctx;
const onTap = (stage, pos, fn) => tapper(stage, e => fn(pos(e)));
const inBox = (p, x, y, w, hh) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + hh;
// silhouette / recolour palettes: map every letter except outline to one colour
const flat = (rows, col, keepK = true) => {
  const pal = {};
  for (const ch of new Set(rows.join(''))) if (ch !== '.' && !(keepK && ch === 'k')) pal[ch] = col;
  if (!keepK) pal.k = col;
  return pal;
};
function grass(ctx, top = 50) {
  R(ctx, 0, top, 100, 100 - top, '#6fb04a');
  ctx.fillStyle = '#3d7a34';
  for (let i = 0; i < 30; i++) ctx.fillRect((i * 37) % 100, top + 2 + ((i * 53) % (100 - top - 4)), 2, 1);
}
function sky(ctx, c1 = '#9fd3f2') { R(ctx, 0, 0, 100, 100, c1); }

// ---------- sprites (our own takes, evoked by shape and colour) ----------
const MOUSE = ['k..........k', 'yk........ky', 'yyk......kyy', '.yy......yy.', '..yyyyyyyy..', '.yyyyyyyyyy.', '.ykwyyyykwy.', '.rryyyyyyrr.', '.yyyykkyyyy.', '..yyyyyyyy..', '..yy....yy..', '..yy....yy..'];
const FOX = ['b..........b', 'bb........bb', 'bBb......bBb', '.bbb....bbb.', '..bbbbbbbb..', '.bbkwbbkwbb.', '.bbbbkkbbbb.', 'cc.bbbbbb.cc', 'cccccccccccc', '.cccbbbbccc.', '..bb....bb..'];
const SLEEPY = ['..k........k..', '.kGk......kGk.', '.kGGGGGGGGGGk.', 'kGGGGGGGGGGGGk', 'kGGkkGGGGkkGGk', 'kGGGGGkkGGGGGk', 'kGGccccccccGGk', 'kGccccccccccGk', 'kGccccccccccGk', 'kGGccccccccGGk', '.kGGGGGGGGGGk.', '..kGGk..kGGk..'];
const PUFF = ['..ff..ff..', '.ffffffff.', 'ffffffffff', 'fUwfffUwff', 'ffffffffff', 'ffffkfffff', '.ffffffff.', '..ff..ff..'];
const KARP = ['....yy......', '..rrrrrr..r.', '.rrwkrrrrrr.', 'rrrrrrrrrrr.', '.rcccrrrrrr.', '..rrrrrr..r.', '....yy......'];
const BLOB = ['...pppppp...', '.pppppppppp.', 'pppppppppppp', 'ppkpppppkppp', 'pppppppppppp', 'pppkkkkkpppp', 'pppppppppppp', '.pppppppppp.', 'pp.pp..pp.pp'];
const SPROUT = ['...GGGG...', '..GgGGgG..', '.gggggggg.', 'gkwggggkwg', 'gggggggggg', '.gggffggg.', 'gg.gggg.gg'];
const LIZARD = ['..oooo....', '.oooooo...', '.okwooo...', '.oooooo.r.', '..oyyoo.ry', '..oyyooo..', '..oo..oo..'];
const TURTLE = ['..uuuu....', '.uuuuuu...', '.ukwuuu...', '.uuuuuubb.', '..ubbbbbb.', '..uubbbu..', '..uu..uu..'];
const BALL = ['..kkkk..', '.krrrrk.', 'krrrrrrk', 'kkkwwkkk', 'kwwwwwwk', 'kwwwwwwk', '.kwwwwk.', '..kkkk..'];
const STONE = ['..kkkk..', '.kXXXXk.', 'kXXXXXXk', 'kXXSSXXk', 'kXXSSXXk', 'kXXXXXXk', '.kXXXXk.', '..kkkk..'];
const RACCOON = ['.BB......BB.', '.BbB....BbB.', '..bbbbbbbb..', '.bBkwbbkwBb.', '.bBBbbbbBBb.', '.bbbbkkbbbb.', '..bbccccbb..', '.uuuuuuuuuu.', '.uuuuuuuuuu.', '..bb....bb..'];
const BAG = ['...kk...', '..kNNk..', '.kccccck', 'kccNNcck', 'kcNccNck', 'kccNNcck', 'kcccccck', '.kkkkkk.'];
const VILLAGER = ['.BBBBBB.', 'BBBBBBBB', 'BckcckcB', '.cccccc.', '.fccccf.', '..cccc..', '.rrrrrr.', 'rrrrrrrr', '.rr..rr.', '.bb..bb.'];
const BEETLE = ['.k....k.', '..k..k..', '.UUUUUU.', 'UUuUUuUU', 'UUUUUUUU', 'UUUkkUUU', '.UUUUUU.', 'k.k..k.k'];
const FISH = ['...ss....', '.sssssss.', 'sskssssss', 'sssssssss', '.sssssss.', '...ss....'];
const GOLDFISH = ['...nn......', '.nnnnnnnnn.', 'nnknnnnnnnn', 'nnnnnnnnnnn', '.nnnnnnnnn.', '...nn......'];
const TIARA = ['...nn...', '.n.nn.n.', 'nnnrrnnn'];
const WAND = ['.fnf.', 'fnnnf', '.fnf.', '..k..', '..f..', '..f..', '..f..', '..f..'];
const BOW = ['ff..ff', 'fFffFf', '.ffff.', 'fF..Ff'];
const ROCK = ['...kkkk...', '..kssssk..', '.kssssssk.', 'ksssSsssk.', 'kssssssSsk', 'ksSssssssk', '.kssssssk.', '..kkkkkk..'];

const PAL_SLEEPY = { G: '#2a5a6a' };
const PAL_KARP = { r: '#f08a2a' };
const EVOS = {
  water: { name: 'Water', body: { b: '#4f8fd0', B: '#2c5a9a', c: '#9fd3f2' }, stone: { X: '#4f8fd0', S: '#fff4e0' } },
  thunder: { name: 'Thunder', body: { b: '#ffe27a', B: '#b5862a', c: '#fff4e0' }, stone: { X: '#a8d870', S: '#ffe27a' } },
  fire: { name: 'Fire', body: { b: '#f08a2a', B: '#8e2a2a', c: '#ffe27a' }, stone: { X: '#d0463c', S: '#ffe27a' } },
  leaf: { name: 'Leaf', body: { b: '#efdcb4', B: '#3d7a34', c: '#6fb04a' }, stone: { X: '#3d7a34', S: '#a8d870' } },
};
// Creatures by name, with where their eyes sit (for the copycat's give-away face)
const MONS = {
  PIKACHU: { rows: MOUSE, pal: {}, body: '#ffe27a', eyes: [6, 2, 8] },
  EEVEE: { rows: FOX, pal: {}, body: '#a0663a', eyes: [5, 3, 7] },
  SNORLAX: { rows: SLEEPY, pal: PAL_SLEEPY, body: '#2a5a6a', eyes: [4, 3, 9] },
  JIGGLYPUFF: { rows: PUFF, pal: {}, body: '#f08ab0', eyes: [3, 1, 6] },
  MAGIKARP: { rows: KARP, pal: PAL_KARP, body: '#f08a2a', eyes: [2, 3, 3] },
  BULBA: { rows: SPROUT, pal: {}, body: '#6fb04a', eyes: [3, 1, 7] },
  CHARM: { rows: LIZARD, pal: {}, body: '#f39a3a', eyes: [2, 2, 2] },
  SQUIRT: { rows: TURTLE, pal: {}, body: '#9fd3f2', eyes: [2, 2, 2] },
};
// draw a creature; `copy` paints the copycat's dot-eyed derpy face over the real one
function mon(ctx, name, x, y, sc = 1, copy = false, pal = null) {
  const m = MONS[name], s = spr(m.rows, pal || m.pal);
  put(ctx, s, x, y, sc);
  if (!copy) return;
  const left = x - (s.w * sc) / 2, top = y - (s.h * sc) / 2;
  const [ey, x1, x2] = m.eyes;
  R(ctx, left + x1 * sc, top + ey * sc, 2 * sc, sc, m.body);
  if (x2 !== x1) R(ctx, left + x2 * sc, top + ey * sc, 2 * sc, sc, m.body);
  R(ctx, left + (x1 + 0.5) * sc, top + ey * sc, Math.max(1, sc * 0.6), Math.max(1, sc * 0.6), '#1a1220');
  if (x2 !== x1) R(ctx, left + (x2 + 0.5) * sc, top + ey * sc, Math.max(1, sc * 0.6), Math.max(1, sc * 0.6), '#1a1220');
  R(ctx, left + ((x1 + x2) / 2) * sc, top + (ey + 2) * sc, 2.4 * sc, Math.max(1, sc * 0.5), '#1a1220');
}
function btn(ctx, x, y, w, hh, label, col = '#fff4e0', bg = '#3a2a5c', size = 9) {
  R(ctx, x, y, w, hh, '#1a1220'); R(ctx, x + 1, y + 1, w - 2, hh - 2, bg);
  txt(ctx, label, x + w / 2, y + hh / 2 + 0.5, col, size);
}
function hearts(ctx, n, max, x = 4, y = 4) {
  for (let i = 0; i < max; i++) { R(ctx, x + i * 6, y, 4, 4, i < n ? '#f08ab0' : '#3a2a5c'); R(ctx, x + i * 6 + 1, y + 4, 2, 1, i < n ? '#f08ab0' : '#3a2a5c'); }
}

export default [
  // 1. The copycat turned into something. Which one?
  {
    id: 'fp-ditto-copy', cmd: 'Who did Ditto copy?', theme: 'funtendo',
    setup({ stage, win, lose, sfx, frame, pos, expose }) {
      const ctx = scene(stage);
      const names = shuffle(Object.keys(MONS)).slice(0, 3);
      const ans = rnd(3), XS = [18, 50, 82];
      const s = expose({ x: XS[ans], y: 76, t: 0 });
      let done = false;
      onTap(stage, pos, p => {
        if (done || p.y < 60) return;
        const k = XS.findIndex(x => Math.abs(p.x - x) < 15);
        if (k < 0) return;
        done = true;
        sfx(k === ans ? 'coin' : 'nope');
        k === ans ? win() : lose();
      });
      frame(dt => {
        s.t += dt;
        sky(ctx, '#e8d8f8'); R(ctx, 0, 60, 100, 40, '#c8b0e0');
        const m = MONS[names[ans]];
        if (s.t < 0.45) put(ctx, spr(BLOB), 50, 32, 2.4 + Math.sin(s.t * 30) * 0.2);
        else put(ctx, spr(m.rows, flat(m.rows, '#b07ad8')), 50, 32, 2.6);
        txt(ctx, s.t < 0.45 ? 'TRANSFORM!' : '?', 50, 8, '#6a3e94', 9);
        XS.forEach((x, k) => { R(ctx, x - 14, 64, 28, 26, '#fff4e0'); R(ctx, x - 13, 65, 26, 24, '#e8d8f8'); mon(ctx, names[k], x, 77, 1.6); });
      });
    },
    async solve(b, s) { await b.wait(550); await b.tap({ x: s.x, y: s.y }); },
  },

  // 2. One of these is the copycat. Its derpy face gives it away.
  {
    id: 'fp-ditto-spot', cmd: 'Spot the Ditto!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const name = pick(['PIKACHU', 'EEVEE', 'JIGGLYPUFF', 'BULBA']);
      const cols = speed > 1.4 ? 4 : 3, rows = speed > 1.4 ? 3 : 2;
      const cells = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ x: 100 / cols * (c + 0.5), y: 28 + r * (64 / rows) + 32 / rows });
      const odd = rnd(cells.length);
      const s = expose({ x: cells[odd].x, y: cells[odd].y });
      let done = false;
      onTap(stage, pos, p => {
        if (done) return;
        const k = cells.findIndex(c => Math.abs(p.x - c.x) < 50 / cols && Math.abs(p.y - c.y) < 32 / rows);
        if (k < 0) return;
        done = true;
        sfx(k === odd ? 'coin' : 'nope');
        k === odd ? win() : lose();
      });
      let t = 0;
      frame(dt => {
        t += dt;
        sky(ctx, '#f8ecd0'); grass(ctx, 60);
        txt(ctx, 'One of them is a copycat…', 50, 10, '#6b3d22', 8);
        const sc = cols === 4 ? 1.5 : 1.9;
        cells.forEach((c, k) => mon(ctx, name, c.x, c.y + Math.sin(t * 5 + k) * 0.8, sc, k === odd));
      });
    },
    async solve(b, s) { await b.wait(250); await b.tap({ x: s.x, y: s.y }); },
  },

  // 3. Stretch or squash the blob to fit the outline, and hold it there.
  {
    id: 'fp-ditto-squish', cmd: 'Squish Ditto!', theme: 'funtendo',
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const target = 18 + Math.random() * 46, tol = 5 / Math.sqrt(speed);
      const s = expose({ target, h: 30, held: 0 });
      follow(stage, pos, p => { s.h = clamp(88 - p.y, 8, 76); });
      frame(dt => {
        const ok = Math.abs(s.h - s.target) < tol;
        s.held = ok ? s.held + dt : 0;
        if (s.held > 0.35) { sfx('coin'); return win(); }
        R(ctx, 0, 0, 100, 100, '#f8ecd0'); R(ctx, 0, 88, 100, 12, '#c8b0e0');
        // target outline
        ctx.setLineDash([2, 2]); ctx.strokeStyle = '#6a3e94'; ctx.lineWidth = 1;
        ctx.strokeRect(30, 88 - target, 40, target); ctx.setLineDash([]);
        // the blob
        const w = clamp(1600 / Math.max(10, s.h), 24, 70);
        R(ctx, 50 - w / 2, 88 - s.h, w, s.h, ok ? '#c890e8' : '#a46ad0');
        R(ctx, 50 - w / 2 + 2, 88 - s.h, w - 4, 2, '#d8b0f0');
        const ey = 88 - s.h + Math.min(8, s.h * 0.3);
        R(ctx, 50 - w / 5, ey, 2, 2, '#1a1220'); R(ctx, 50 + w / 5 - 2, ey, 2, 2, '#1a1220');
        R(ctx, 47, ey + 4, 6, 1, '#1a1220');
        txt(ctx, ok ? 'HOLD IT…' : 'DRAG UP OR DOWN TO FIT', 50, 8, ok ? '#3d7a34' : '#6a3e94', 8);
      });
    },
    async solve(b, s) {
      b.down({ x: 50, y: 88 - s.target });
      await b.until(() => false, 1500);
      b.up({ x: 50, y: 88 - s.target });
    },
  },

  // 4. Which stone makes this evolution?
  {
    id: 'fp-stone', cmd: 'Evolve it!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, frame, pos, expose }) {
      const ctx = scene(stage);
      const kinds = shuffle(Object.keys(EVOS));
      const want = pick(kinds);
      const XS = [14, 38, 62, 86];
      const s = expose({ x: XS[kinds.indexOf(want)], y: 80 });
      let done = false, flash = 0, t = 0;
      onTap(stage, pos, p => {
        if (done || p.y < 66) return;
        const k = XS.findIndex(x => Math.abs(p.x - x) < 11);
        if (k < 0) return;
        done = true;
        if (kinds[k] === want) { flash = 0.01; sfx('sparkle'); setTimeout(win, 300); } else { sfx('nope'); lose(); }
      });
      frame(dt => {
        t += dt; if (flash) flash += dt;
        sky(ctx, '#2a1c34');
        txt(ctx, 'Make this one:', 50, 8, '#c8a0ec', 8);
        put(ctx, spr(FOX, EVOS[want].body), 30, 34, 2);
        txt(ctx, '→', 50, 34, '#fff4e0', 12);
        put(ctx, spr(FOX), 70, 34, 2);
        if (flash) R(ctx, 0, 0, 100, 100, `rgba(255,255,255,${Math.max(0, 0.8 - flash * 3)})`);
        txt(ctx, `${EVOS[want].name} type`, 30, 52, '#fff4e0', 8);
        XS.forEach((x, k) => put(ctx, spr(STONE, EVOS[kinds[k]].stone), x, 80 + Math.sin(t * 4 + k) * 1, 2.2));
      });
    },
    async solve(b, s) { await b.wait(300); await b.tap({ x: s.x, y: s.y }); },
  },

  // 5. Rub its head until it's happy.
  {
    id: 'fp-pet', cmd: 'Pet Eevee!', theme: 'funtendo',
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const need = 160 + speed * 50;
      const s = expose({ love: 0, last: null });
      const pops = [];
      follow(stage, pos, (p, ph) => {
        if (ph === 'down') { s.last = p; return; }
        if (ph === 'up' || !s.last) { s.last = null; return; }
        if (dist(p, { x: 50, y: 52 }) < 26) {
          s.love += dist(p, s.last);
          if (Math.random() < 0.12) { pops.push({ x: p.x, y: p.y, t: 0 }); sfx('purr'); }
        }
        s.last = p;
        if (s.love >= need) { sfx('coin'); win(); }
      });
      frame(dt => {
        R(ctx, 0, 0, 100, 100, '#f8ecd0'); R(ctx, 0, 76, 100, 24, '#c9ad7f');
        put(ctx, spr(FOX), 50, 54, 4);
        if (s.love > need * 0.5) { R(ctx, 35, 41, 6, 1, '#1a1220'); R(ctx, 59, 41, 6, 1, '#1a1220'); }
        R(ctx, 20, 92, 60, 4, '#3a2a5c'); R(ctx, 20, 92, 60 * Math.min(1, s.love / need), 4, '#f08ab0');
        for (const h of pops) { h.t += dt; R(ctx, h.x - 2, h.y - 6 - h.t * 30, 4, 3, `rgba(240,138,176,${Math.max(0, 1 - h.t)})`); }
        txt(ctx, 'RUB BACK AND FORTH', 50, 8, '#6b3d22', 8);
      });
    },
    async solve(b) {
      b.down({ x: 40, y: 50 });
      for (let i = 0; !b.over() && i < 200; i++) { b.move({ x: i % 2 ? 62 : 38, y: 50 + (i % 3) }); await b.wait(25); }
      b.up({ x: 50, y: 50 });
    },
  },

  // 6. Drag the treat into the hungry fox's mouth.
  {
    id: 'fp-poffin', cmd: 'Feed Eevee!', theme: 'funtendo',
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ ex: 50, ey: 38, tx: 50, ty: 84, held: false, t: Math.random() * 6 });
      follow(stage, pos, (p, ph) => {
        if (ph === 'down') s.held = dist(p, { x: s.tx, y: s.ty }) < 14;
        if (ph === 'up') { s.held = false; s.tx = 50; s.ty = 84; return; }
        if (s.held) { s.tx = p.x; s.ty = p.y; }
      });
      frame(dt => {
        s.t += dt * speed;
        s.ex = 50 + Math.sin(s.t * 1.6) * 30;
        s.ey = 38 - Math.abs(Math.sin(s.t * 5)) * 6;
        if (s.held && dist({ x: s.tx, y: s.ty }, { x: s.ex, y: s.ey + 4 }) < 9) { sfx('coin'); return win(); }
        R(ctx, 0, 0, 100, 100, '#c8e8f8'); grass(ctx, 50);
        put(ctx, spr(FOX), s.ex, s.ey, 2, Math.cos(s.t * 1.6) < 0);
        // poffin: a little pink pastry
        R(ctx, s.tx - 4, s.ty - 3, 8, 6, '#f08ab0'); R(ctx, s.tx - 3, s.ty - 4, 6, 2, '#fff4e0'); R(ctx, s.tx - 1, s.ty - 1, 2, 2, '#c0507a');
        txt(ctx, 'DRAG THE TREAT TO ITS MOUTH', 50, 8, '#2c5a9a', 7);
      });
    },
    async solve(b, s) {
      b.down({ x: s.tx, y: s.ty });
      while (!b.over()) { b.move({ x: s.ex, y: s.ey + 4 }); await b.wait(16); }
      b.up({ x: s.ex, y: s.ey });
    },
  },

  // 7. Swipe the ball so the fox can catch it.
  {
    id: 'fp-fetch', cmd: 'Fetch!', theme: 'funtendo', time: 6,
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const W = 1.4 * speed, A = 32;
      const s = expose({ t: 0, W, A, ball: null, ex: 50 });
      swipe(stage, pos, (dir, dx, dy) => {
        if (s.ball || dy > -4) return;
        const L = Math.hypot(dx, dy);
        s.ball = { x: 50, y: 86, vx: (dx / L) * 120, vy: (dy / L) * 120 };
        sfx('swap');
      });
      frame(dt => {
        s.t += dt;
        s.ex = 50 + Math.sin(s.t * W) * A;
        sky(ctx, '#c8e8f8'); grass(ctx, 34);
        put(ctx, spr(FOX), s.ex, 24, 1.8, Math.cos(s.t * W) < 0);
        const o = s.ball;
        if (o) {
          o.x += o.vx * dt; o.y += o.vy * dt;
          if (dist(o, { x: s.ex, y: 24 }) < 9) { sfx('coin'); return win(); }
          if (o.y < -5 || o.x < -5 || o.x > 105) s.ball = null;
          else { circle(ctx, o.x, o.y, 2.5, '#d0463c', true); R(ctx, o.x - 2, o.y - 0.5, 4, 1, '#fff4e0'); }
        }
        if (!s.ball) { circle(ctx, 50, 86, 2.5, '#d0463c', true); R(ctx, 48, 85.5, 4, 1, '#fff4e0'); }
        txt(ctx, 'SWIPE THE BALL UP TO IT', 50, 95, '#1a1220', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        if (s.ball) { await b.wait(30); continue; }
        // aim where the fox will be when the ball arrives (swipe ~0.12s + flight)
        let aim = s.ex;
        for (let k = 0; k < 4; k++) {
          const fl = Math.hypot(aim - 50, 62) / 120;
          aim = 50 + Math.sin((s.t + 0.14 + fl) * s.W) * s.A;
        }
        const dx = aim - 50, dy = -62, L = Math.hypot(dx, dy);
        await b.drag({ x: 50, y: 80 }, { x: 50 + (dx / L) * 30, y: 80 + (dy / L) * 30 }, 100, 3);
        await b.wait(600);
      }
    },
  },

  // 8. Throw when the ring is at its smallest.
  {
    id: 'fp-throw', cmd: 'Throw it!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const name = pick(['PIKACHU', 'EEVEE', 'BULBA', 'SQUIRT', 'CHARM']);
      const P = 1.4 / speed;
      const s = expose({ r: 24, t: Math.random() * P, thrown: 0, ok: false });
      onTap(stage, pos, () => {
        if (s.thrown) return;
        s.thrown = 0.01; s.ok = s.r < 9.5;
        sfx('swap');
      });
      frame(dt => {
        if (!s.thrown) s.t += dt;
        s.r = 6 + 18 * (0.5 + 0.5 * Math.cos((s.t / P) * Math.PI * 2));
        sky(ctx, '#c8e8f8'); grass(ctx, 50);
        mon(ctx, name, 50, 40, 2.2);
        circle(ctx, 50, 40, s.r, s.r < 9.5 ? '#6fb04a' : s.r < 15 ? '#ffe27a' : '#d0463c', false, 1.5);
        if (s.thrown) {
          s.thrown += dt;
          const k = Math.min(1, s.thrown / 0.35);
          const bx = 50, by = 88 - k * 48 - Math.sin(k * Math.PI) * 14;
          if (k < 1 || s.ok) put(ctx, spr(BALL), bx + (s.ok && k >= 1 ? Math.sin(s.thrown * 20) * 2 : 0), by, 1.4);
          if (k >= 1 && !s.ok) { sfx('nope'); return lose(); }
          if (s.ok && k >= 1) { R(ctx, 30, 20, 40, 34, '#c8e8f8'); grass(ctx, 50); put(ctx, spr(BALL), 50 + Math.sin(s.thrown * 18) * 2, 46, 1.6); }
          if (s.ok && s.thrown > 0.95) { sfx('coin'); return win(); }
        } else put(ctx, spr(BALL), 50, 88, 1.4);
        txt(ctx, 'TAP WHEN THE RING IS SMALL', 50, 8, '#2c5a9a', 7);
      });
    },
    async solve(b, s) { await b.until(() => s.r < 7.5); await b.tap({ x: 50, y: 70 }); },
  },

  // 9. Name the silhouette.
  {
    id: 'fp-who', cmd: 'Who’s that Pokémon?', theme: 'funtendo',
    setup({ stage, win, lose, sfx, frame, pos, expose }) {
      const ctx = scene(stage);
      const names = shuffle(['PIKACHU', 'EEVEE', 'SNORLAX', 'JIGGLYPUFF', 'MAGIKARP']).slice(0, 3);
      const ans = rnd(3), YS = [64, 76, 88];
      const s = expose({ y: YS[ans] + 4 });
      let done = 0, ok = false, t = 0;
      onTap(stage, pos, p => {
        if (done) return;
        const k = YS.findIndex(y => p.y >= y && p.y <= y + 9 && p.x > 18 && p.x < 82);
        if (k < 0) return;
        done = 0.01; ok = k === ans;
        sfx(ok ? 'coin' : 'nope');
      });
      frame(dt => {
        t += dt;
        R(ctx, 0, 0, 100, 100, '#2c5a9a');
        // the classic sunburst
        ctx.fillStyle = '#4f8fd0';
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + t * 0.3; ctx.beginPath(); ctx.moveTo(50, 32); ctx.lineTo(50 + Math.cos(a) * 80, 32 + Math.sin(a) * 80); ctx.lineTo(50 + Math.cos(a + 0.22) * 80, 32 + Math.sin(a + 0.22) * 80); ctx.fill(); }
        const m = MONS[names[ans]];
        if (done) mon(ctx, names[ans], 50, 32, 2.6);
        else put(ctx, spr(m.rows, flat(m.rows, '#1a1220', false)), 50, 32, 2.6);
        YS.forEach((y, k) => btn(ctx, 18, y, 64, 9, names[k], '#fff4e0', done && k === ans ? '#3d7a34' : '#1e2850', 8));
        if (done) { done += dt; if (done > 0.45) return ok ? win() : lose(); }
      });
    },
    async solve(b, s) { await b.wait(300); await b.tap({ x: 50, y: s.y }); },
  },

  // 10. Tap the floppy fish while it's in the air.
  {
    id: 'fp-karp', cmd: 'Catch Magikarp!', theme: 'funtendo',
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ air: false, x: 50, y: 70, t: 0, next: 0.3, x0: 50 });
      const DUR = 0.9 / Math.sqrt(speed);
      let caught = -1;
      onTap(stage, pos, p => {
        if (caught >= 0) return;
        if (s.air && dist(p, s) < 11) { caught = 0; sfx('coin'); } else sfx('drip');
      });
      frame(dt => {
        s.t += dt;
        if (!s.air && s.t > s.next) { s.air = true; s.t = 0; s.x0 = 15 + Math.random() * 70; sfx('drip'); }
        if (s.air && caught < 0) {
          const k = s.t / DUR;
          s.x = s.x0 + k * 10; s.y = 66 - Math.sin(k * Math.PI) * 44;
          if (k >= 1) { s.air = false; s.t = 0; s.next = (0.3 + Math.random() * 0.4) / speed; }
        }
        if (caught >= 0) { caught += dt; s.y -= dt * 40; if (caught > 0.4) return win(); }
        sky(ctx, '#f8c8a8'); R(ctx, 0, 62, 100, 38, '#2c5a9a');
        for (let i = 0; i < 6; i++) R(ctx, ((i * 31 + s.t * 8) % 110) - 5, 66 + i * 5, 10, 1, '#4f8fd0');
        if (s.air || caught >= 0) put(ctx, spr(KARP, PAL_KARP), s.x, s.y, 1.8, Math.sin(s.t * 20) > 0);
        else { circle(ctx, s.x0 + 10, 66, 3 + (s.t * 8) % 4, '#9fd3f2'); }
        txt(ctx, 'TAP IT MID-SPLASH', 50, 8, '#8e2a2a', 8);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        if (s.air && s.y < 50) await b.tap({ x: s.x + 2, y: s.y });
        await b.wait(20);
      }
    },
  },

  // 11. Play the tune back on the flute to wake the big sleeper.
  {
    id: 'fp-flute', cmd: 'Wake Snorlax!', theme: 'funtendo', time: 7,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const HX = [20, 40, 60, 80], COL = ['#f08ab0', '#ffe27a', '#9fd3f2', '#a8d870'];
      const n = speed > 1.4 ? 4 : 3;
      const seq = Array.from({ length: n }, () => rnd(4));
      const step = 0.42 / Math.sqrt(speed);
      const s = expose({ seq, HX, ready: false, i: 0, t: 0 });
      let lit = -1, litT = 0, awake = -1;
      onTap(stage, pos, p => {
        if (!s.ready || awake >= 0) return;
        const k = HX.findIndex(x => Math.abs(p.x - x) < 9 && p.y > 74 && p.y < 96);
        if (k < 0) return;
        lit = k; litT = 0.2; sfx('ring');
        if (k !== seq[s.i]) { sfx('nope'); return lose(); }
        if (++s.i >= n) { awake = 0; sfx('coin'); }
      });
      frame(dt => {
        s.t += dt;
        if (!s.ready) {
          const k = Math.floor(s.t / step) - 1;
          if (k >= 0 && k < n && lit !== seq[k] + 10 * k) { lit = seq[k] + 10 * k; litT = step * 0.7; sfx('ring'); }
          if (k >= n) { s.ready = true; lit = -1; }
        }
        litT -= dt;
        sky(ctx, '#c8e8f8'); grass(ctx, 50);
        if (awake >= 0) { awake += dt; put(ctx, spr(SLEEPY, PAL_SLEEPY), 50 + awake * 60, 36, 2.6); if (awake > 0.5) return win(); }
        else { put(ctx, spr(SLEEPY, PAL_SLEEPY), 50, 36 + Math.sin(s.t * 2) * 0.8, 2.6); txt(ctx, 'z Z', 76, 14 - (s.t * 6) % 6, '#2c5a9a', 9); }
        // the flute
        R(ctx, 8, 80, 84, 10, '#6b3d22'); R(ctx, 8, 80, 84, 2, '#a0663a');
        HX.forEach((x, k) => {
          const on = litT > 0 && (lit % 10) === k;
          circle(ctx, x, 85, 4, on ? COL[k] : '#3a2216', true);
          if (on) circle(ctx, x, 85, 7, COL[k]);
        });
        txt(ctx, s.ready ? `YOUR TURN · ${s.i}/${n}` : 'LISTEN…', 50, 70, '#1a1220', 8);
      });
    },
    async solve(b, s) {
      await b.until(() => s.ready);
      for (const k of s.seq) { await b.tap({ x: s.HX[k], y: 85 }); await b.wait(60); }
    },
  },

  // 12. Three starters hide in balls, the balls shuffle: find the one that was asked for.
  {
    id: 'fp-starter', cmd: 'Pick a starter!', theme: 'funtendo', time: 7,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const who = ['BULBA', 'CHARM', 'SQUIRT'], TYPE = { BULBA: 'GRASS', CHARM: 'FIRE', SQUIRT: 'WATER' };
      const want = pick(who);
      const balls = who.map((w, i) => ({ who: w, x: 20 + i * 30, from: 20 + i * 30, to: 20 + i * 30 }));
      const swaps = 3 + Math.round(speed);
      const SW = 0.42 / speed;
      const s = expose({ balls, want, ready: false });
      let t = 0, done = 0, ok = false;
      onTap(stage, pos, p => {
        if (!s.ready || done) return;
        const bl = balls.find(o => Math.abs(p.x - o.x) < 12 && p.y > 50 && p.y < 80);
        if (!bl) return;
        done = 0.01; ok = bl.who === want;
        sfx(ok ? 'coin' : 'nope');
      });
      let swapIdx = -1;
      frame(dt => {
        t += dt;
        const shuffleT = t - 1.1;
        if (shuffleT > 0 && !s.ready) {
          const k = Math.floor(shuffleT / SW);
          if (k !== swapIdx) {
            balls.forEach(o => (o.x = o.from = o.to));
            if (k >= swaps) { s.ready = true; }
            else {
              swapIdx = k;
              const [a, c] = shuffle([0, 1, 2]).slice(0, 2);
              const A = balls.find(o => Math.abs(o.to - (20 + a * 30)) < 1), C = balls.find(o => Math.abs(o.to - (20 + c * 30)) < 1);
              A.to = 20 + c * 30; C.to = 20 + a * 30;
              sfx('swap');
            }
          }
          if (!s.ready) { const f = (shuffleT % SW) / SW; balls.forEach(o => (o.x = o.from + (o.to - o.from) * f)); }
        }
        R(ctx, 0, 0, 100, 100, '#e8d8b8'); R(ctx, 0, 70, 100, 30, '#a0663a'); R(ctx, 0, 70, 100, 2, '#c79a5a');
        txt(ctx, `Find the ${TYPE[want]} type!`, 50, 12, '#6b3d22', 9);
        balls.forEach(o => {
          if (t < 1.1 || done) mon(ctx, o.who, o.x, 50, 1.6);
          if (t >= 0.8) put(ctx, spr(BALL), o.x, 64, 2.2);
        });
        if (done) { done += dt; if (done > 0.5) return ok ? win() : lose(); }
      });
    },
    async solve(b, s) {
      await b.until(() => s.ready);
      await b.tap({ x: s.balls.find(o => o.who === s.want).x, y: 64 });
    },
  },

  // 13. Walk through the tall grass without stepping on a rustling patch.
  {
    id: 'fp-grass', cmd: 'Don’t get caught!', theme: 'funtendo', time: 5, timeoutWins: true,
    setup({ stage, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const LX = [25, 50, 75];
      const v = 38 * speed;
      const rows = [];
      for (let y = 10, k = 0; y > -260; y -= 24, k++) {
        const bad = k < 1 ? [] : shuffle([0, 1, 2]).slice(0, rnd(2) + 1);
        rows.push({ y, bad });
      }
      const s = expose({ lane: 1, rows, LX });
      follow(stage, pos, p => { s.lane = p.x < 37 ? 0 : p.x > 63 ? 2 : 1; });
      let t = 0;
      frame(dt => {
        t += dt;
        for (const r of rows) r.y += v * dt;
        for (const r of rows) if (r.bad.includes(s.lane) && Math.abs(r.y - 76) < 7) { sfx('alarm'); return lose(); }
        R(ctx, 0, 0, 100, 100, '#6fb04a');
        for (const r of rows) {
          if (r.y < -12 || r.y > 112) continue;
          LX.forEach((x, k) => {
            const rust = r.bad.includes(k);
            const wob = rust ? Math.sin(t * 40 + k) * 1.5 : 0;
            for (let j = -2; j <= 2; j++) R(ctx, x + j * 4 + wob, r.y - 5 - Math.abs(j) * -1, 2, 10, rust ? '#2a5a1c' : '#3d7a34');
            if (rust) { R(ctx, x - 1, r.y - 9, 2, 2, '#fff4e0'); }
          });
        }
        put(ctx, spr(VILLAGER), LX[s.lane], 76, 1.4);
        txt(ctx, 'TAP A LANE TO STEP INTO IT', 50, 96, '#1a1220', 7);
      });
    },
    async solve(b, s) {
      b.down({ x: s.LX[s.lane], y: 76 });
      while (!b.over()) {
        // look at the next rustling rows approaching the player and pick a lane clear for both
        const near = s.rows.filter(r => r.y > 40 && r.y < 86).sort((a, c) => c.y - a.y);
        const blocked = new Set(near.slice(0, 1).flatMap(r => r.bad));
        const later = new Set(near.slice(1, 2).flatMap(r => r.bad));
        let lane = s.lane;
        if (blocked.has(lane) || (later.has(lane) && !blocked.size)) {
          const opts = [0, 1, 2].filter(k => !blocked.has(k)).sort((a, c) => (later.has(a) - later.has(c)) || Math.abs(a - s.lane) - Math.abs(c - s.lane));
          if (opts.length) lane = opts[0];
        }
        b.move({ x: s.LX[lane], y: 76 });
        await b.wait(16);
      }
      b.up({ x: 50, y: 76 });
    },
  },

  // 14. Zap the escaping balloon with a bolt from the electric mouse.
  {
    id: 'fp-thunder', cmd: 'Thundershock!', theme: 'funtendo',
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const need = speed > 1.5 ? 3 : 2;
      const s = expose({ x: 20, y: 22, hits: 0, t: 0 });
      let bolt = null, hurt = 0;
      onTap(stage, pos, p => {
        bolt = { x: p.x, y: p.y, t: 0.15 };
        sfx('glaive');
        if (dist(p, s) < 11) { s.hits++; hurt = 0.3; if (s.hits >= need) setTimeout(win, 200); }
      });
      frame(dt => {
        s.t += dt;
        s.x = 50 + Math.sin(s.t * 1.3 * speed) * 34;
        s.y = 24 + Math.sin(s.t * 2.1 * speed) * 8;
        hurt = Math.max(0, hurt - dt);
        sky(ctx, '#c8e8f8'); grass(ctx, 76);
        // balloon with a big R
        circle(ctx, s.x, s.y, 9, hurt ? '#fff4e0' : '#f08ab0', true);
        txt(ctx, 'R', s.x, s.y, '#c0507a', 10);
        R(ctx, s.x - 4, s.y + 11, 8, 5, '#a0663a'); R(ctx, s.x - 0.5, s.y + 8, 1, 3, '#6b3d22');
        mon(ctx, 'PIKACHU', 50, 84, 1.8);
        if (bolt) {
          bolt.t -= dt;
          ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(50, 76);
          for (let k = 1; k <= 5; k++) ctx.lineTo(50 + (bolt.x - 50) * k / 5 + (k < 5 ? (Math.random() - 0.5) * 8 : 0), 76 + (bolt.y - 76) * k / 5);
          ctx.stroke();
          if (bolt.t <= 0) bolt = null;
        }
        for (let i = 0; i < need; i++) R(ctx, 4 + i * 6, 4, 4, 4, i < s.hits ? '#ffe27a' : '#3a2a5c');
      });
    },
    async solve(b, s) { while (!b.over()) { await b.tap({ x: s.x, y: s.y }); await b.wait(150); } },
  },

  // 15. Magical: charge under the moon and release at full moon to evolve.
  {
    id: 'fp-moon', cmd: 'Moon evolution!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const P = 2.4 / speed;
      const s = expose({ m: 0, t: Math.random() * 0.4, held: 0, holding: false, rising: true });
      let done = 0, prev = 0;
      follow(stage, pos, (p, ph) => {
        if (done) return;
        if (ph === 'down') { s.holding = true; s.held = 0; sfx('charge'); }
        if (ph === 'up') {
          s.holding = false;
          if (s.held < 0.45) return;
          if (s.m > 0.85) { done = 0.01; sfx('sparkle'); } else { sfx('fizzle'); lose(); }
        }
      });
      frame(dt => {
        s.t += dt;
        prev = s.m;
        s.m = (1 - Math.cos((s.t / P) * Math.PI * 2)) / 2;
        s.rising = s.m > prev;
        if (s.holding) s.held += dt;
        R(ctx, 0, 0, 100, 100, '#1a1030');
        for (let i = 0; i < 20; i++) R(ctx, (i * 37) % 100, (i * 23) % 60, 1, 1, '#c8a0ec');
        // moon: lit disc covered by a shadow disc that slides off as it fills
        circle(ctx, 50, 22, 12, '#fff8d0', true);
        circle(ctx, 50 + s.m * 26, 22, 12, '#1a1030', true);
        circle(ctx, 50, 22, 12, s.m > 0.85 ? '#ffe27a' : '#6a5a8a');
        const evolved = done > 0.15;
        put(ctx, spr(FOX, evolved ? { b: '#f8b0d4', B: '#c0507a', c: '#fff4e0' } : {}), 50, 66, 3);
        if (evolved) put(ctx, spr(TIARA), 50, 51, 2);
        if (s.holding) for (let k = 0; k < 6; k++) { const a = s.t * 4 + k; R(ctx, 50 + Math.cos(a) * 20, 66 + Math.sin(a) * 14, 2, 2, '#ffe27a'); }
        R(ctx, 30, 90, 40, 3, '#3a2a5c'); R(ctx, 30, 90, 40 * Math.min(1, s.held / 0.45), 3, '#f08ab0');
        txt(ctx, 'HOLD TO CHARGE · LET GO AT FULL MOON', 50, 96, '#c8a0ec', 6);
        if (done) { done += dt; R(ctx, 0, 0, 100, 100, `rgba(255,255,255,${Math.max(0, 0.6 - done * 2)})`); if (done > 0.5) return win(); }
      });
    },
    async solve(b, s) {
      b.down({ x: 50, y: 66 });
      await b.until(() => s.held >= 0.47 && s.m > 0.92);
      b.up({ x: 50, y: 66 });
    },
  },

  // 16. Magical: dress the copycat up as a magical girl (tiara, wand, bow).
  {
    id: 'fp-sailor-ditto', cmd: 'Dress up Ditto!', theme: 'funtendo', time: 7,
    setup({ stage, win, sfx, frame, pos, expose }) {
      const ctx = scene(stage);
      const items = [
        { name: 'tiara', rows: TIARA, x: 18, y: 84, hx: 50, hy: 31, done: false },
        { name: 'wand', rows: WAND, x: 50, y: 84, hx: 72, hy: 52, done: false },
        { name: 'bow', rows: BOW, x: 82, y: 84, hx: 50, hy: 60, done: false },
      ];
      shuffle(items).forEach((it, k) => { it.x = 18 + k * 32; it.home = it.x; });
      const s = expose({ items, drag: null });
      follow(stage, pos, (p, ph) => {
        if (ph === 'down') s.drag = items.find(it => !it.done && dist(p, it) < 11) || null;
        if (!s.drag) return;
        if (ph === 'move') { s.drag.x = p.x; s.drag.y = p.y; }
        if (ph === 'up') {
          if (dist(s.drag, { x: s.drag.hx, y: s.drag.hy }) < 13) {
            s.drag.done = true; s.drag.x = s.drag.hx; s.drag.y = s.drag.hy; sfx('sparkle');
            if (items.every(it => it.done)) setTimeout(win, 250);
          } else { s.drag.x = s.drag.home; s.drag.y = 84; sfx('land'); }
          s.drag = null;
        }
      });
      let t = 0;
      frame(dt => {
        t += dt;
        R(ctx, 0, 0, 100, 100, '#2a1c34');
        for (let i = 0; i < 14; i++) R(ctx, (i * 41) % 100, (i * 29) % 70, 1, 1, '#f08ab0');
        put(ctx, spr(BLOB), 50, 46 + Math.sin(t * 4), 4);
        items.forEach(it => {
          if (!it.done) { ctx.setLineDash([2, 2]); ctx.strokeStyle = '#6a5a8a'; ctx.strokeRect(it.hx - 6, it.hy - 5, 12, 10); ctx.setLineDash([]); }
        });
        R(ctx, 0, 74, 100, 26, '#3a2a5c');
        items.forEach(it => put(ctx, spr(it.rows), it.x, it.y, 2.4));
        txt(ctx, 'DRAG EACH ITEM ONTO DITTO', 50, 8, '#f8b0d4', 8);
      });
    },
    async solve(b, s) {
      for (const it of s.items) { await b.drag({ x: it.x, y: it.y }, { x: it.hx, y: it.hy }, 200, 6); await b.wait(60); }
    },
  },

  // ---------- island life ----------

  // 17. Shake the tree without bees. Three fruit wins.
  {
    id: 'fp-tree', cmd: 'Shake the tree!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, frame, pos, expose }) {
      const ctx = scene(stage);
      const XS = [28, 72], bees = rnd(2);
      const s = expose({ x: XS[1 - bees], y: 40 });
      let shake = [0, 0], fruit = [], got = 0, stung = -1, t = 0;
      onTap(stage, pos, p => {
        if (stung >= 0 || got >= 3) return;
        const k = XS.findIndex(x => Math.abs(p.x - x) < 18 && p.y < 80);
        if (k < 0) return;
        shake[k] = 0.25;
        if (k === bees) { stung = 0; sfx('alarm'); return; }
        fruit.push({ x: XS[k] + (Math.random() - 0.5) * 16, y: 34, vy: 0 });
        sfx('pop');
      });
      frame(dt => {
        t += dt;
        sky(ctx, '#c8e8f8'); grass(ctx, 72);
        XS.forEach((x, k) => {
          shake[k] = Math.max(0, shake[k] - dt);
          const wob = shake[k] ? Math.sin(t * 60) * 2 : 0;
          R(ctx, x - 3, 50, 6, 26, '#6b3d22');
          circle(ctx, x + wob, 36, 17, '#3d7a34', true); circle(ctx, x + wob - 5, 30, 8, '#6fb04a', true);
          if (k !== bees) for (let j = 0; j < 3; j++) circle(ctx, x + wob - 8 + j * 8, 42, 2, '#d0463c', true);
          else for (let j = 0; j < 4; j++) { const a = t * 6 + j * 1.6; R(ctx, x + Math.cos(a) * 20, 34 + Math.sin(a * 1.3) * 12, 2, 2, j % 2 ? '#ffe27a' : '#1a1220'); }
        });
        for (const f of fruit) {
          if (f.y < 78) { f.vy += 200 * dt; f.y += f.vy * dt; if (f.y >= 78) { f.y = 78; got++; if (got >= 3) setTimeout(win, 200); } }
          circle(ctx, f.x, f.y, 2.5, '#d0463c', true); R(ctx, f.x - 0.5, f.y - 4, 1, 2, '#3d7a34');
        }
        put(ctx, spr(VILLAGER), 50, 84, 1.4);
        if (stung >= 0) {
          stung += dt;
          circle(ctx, XS[bees], 50 + stung * 60, 5, '#a0663a', true);
          for (let j = 0; j < 6; j++) R(ctx, 50 + Math.cos(t * 9 + j) * 10, 80 + Math.sin(t * 11 + j) * 8, 2, 2, j % 2 ? '#ffe27a' : '#1a1220');
          if (stung > 0.5) return lose();
        }
        txt(ctx, `TAP THE TREE WITHOUT BEES · ${Math.min(got, 3)}/3`, 50, 96, '#1a1220', 7);
      });
    },
    async solve(b, s) { for (let i = 0; i < 3; i++) { await b.tap({ x: s.x, y: s.y }); await b.wait(90); } await b.until(() => false, 900); },
  },

  // 18. Several shadows come by; only reel in when the BIG one bites.
  {
    id: 'fp-bigfish', cmd: 'Catch the big one!', theme: 'funtendo', time: 7,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const order = [...Array(1 + rnd(2)).fill('small'), 'big'];
      const s = expose({ state: 'swim', big: false, k: 0, t: 0 });
      const SW = 0.5 / speed, NIB = 0.5 / speed, DIP = 0.55 / Math.sqrt(speed);
      let caught = -1;
      const fishX = () => s.state === 'swim' ? 90 - (s.t / SW) * 30 : s.state === 'leave' ? 60 + (s.t / SW) * 40 : 60;
      onTap(stage, pos, () => {
        if (caught >= 0) return;
        if (s.state === 'dip' && s.big) { caught = 0; s.state = 'caught'; sfx('coin'); }
        else { sfx('nope'); lose(); }
      });
      frame(dt => {
        s.t += dt;
        s.big = order[s.k] === 'big';
        if (s.state === 'swim' && s.t > SW) { s.state = 'nibble'; s.t = 0; }
        else if (s.state === 'nibble' && s.t > NIB) { s.state = 'dip'; s.t = 0; sfx('drip'); }
        else if (s.state === 'dip' && s.t > DIP) {
          if (s.big) { sfx('fizzle'); return lose(); }
          s.state = 'leave'; s.t = 0;
        } else if (s.state === 'leave' && s.t > SW) { s.k++; s.state = 'swim'; s.t = 0; }
        if (caught >= 0) { caught += dt; if (caught > 0.4) return win(); }
        sky(ctx, '#f8c8a8'); R(ctx, 0, 36, 100, 64, '#2c5a9a');
        for (let i = 0; i < 7; i++) R(ctx, ((i * 29 + s.t * 6) % 110) - 5, 42 + i * 8, 8, 1, '#4f8fd0');
        R(ctx, 0, 28, 30, 8, '#a0663a');
        put(ctx, spr(VILLAGER), 12, 20, 1.3);
        ctx.strokeStyle = '#6b3d22'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(16, 18); ctx.lineTo(36, 6); ctx.stroke();
        const dip = s.state === 'dip', nib = s.state === 'nibble';
        const by = dip ? 44 : 39 + (nib ? Math.sin(s.t * 40) * 1 : 0);
        ctx.strokeStyle = '#fff4e0'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(36, 6); ctx.lineTo(60, by - 2); ctx.stroke();
        if (caught < 0) { R(ctx, 58, by - 2, 4, 2, '#d0463c'); R(ctx, 58, by, 4, 2, '#fff4e0'); }
        // shadow
        if (caught < 0 && s.k < order.length) {
          const r = s.big ? 9 : 4;
          ctx.fillStyle = 'rgba(16,24,48,0.55)'; ctx.beginPath(); ctx.ellipse(fishX(), 58, r * 1.6, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        }
        if (caught >= 0) put(ctx, spr(GOLDFISH), 60, 44 - caught * 60, 2.2);
        if (dip) txt(ctx, '!', 60, 30, '#ffe27a', 14);
        txt(ctx, 'ONLY THE BIG SHADOW', 50, 94, '#fff4e0', 7);
      });
    },
    async solve(b, s) { await b.until(() => s.state === 'dip' && s.big); await b.wait(40); await b.tap({ x: 50, y: 60 }); },
  },

  // 19. Sneak up on the beetle: only move while it isn't looking.
  {
    id: 'fp-net', cmd: 'Net it!', theme: 'funtendo', time: 7,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ px: 12, moving: false, warn: false, look: false, t: 0, next: (0.8 + Math.random() * 0.5) / speed });
      const WARN = 0.35, LOOK = 0.6 / Math.sqrt(speed);
      let swing = -1;
      follow(stage, pos, (p, ph) => { if (ph === 'down') s.moving = true; if (ph === 'up') s.moving = false; });
      frame(dt => {
        s.t += dt;
        if (!s.warn && !s.look && s.t > s.next) { s.warn = true; s.t = 0; }
        else if (s.warn && s.t > WARN) { s.warn = false; s.look = true; s.t = 0; }
        else if (s.look && s.t > LOOK) { s.look = false; s.t = 0; s.next = (0.7 + Math.random() * 0.6) / speed; }
        if (swing < 0 && s.moving) {
          if (s.look) { sfx('nope'); return lose(); }
          s.px += 22 * speed * dt;
          if (s.px >= 64) { swing = 0; sfx('swap'); }
        }
        if (swing >= 0) { swing += dt; if (swing > 0.35) { sfx('coin'); return win(); } }
        sky(ctx, '#c8e8f8'); grass(ctx, 74);
        R(ctx, 78, 10, 10, 66, '#6b3d22'); R(ctx, 80, 10, 2, 66, '#a0663a');
        if (swing < 0.2) put(ctx, spr(BEETLE), 83, 44, 1.6);
        put(ctx, spr(VILLAGER), s.px, 66, 1.6, false);
        // net
        const a = swing >= 0 ? -1.2 + swing * 6 : -0.6;
        ctx.strokeStyle = '#6b3d22'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(s.px + 4, 62); ctx.lineTo(s.px + 4 + Math.cos(a) * 18, 62 + Math.sin(a) * 18); ctx.stroke();
        circle(ctx, s.px + 4 + Math.cos(a) * 20, 62 + Math.sin(a) * 20, 4, '#fff4e0');
        if (s.warn) txt(ctx, '…', 83, 34, '#ffe27a', 12);
        if (s.look) txt(ctx, '?!', 83, 32, '#d0463c', 12);
        txt(ctx, 'HOLD TO SNEAK · LET GO WHEN IT LOOKS', 50, 94, '#1a1220', 6);
      });
    },
    async solve(b, s) {
      let down = false;
      while (!b.over()) {
        const safe = !s.warn && !s.look;
        if (safe && !down) { b.down({ x: 40, y: 50 }); down = true; }
        if (!safe && down) { b.up({ x: 40, y: 50 }); down = false; }
        await b.wait(16);
      }
      if (down) b.up({ x: 40, y: 50 });
    },
  },

  // 20. Pay off the loan exactly, in big and small bags.
  {
    id: 'fp-loan', cmd: 'Pay the loan!', theme: 'funtendo', time: 7,
    setup({ stage, win, lose, sfx, frame, pos, expose }) {
      const ctx = scene(stage);
      const big = 1 + rnd(4), small = rnd(5) + (big < 2 ? 1 : 0);
      const need = big * 1000 + small * 100;
      const s = expose({ need, paid: 0, big, small });
      let done = 0;
      onTap(stage, pos, p => {
        if (done) return;
        if (inBox(p, 10, 70, 36, 24)) s.paid += 1000;
        else if (inBox(p, 54, 70, 36, 24)) s.paid += 100;
        else return;
        sfx('coin');
        if (s.paid === need) { done = 0.01; }
        else if (s.paid > need) { sfx('nope'); lose(); }
      });
      frame(dt => {
        R(ctx, 0, 0, 100, 100, '#f8ecd0'); R(ctx, 0, 62, 100, 38, '#c9ad7f');
        put(ctx, spr(RACCOON), 26, 34, 2.6);
        R(ctx, 50, 14, 44, 34, '#fff4e0'); R(ctx, 50, 14, 44, 2, '#a0663a');
        txt(ctx, 'LOAN', 72, 21, '#8e2a2a', 8);
        txt(ctx, `${(need - Math.min(s.paid, need)).toLocaleString('en-US')}`, 72, 33, '#1a1220', 11);
        txt(ctx, 'bells', 72, 42, '#6b3d22', 7);
        R(ctx, 10, 70, 36, 24, '#e8d8b8'); put(ctx, spr(BAG), 28, 79, 1.8); txt(ctx, '1,000', 28, 90, '#6b3d22', 7);
        R(ctx, 54, 70, 36, 24, '#e8d8b8'); put(ctx, spr(BAG), 72, 80, 1.2); txt(ctx, '100', 72, 90, '#6b3d22', 7);
        if (done) { done += dt; txt(ctx, 'Paid in full, yes yes!', 50, 56, '#3d7a34', 8); if (done > 0.45) return win(); }
      });
    },
    async solve(b, s) {
      for (let i = 0; i < s.big; i++) { await b.tap({ x: 28, y: 82 }); await b.wait(40); }
      for (let i = 0; i < s.small; i++) { await b.tap({ x: 72, y: 82 }); await b.wait(40); }
    },
  },

  // 21. Dig at the star-shaped crack (three digs).
  {
    id: 'fp-fossil', cmd: 'Dig it up!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, frame, pos, expose }) {
      const ctx = scene(stage);
      const spotsAt = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) spotsAt.push({ x: 14 + c * 24 + (r % 2) * 6, y: 30 + r * 22 });
      const star = rnd(spotsAt.length);
      const plain = shuffle(spotsAt.map((_, i) => i).filter(i => i !== star)).slice(0, 4);
      const s = expose({ x: spotsAt[star].x, y: spotsAt[star].y, digs: 0 });
      let fossil = -1, junk = null;
      onTap(stage, pos, p => {
        if (fossil >= 0 || junk) return;
        const k = spotsAt.findIndex(o => dist(o, p) < 9);
        if (k < 0) return;
        if (k === star) { s.digs++; sfx('land'); if (s.digs >= 3) { fossil = 0; sfx('coin'); } }
        else { junk = spotsAt[k]; sfx('nope'); setTimeout(lose, 300); }
      });
      frame(dt => {
        R(ctx, 0, 0, 100, 100, '#a8d870');
        ctx.fillStyle = '#6fb04a'; for (let i = 0; i < 40; i++) ctx.fillRect((i * 37) % 100, (i * 53) % 100, 2, 1);
        plain.forEach(i => { const o = spotsAt[i]; R(ctx, o.x - 3, o.y, 6, 1, '#6b3d22'); R(ctx, o.x - 1, o.y - 2, 1, 2, '#6b3d22'); });
        const o = spotsAt[star];
        if (s.digs === 0) {
          ctx.strokeStyle = '#6b3d22'; ctx.lineWidth = 1; ctx.beginPath();
          for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + Math.cos(a) * 5, o.y + Math.sin(a) * 5); }
          ctx.stroke();
        } else circle(ctx, o.x, o.y, 2 + s.digs * 1.5, '#6b3d22', true);
        if (junk) { circle(ctx, junk.x, junk.y, 4, '#6b3d22', true); R(ctx, junk.x - 2, junk.y - 6, 4, 4, '#8e8e9e'); }
        if (fossil >= 0) {
          fossil += dt;
          R(ctx, o.x - 6, o.y - 6 - fossil * 20, 12, 8, '#efdcb4'); R(ctx, o.x - 4, o.y - 4 - fossil * 20, 8, 1, '#a0663a');
          txt(ctx, 'A FOSSIL!', 50, 92, '#3d7a34', 9);
          if (fossil > 0.5) return win();
        } else txt(ctx, 'DIG THE STAR CRACK · 3 DIGS', 50, 92, '#1a1220', 7);
      });
    },
    async solve(b, s) { for (let i = 0; i < 3; i++) { await b.tap({ x: s.x, y: s.y }); await b.wait(60); } },
  },

  // 22. Slingshot the drifting balloon present.
  {
    id: 'fp-present', cmd: 'Pop the present!', theme: 'funtendo', time: 6,
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const s = expose({ bx: dir > 0 ? -5 : 105, by: 20, vx: dir * 22 * speed, px: 50, shot: null, t: 0, fall: -1 });
      follow(stage, pos, (p, ph) => {
        s.px = clamp(p.x, 8, 92);
        if (ph === 'up' && !s.shot && s.fall < 0) { s.shot = { x: s.px, y: 84 }; sfx('swap'); }
      });
      frame(dt => {
        s.t += dt;
        if (s.fall < 0) {
          s.bx += s.vx * dt; s.by = 20 + Math.sin(s.t * 3) * 3;
          if (s.bx > 108) s.bx = -8; if (s.bx < -8) s.bx = 108;
        }
        if (s.shot) {
          s.shot.y -= 150 * dt;
          if (s.fall < 0 && dist(s.shot, { x: s.bx, y: s.by }) < 7) { s.fall = 0; sfx('pop'); s.shot = null; }
          else if (s.shot.y < -4) s.shot = null;
        }
        sky(ctx, '#c8e8f8'); grass(ctx, 86);
        if (s.fall < 0) {
          circle(ctx, s.bx, s.by - 8, 5, '#d0463c', true);
          ctx.strokeStyle = '#1a1220'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(s.bx, s.by - 3); ctx.lineTo(s.bx, s.by + 2); ctx.stroke();
          R(ctx, s.bx - 4, s.by + 2, 8, 7, '#9fd3f2'); R(ctx, s.bx - 0.5, s.by + 2, 1, 7, '#ffe27a');
        } else {
          s.fall += dt;
          R(ctx, s.bx - 4, s.by + 2 + s.fall * 120, 8, 7, '#9fd3f2');
          if (s.fall > 0.5) { sfx('coin'); return win(); }
        }
        if (s.shot) R(ctx, s.shot.x - 1, s.shot.y - 1, 2, 2, '#6b3d22');
        put(ctx, spr(VILLAGER), s.px, 90, 1.2);
        R(ctx, s.px - 1, 80, 2, 4, '#6b3d22');
        txt(ctx, 'DRAG TO AIM · LET GO TO SHOOT', 50, 6, '#2c5a9a', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        if (s.shot || s.fall >= 0) { await b.wait(20); continue; }
        const tt = (84 - s.by) / 150 + 0.05;
        const x = s.bx + s.vx * tt;
        if (x > 10 && x < 90) { await b.tap({ x, y: 90 }); await b.wait(150); }
        else await b.wait(20);
      }
    },
  },

  // 23. Cross-breed: pick the two flowers that make the colour asked for.
  {
    id: 'fp-breed', cmd: 'Cross-breed!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, frame, pos, expose }) {
      const ctx = scene(stage);
      const COL = { red: '#d0463c', blue: '#4f8fd0', yellow: '#ffe27a', white: '#fff4e0' };
      const RECIPES = [['purple', '#a46ad0', 'red', 'blue'], ['orange', '#f39a3a', 'red', 'yellow'], ['pink', '#f8b0d4', 'red', 'white'], ['green', '#6fb04a', 'yellow', 'blue']];
      const [name, hex, a, c] = pick(RECIPES);
      const flowers = shuffle(['red', 'blue', 'yellow', 'white']).map((col, k) => ({ col, x: 16 + k * 23, y: 72, sel: false }));
      const s = expose({ a: flowers.find(f => f.col === a), c: flowers.find(f => f.col === c) });
      let done = 0, ok = false;
      onTap(stage, pos, p => {
        if (done) return;
        const f = flowers.find(o => Math.abs(p.x - o.x) < 10 && p.y > 56 && p.y < 90);
        if (!f || f.sel) return;
        f.sel = true; sfx('select');
        const sel = flowers.filter(o => o.sel);
        if (sel.length === 2) { done = 0.01; ok = sel.every(o => o.col === a || o.col === c); sfx(ok ? 'sparkle' : 'nope'); }
      });
      let t = 0;
      frame(dt => {
        t += dt;
        sky(ctx, '#c8e8f8'); grass(ctx, 60);
        txt(ctx, `Breed a ${name} flower!`, 50, 10, '#2c5a9a', 9);
        // target flower
        for (let k = 0; k < 5; k++) { const ang = k * 1.256 + t; circle(ctx, 50 + Math.cos(ang) * 5, 30 + Math.sin(ang) * 5, 4, hex, true); }
        circle(ctx, 50, 30, 2.5, '#ffe27a', true);
        flowers.forEach(f => {
          R(ctx, f.x - 0.5, f.y, 1, 12, '#3d7a34');
          for (let k = 0; k < 5; k++) { const ang = k * 1.256; circle(ctx, f.x + Math.cos(ang) * 4, f.y + Math.sin(ang) * 4, 3, COL[f.col], true); }
          circle(ctx, f.x, f.y, 2, f.col === 'yellow' ? '#f39a3a' : '#ffe27a', true);
          if (f.sel) circle(ctx, f.x, f.y + 2, 10, '#fff4e0');
        });
        txt(ctx, 'TAP TWO PARENTS', 50, 94, '#1a1220', 7);
        if (done) { done += dt; if (done > 0.4) return ok ? win() : lose(); }
      });
    },
    async solve(b, s) { await b.tap({ x: s.a.x, y: s.a.y }); await b.wait(60); await b.tap({ x: s.c.x, y: s.c.y }); },
  },

  // 24. Whack the money rock as fast as you can.
  {
    id: 'fp-rock', cmd: 'Hit the money rock!', theme: 'funtendo',
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const need = 8 + Math.round(speed * 3);
      const s = expose({ hits: 0 });
      const bells = [];
      let shake = 0;
      onTap(stage, pos, () => {
        s.hits++; shake = 0.1; sfx('coin');
        bells.push({ x: 50, y: 46, vx: (Math.random() - 0.5) * 80, vy: -60 - Math.random() * 30 });
        if (s.hits >= need) win();
      });
      frame(dt => {
        shake = Math.max(0, shake - dt);
        sky(ctx, '#c8e8f8'); grass(ctx, 60);
        put(ctx, spr(ROCK), 50 + (shake ? Math.sin(shake * 200) * 2 : 0), 50, 4);
        for (const o of bells) { o.vy += 200 * dt; o.x += o.vx * dt; o.y += o.vy * dt; if (o.y < 96) put(ctx, spr(BAG), o.x, o.y, 0.9); }
        put(ctx, spr(VILLAGER), 22, 70, 1.6);
        R(ctx, 20, 92, 60, 4, '#3a2a5c'); R(ctx, 20, 92, 60 * Math.min(1, s.hits / need), 4, '#ffe27a');
        txt(ctx, 'TAP FAST!', 50, 8, '#2c5a9a', 9);
      });
    },
    async solve(b) { while (!b.over()) await b.tap({ x: 50, y: 50 }); },
  },

  // 25. Fish keep popping up. Tap only the rare golden one, never the sea bass.
  {
    id: 'fp-seabass', cmd: 'Not a sea bass!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const before = 2 + rnd(3);
      const STEP = 0.6 / speed;
      const s = expose({ rare: false, k: 0, t: 0 });
      let done = 0, ok = false;
      onTap(stage, pos, () => {
        if (done) return;
        done = 0.01; ok = s.rare;
        sfx(ok ? 'coin' : 'nope');
      });
      frame(dt => {
        s.t += dt;
        if (!done && s.t > STEP) { s.t = 0; s.k++; if (s.k > before) { sfx('fizzle'); return lose(); } }
        s.rare = s.k === before;
        R(ctx, 0, 0, 100, 100, '#f8c8a8'); R(ctx, 0, 60, 100, 40, '#2c5a9a'); R(ctx, 0, 54, 100, 8, '#a0663a');
        const bob = Math.sin(Math.min(1, s.t / 0.15) * Math.PI / 2);
        put(ctx, spr(VILLAGER), 50, 42, 2);
        if (s.rare) put(ctx, spr(GOLDFISH), 50, 18 + (1 - bob) * 10, 2.6);
        else put(ctx, spr(FISH), 50, 18 + (1 - bob) * 10, 2.6);
        txt(ctx, s.rare ? 'A coelacanth!' : 'I caught a sea bass!', 50, 74, s.rare ? '#ffe27a' : '#fff4e0', 8);
        txt(ctx, s.rare ? '' : '…no wait', 50, 84, '#c8a0ec', 7);
        txt(ctx, 'TAP ONLY THE RARE ONE', 50, 95, '#fff4e0', 7);
        if (done) { done += dt; if (done > 0.3) return ok ? win() : lose(); }
      });
    },
    async solve(b, s) { await b.until(() => s.rare); await b.wait(60); await b.tap({ x: 50, y: 30 }); },
  },

  // 26. Boss: a full gym battle. Pick the right move, dodge, weaken it, then catch it.
  {
    id: 'fp-gym', cmd: 'Gym battle!', theme: 'funtendo', time: 26, boss: true,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose, phase }) {
      const ctx = scene(stage);
      const FOES = [
        { name: 'SQUIRT', type: 'WATER', weak: 'VINE WHIP' },
        { name: 'CHARM', type: 'FIRE', weak: 'WATER GUN' },
        { name: 'BULBA', type: 'GRASS', weak: 'EMBER' },
      ];
      const foe = pick(FOES);
      const MOVES = shuffle(['VINE WHIP', 'WATER GUN', 'EMBER']);
      const MOVE_Y = [62, 74, 86];
      const s = expose({
        ph: 1, wait: 1.1, hp: 100, me: 3, inv: 0, px: 50, shots: [], fired: 0,
        meter: 0, charging: false, zone: [0, 0], r: 24, rt: 0, thrown: 0, ok: false,
        moveY: MOVE_Y[MOVES.indexOf(foe.weak)], msg: '', msgT: 0,
      });
      const SHOTS = 4, GAP = 0.85 / speed;
      let t = 0, hurt = 0, fx = null;
      const say = m => { s.msg = m; s.msgT = 1.1; };
      const next = (n, title) => { s.ph = n; s.wait = 1.0; phase(n, title); };
      phase(1, 'Pick a move!');
      follow(stage, pos, (p, ph) => {
        if (s.wait > 0) return;
        if (s.ph === 1 && ph === 'down') {
          const k = MOVE_Y.findIndex(y => p.y >= y - 5 && p.y <= y + 5 && p.x > 20 && p.x < 80);
          if (k < 0) return;
          fx = { t: 0.4, move: MOVES[k] };
          if (MOVES[k] === foe.weak) { s.hp = 55; hurt = 0.4; sfx('boom'); say('Super effective!'); next(2, 'Dodge!'); }
          else { sfx('nope'); say('Not very effective…'); s.wait = 0.5; }
        } else if (s.ph === 2) {
          s.px = clamp(p.x, 10, 90);
        } else if (s.ph === 3) {
          if (ph === 'down') { s.charging = true; s.meter = 0; sfx('charge'); }
          if (ph === 'up' && s.charging) {
            s.charging = false;
            const left = s.hp - s.meter;
            if (left <= 2) { s.hp = 0; sfx('fizzle'); say('It fainted!'); return lose(); }
            s.hp = left; hurt = 0.3; sfx('boom');
            if (left <= 20) { say('It’s weak!'); next(4, 'Catch it!'); }
            else { say('Again!'); s.zone = [s.hp - 20, s.hp - 4]; }
          }
        } else if (s.ph === 4 && ph === 'down' && !s.thrown) {
          s.thrown = 0.01; s.ok = s.r < 9.5; sfx('swap');
        }
      });
      frame(dt => {
        t += dt; hurt = Math.max(0, hurt - dt); s.inv = Math.max(0, s.inv - dt); s.msgT -= dt;
        if (s.wait > 0) { s.wait -= dt; if (s.ph === 3 && s.wait <= 0) s.zone = [s.hp - 20, s.hp - 4]; }
        // phase 2: dodge the foe's attacks
        if (s.ph === 2 && s.wait <= 0) {
          if (s.fired < SHOTS && t > (s.lastShot || 0) + GAP) {
            s.lastShot = t; s.fired++;
            s.shots.push({ x: clamp(s.px + (Math.random() - 0.5) * 12, 10, 90), y: 30 });
            sfx('aiplace');
          }
          for (const o of s.shots) o.y += 70 * speed * dt;
          for (const o of s.shots) if (!o.spent && o.y > 76 && o.y < 90 && Math.abs(o.x - s.px) < 7 && s.inv <= 0) {
            o.spent = true; s.me--; s.inv = 0.7; sfx('nope');
            if (s.me <= 0) { say('Your Eevee fainted!'); return lose(); }
          }
          s.shots = s.shots.filter(o => o.y < 104);
          if (s.fired >= SHOTS && !s.shots.length) next(3, 'Weaken it!');
        }
        if (s.ph === 3 && s.charging) s.meter = Math.min(100, s.meter + 55 * speed * dt);
        if (s.ph === 4 && s.wait <= 0) {
          if (!s.thrown) s.rt += dt;
          s.r = 6 + 18 * (0.5 + 0.5 * Math.cos((s.rt / (1.4 / speed)) * Math.PI * 2));
          if (s.thrown) {
            s.thrown += dt;
            if (s.thrown > 0.35 && !s.ok) { s.thrown = 0; say('It broke free!'); sfx('fizzle'); }
            else if (s.ok && s.thrown > 1.0) { sfx('coin'); return win(); }
          }
        }
        // ---- draw ----
        R(ctx, 0, 0, 100, 100, '#e8d8f8');
        R(ctx, 54, 34, 40, 6, '#c8b0e0'); R(ctx, 6, 82, 40, 6, '#c8b0e0');
        const caught = s.ph === 4 && s.ok && s.thrown > 0.35;
        if (!caught) {
          const fxw = hurt ? Math.sin(t * 80) * 2 : 0;
          mon(ctx, foe.name, 74 + fxw, 26, 2.4);
        } else put(ctx, spr(BALL), 74 + Math.sin(s.thrown * 18) * 2, 32, 1.6);
        // HP bar
        R(ctx, 54, 6, 40, 4, '#3a2a5c');
        R(ctx, 54, 6, 40 * s.hp / 100, 4, s.hp > 50 ? '#6fb04a' : s.hp > 20 ? '#ffe27a' : '#d0463c');
        txt(ctx, `${foe.type}`, 64, 13, '#6a3e94', 6);
        hearts(ctx, s.me, 3, 4, 4);
        const evx = s.ph === 2 ? s.px : 26;
        if (!(s.inv > 0 && Math.floor(t * 16) % 2)) put(ctx, spr(FOX), evx, 76, 2, true);
        // a magical-girl trainer cheering behind
        put(ctx, spr(TIARA), 10, 60, 1); R(ctx, 7, 62, 6, 6, '#f8b0d4'); R(ctx, 8, 63, 1, 1, '#1a1220'); R(ctx, 11, 63, 1, 1, '#1a1220'); R(ctx, 7, 68, 6, 6, '#4f8fd0');
        if (s.ph === 1) MOVES.forEach((m, k) => btn(ctx, 20, MOVE_Y[k] - 5, 60, 10, m, '#fff4e0', '#3a2a5c', 7));
        if (fx && (fx.t -= dt) > 0) { for (let k = 0; k < 6; k++) R(ctx, 30 + (74 - 30) * (1 - fx.t / 0.4) + Math.sin(k + t * 20) * 3, 70 - 44 * (1 - fx.t / 0.4) + k, 2, 2, fx.move === 'EMBER' ? '#f39a3a' : fx.move === 'WATER GUN' ? '#4f8fd0' : '#6fb04a'); }
        for (const o of s.shots) { circle(ctx, o.x, o.y, 3, '#c0507a', true); circle(ctx, o.x, o.y, 1.5, '#fff4e0', true); }
        if (s.ph === 3) {
          R(ctx, 54, 46, 40, 5, '#3a2a5c');
          if (s.wait <= 0) R(ctx, 54 + 40 * (s.zone[0] / 100), 46, 40 * ((s.zone[1] - s.zone[0]) / 100), 5, '#ffe27a');
          R(ctx, 54, 46, 40 * s.meter / 100, 5, s.charging ? '#f08ab0' : 'rgba(240,138,176,0.4)');
          txt(ctx, 'HOLD TO CHARGE · LET GO IN THE GOLD', 50, 96, '#6a3e94', 6);
        }
        if (s.ph === 4) {
          if (!caught) circle(ctx, 74, 26, s.r, s.r < 9.5 ? '#6fb04a' : s.r < 15 ? '#ffe27a' : '#d0463c', false, 1.5);
          if (s.thrown && !caught) { const k = Math.min(1, s.thrown / 0.35); put(ctx, spr(BALL), 30 + 44 * k, 76 - 50 * k - Math.sin(k * Math.PI) * 10, 1.4); }
          txt(ctx, 'TAP WHEN THE RING IS SMALL', 50, 96, '#6a3e94', 6);
        }
        if (s.ph === 2) txt(ctx, 'DRAG TO DODGE', 50, 96, '#6a3e94', 6);
        if (s.msgT > 0) txt(ctx, s.msg, 50, 52, '#c0507a', 9);
      });
    },
    async solve(b, s) {
      await b.until(() => s.wait <= 0);
      await b.tap({ x: 50, y: s.moveY });
      await b.until(() => s.ph === 2 && s.wait <= 0);
      b.down({ x: s.px, y: 80 });
      while (!b.over() && s.ph === 2) {
        const threat = s.shots.filter(o => !o.spent && o.y > 20 && o.y < 92);
        let best = s.px, bd = -1;
        for (let x = 12; x <= 88; x += 4) {
          const d = Math.min(99, ...threat.map(o => Math.abs(o.x - x))) - Math.abs(x - s.px) * 0.02;
          if (d > bd) { bd = d; best = x; }
        }
        b.move({ x: best, y: 80 });
        await b.wait(16);
      }
      b.up({ x: s.px, y: 80 });
      while (!b.over() && s.ph === 3) {
        await b.until(() => s.wait <= 0 && s.ph === 3);
        if (s.ph !== 3) break;
        const target = (s.hp - (s.zone[0] + s.zone[1]) / 2);
        b.down({ x: 50, y: 50 });
        await b.until(() => s.meter >= target);
        b.up({ x: 50, y: 50 });
        await b.wait(60);
      }
      while (!b.over()) {
        await b.until(() => s.ph === 4 && s.wait <= 0 && !s.thrown && s.r < 7.5);
        if (b.over()) break;
        await b.tap({ x: 50, y: 50 });
        await b.wait(500);
      }
    },
  },
];
