import { h, icon } from '../ui.js';
import { toLogical } from '../pixel.js';
import { rnd, pick, shuffle, clamp, dist, at, spots, tapper, follow, swipe, holdable, art, sprite, canvas, addStyle } from './kit.js';

// Magical-girl, sporty and silly microgames for the arcade.

addStyle('wild', `
[class*="mcs-wd-"] .mc-canvas { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); image-rendering: pixelated; touch-action: none; }
[class*="mcs-wd-"] .mc-spr { image-rendering: pixelated; pointer-events: none; }
.mcs-wd-pose { background: linear-gradient(#3a2058, #6a3a8a); }
.wd-arrows { position: absolute; left: 0; right: 0; top: 7%; display: flex; gap: 4%; justify-content: center; }
.wd-arrows img { width: 15%; image-rendering: pixelated; transition: opacity .2s, transform .2s; }
.wd-arrows img.done { opacity: .25; transform: scale(.8); }
.wd-arrows img.next { animation: wdbob .4s ease-in-out infinite alternate; }
@keyframes wdbob { to { transform: translateY(-6%); } }
.wd-poser { position: absolute; left: 50%; top: 60%; width: 38%; transform: translate(-50%, -50%); transition: transform .15s; }
.wd-poser img { width: 100%; image-rendering: pixelated; display: block; }
.mcs-wd-portal { background: #140c24; }
.wd-portal { position: absolute; left: 50%; top: 51%; width: 38%; aspect-ratio: 1; border-radius: 50%; transform: translate(-50%, -50%);
  background: conic-gradient(#a46ad0, #f08ab0, #4f8fd0, #a46ad0, #f08ab0, #4f8fd0, #a46ad0); box-shadow: 0 0 0 4px #1a1220, 0 0 24px #a46ad0;
  animation: wdspin 1.2s linear infinite; transition: width .5s; }
.wd-portal.closed { width: 0; }
@keyframes wdspin { to { transform: translate(-50%, -50%) rotate(360deg); } }
.wd-rune { width: 21%; aspect-ratio: 1; border: 0; padding: 0; background: #2a1c44; box-shadow: 0 0 0 3px #1a1220, inset 0 0 0 3px #4a3a6a; display: grid; place-items: center; cursor: pointer; }
.wd-rune img { width: 70%; image-rendering: pixelated; filter: brightness(.55) saturate(.6); }
.wd-rune.on { background: #6a4a9a; box-shadow: 0 0 0 3px #1a1220, 0 0 18px #ffe27a, inset 0 0 0 3px #ffe27a; }
.wd-rune.on img { filter: none; }
.mcs-wd-tickle { background: linear-gradient(#bfe6ff 0 70%, #f2f6ff 70%); }
.wd-yeti { position: absolute; left: 50%; top: 52%; width: 62%; transform: translate(-50%, -50%); }
.wd-yeti img { width: 100%; display: block; image-rendering: pixelated; }
.wd-yeti.laugh { animation: wdshake .12s steps(2) infinite; }
@keyframes wdshake { 50% { transform: translate(-48%, -51%) rotate(2deg); } }
.wd-bar { position: absolute; left: 10%; right: 10%; top: 5%; height: 7%; background: #1a1220; box-shadow: 0 0 0 3px #1a1220; }
.wd-bar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #f08ab0, #ffe27a); }
.wd-haha { position: absolute; right: 6%; top: 15%; font-size: 26px; color: #c0507a; opacity: 0; transition: opacity .15s; pointer-events: none; }
.wd-yeti.laugh + .wd-haha { opacity: 1; }
.mcs-wd-candles { background: linear-gradient(#3a2448 0 72%, #6b3d22 72%); }
.wd-cake { position: absolute; left: 14%; right: 14%; top: 56%; height: 26%; background: #f2c6d8; box-shadow: 0 0 0 3px #1a1220, inset 0 -10px 0 #d890b0, inset 0 8px 0 #fff4e0; }
.wd-plate { position: absolute; left: 8%; right: 8%; top: 81%; height: 4%; background: #d8d8e8; box-shadow: 0 0 0 3px #1a1220; }
.wd-candle { position: absolute; width: 4%; height: 15%; transform: translateX(-50%); background: repeating-linear-gradient(0deg, #9fd3f2 0 6px, #fff4e0 6px 12px); box-shadow: 0 0 0 2px #1a1220; }
.wd-candle i { position: absolute; left: 50%; bottom: 100%; width: 160%; height: 55%; transform: translateX(-50%); background: linear-gradient(0deg, #f39a3a, #ffe27a); clip-path: polygon(50% 0, 100% 75%, 50% 100%, 0 75%); animation: flick .15s steps(2) infinite; }
.wd-candle.out i { background: none; }
.wd-candle.out::after { content: ''; position: absolute; left: 30%; bottom: 110%; width: 40%; height: 40%; background: rgba(220, 220, 240, .5); animation: wdsmoke .8s forwards; }
@keyframes wdsmoke { to { transform: translateY(-200%); opacity: 0; } }
.mcs-wd-hidden { background: #3a5a3a; }
.wd-crowd { position: absolute; width: 13%; image-rendering: pixelated; cursor: pointer; }
.wd-want { position: absolute; left: 4%; top: 4%; display: flex; align-items: center; gap: 6px; background: #1a1220; padding: 4px 8px 4px 4px; color: #ffe27a; font-size: 20px; z-index: 2; pointer-events: none; }
.wd-want img { width: 40px; height: 40px; image-rendering: pixelated; background: #f6b8c8; }
`);

// ---------- canvas helpers ----------
function cvs(api, LW = 100, LH = 100) {
  const { cv, ctx } = canvas(api.stage, LW, LH);
  const L = e => toLogical(cv, LW, LH, e);
  // logical canvas point -> stage percent, for the bot
  const P = (x, y) => {
    const r = cv.getBoundingClientRect(), s = api.stage.getBoundingClientRect();
    return { x: ((r.left + (x / LW) * r.width - s.left) / s.width) * 100, y: ((r.top + (y / LH) * r.height - s.top) / s.height) * 100 };
  };
  return { cv, ctx, L, P };
}
const IM = new Map();
function img(src) {
  if (!IM.has(src)) { const i = new Image(); i.src = src; IM.set(src, i); }
  return IM.get(src);
}
const pic = (rows, pal) => img(art(rows, pal));
const ico = name => img(icon(name).src);
// draw an image centred on (x, y)
function blit(ctx, im, x, y, w, hh = w) { if (im.complete && im.naturalWidth) ctx.drawImage(im, Math.round(x - w / 2), Math.round(y - hh / 2), w, hh); }
function disc(ctx, x, y, r, c) {
  ctx.fillStyle = c;
  for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); ctx.fillRect(Math.round(x - w), Math.round(y + dy), w * 2 + 1, 1); }
}
function rect(ctx, x, y, w, hh, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hh)); }
function txt(ctx, s, x, y, size, col, align = 'center') {
  ctx.font = `${size}px "Jersey 10", monospace`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1a1220'; ctx.fillText(s, x + 0.6, y + 0.6);
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function bands(ctx, cols, LW = 100, LH = 100) { cols.forEach((c, i) => rect(ctx, 0, (i * LH) / cols.length, LW, LH / cols.length + 1, c)); }
function line(ctx, a, b, c, w = 1) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
function stars(ctx, t, n = 24) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = (i + Math.floor(t * 3)) % 5 ? '#6a5a9a' : '#fff4e0';
    ctx.fillRect((i * 37) % 100, (i * 53) % 70, 1, 1);
  }
}
const mag = v => Math.hypot(v.x, v.y);
const capMag = (v, m) => { const l = mag(v); return l > m ? { x: (v.x / l) * m, y: (v.y / l) * m } : v; };

// ---------- sprites ----------
const MONSTER = [
  '...kkkkkk...',
  '.kkPPPPPPkk.',
  'kPPPPPPPPPPk',
  'kPwwPPPPwwPk',
  'kPwkPPPPwkPk',
  'kPPPPPPPPPPk',
  'kPPkkkkkkPPk',
  'kPPkrrrrkPPk',
  '.kPPPPPPPPk.',
  '.kPkkPPkkPk.',
  '..k..kk..k..',
];
const ARROW = [
  '....k....',
  '...kyk...',
  '..kyyyk..',
  '.kyyyyyk.',
  'kyyyyyyyk',
  'kkkyyykkk',
  '..kyyyk..',
  '..kyyyk..',
  '..kkkkk..',
];
const rot = (rows, turns) => {
  let r = rows;
  for (let k = 0; k < turns; k++) r = [...r[0]].map((_, x) => r.map(row => row[x]).reverse().join(''));
  return r;
};
const ARROWS = { up: ARROW, right: rot(ARROW, 1), down: rot(ARROW, 2), left: rot(ARROW, 3) };
const YETI = [
  '....kkkkkkkk....',
  '..kkwwwwwwwwkk..',
  '.kwwwwwwwwwwwwk.',
  'kwwwuuuuuuuuwwwk',
  'kwwuukuuuukuuwwk',
  'kwwuuuuuuuuuuwwk',
  'kwwuuukkkkuuuwwk',
  'kwwwuuurruuuwwwk',
  'kkwwwwwwwwwwwwkk',
  'kwkwwwccccwwwkwk',
  'kwkwwccccccwwkwk',
  'kwkwwccccccwwkwk',
  'kwkwwwccccwwwkwk',
  '.k.kwwwwwwwwk.k.',
  '...kwwk..kwwk...',
  '...kkkk..kkkk...',
];
const BALL = ['.kkkk.', 'kwwkwk', 'kwkkwk', 'kwwwkk', 'kwkwwk', '.kkkk.'];
const BBALL = ['.kkkk.', 'kokook', 'kkkkkk', 'kookok', 'kokook', '.kkkk.'];
const ROBOT = [
  '.yy....yy.',
  'yyyk..kyyy',
  '.kkkkkkkk.',
  'kssssssssk',
  'kswwkkwwsk',
  'kswkrrkwsk',
  'kswwwwwwsk',
  'kssssssssk',
  '.kkkkkkkk.',
  '.k.k..k.k.',
];

export default [
  // ===================== MAGIC =====================
  {
    id: 'wd-transform', cmd: 'Transform!', theme: 'magic', time: 6,
    setup(api) {
      // Trace the magic star: corner to corner, the way you'd draw it.
      const { win, sfx, speed, frame } = api;
      const { ctx, L, P } = cvs(api);
      const ORDER = [0, 2, 4, 1, 3, 0];
      const girl = ico('girl' + rnd(10));
      const R = 30 - (speed - 1) * 4;
      let spin = 0, finger = null, done = false;
      const pts = () => [0, 1, 2, 3, 4].map(k => {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5 + spin;
        return { x: 50 + Math.cos(a) * R, y: 54 + Math.sin(a) * R };
      });
      const s = api.expose({ idx: 0, pts: pts(), P, ORDER });
      follow(api.stage, L, (p, ph) => {
        if (done || ph === 'hover') return;
        if (ph === 'up') { finger = null; return; }
        finger = p;
        const tgt = s.pts[ORDER[s.idx]];
        if (tgt && dist(p, tgt) < 9) {
          s.idx++;
          sfx('peg', s.idx);
          if (s.idx === ORDER.length) { done = true; sfx('glaive'); win(); }
        }
      });
      frame((dt, t) => {
        spin += dt * 0.35 * (speed - 1);
        s.pts = pts();
        bands(ctx, ['#3a1c4c', '#4a2260', '#5a2a70', '#6a3280']);
        stars(ctx, t);
        ctx.globalAlpha = done ? 1 : 0.45;
        blit(ctx, girl, 50, 54, 22);
        ctx.globalAlpha = 1;
        for (let k = 0; k < 5; k++) line(ctx, s.pts[ORDER[k]], s.pts[ORDER[k + 1]], 'rgba(255,244,224,0.18)', 1);
        for (let k = 1; k < s.idx; k++) line(ctx, s.pts[ORDER[k - 1]], s.pts[ORDER[k]], '#ffe27a', 2.5);
        if (finger && s.idx > 0 && !done) line(ctx, s.pts[ORDER[s.idx - 1]], finger, '#f08ab0', 1.5);
        s.pts.forEach((p, k) => {
          const next = ORDER[s.idx] === k && !done;
          disc(ctx, p.x, p.y, next ? 4 + (Math.floor(t * 6) % 2) : 3, next ? '#fff4e0' : s.idx > 0 && ORDER.slice(0, s.idx).includes(k) ? '#ffe27a' : '#a46ad0');
        });
        if (s.idx === 0) txt(ctx, 'start here', s.pts[0].x, s.pts[0].y - 8, 7, '#fff4e0');
      });
    },
    async solve(b, s) {
      let cur = { ...s.pts[0] };
      b.down(s.P(cur.x, cur.y));
      while (!b.over() && s.idx < s.ORDER.length) {
        const tgt = s.pts[s.ORDER[s.idx]];
        for (let i = 1; i <= 6; i++) { b.move(s.P(cur.x + ((tgt.x - cur.x) * i) / 6, cur.y + ((tgt.y - cur.y) * i) / 6)); await b.wait(16); }
        cur = { ...tgt };
        await b.wait(10);
      }
      b.up(s.P(cur.x, cur.y));
    },
  },
  {
    id: 'wd-beam', cmd: 'Zap it!', theme: 'magic',
    setup(api) {
      // The wand sweeps on its own; tap when it points at the monster.
      const { win, sfx, speed, frame } = api;
      const { ctx, P } = cvs(api);
      const W = { x: 50, y: 82 };
      const mon = pic(MONSTER), girl = ico('girl' + rnd(10));
      const s = api.expose({ mx: 50, my: 24, ang: -90, need: -90, P });
      let hit = false, cool = 0, beam = 0, beamA = 0;
      tapper(api.stage, () => {
        if (hit || cool > 0) return;
        cool = 0.35;
        const a = (s.ang * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
        const vx = s.mx - W.x, vy = s.my - W.y;
        beam = 0.25; beamA = a;
        if (vx * dx + vy * dy > 0 && Math.abs(vx * dy - vy * dx) < 9) { hit = true; sfx('boom'); win(); } else sfx('nope');
      });
      frame((dt, t) => {
        if (!hit) { s.mx = 50 + Math.sin(t * 1.3 * speed) * 32; s.my = 24 + Math.sin(t * 2.1) * 5; }
        s.ang = -90 + Math.sin(t * 2.4 * speed + 0.7) * 65;
        s.need = (Math.atan2(s.my - W.y, s.mx - W.x) * 180) / Math.PI;
        cool -= dt; beam -= dt;
        bands(ctx, ['#1e1838', '#2a2048', '#3a2a58', '#4a3468']);
        stars(ctx, t);
        rect(ctx, 0, 90, 100, 10, '#2a1c3a');
        blit(ctx, girl, 50, 90, 16);
        const a = (s.ang * Math.PI) / 180;
        for (let d = 8; d < 90; d += 4) { ctx.fillStyle = 'rgba(255,226,122,0.45)'; ctx.fillRect(Math.round(W.x + Math.cos(a) * d), Math.round(W.y + Math.sin(a) * d), 1, 1); }
        line(ctx, W, { x: W.x + Math.cos(a) * 8, y: W.y + Math.sin(a) * 8 }, '#f08ab0', 2);
        disc(ctx, W.x + Math.cos(a) * 8, W.y + Math.sin(a) * 8, 2, '#ffe27a');
        if (beam > 0) line(ctx, W, { x: W.x + Math.cos(beamA) * 120, y: W.y + Math.sin(beamA) * 120 }, hit ? '#fff4e0' : '#f08ab0', 3);
        if (!hit) blit(ctx, mon, s.mx, s.my, 18, 17);
        else { disc(ctx, s.mx, s.my, 10, '#ffe27a'); disc(ctx, s.mx, s.my, 6, '#fff4e0'); }
      });
    },
    async solve(b, s) {
      await b.until(() => Math.abs(s.ang - s.need) < 3.5);
      await b.tap({ x: 50, y: 50 });
    },
  },
  {
    id: 'wd-star', cmd: 'Catch the stars!', theme: 'magic', time: 6,
    setup(api) {
      // Slide under three falling wish-stars. Dodge the gloom orbs.
      const { win, lose, sfx, speed, frame } = api;
      const { ctx, L, P } = cvs(api);
      const girl = ico('girl' + rnd(10)), star = ico('star');
      const N = 3;
      const lanes = shuffle([22, 50, 78]).map(x => x + (Math.random() - 0.5) * 10);
      const s = api.expose({ gx: 50, stars: [], glooms: [], P });
      let spawned = 0, nextG = 0.5, caught = 0;
      follow(api.stage, L, (p, ph) => { if (ph === 'down' || ph === 'move') s.gx = clamp(p.x, 6, 94); });
      const vy = 45 * Math.sqrt(speed);
      frame((dt, t) => {
        if (spawned < N && t >= 0.2 + (spawned * 1.4) / speed) { s.stars.push({ x0: lanes[spawned], x: lanes[spawned], y: -4, ph: Math.random() * 6, t: 0 }); spawned++; }
        if (t >= nextG && t < api.time - 1) {
          nextG = t + 0.9 / speed;
          const gx = 6 + Math.random() * 88;
          // gloom never falls in a star's lane, so every star is catchable
          if (lanes.every(x => Math.abs(gx - x) > 30)) s.glooms.push({ x: gx, y: -4 });
        }
        for (const st of s.stars) {
          if (st.done) continue;
          st.t += dt; st.y += vy * dt;
          st.x = clamp(st.x0 + Math.sin(st.t * 3 + st.ph) * 12, 6, 94);
          if (st.y > 80 && st.y < 92 && Math.abs(st.x - s.gx) < 9) { st.done = true; caught++; sfx('coin'); if (caught === N) win(); }
          else if (st.y > 100) { st.done = true; lose(); }
        }
        for (const g of s.glooms) {
          if (g.done) continue;
          g.y += 40 * Math.sqrt(speed) * dt;
          if (g.y > 80 && g.y < 92 && Math.abs(g.x - s.gx) < 7) { g.done = true; sfx('nope'); lose(); }
          if (g.y > 104) g.done = true;
        }
        bands(ctx, ['#141030', '#1e1840', '#2a2050', '#3a2a60']);
        stars(ctx, t, 30);
        rect(ctx, 0, 94, 100, 6, '#2a1c3a');
        for (const st of s.stars) if (!st.done) { blit(ctx, star, st.x, st.y, 9); ctx.fillStyle = 'rgba(255,226,122,0.4)'; ctx.fillRect(Math.round(st.x), Math.round(st.y - 9), 1, 4); }
        for (const g of s.glooms) if (!g.done) { disc(ctx, g.x, g.y, 4, '#2a1030'); disc(ctx, g.x - 1, g.y - 1, 2, '#6a2a7a'); }
        blit(ctx, girl, s.gx, 87, 14);
        txt(ctx, `${caught}/${N}`, 92, 6, 8, '#ffe27a');
      });
    },
    async solve(b, s) {
      b.down(s.P(s.gx, 88));
      while (!b.over()) {
        const st = s.stars.filter(q => !q.done).sort((p, q) => q.y - p.y)[0];
        const tx = st ? st.x : s.gx;
        let best = s.gx, bestSc = -1e9;
        for (let x = 6; x <= 94; x += 2) {
          const danger = s.glooms.some(g => !g.done && g.y > 64 && g.y < 96 && Math.abs(g.x - x) < 11);
          const sc = -Math.abs(x - tx) - (danger ? 1000 : 0);
          if (sc > bestSc) { bestSc = sc; best = x; }
        }
        b.move(s.P(best, 88));
        await b.wait(20);
      }
      b.up(s.P(s.gx, 88));
    },
  },
  {
    id: 'wd-brooch', cmd: 'Spin it!', theme: 'magic',
    setup(api) {
      // Circle your finger around the brooch to wind up its magic.
      const { win, sfx, speed, frame } = api;
      const { ctx, L, P } = cvs(api);
      const need = 2 * (1 + (speed - 1) * 0.5) * Math.PI * 2;
      const C = { x: 50, y: 52 };
      const s = api.expose({ total: 0, need, P });
      let last = null, done = false, clicks = 0;
      const ang = p => Math.atan2(p.y - C.y, p.x - C.x);
      follow(api.stage, L, (p, ph) => {
        if (done) return;
        if (ph === 'down') { last = ang(p); return; }
        if (ph === 'up') { last = null; return; }
        if (ph !== 'move' || last === null) return;
        const a = ang(p);
        let d = a - last;
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        last = a;
        if (dist(p, C) > 8) s.total += d;
        const c = Math.floor(Math.abs(s.total) / (Math.PI / 2));
        if (c > clicks) { clicks = c; sfx('peg', 1 + (c % 8)); }
        if (Math.abs(s.total) >= need) { done = true; sfx('sparkle'); win(); }
      });
      frame((dt, t) => {
        bands(ctx, ['#2a1840', '#3a2050', '#4a2a60', '#3a2050']);
        stars(ctx, t);
        const f = Math.min(1, Math.abs(s.total) / need);
        // progress ring
        ctx.strokeStyle = '#1a1220'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(C.x, C.y, 36, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(C.x, C.y, 36, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
        // the brooch: a gold compact with a spinning star
        disc(ctx, C.x, C.y, 22, '#1a1220'); disc(ctx, C.x, C.y, 20, '#f2c84b'); disc(ctx, C.x, C.y, 16, '#f08ab0'); disc(ctx, C.x, C.y, 14, '#fff4e0');
        const a0 = s.total;
        ctx.fillStyle = f >= 1 ? '#ffe27a' : '#a46ad0';
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = k % 2 ? 5 : 12, a = a0 + (k * Math.PI) / 5 - Math.PI / 2;
          ctx.lineTo(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r);
        }
        ctx.fill();
        txt(ctx, 'spin around the brooch', 50, 94, 7, '#c8a0ec');
      });
    },
    async solve(b, s) {
      const C = { x: 50, y: 52 };
      b.down(s.P(C.x + 30, C.y));
      for (let a = 0; !b.over() && a < s.need + 2; a += 0.35) { b.move(s.P(C.x + Math.cos(a) * 30, C.y + Math.sin(a) * 30)); await b.wait(16); }
      b.up(s.P(C.x + 30, C.y));
    },
  },
  {
    id: 'wd-pose', cmd: 'Pose!', theme: 'magic', time: 6,
    setup(api) {
      // Swipe the arrows in order to strike the transformation pose.
      const { stage, win, lose, sfx, speed, pos } = api;
      const n = speed > 1.5 ? 4 : 3;
      const DIRS = ['up', 'right', 'down', 'left'];
      const seq = [];
      while (seq.length < n) { const d = pick(DIRS); if (d !== seq[seq.length - 1]) seq.push(d); }
      const arrows = seq.map(d => h('img', { src: art(ARROWS[d]), alt: '' }));
      const poser = h('div', { class: 'wd-poser' }, icon('girl' + rnd(10), ''));
      stage.append(h('div', { class: 'wd-arrows' }, arrows), poser, h('p', { class: 'mc-note' }, 'Swipe the arrows, left to right'));
      const s = api.expose({ seq, i: 0 });
      const mark = () => arrows.forEach((a, k) => { a.classList.toggle('done', k < s.i); a.classList.toggle('next', k === s.i); });
      mark();
      const MOVE = { up: '0,-25%', down: '0,18%', left: '-28%,0', right: '28%,0' };
      swipe(stage, pos, dir => {
        if (s.i >= n || api.over()) return;
        if (dir !== seq[s.i]) { sfx('nope'); return lose(); }
        poser.style.transform = `translate(-50%,-50%) translate(${MOVE[dir]}) rotate(${dir === 'left' ? -12 : dir === 'right' ? 12 : 0}deg)`;
        s.i++;
        mark();
        sfx('peg', s.i * 2);
        if (s.i === n) { sfx('sparkle'); win(); }
      });
    },
    async solve(b, s) {
      for (const d of s.seq) { await b.swipe(d, { x: 50, y: 55 }); await b.wait(60); }
    },
  },
  {
    id: 'wd-glaive', cmd: 'Charge!', theme: 'magic',
    setup(api) {
      // Hold to charge the Saturn glaive. Let go in the gold. Overcharge and it fizzles.
      const { win, lose, sfx, speed, frame } = api;
      const { ctx } = cvs(api);
      const w = 16 / Math.pow(speed, 0.4), lo = 50 + Math.random() * (40 - w), hi = lo + w;
      const s = api.expose({ m: 0, lo, hi });
      let holding = false, released = false;
      holdable(api.stage, () => { if (!released) { holding = true; sfx('charge'); } }, () => {
        if (!holding) return;
        holding = false; released = true;
        if (s.m >= lo && s.m <= hi) { sfx('glaive'); win(); } else { sfx('nope'); lose(); }
      });
      frame((dt, t) => {
        if (holding) {
          s.m += 38 * Math.sqrt(speed) * dt;
          if (s.m >= 100) { s.m = 100; holding = false; released = true; sfx('fizzle'); lose(); }
        }
        bands(ctx, ['#1c1030', '#2a1640', '#3a1c50', '#2a1640']);
        stars(ctx, t);
        // aura grows with the charge
        const f = s.m / 100;
        if (f > 0) { ctx.globalAlpha = 0.25 + 0.3 * f; disc(ctx, 40, 44, Math.round(8 + 22 * f), '#a46ad0'); ctx.globalAlpha = 1; }
        // the glaive: a long staff with a crescent blade
        rect(ctx, 39, 30, 3, 62, '#1a1220'); rect(ctx, 40, 30, 1, 62, '#c9ad7f');
        disc(ctx, 36, 26, 12, '#1a1220'); disc(ctx, 36, 26, 11, s.m >= lo && s.m <= hi ? '#fff4e0' : '#c8a0ec'); disc(ctx, 30, 26, 10, '#1c1030');
        disc(ctx, 40, 32, 3, '#f08ab0');
        if (holding && Math.floor(t * 12) % 2) { ctx.fillStyle = '#ffe27a'; for (let k = 0; k < 6; k++) ctx.fillRect(Math.round(40 + Math.cos(k + t * 5) * (10 + 20 * f)), Math.round(44 + Math.sin(k + t * 5) * (10 + 20 * f)), 1, 1); }
        // meter
        rect(ctx, 72, 12, 12, 78, '#1a1220');
        rect(ctx, 74, 14 + 74 * (1 - hi / 100), 8, (74 * (hi - lo)) / 100, '#ffe27a');
        rect(ctx, 74, 14 + 74 * (1 - f), 8, 74 * f, s.m >= lo && s.m <= hi ? '#fff4e0' : '#a46ad0');
        txt(ctx, holding ? 'let go in the gold!' : 'hold to charge', 50, 96, 7, '#fff4e0');
      });
    },
    async solve(b, s) {
      b.down({ x: 50, y: 50 });
      await b.until(() => s.m >= (s.lo + s.hi) / 2);
      b.up({ x: 50, y: 50 });
    },
  },
  {
    id: 'wd-portal', cmd: 'Seal it!', theme: 'magic', time: 7,
    setup(api) {
      // Watch the runes light up, then tap them back in the same order.
      const { stage, win, lose, sfx, speed, frame } = api;
      const NAMES = ['star', 'moon', 'heart', 'shard'];
      const POS = [[50, 14], [86, 51], [50, 88], [14, 51]];
      const n = speed > 1.5 ? 4 : 3;
      const seq = [];
      while (seq.length < n) { const r = rnd(4); if (r !== seq[seq.length - 1]) seq.push(r); }
      const portal = h('div', { class: 'wd-portal' });
      const note = h('p', { class: 'mc-note' }, 'Watch…');
      const s = api.expose({ seq, ready: false, i: 0, runes: [] });
      s.runes = NAMES.map((nm, k) => {
        const r = at(h('button', { type: 'button', class: 'wd-rune' }, icon(nm, '')), POS[k][0], POS[k][1]);
        tapper(r, () => {
          if (!s.ready || api.over()) return;
          r.classList.add('on'); setTimeout(() => r.classList.remove('on'), 180);
          if (k !== seq[s.i]) { sfx('nope'); return lose(); }
          s.i++;
          sfx('peg', s.i * 2);
          if (s.i === n) { portal.classList.add('closed'); sfx('sparkle'); win(); }
        });
        return r;
      });
      stage.append(portal, ...s.runes, note);
      const on = 0.45 / Math.pow(speed, 0.3), gap = 0.18;
      let lastOn = -1;
      frame((dt, t) => {
        if (s.ready) return;
        const k = Math.floor((t - 0.5) / (on + gap)), within = (t - 0.5) % (on + gap) < on;
        const cur = t >= 0.5 && k < n && within ? seq[k] : -1;
        if (cur !== lastOn) {
          s.runes.forEach((r, j) => r.classList.toggle('on', j === cur));
          if (cur >= 0) sfx('blip');
          lastOn = cur;
        }
        if (t >= 0.5 + n * (on + gap)) { s.ready = true; note.textContent = 'Your turn!'; s.runes.forEach(r => r.classList.remove('on')); }
      });
    },
    async solve(b, s) {
      await b.until(() => s.ready);
      for (const k of s.seq) { await b.tap(s.runes[k]); await b.wait(60); }
    },
  },
  {
    id: 'wd-boss', cmd: 'Defeat it!', theme: 'magic', time: 14, boss: true,
    setup(api) {
      // Boss: catch stars to charge up, dodge the gloom, then tap the monster to blast it. Twice!
      const { win, sfx, speed, frame } = api;
      const { ctx, L, P } = cvs(api);
      const mon = pic(MONSTER), girl = ico('girl' + rnd(10)), star = ico('star'), heart = ico('heart'), heartOff = ico('heartOff');
      const s = api.expose({ gx: 50, stars: [], orbs: [], charge: 0, hp: 2, mx: 50, my: 20, P });
      let nextOrb = 1, nextStar = 0.4, hurt = 0, blast = 0, done = false;
      const finisher = () => {
        s.charge = 0; s.hp--; blast = 0.5;
        sfx('glaive');
        if (s.hp <= 0) { done = true; sfx('boom'); win(); }
      };
      follow(api.stage, L, (p, ph) => {
        if (done || ph === 'hover' || ph === 'up') return;
        if (ph === 'down' && s.charge >= 3 && p.y < 45) return finisher();
        s.gx = clamp(p.x, 6, 94);
      });
      frame((dt, t) => {
        s.mx = 50 + Math.sin(t * 0.9 * speed) * 30; s.my = 20 + Math.sin(t * 2) * 3;
        hurt -= dt; blast -= dt;
        if (t >= nextOrb) {
          nextOrb = t + 1.0 / speed;
          const vy = 50 * Math.sqrt(speed), tt = (86 - s.my) / vy;
          s.orbs.push({ x: s.mx, y: s.my + 6, vx: (s.gx - s.mx) / tt, vy });
          sfx('swap');
        }
        if (t >= nextStar) { nextStar = t + 0.75 / speed; s.stars.push({ x0: 8 + Math.random() * 84, x: 0, y: -4, ph: Math.random() * 6 }); }
        for (const st of s.stars) {
          if (st.done) continue;
          st.y += 35 * Math.sqrt(speed) * dt; st.x = clamp(st.x0 + Math.sin(st.y / 8 + st.ph) * 5, 5, 95);
          if (st.y > 80 && st.y < 92 && Math.abs(st.x - s.gx) < 9) { st.done = true; if (s.charge < 3) { s.charge++; sfx('coin'); } }
          if (st.y > 100) st.done = true;
        }
        for (const o of s.orbs) {
          if (o.done) continue;
          o.x += o.vx * dt; o.y += o.vy * dt;
          if (o.y > 80 && o.y < 92 && Math.abs(o.x - s.gx) < 6) { o.done = true; s.charge = Math.max(0, s.charge - 1); hurt = 0.4; sfx('nope'); }
          if (o.y > 104) o.done = true;
        }
        bands(ctx, ['#100a20', '#1a1030', '#2a1640', '#3a1c50']);
        stars(ctx, t, 30);
        rect(ctx, 0, 94, 100, 6, '#2a1c3a');
        if (blast > 0) line(ctx, { x: s.gx, y: 84 }, { x: s.mx, y: s.my }, '#fff4e0', 4 * blast + 1);
        ctx.globalAlpha = blast > 0 && Math.floor(t * 20) % 2 ? 0.4 : 1;
        if (!done) blit(ctx, mon, s.mx, s.my, 26, 24);
        ctx.globalAlpha = 1;
        if (s.charge >= 3 && !done) { ctx.strokeStyle = Math.floor(t * 8) % 2 ? '#ffe27a' : '#f08ab0'; ctx.lineWidth = 1; ctx.strokeRect(s.mx - 16, s.my - 15, 32, 30); txt(ctx, 'TAP IT!', s.mx, s.my + 20, 9, '#ffe27a'); }
        for (const st of s.stars) if (!st.done) blit(ctx, star, st.x, st.y, 8);
        for (const o of s.orbs) if (!o.done) { disc(ctx, o.x, o.y, 3, '#2a1030'); disc(ctx, o.x, o.y, 2, '#c0507a'); }
        ctx.globalAlpha = hurt > 0 && Math.floor(t * 20) % 2 ? 0.3 : 1;
        blit(ctx, girl, s.gx, 87, 14);
        ctx.globalAlpha = 1;
        for (let k = 0; k < 2; k++) blit(ctx, k < s.hp ? heart : heartOff, 6 + k * 8, 6, 7);
        for (let k = 0; k < 3; k++) blit(ctx, star, 74 + k * 9, 6, 7);
        for (let k = s.charge; k < 3; k++) rect(ctx, 71 + k * 9, 3, 7, 7, 'rgba(16,10,32,0.7)');
      });
    },
    async solve(b, s) {
      b.down(s.P(s.gx, 88));
      while (!b.over()) {
        if (s.charge >= 3) {
          b.up(s.P(s.gx, 88));
          await b.tap(s.P(s.mx, s.my));
          b.down(s.P(s.gx, 88));
          continue;
        }
        const st = s.stars.filter(q => !q.done && q.y > 10 && q.y < 92).sort((p, q) => q.y - p.y)[0];
        const tx = st ? st.x : 50;
        let best = s.gx, bestSc = -1e9;
        for (let x = 6; x <= 94; x += 2) {
          const danger = s.orbs.some(o => !o.done && o.y > 40 && o.y < 94 && Math.abs(o.x + o.vx * ((86 - o.y) / o.vy) - x) < 11);
          const sc = -Math.abs(x - tx) - (danger ? 1000 : 0);
          if (sc > bestSc) { bestSc = sc; best = x; }
        }
        b.move(s.P(best, 88));
        await b.wait(20);
      }
      b.up(s.P(s.gx, 88));
    },
  },

  // ===================== SPORT =====================
  {
    id: 'wd-penalty', cmd: 'Score!', theme: 'sport',
    setup(api) {
      // Tap a spot in the goal to shoot. The keeper dives after it, so pick the far corner.
      const { win, lose, sfx, speed, frame } = api;
      const { ctx, L, P } = cvs(api);
      const ball = pic(BALL);
      const s = api.expose({ kx: 50, shot: null, P });
      const kv = 40 + 15 * (speed - 1);
      tapper(api.stage, e => {
        if (s.shot) return;
        const p = L(e);
        if (p.x < 16 || p.x > 84 || p.y < 14 || p.y > 42) return;
        s.shot = { tx: p.x, ty: p.y, t: 0 };
        sfx('swap');
      });
      frame((dt, t) => {
        if (!s.shot) s.kx = 50 + Math.sin(t * 2 * speed) * 26;
        else if (!s.shot.done) {
          const sh = s.shot;
          sh.t += dt;
          if (sh.t > 0.08) s.kx += clamp(sh.tx - s.kx, -kv * dt, kv * dt);
          if (sh.t >= 0.35) {
            sh.done = true;
            if (Math.abs(s.kx - sh.tx) < 9) { sh.saved = true; sfx('nope'); lose(); } else { sfx('coin'); win(); }
          }
        }
        // pitch and goal
        bands(ctx, ['#4a8a3a', '#5a9a44', '#4a8a3a', '#5a9a44', '#4a8a3a']);
        rect(ctx, 12, 10, 76, 34, '#24305a');
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        for (let x = 14; x < 88; x += 4) ctx.fillRect(x, 12, 1, 32);
        for (let y = 14; y < 44; y += 4) ctx.fillRect(12, y, 76, 1);
        rect(ctx, 10, 8, 80, 3, '#fff4e0'); rect(ctx, 10, 8, 3, 38, '#fff4e0'); rect(ctx, 87, 8, 3, 38, '#fff4e0');
        rect(ctx, 0, 46, 100, 1, '#fff4e0');
        // keeper
        const kx = s.kx, dive = s.shot && Math.abs(s.shot.tx - kx) > 2 ? Math.sign(s.shot.tx - kx) : 0;
        rect(ctx, kx - 4, 26, 8, 12, '#f39a3a'); disc(ctx, kx, 22, 3, '#e8b088');
        rect(ctx, kx - 9 + dive * 3, 27 - (dive ? 3 : 0), 5, 2, '#f39a3a'); rect(ctx, kx + 4 + dive * 3, 27 - (dive ? 3 : 0), 5, 2, '#f39a3a');
        rect(ctx, kx - 3, 38, 2, 5, '#1a1220'); rect(ctx, kx + 1, 38, 2, 5, '#1a1220');
        // ball
        let bx = 50, by = 84, bs = 8;
        if (s.shot) { const k = Math.min(1, s.shot.t / 0.35); bx = 50 + (s.shot.tx - 50) * k; by = 84 + (s.shot.ty - 84) * k; bs = 8 - 3 * k; }
        blit(ctx, ball, bx, by, bs);
        if (!s.shot) txt(ctx, 'tap the goal to shoot', 50, 96, 7, '#fff4e0');
      });
    },
    async solve(b, s) {
      await b.wait(150);
      const tx = s.kx > 50 ? 18 : 82;
      await b.tap(s.P(tx, 22));
    },
  },
  {
    id: 'wd-swing', cmd: 'Swing!', theme: 'sport',
    setup(api) {
      // Tap to swing when the pitch reaches the plate.
      const { win, lose, sfx, speed, frame } = api;
      const { ctx, P } = cvs(api);
      const rel = 0.5 + Math.random() * 1.4, v = 55 + 25 * speed;
      const s = api.expose({ by: -99, P });
      let swung = 0, hit = false, done = false, hx = 0, hy = 0;
      tapper(api.stage, () => {
        if (swung || done) return;
        swung = 0.01;
        if (s.by >= 72 && s.by <= 86) { hit = true; done = true; hx = 50; hy = s.by; sfx('boom'); win(); }
        else { done = true; sfx('nope'); lose(); }
      });
      frame((dt, t) => {
        if (swung) swung += dt;
        if (!hit && t >= rel) {
          s.by = 18 + v * (t - rel);
          if (s.by > 96 && !done) { done = true; sfx('nope'); lose(); }
        }
        if (hit) { hx += 120 * dt; hy -= 160 * dt; }
        bands(ctx, ['#6ab04a', '#5aa03a', '#6ab04a', '#5aa03a', '#6ab04a']);
        disc(ctx, 50, 50, 30, '#c79a5a'); disc(ctx, 50, 20, 6, '#b5862a');
        rect(ctx, 46, 82, 8, 6, '#fff4e0');
        // pitcher
        const wind = t < rel ? Math.sin(t * 8) * 2 : 0;
        rect(ctx, 47, 12 + wind, 6, 8, '#d0463c'); disc(ctx, 50, 9 + wind, 3, '#e8b088');
        // batter (right of the plate) and bat
        rect(ctx, 60, 76, 7, 11, '#4f8fd0'); disc(ctx, 63, 72, 3, '#e8b088'); rect(ctx, 61, 69, 5, 2, '#4f8fd0');
        const ang = swung ? Math.min(1, swung / 0.12) * 2.4 : 0;
        const bx = 60, byy = 78;
        line(ctx, { x: bx, y: byy }, { x: bx + Math.cos(-1.1 - ang) * 16, y: byy + Math.sin(-1.1 - ang) * 16 }, '#b5862a', 2.5);
        // the ball
        if (s.by > -50) blit(ctx, pic(['.kk.', 'kwwk', 'kwrk', '.kk.']), hit ? hx : 50 + Math.sin(s.by / 10) * 1.5, hit ? hy : s.by, hit ? 4 : 3 + (s.by - 18) / 25);
        if (hit) txt(ctx, 'HOME RUN!', 50, 40, 12, '#ffe27a');
      });
    },
    async solve(b, s) {
      await b.until(() => s.by >= 77 && s.by <= 81);
      await b.tap({ x: 30, y: 50 });
    },
  },
  {
    id: 'wd-hoops', cmd: 'Shoot!', theme: 'sport', time: 7,
    setup(api) {
      // Pull back like a slingshot, aim the arc, let go. Swish!
      const { win, sfx, speed, frame } = api;
      const { ctx, L, P } = cvs(api);
      const B0 = { x: 20, y: 80 }, hoop = { x: 79, y: 30 + Math.random() * 20 }, K = 4, G = 150, ST = 1 / 120;
      const bb = pic(BBALL);
      const step = q => {
        const py = q.y;
        q.vy += G * ST; q.x += q.vx * ST; q.y += q.vy * ST;
        if (py < hoop.y && q.y >= hoop.y && q.vy > 0 && q.x > hoop.x - 4.5 && q.x < hoop.x + 4.5) return 'in';
        if (q.y > 108 || q.x > 110 || q.x < -10) return 'out';
        return '';
      };
      const sim = (vx, vy, pts) => {
        const q = { x: B0.x, y: B0.y, vx, vy };
        for (let i = 0; i < 500; i++) { const r = step(q); if (pts && i % 5 === 0) pts.push({ x: q.x, y: q.y }); if (r) return r === 'in'; }
        return false;
      };
      const s = api.expose({ P, sim: (px, py) => sim(px * K, py * K), ball: null });
      let down = null, pull = null, acc = 0, swish = false;
      follow(api.stage, L, (p, ph) => {
        if (s.ball || swish) return;
        if (ph === 'down') { down = p; pull = { x: 0, y: 0 }; }
        else if (ph === 'move' && down) pull = capMag({ x: down.x - p.x, y: down.y - p.y }, 40);
        else if (ph === 'up' && down) {
          if (pull && mag(pull) > 4) { s.ball = { x: B0.x, y: B0.y, vx: pull.x * K, vy: pull.y * K }; acc = 0; sfx('swap'); }
          down = null; pull = null;
        }
      });
      frame((dt, t) => {
        if (s.ball) {
          acc += dt;
          while (acc >= ST && s.ball) {
            acc -= ST;
            const r = step(s.ball);
            if (r === 'in') { swish = true; sfx('coin'); win(); }
            if (r) { if (r === 'out') sfx('land'); s.ball = r === 'in' ? s.ball : null; break; }
          }
        }
        bands(ctx, ['#3a2a4a', '#4a3458', '#3a2a4a', '#6b3d22']);
        rect(ctx, 0, 88, 100, 12, '#a0663a');
        // hoop and backboard
        rect(ctx, 88, hoop.y - 16, 3, 22, '#fff4e0'); rect(ctx, 91, hoop.y - 6, 3, 60, '#8a8aa0');
        rect(ctx, hoop.x - 5, hoop.y, 11, 2, '#d0463c');
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        for (let k = 0; k < 4; k++) ctx.fillRect(hoop.x - 4 + k * 3, hoop.y + 2, 1, 6);
        // aim preview
        if (pull && mag(pull) > 4) {
          const pts = []; sim(pull.x * K, pull.y * K, pts);
          ctx.fillStyle = '#ffe27a';
          pts.slice(0, Math.round(10 / Math.sqrt(speed))).forEach(q => ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1));
        }
        const q = s.ball || (swish ? { x: hoop.x, y: hoop.y + 4 } : B0);
        blit(ctx, bb, q.x, q.y, 7);
        if (!s.ball && !swish) txt(ctx, 'pull back and let go', 50, 95, 7, '#fff4e0');
        if (swish) txt(ctx, 'SWISH!', 50, 30, 14, '#ffe27a');
      });
    },
    async solve(b, s) {
      let best = null;
      for (let px = 4; px <= 30 && !best; px++) for (let py = -36; py <= -4; py++) {
        if (Math.hypot(px, py) > 39) continue;
        if (s.sim(px, py) && s.sim(px - 0.6, py) && s.sim(px + 0.6, py) && s.sim(px, py - 0.6) && s.sim(px, py + 0.6)) { best = { px, py }; break; }
      }
      if (!best) return;
      const D = { x: 55, y: 30 };
      await b.drag(s.P(D.x, D.y), s.P(D.x - best.px, D.y - best.py), 200, 8);
    },
  },
  {
    id: 'wd-sumo', cmd: 'Push!', theme: 'sport',
    setup(api) {
      // Mash to shove the other wrestler out of the ring.
      const { win, lose, sfx, speed, frame } = api;
      const { ctx } = cvs(api);
      let p = 50, done = false, bump = 0;
      tapper(api.stage, () => { if (done) return; p += 7; bump = 0.08; sfx('tap'); if (p >= 100) { done = true; sfx('boom'); win(); } });
      frame((dt, t) => {
        if (!done) { p -= (12 + 6 * speed) * dt; if (p <= 0) { p = 0; done = true; sfx('nope'); lose(); } }
        bump -= dt;
        rect(ctx, 0, 0, 100, 100, '#c79a5a');
        disc(ctx, 50, 56, 40, '#fff4e0'); disc(ctx, 50, 56, 38, '#d8b07a');
        txt(ctx, 'TAP TAP TAP!', 50, 9, 10, '#fff4e0');
        // wrestlers meet at x
        const x = 18 + (p / 100) * 64, j = bump > 0 ? 1 : 0;
        // you (left, red belt)
        disc(ctx, x - 9 + j, 56, 9, '#f0c8a0'); rect(ctx, x - 16 + j, 58, 14, 3, '#d0463c'); disc(ctx, x - 9 + j, 44, 4, '#f0c8a0'); rect(ctx, x - 11 + j, 40, 4, 2, '#1a1220');
        // the other wrestler (right, blue belt)
        disc(ctx, x + 9, 56, 9, '#e8b890'); rect(ctx, x + 2, 58, 14, 3, '#4f8fd0'); disc(ctx, x + 9, 44, 4, '#e8b890'); rect(ctx, x + 7, 40, 4, 2, '#1a1220');
        // power bar
        rect(ctx, 10, 92, 80, 4, '#1a1220'); rect(ctx, 10, 92, 0.8 * p, 4, '#d0463c');
      });
    },
    async solve(b) { while (!b.over()) await b.tap({ x: 50, y: 50 }); },
  },
  {
    id: 'wd-putt', cmd: 'Putt!', theme: 'sport', time: 6,
    setup(api) {
      // Pull back from the ball to aim and set the power, then let go. Sink it!
      const { win, sfx, frame } = api;
      const { ctx, L, P } = cvs(api);
      const B0 = { x: 50, y: 86 }, hole = { x: 25 + Math.random() * 50, y: 18 + Math.random() * 22 }, A = 60, K = 3;
      const s = api.expose({ P, hole, B0, A, K, ball: null });
      let down = null, pull = null, stopped = 0, sunk = false;
      follow(api.stage, L, (p, ph) => {
        if (s.ball || sunk) return;
        if (ph === 'down') { down = p; pull = { x: 0, y: 0 }; }
        else if (ph === 'move' && down) pull = capMag({ x: down.x - p.x, y: down.y - p.y }, 40);
        else if (ph === 'up' && down) {
          if (pull && mag(pull) > 3) { const l = mag(pull); s.ball = { x: B0.x, y: B0.y, dx: pull.x / l, dy: pull.y / l, v: l * K }; sfx('tap'); }
          down = null; pull = null;
        }
      });
      frame(dt => {
        const q = s.ball;
        if (q && !sunk) {
          q.v = Math.max(0, q.v - A * dt);
          q.x += q.dx * q.v * dt; q.y += q.dy * q.v * dt;
          if (q.x < 4 || q.x > 96) { q.dx = -q.dx; q.x = clamp(q.x, 4, 96); }
          if (q.y < 4 || q.y > 96) { q.dy = -q.dy; q.y = clamp(q.y, 4, 96); }
          if (dist(q, hole) < 3.5 && q.v < 70) { sunk = true; sfx('coin'); win(); }
          if (q.v === 0 && !sunk) { stopped += dt; if (stopped > 0.3) { stopped = 0; s.ball = null; sfx('nope'); } }
        }
        rect(ctx, 0, 0, 100, 100, '#3d7a34');
        disc(ctx, 50, 50, 44, '#6fb04a');
        for (let k = 0; k < 6; k++) rect(ctx, 0, k * 17 + 5, 100, 1, 'rgba(168,216,112,0.25)');
        disc(ctx, hole.x, hole.y, 3, '#1a1220');
        rect(ctx, hole.x, hole.y - 14, 1, 14, '#fff4e0'); rect(ctx, hole.x + 1, hole.y - 14, 6, 4, '#d0463c');
        if (pull && mag(pull) > 3) {
          const l = mag(pull), d = ((l * K) ** 2) / (2 * A);
          ctx.fillStyle = '#fff4e0';
          for (let k = 3; k < d; k += 3) ctx.fillRect(Math.round(B0.x + (pull.x / l) * k), Math.round(B0.y + (pull.y / l) * k), 1, 1);
        }
        const b = sunk ? null : s.ball || B0;
        if (b) { disc(ctx, b.x, b.y, 2, '#1a1220'); disc(ctx, b.x, b.y, 1, '#fff4e0'); }
        if (!s.ball && !sunk) txt(ctx, 'pull back from the ball', 50, 96, 7, '#fff4e0');
      });
    },
    async solve(b, s) {
      const dx = s.hole.x - s.B0.x, dy = s.hole.y - s.B0.y, d = Math.hypot(dx, dy);
      const v = Math.sqrt(2 * s.A * (d + 2)), l = v / s.K;
      const D = { x: 50, y: 40 };
      await b.drag(s.P(D.x, D.y), s.P(D.x - (dx / d) * l, D.y - (dy / d) * l), 200, 8);
    },
  },
  {
    id: 'wd-highjump', cmd: 'Jump!', theme: 'sport',
    setup(api) {
      // Tap to leap when your runner hits the takeoff mark.
      const { win, lose, sfx, speed, frame } = api;
      const { ctx } = cvs(api);
      const v = 30 + 12 * speed;
      const s = api.expose({ x: 4 });
      let jumped = 0, ok = false, done = false;
      tapper(api.stage, () => {
        if (jumped || done) return;
        jumped = 0.001;
        if (s.x >= 54 && s.x <= 62) { ok = true; sfx('swap'); win(); } else { done = true; sfx('nope'); lose(); }
      });
      frame((dt, t) => {
        if (!jumped && !done) { s.x += v * dt; if (s.x > 64) { done = true; sfx('land'); lose(); } }
        if (jumped && ok) { jumped += dt; s.x += v * dt; }
        bands(ctx, ['#9fd3f2', '#bfe6ff', '#9fd3f2']);
        rect(ctx, 0, 76, 100, 24, '#d0463c');
        for (let k = 0; k < 100; k += 10) rect(ctx, k, 80, 6, 1, '#f08a7a');
        rect(ctx, 54, 76, 8, 2, '#ffe27a');
        // bar and posts
        rect(ctx, 70, 44, 2, 32, '#4a4058'); rect(ctx, 84, 44, 2, 32, '#4a4058'); rect(ctx, 70, 46, 16, 2, '#ffe27a');
        rect(ctx, 66, 66, 30, 10, '#4f8fd0');
        // runner
        const air = jumped && ok ? Math.sin(Math.min(1, jumped / 0.55) * Math.PI) * 36 : 0;
        const y = 70 - air, leg = Math.floor(t * 12) % 2;
        disc(ctx, s.x, y - 12, 3, '#e8b088');
        rect(ctx, s.x - 2, y - 9, 4, 7, '#f39a3a');
        rect(ctx, s.x - 2 + (leg ? 1 : -1), y - 2, 2, 6, '#1a1220'); rect(ctx, s.x + (leg ? -1 : 1), y - 2, 2, 6, '#1a1220');
        if (!jumped) txt(ctx, 'tap on the yellow mark', 50, 92, 7, '#fff4e0');
      });
    },
    async solve(b, s) {
      await b.until(() => s.x >= 56.5 && s.x <= 59.5);
      await b.tap({ x: 50, y: 50 });
    },
  },
  {
    id: 'wd-archery', cmd: 'Bullseye!', theme: 'sport', time: 6,
    setup(api) {
      // The sight drifts. Mind the wind: aim upwind so the arrow blows onto the bullseye.
      const { win, lose, sfx, speed, frame } = api;
      const { ctx } = cvs(api);
      const w = (rnd(2) ? 1 : -1) * (4 + Math.random() * 9), bull = { x: 50, y: 42 }, aim = { x: 50 - w, y: 42 }, om = 2.2 * speed;
      const s = api.expose({ cx: aim.x, cy: aim.y, w, bull });
      let arrows = 2;
      const hits = [];
      tapper(api.stage, () => {
        if (arrows <= 0 || api.over()) return;
        arrows--;
        const imp = { x: s.cx + w, y: s.cy };
        hits.push(imp);
        if (dist(imp, bull) < 5) { sfx('coin'); win(); }
        else { sfx('land'); if (arrows === 0) lose(); }
      });
      frame((dt, t) => {
        s.cx = aim.x + 20 * Math.sin(om * t); s.cy = aim.y + 12 * Math.sin(2 * om * t);
        bands(ctx, ['#9fd3f2', '#bfe6ff', '#c8ecb0', '#a8d870']);
        rect(ctx, 49, 60, 2, 30, '#6b3d22');
        [[19, '#fff4e0'], [15, '#1a1220'], [11, '#4f8fd0'], [7, '#d0463c'], [4, '#ffe27a']].forEach(([r, c]) => disc(ctx, bull.x, bull.y, r, c));
        for (const p of hits) { rect(ctx, p.x, p.y - 1, 1, 3, '#6b3d22'); rect(ctx, p.x - 1, p.y, 3, 1, '#6b3d22'); }
        // wind sock
        txt(ctx, `wind ${w > 0 ? '→' : '←'} ${Math.round(Math.abs(w))}`, 50, 8, 9, '#1a1220');
        for (let k = 0; k < Math.round(Math.abs(w) / 2); k++) rect(ctx, 50 + Math.sign(w) * (8 + k * 3), 14, 2, 1, '#4a4058');
        // sight
        ctx.strokeStyle = '#d0463c'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(s.cx, s.cy, 4, 0, Math.PI * 2); ctx.stroke();
        rect(ctx, s.cx - 7, s.cy, 5, 1, '#d0463c'); rect(ctx, s.cx + 3, s.cy, 5, 1, '#d0463c'); rect(ctx, s.cx, s.cy - 7, 1, 5, '#d0463c'); rect(ctx, s.cx, s.cy + 3, 1, 5, '#d0463c');
        txt(ctx, `arrows ${arrows}`, 88, 94, 7, '#1a1220');
      });
    },
    async solve(b, s) {
      await b.until(() => Math.hypot(s.cx + s.w - s.bull.x, s.cy - s.bull.y) < 2.5);
      await b.tap({ x: 50, y: 50 });
    },
  },

  // ===================== SILLY =====================
  {
    id: 'wd-tickle', cmd: 'Tickle!', theme: 'silly',
    setup(api) {
      // Rub the yeti's tummy until it can't stop giggling.
      const { stage, win, sfx, speed, frame, pos } = api;
      const yeti = h('div', { class: 'wd-yeti' }, h('img', { src: art(YETI, { c: '#f6d0e0' }), alt: '' }));
      const bar = h('i');
      stage.append(h('div', { class: 'wd-bar' }, bar), yeti, h('div', { class: 'wd-haha' }, 'hee hee!'), h('p', { class: 'mc-note' }, 'Rub the pink tummy!'));
      const need = 160 * (1 + (speed - 1) * 0.4);
      const belly = p => p.x > 36 && p.x < 64 && p.y > 50 && p.y < 72;
      let total = 0, last = null, laugh = 0, done = false, ding = 0;
      follow(stage, pos, (p, ph) => {
        if (done) return;
        if (ph === 'up') { last = null; return; }
        if (ph === 'move' && last && belly(p) && belly(last)) {
          total += dist(p, last); laugh = 0.25;
          if (total - ding > 25) { ding = total; sfx('peg', 1 + rnd(6)); }
          if (total >= need) { done = true; sfx('sparkle'); win(); }
        }
        last = p;
      });
      frame(dt => {
        laugh -= dt;
        yeti.classList.toggle('laugh', laugh > 0);
        bar.style.width = Math.min(100, (total / need) * 100) + '%';
      });
    },
    async solve(b) {
      b.down({ x: 40, y: 60 });
      for (let k = 0; !b.over() && k < 120; k++) { b.move({ x: k % 2 ? 60 : 40, y: k % 3 ? 58 : 64 }); await b.wait(20); }
      b.up({ x: 50, y: 60 });
    },
  },
  {
    id: 'wd-candles', cmd: 'Blow!', theme: 'silly',
    setup(api) {
      // Swipe across the flames to blow out every birthday candle.
      const { stage, win, sfx, speed, pos } = api;
      const n = 4 + (speed > 1.4 ? 2 : 0);
      stage.append(h('div', { class: 'wd-cake' }), h('div', { class: 'wd-plate' }), h('p', { class: 'mc-note', style: 'top:6%;bottom:auto' }, 'Swipe across the flames!'));
      const cs = Array.from({ length: n }, (_, k) => {
        const x = 22 + (k * 56) / (n - 1), y = 41 + (k % 2) * 3;
        const el = h('div', { class: 'wd-candle', style: `left:${x}%;top:${y}%` }, h('i'));
        stage.append(el);
        return { x, y: y - 2, el, out: false };
      });
      let left = n;
      follow(stage, pos, (p, ph) => {
        if (ph !== 'move' && ph !== 'down') return;
        for (const c of cs) {
          if (!c.out && Math.abs(p.x - c.x) < 5 && p.y > c.y - 14 && p.y < c.y + 14) {
            c.out = true; c.el.classList.add('out'); sfx('swap');
            if (--left === 0) { sfx('sparkle'); win(); }
          }
        }
      });
    },
    async solve(b) {
      while (!b.over()) { await b.drag({ x: 10, y: 38 }, { x: 92, y: 38 }, 300, 20); await b.wait(40); }
    },
  },
  {
    id: 'wd-jar', cmd: 'Lid on!', theme: 'silly',
    setup(api) {
      // Drag the lid onto the wobbling jar before the cookies escape.
      const { win, sfx, speed, frame } = api;
      const { ctx, L, P } = cvs(api);
      const JT = 52;
      const s = api.expose({ lid: { x: 20 + Math.random() * 60, y: 16 }, jx: 50, JT, P });
      let held = null, done = false;
      follow(api.stage, L, (p, ph) => {
        if (done) return;
        if (ph === 'down' && dist(p, s.lid) < 14) { held = { dx: s.lid.x - p.x, dy: s.lid.y - p.y }; sfx('select'); }
        else if (ph === 'move' && held) s.lid = { x: clamp(p.x + held.dx, 8, 92), y: clamp(p.y + held.dy, 6, 94) };
        else if (ph === 'up' && held) {
          held = null;
          if (Math.abs(s.lid.x - s.jx) < 6 && Math.abs(s.lid.y - JT) < 7) { done = true; sfx('place'); win(); }
          else sfx('land');
        }
      });
      frame((dt, t) => {
        s.jx = 50 + Math.sin(t * 1.4 * speed) * 22;
        if (done) s.lid = { x: s.jx, y: JT };
        bands(ctx, ['#f2e6c9', '#efdcb4', '#f2e6c9']);
        rect(ctx, 0, 86, 100, 14, '#a0663a'); rect(ctx, 0, 86, 100, 2, '#6b3d22');
        // jar with cookies
        const x = s.jx;
        rect(ctx, x - 12, JT + 2, 24, 32, '#1a1220'); rect(ctx, x - 11, JT + 3, 22, 30, '#bfe6ff');
        rect(ctx, x - 9, JT - 1, 18, 4, '#1a1220'); rect(ctx, x - 8, JT, 16, 3, '#9fd3f2');
        for (let k = 0; k < 5; k++) disc(ctx, x - 6 + (k % 3) * 6, JT + 26 - Math.floor(k / 3) * 7, 3, '#b5862a');
        if (!done && Math.floor(t * 4) % 2) txt(ctx, 'nom', x + 16, JT + 8 + Math.sin(t * 6) * 2, 7, '#6b3d22', 'left');
        // the lid
        const l = s.lid;
        rect(ctx, l.x - 11, l.y - 3, 22, 6, '#1a1220'); rect(ctx, l.x - 10, l.y - 2, 20, 4, '#d0463c');
        rect(ctx, l.x - 3, l.y - 6, 6, 3, '#1a1220'); rect(ctx, l.x - 2, l.y - 5, 4, 2, '#d0463c');
        if (!held && !done) { ctx.strokeStyle = '#ffe27a'; ctx.strokeRect(s.jx - 12, JT - 5, 24, 9); }
      });
    },
    async solve(b, s) {
      b.down(s.P(s.lid.x, s.lid.y));
      let p = { ...s.lid };
      for (let i = 1; i <= 8; i++) { p = { x: p.x + (s.jx - p.x) * 0.5, y: p.y + (s.JT - p.y) * (i / 8) }; b.move(s.P(p.x, p.y)); await b.wait(16); }
      for (let i = 0; i < 4; i++) { b.move(s.P(s.jx, s.JT)); await b.wait(10); }
      b.up(s.P(s.jx, s.JT));
    },
  },
  {
    id: 'wd-zip', cmd: 'Zip it!', theme: 'silly',
    setup(api) {
      // Drag the zipper all the way up. Wander off the track and it snags!
      const { win, sfx, speed, frame } = api;
      const { ctx, L, P } = cvs(api);
      const s = api.expose({ tx: 50, ty: 86, P });
      let held = false, done = false, snag = 0;
      follow(api.stage, L, (p, ph) => {
        if (done) return;
        if (ph === 'down' && dist(p, { x: s.tx, y: s.ty }) < 12) { held = true; sfx('select'); }
        else if (ph === 'move' && held) {
          if (Math.abs(p.x - s.tx) > 12) { held = false; snag = 0.4; sfx('nope'); return; }
          const ny = clamp(p.y, 20, 86);
          if (ny < s.ty - 4) sfx('tap');
          s.ty = ny;
          if (s.ty <= 22) { done = true; sfx('sparkle'); win(); }
        } else if (ph === 'up') held = false;
      });
      frame((dt, t) => {
        s.tx = 50 + (speed > 1 ? Math.sin(t * 2.5) * 6 * (speed - 1) : 0);
        snag -= dt;
        rect(ctx, 0, 0, 100, 100, '#9fd3f2');
        // jacket
        const x = s.tx;
        rect(ctx, x - 34, 14, 68, 86, '#1a1220'); rect(ctx, x - 33, 15, 66, 85, '#4f8fd0');
        rect(ctx, x - 44, 18, 12, 60, '#1a1220'); rect(ctx, x - 43, 19, 10, 58, '#2c5a9a');
        rect(ctx, x + 32, 18, 12, 60, '#1a1220'); rect(ctx, x + 33, 19, 10, 58, '#2c5a9a');
        rect(ctx, x - 12, 6, 24, 10, '#f2c84b');
        // open part above the tab shows the shirt
        rect(ctx, x - 6 * ((s.ty - 20) / 66) - 1, 16, 12 * ((s.ty - 20) / 66) + 2, s.ty - 16, '#f2e6c9');
        for (let y = 18; y < 98; y += 3) rect(ctx, x - 1, y, 2, 1, y < s.ty ? '#8a8aa0' : '#c9c9d8');
        // tab
        rect(ctx, x - 3, s.ty - 2, 6, 9, snag > 0 ? '#d0463c' : '#ffe27a'); rect(ctx, x - 1, s.ty + 1, 2, 4, '#1a1220');
        if (!done) txt(ctx, held ? 'up up up!' : 'drag the tab up', 50, 96, 7, '#1a1220');
      });
    },
    async solve(b, s) {
      b.down(s.P(s.tx, s.ty + 1));
      for (let y = s.ty; !b.over() && y >= 14; y -= 4) { b.move(s.P(s.tx, y)); await b.wait(16); }
      b.up(s.P(s.tx, 20));
    },
  },
  {
    id: 'wd-alarm', cmd: 'Snooze!', theme: 'silly',
    setup(api) {
      // The alarm-clock robot won't shut up. Slap it three times!
      const { win, sfx, speed, frame, pos } = api;
      const { ctx, L, P } = cvs(api);
      const robot = pic(ROBOT);
      const s = api.expose({ rx: 50, ry: 50, hits: 0, P });
      let vx = 30 * speed * (rnd(2) ? 1 : -1), vy = 22 * speed, shake = 0, done = false;
      api.stage.addEventListener('pointerdown', e => {
        if (done) return;
        const p = L(e);
        if (dist(p, { x: s.rx, y: s.ry }) < 11) {
          s.hits++; shake = 0.3; sfx('pop');
          if (s.hits >= 3) { done = true; sfx('sparkle'); win(); return; }
          s.rx = 15 + Math.random() * 70; s.ry = 25 + Math.random() * 55;
          vx = -vx * 1.15; vy = vy * 1.15;
        } else sfx('tap');
      });
      frame((dt, t) => {
        if (!done) {
          s.rx += vx * dt; s.ry += vy * dt;
          if (s.rx < 10 || s.rx > 90) { vx = -vx; s.rx = clamp(s.rx, 10, 90); }
          if (s.ry < 22 || s.ry > 88) { vy = -vy; s.ry = clamp(s.ry, 22, 88); }
          if (Math.floor(t * 4) % 2 === 0 && Math.floor((t - dt) * 4) % 2 === 1) sfx('alarm');
        }
        shake -= dt;
        bands(ctx, ['#2a2048', '#3a2a58', '#f2e6c9', '#efdcb4']);
        rect(ctx, 70, 8, 22, 12, '#1a1220'); txt(ctx, '6:00', 81, 14, 8, '#d0463c');
        const j = done ? 0 : Math.sin(t * 60) * 1.2 + (shake > 0 ? Math.sin(t * 90) * 3 : 0);
        blit(ctx, robot, s.rx + j, s.ry, 20, 20);
        if (!done) { txt(ctx, 'BRRING', s.rx, s.ry - 14, 7, '#ffe27a'); }
        else txt(ctx, 'zzz…', s.rx, s.ry - 14, 9, '#fff4e0');
        for (let k = 0; k < 3; k++) rect(ctx, 6 + k * 7, 6, 5, 5, k < s.hits ? '#ffe27a' : '#4a4058');
      });
    },
    async solve(b, s) {
      while (!b.over()) { await b.tap(s.P(s.rx, s.ry)); await b.wait(70); }
    },
  },
  {
    id: 'wd-hidden', cmd: 'Find her!', theme: 'silly', time: 6,
    setup(api) {
      // She's somewhere in the crowd. Tap her, and only her.
      const { stage, win, lose, sfx, speed, frame } = api;
      const T = rnd(10);
      const others = ['cat', 'dog', 'cat0', 'cat1', 'cat2', 'cat3', 'cat4', 'cat5', ...[...Array(10).keys()].filter(k => k !== T).map(k => 'girl' + k)];
      stage.append(h('div', { class: 'wd-want' }, icon('girl' + T, ''), 'Find her!'));
      const where = shuffle(spots(18, 14, 8, 30));
      const s = api.expose({});
      const items = where.map((p, k) => {
        const name = k === 0 ? 'girl' + T : others[(k - 1) % others.length];
        const el = at(h('img', { src: icon(name).src, class: 'wd-crowd', alt: '', draggable: 'false' }), p.x, p.y);
        el.p = { ...p, a: Math.random() * 6 };
        tapper(el, () => {
          if (api.over()) return;
          if (k === 0) { sfx('sparkle'); win(); } else { sfx('nope'); el.style.filter = 'brightness(.4)'; lose(); }
        });
        if (k === 0) s.el = el;
        return el;
      });
      // the target is drawn somewhere in the middle of the stack, not always on top
      shuffle(items).forEach(el => stage.append(el));
      frame((dt, t) => { if (speed > 1.05) items.forEach(el => at(el, el.p.x + Math.sin(t * speed + el.p.a) * 3 * (speed - 1), el.p.y)); });
    },
    async solve(b, s) { await b.wait(300); await b.tap(s.el); },
  },
];
