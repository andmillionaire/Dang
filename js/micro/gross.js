import { h } from '../ui.js';
import { rnd, pick, shuffle, clamp, dist, follow, holdable, canvas, addStyle } from './kit.js';

// Gross-Out: silly, cartoonish toilet-humour microgames. Every game draws on a 100x100 pixel
// canvas that fills the stage, so stage percent and canvas pixels are the same numbers.

addStyle('gross', `
  [class*="mcs-gr-"] .mc-canvas { width: 100%; height: 100%; display: block; touch-action: none; }
  .mc-spr { image-rendering: pixelated; pointer-events: none; }
`);

// ---------- drawing helpers ----------
function board(api) {
  const { cv, ctx } = canvas(api.stage, 100, 100);
  cv.style.width = '100%';
  cv.style.height = '100%';
  return ctx;
}
const R = (c, x, y, w, hh, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hh)); };
// A chunky pixel ellipse.
function oval(c, cx, cy, rx, ry, col) {
  c.fillStyle = col;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    c.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
  }
}
const disc = (c, cx, cy, r, col) => oval(c, cx, cy, r, r, col);
function txt(c, s, x, y, col = '#fff4e0', size = 8) {
  c.font = `${size}px "Jersey 10", monospace`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#1a1220';
  c.fillText(s, x + 0.6, y + 0.6);
  c.fillStyle = col;
  c.fillText(s, x, y);
}
const note = (api, text) => api.stage.append(h('p', { class: 'mc-note' }, text));
// Run draw() now and every frame after `step(dt, t)`.
function loop(api, step, paint) { paint(0); api.frame((dt, t) => { if (step) step(dt, t); if (!api.over()) paint(t); }); }

const SKIN = '#f2c8a0', SKIN2 = '#d89a70', INK = '#1a1220', TILE = '#cfe4ec', TILE2 = '#b4d0dc';
function tiles(c, a = TILE, b = TILE2) {
  R(c, 0, 0, 100, 100, a);
  for (let x = 0; x < 100; x += 12.5) R(c, x, 0, 1, 100, b);
  for (let y = 0; y < 100; y += 12.5) R(c, 0, y, 100, 1, b);
}
// A cartoon face: head, eyes that look toward (lx, ly), optional cheeks.
function face(c, cx, cy, r, lx = cx, ly = cy + 30, skin = SKIN) {
  disc(c, cx, cy, r + 1, INK);
  disc(c, cx, cy, r, skin);
  for (const ex of [cx - r * 0.38, cx + r * 0.38]) {
    const ey = cy - r * 0.3;
    disc(c, ex, ey, 4, INK);
    disc(c, ex, ey, 3, '#fff4e0');
    const a = Math.atan2(ly - ey, lx - ex);
    R(c, ex + Math.cos(a) * 1.5 - 1, ey + Math.sin(a) * 1.5 - 1, 2, 2, INK);
  }
}

// ---------- the games ----------
export default [
  {
    id: 'gr-plunge', cmd: 'Plunge it!', theme: 'gross', time: 6,
    setup(api) {
      const { win, sfx, speed, pos, stage } = api;
      const c = board(api);
      const need = 4 + Math.round(speed);
      const s = api.expose({ y: 40, pumps: 0, need });
      let low = false, gurgle = 0;
      follow(stage, pos, (p, ph) => {
        if (ph === 'hover') return;
        s.y = clamp(p.y, 28, 74);
        if (s.y > 64 && !low) { low = true; sfx('drip'); }
        if (s.y < 42 && low) { low = false; s.pumps++; gurgle = 1; sfx('pop', s.pumps); if (s.pumps >= need) win(); }
      });
      note(api, 'Drag the plunger up and down');
      loop(api, dt => (gurgle = Math.max(0, gurgle - dt * 3)), t => {
        tiles(c);
        // tank and bowl
        R(c, 30, 10, 40, 22, INK); R(c, 31, 11, 38, 20, '#f4f4f8'); R(c, 31, 28, 38, 3, '#d8d8e8');
        oval(c, 50, 72, 30, 15, INK); oval(c, 50, 72, 29, 14, '#f4f4f8'); oval(c, 50, 71, 22, 9, '#8a7a4a');
        oval(c, 50, 70, 22 * (1 - s.pumps / need) + 2, 6 * (1 - s.pumps / need) + 1, '#6a5a32');
        if (gurgle) for (let k = 0; k < 4; k++) disc(c, 38 + k * 8, 66 - gurgle * 8 - k % 2 * 3, 2, '#bfe6ff');
        // plunger
        R(c, 48, s.y - 34, 4, 34, INK); R(c, 49, s.y - 33, 2, 33, '#c07a3a');
        oval(c, 50, s.y + 2, 12, 5, INK); oval(c, 50, s.y + 1, 11, 4, '#d0463c');
        // clog meter
        R(c, 8, 8, 6, 52, INK); R(c, 9, 9 + 50 * (1 - s.pumps / need), 4, 50 * (s.pumps / need), '#6fb04a');
        txt(c, `${s.pumps}/${need}`, 11, 66, '#1a1220', 7);
      });
    },
    async solve(b) {
      b.down({ x: 50, y: 40 });
      while (!b.over()) {
        for (const y of [50, 62, 72]) { b.move({ x: 50, y }); await b.wait(20); }
        for (const y of [60, 48, 34]) { b.move({ x: 50, y }); await b.wait(20); }
      }
      b.up({ x: 50, y: 40 });
    },
  },

  {
    id: 'gr-nose', cmd: 'Pick it!', theme: 'gross', time: 6,
    setup(api) {
      const { win, sfx, speed, pos, stage } = api;
      const c = board(api);
      const N = [{ x: 42, y: 58 }, { x: 58, y: 58 }];
      const s = api.expose({ nost: rnd(2), N, grab: false, fx: 80, fy: 92 });
      let swap = 0;
      follow(stage, pos, (p, ph) => {
        if (ph === 'hover') return;
        s.fx = p.x; s.fy = p.y;
        if (ph === 'down' && dist(p, N[s.nost]) < 10) { s.grab = true; sfx('select'); }
        if (ph === 'up') {
          if (s.grab && p.y > N[s.nost].y + 20) { sfx('pop'); win(); }
          s.grab = false;
        }
      });
      note(api, 'Grab the booger and pull it out');
      loop(api, dt => {
        // at speed it hides in the other nostril now and then
        if (speed > 1.2 && !s.grab && (swap += dt) > 1.3 / speed) { swap = 0; s.nost = 1 - s.nost; }
      }, () => {
        R(c, 0, 0, 100, 100, '#f8d8e8');
        face(c, 50, 48, 40, s.fx, s.fy);
        // nose
        R(c, 44, 30, 12, 18, SKIN2); oval(c, 50, 54, 16, 9, INK); oval(c, 50, 53, 15, 8, SKIN2);
        for (const n of N) oval(c, n.x, n.y, 4, 3, '#3a2216');
        // mouth
        R(c, 40, 72, 20, 3, INK); R(c, 42, 75, 16, 1, '#c0507a');
        const bx = s.grab ? s.fx : N[s.nost].x, by = s.grab ? s.fy - 4 : N[s.nost].y + 1;
        disc(c, bx, by, 3, '#3d7a34'); disc(c, bx, by, 2, '#8ac850');
        if (s.grab) R(c, N[s.nost].x, N[s.nost].y, 1, Math.max(0, by - N[s.nost].y), '#a8d870');
        // finger
        R(c, s.fx - 3, s.fy, 7, 40, INK); R(c, s.fx - 2, s.fy + 1, 5, 40, SKIN); R(c, s.fx - 1, s.fy + 1, 3, 3, '#fff4e0');
      });
    },
    async solve(b, s) {
      const n = s.N[s.nost];
      await b.drag({ x: n.x, y: n.y }, { x: n.x, y: n.y + 34 }, 200, 6);
    },
  },

  {
    id: 'gr-pimple', cmd: 'Squeeze!', theme: 'gross', time: 6,
    setup(api) {
      const { win, sfx, speed, pos, stage } = api;
      const c = board(api);
      const n = speed > 1.4 ? 3 : 2;
      const where = shuffle([{ x: 30, y: 46 }, { x: 70, y: 46 }, { x: 36, y: 70 }, { x: 64, y: 70 }, { x: 50, y: 30 }]).slice(0, n);
      const s = api.expose({ zits: where.map(p => ({ ...p, press: 0, popped: false })) });
      let active = null, splats = [];
      follow(stage, pos, (p, ph) => {
        if (ph === 'down') active = s.zits.find(z => !z.popped && dist(z, p) < 10) || null;
        if (ph === 'move' && active && dist(active, p) > 14) active = null;
        if (ph === 'up') active = null;
      });
      note(api, 'Press and hold each spot');
      loop(api, dt => {
        for (const z of s.zits) if (!z.popped && z !== active) z.press = Math.max(0, z.press - dt * 2);
        if (active && !active.popped) {
          active.press += dt / (0.55 + 0.1 * speed);
          if (active.press >= 1) {
            active.popped = true; sfx('pop', 3);
            splats.push({ x: active.x, y: active.y, t: 0 });
            active = null;
            if (s.zits.every(z => z.popped)) win();
          }
        }
        splats.forEach(q => (q.t += dt));
      }, () => {
        R(c, 0, 0, 100, 100, '#c8e4f4');
        face(c, 50, 52, 44, 50, 80);
        R(c, 40, 82, 20, 3, INK);
        for (const z of s.zits) {
          if (z.popped) { disc(c, z.x, z.y, 3, '#f0a090'); continue; }
          const r = 3 + z.press * 2;
          disc(c, z.x, z.y, r + 1, '#c0507a'); disc(c, z.x, z.y, r, '#f08a8a'); disc(c, z.x, z.y - 1, 1 + z.press * 1.5, '#fff8d0');
        }
        for (const q of splats) if (q.t < 0.5) for (let k = 0; k < 6; k++) R(c, q.x + Math.cos(k) * q.t * 40, q.y + Math.sin(k) * q.t * 40, 2, 2, '#fff8d0');
      });
    },
    async solve(b, s) {
      for (const z of s.zits) { await b.hold({ x: z.x, y: z.y }, 900); await b.wait(40); }
    },
  },

  {
    id: 'gr-flush', cmd: 'Flush it!', theme: 'gross', time: 6,
    setup(api) {
      const { win, lose, sfx, speed, pos, stage } = api;
      const c = board(api);
      const s = api.expose({ x: 50, y: 58, handle: { x: 84, y: 16 } });
      let a = Math.random() * 6, swirl = -1;
      follow(stage, pos, (p, ph) => {
        if (ph !== 'down' || swirl >= 0) return;
        if (dist(p, s.handle) > 14) return;
        sfx('door');
        if (dist(s, { x: 50, y: 58 }) < 7) { swirl = 0; } else { sfx('nope'); lose(); }
      });
      note(api, 'Flush when the hairball is over the drain');
      loop(api, (dt, t) => {
        if (swirl >= 0) { swirl += dt; if (swirl > 0.5) win(); return; }
        a += dt * 1.8 * Math.pow(speed, 0.6);
        const r = 4 + 18 * Math.abs(Math.sin(t * 1.1 * Math.pow(speed, 0.5)));
        s.x = 50 + Math.cos(a) * r; s.y = 58 + Math.sin(a) * r * 0.7;
      }, t => {
        tiles(c, '#e8d8f0', '#d4c0e0');
        oval(c, 50, 58, 38, 30, INK); oval(c, 50, 58, 37, 29, '#f4f4f8'); oval(c, 50, 58, 30, 23, '#9fd3f2');
        oval(c, 50, 58, 7, 5, '#4f8fd0'); oval(c, 50, 58, 4, 3, '#2c5a9a');
        // handle on the tank
        R(c, 70, 6, 26, 18, INK); R(c, 71, 7, 24, 16, '#f4f4f8');
        R(c, 78, 13, 14, 5, INK); R(c, 79, 14, 12, 3, '#a8a8b8');
        const k = swirl >= 0 ? Math.max(0, 1 - swirl * 2) : 1;
        const x = swirl >= 0 ? 50 : s.x, y = swirl >= 0 ? 58 : s.y;
        disc(c, x, y, 6 * k + 0.5, '#6b3d22'); disc(c, x - 1, y - 1, 4 * k + 0.5, '#a0663a');
        if (k > 0.5) { R(c, x - 3, y - 2, 2, 2, '#fff4e0'); R(c, x + 1, y - 2, 2, 2, '#fff4e0'); }
      });
    },
    async solve(b, s) {
      await b.until(() => dist(s, { x: 50, y: 58 }) < 3.5);
      await b.tap(s.handle);
    },
  },

  {
    id: 'gr-sneeze', cmd: 'Bless you!', theme: 'gross', time: 6,
    setup(api) {
      const { win, lose, sfx, speed, pos, stage, time } = api;
      const c = board(api);
      const T = time * (0.45 + Math.random() * 0.3);
      const s = api.expose({ hx: 50, ny: 46, tx: 88, ty: 90 });
      let done = -1, ok = false;
      follow(stage, pos, (p, ph) => { if (ph !== 'hover') { s.tx = p.x; s.ty = p.y; } });
      note(api, 'Hold the tissue over the nose!');
      loop(api, (dt, t) => {
        if (done >= 0) { done += dt; if (done > 0.4) ok ? win() : lose(); return; }
        s.hx = 50 + Math.sin(t * 1.5 * speed) * 24;
        if (t >= T) {
          done = 0;
          ok = Math.abs(s.tx - s.hx) < 10 && Math.abs(s.ty - s.ny) < 13;
          sfx(ok ? 'pop' : 'nope');
        }
      }, t => {
        R(c, 0, 0, 100, 100, '#fff0c8');
        face(c, s.hx, 40, 26, s.tx, s.ty);
        oval(c, s.hx, s.ny, 5, 4, SKIN2);
        if (done < 0) {
          const k = t / T;
          txt(c, 'Ah' + '.'.repeat(1 + ((t * 4) | 0) % 3) + (k > 0.6 ? ' ah...' : ''), s.hx, 12, '#c0507a', 8 + k * 4);
          oval(c, s.hx, 56, 4 + k * 3, 2 + k * 2, INK);
        } else {
          txt(c, 'ACHOO!', 50, 12, '#d0463c', 14);
          if (!ok) for (let k = 0; k < 14; k++) disc(c, s.hx + Math.cos(k) * done * 90, s.ny + 8 + Math.abs(Math.sin(k * 2)) * done * 60, 1.5, '#a8d870');
        }
        // the tissue
        R(c, s.tx - 9, s.ty - 7, 18, 14, INK); R(c, s.tx - 8, s.ty - 6, 16, 12, '#ffffff'); R(c, s.tx - 8, s.ty + 3, 16, 3, '#dfe8f0');
      });
    },
    async solve(b, s) {
      b.down({ x: s.hx, y: s.ny });
      while (!b.over()) { b.move({ x: s.hx, y: s.ny }); await b.wait(16); }
      b.up({ x: s.hx, y: s.ny });
    },
  },

  {
    id: 'gr-brush', cmd: 'Brush!', theme: 'gross', time: 6,
    setup(api) {
      const { win, sfx, speed, pos, stage } = api;
      const c = board(api);
      const dirty = new Set(shuffle([0, 1, 2, 3, 4, 5]).slice(0, 4));
      const s = api.expose({ teeth: [0, 1, 2, 3, 4, 5].map(i => ({ x: 17 + i * 11.2, dirt: dirty.has(i) ? 1 : 0 })), bx: 80, by: 80 });
      let last = null, foam = [];
      follow(stage, pos, (p, ph) => {
        if (ph === 'hover') return;
        s.bx = p.x; s.by = p.y;
        if (ph === 'down') last = p;
        if (ph === 'move' && last && p.y > 28 && p.y < 66) {
          const t = s.teeth.find(t => Math.abs(t.x - p.x) < 6);
          if (t && t.dirt > 0) {
            t.dirt -= Math.abs(p.x - last.x) / (22 * Math.sqrt(speed));
            if (Math.random() < 0.3) { foam.push({ x: p.x, y: p.y, t: 0 }); sfx('tap'); }
            if (t.dirt <= 0 && s.teeth.every(q => q.dirt <= 0)) win();
          }
        }
        if (ph === 'move') last = p;
        if (ph === 'up') last = null;
      });
      note(api, 'Scrub back and forth');
      loop(api, dt => { foam.forEach(f => (f.t += dt)); foam = foam.filter(f => f.t < 0.6); }, () => {
        R(c, 0, 0, 100, 100, '#3a1a2a');
        oval(c, 50, 46, 46, 30, '#c0507a'); oval(c, 50, 46, 42, 26, '#7a2a40');
        for (const t of s.teeth) {
          R(c, t.x - 5, 32, 10, 24, INK);
          const d = Math.max(0, t.dirt);
          R(c, t.x - 4, 33, 8, 22, d > 0 ? `rgb(${240 - d * 40},${236 - d * 60},${200 - d * 140})` : '#fffaf0');
          if (d > 0.2) { R(c, t.x - 3, 46, 3, 3, '#8a9a3a'); R(c, t.x + 1, 38, 2, 2, '#8a9a3a'); }
          else R(c, t.x - 3, 35, 2, 5, '#ffffff');
        }
        for (const f of foam) disc(c, f.x, f.y - f.t * 20, 2, '#ffffff');
        // toothbrush
        R(c, s.bx - 6, s.by - 2, 34, 6, INK); R(c, s.bx - 5, s.by - 1, 32, 4, '#4f8fd0');
        R(c, s.bx - 6, s.by - 8, 12, 7, '#fff4e0'); R(c, s.bx - 6, s.by - 9, 12, 2, '#9fd3f2');
      });
    },
    async solve(b) {
      b.down({ x: 12, y: 44 });
      while (!b.over()) {
        for (let x = 12; x <= 88 && !b.over(); x += 4) { b.move({ x, y: 44 }); await b.wait(8); }
        for (let x = 88; x >= 12 && !b.over(); x -= 4) { b.move({ x, y: 44 }); await b.wait(8); }
      }
      b.up({ x: 50, y: 44 });
    },
  },

  {
    id: 'gr-toenail', cmd: 'Clip it!', theme: 'gross', time: 6,
    setup(api) {
      const { win, lose, sfx, speed, pos, stage } = api;
      const c = board(api);
      const long = new Set(shuffle([0, 1, 2, 3, 4]).slice(0, 3));
      const w = 1.6 * Math.pow(speed, 0.6);
      const s = api.expose({ cx: 50, toes: [22, 36, 50, 64, 78].map((x, i) => ({ x, long: long.has(i) })) });
      let ouch = 0;
      follow(stage, pos, (p, ph) => {
        if (ph !== 'down' || ouch) return;
        const t = s.toes.find(t => Math.abs(t.x - s.cx) < 6);
        if (!t) { sfx('tap'); return; }
        if (t.long) { t.long = false; sfx('scratch'); if (s.toes.every(q => !q.long)) win(); }
        else { ouch = 1; sfx('nope'); lose(); }
      });
      note(api, 'Snip when the clippers are over a long nail');
      loop(api, (dt, t) => { if (!ouch) s.cx = 50 + 40 * Math.sin(t * w); }, () => {
        R(c, 0, 0, 100, 100, '#e8f0d0');
        R(c, 0, 82, 100, 18, '#b89a6a');
        oval(c, 50, 78, 44, 22, INK); oval(c, 50, 78, 43, 21, SKIN);
        for (const t of s.toes) {
          disc(c, t.x, 56, 7, INK); disc(c, t.x, 56, 6, SKIN);
          R(c, t.x - 4, 48, 8, 6, '#f8e8d8');
          if (t.long) { R(c, t.x - 4, 38, 8, 11, INK); R(c, t.x - 3, 39, 6, 10, '#f0e0b0'); R(c, t.x - 2, 40, 1, 7, '#fff8e8'); }
        }
        // clippers
        R(c, s.cx - 4, 18, 8, 16, INK); R(c, s.cx - 3, 19, 6, 14, '#c8c8d8'); R(c, s.cx - 7, 30, 14, 4, INK); R(c, s.cx - 6, 31, 12, 2, '#e8e8f0');
        if (ouch) txt(c, 'OUCH!', 50, 10, '#d0463c', 14);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        await b.until(() => s.toes.some(t => t.long && Math.abs(t.x - s.cx) < 1.6));
        if (b.over()) break;
        await b.tap({ x: 50, y: 20 });
        await b.wait(60);
      }
    },
  },

  {
    id: 'gr-smell', cmd: 'Fan it!', theme: 'gross', time: 5, timeoutWins: true,
    setup(api) {
      const { lose, sfx, speed, pos, stage } = api;
      const c = board(api);
      const s = api.expose({ clouds: [] });
      let next = 0.1, sick = 0;
      follow(stage, pos, (p, ph) => {
        if (ph !== 'down') return;
        const cl = s.clouds.filter(q => !q.gone).sort((a, b) => dist(a, p) - dist(b, p))[0];
        if (cl && dist(cl, p) < 13) { cl.gone = true; sfx('swap'); }
      });
      note(api, 'Tap the stink clouds away');
      loop(api, (dt, t) => {
        if (sick) return;
        if (t >= next) { next = t + 0.75 / speed; s.clouds.push({ x: 104, y: 18 + Math.random() * 64, v: 14 + 9 * speed }); }
        for (const q of s.clouds) {
          if (q.gone) { q.x += 120 * dt; continue; }
          q.x -= q.v * dt; q.y += Math.sin(t * 3 + q.v) * 6 * dt;
          if (q.x < 24 && Math.abs(q.y - 50) < 30) { sick = 1; sfx('nope'); lose(); }
        }
      }, t => {
        R(c, 0, 0, 100, 100, '#fff8e0');
        face(c, 6, 50, 22, 40, 50, sick ? '#b8d890' : SKIN);
        oval(c, 22, 52, 5, 4, SKIN2);
        for (const q of s.clouds) {
          if (q.x > 110) continue;
          const col = q.gone ? 'rgba(168,216,112,0.35)' : '#8ac850';
          disc(c, q.x, q.y, 7, col); disc(c, q.x - 6, q.y + 2, 5, col); disc(c, q.x + 6, q.y + 2, 5, col);
          if (!q.gone) for (let k = 0; k < 3; k++) R(c, q.x - 5 + k * 5, q.y - 12 - Math.sin(t * 6 + k) * 2, 1, 4, '#5a8a30');
        }
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const q = s.clouds.filter(q => !q.gone && q.x < 96).sort((a, b) => a.x - b.x)[0];
        if (q) await b.tap({ x: q.x, y: q.y }); else await b.wait(30);
      }
    },
  },

  {
    id: 'gr-litter', cmd: 'Scoop it!', theme: 'gross', time: 6,
    setup(api) {
      const { win, sfx, speed, pos, stage } = api;
      const c = board(api);
      const n = 3 + Math.round(speed);
      const pts = [];
      while (pts.length < n) { const p = { x: 18 + Math.random() * 64, y: 34 + Math.random() * 46 }; if (pts.every(q => dist(q, p) > 14)) pts.push(p); }
      const s = api.expose({ lumps: pts.map(p => ({ ...p, got: false })), sx: 86, sy: 18 });
      let held = false;
      follow(stage, pos, (p, ph) => {
        if (ph === 'hover') return;
        s.sx = p.x; s.sy = p.y;
        held = ph !== 'up';
        if (!held) return;
        for (const l of s.lumps) if (!l.got && dist(l, p) < 9) { l.got = true; sfx('plant'); if (s.lumps.every(q => q.got)) win(); }
      });
      note(api, 'Drag the scoop over every lump');
      loop(api, null, t => {
        R(c, 0, 0, 100, 100, '#c9e0b8');
        R(c, 8, 24, 84, 64, INK); R(c, 9, 25, 82, 62, '#4f8fd0'); R(c, 13, 29, 74, 54, '#e8d8a8');
        for (let k = 0; k < 40; k++) R(c, 14 + (k * 37) % 72, 30 + (k * 53) % 52, 1, 1, '#c9b07a');
        for (const l of s.lumps) if (!l.got) { oval(c, l.x, l.y, 5, 3, '#6b3d22'); R(c, l.x - 2, l.y - 2, 2, 1, '#a0663a'); if ((t * 4 | 0) % 2) R(c, l.x + 3, l.y - 7, 1, 3, '#8ac850'); }
        // scoop
        R(c, s.sx - 8, s.sy - 5, 16, 10, INK); R(c, s.sx - 7, s.sy - 4, 14, 8, '#f08ab0');
        for (let k = 0; k < 4; k++) R(c, s.sx - 5 + k * 3, s.sy - 3, 1, 6, '#c0507a');
        R(c, s.sx + 7, s.sy - 2, 14, 4, INK); R(c, s.sx + 8, s.sy - 1, 12, 2, '#f08ab0');
      });
    },
    async solve(b, s) {
      let cur = { x: 50, y: 55 };
      b.down(cur);
      for (const l of s.lumps) {
        for (let k = 1; k <= 5; k++) { b.move({ x: cur.x + (l.x - cur.x) * k / 5, y: cur.y + (l.y - cur.y) * k / 5 }); await b.wait(16); }
        cur = l;
      }
      b.up(cur);
    },
  },

  {
    id: 'gr-drool', cmd: 'Wipe it!', theme: 'gross', time: 6,
    setup(api) {
      const { win, lose, sfx, speed, pos, stage } = api;
      const c = board(api);
      const s = api.expose({ strands: [{ x: 40, len: 0, wiped: false }, { x: 60, len: 0, wiped: false }], top: 44 });
      let last = null, rag = { x: 85, y: 85 };
      follow(stage, pos, (p, ph) => {
        if (ph === 'hover') return;
        rag = p;
        if (ph === 'move' && last) {
          for (const d of s.strands) {
            if (d.len < 3) continue;
            const crosses = Math.min(last.x, p.x) <= d.x && Math.max(last.x, p.x) >= d.x;
            const y = (last.y + p.y) / 2;
            if (crosses && y > s.top && y < s.top + d.len + 3) { d.len = 0; if (!d.wiped) { d.wiped = true; sfx('swap'); } if (s.strands.every(q => q.wiped)) win(); }
          }
        }
        last = ph === 'up' ? null : p;
      });
      note(api, 'Swipe across the drool');
      loop(api, dt => {
        for (const d of s.strands) {
          d.len += (9 + 5 * speed) * dt * (d.x === 40 ? 1 : 0.8);
          if (s.top + d.len > 94) { sfx('drip'); lose(); }
        }
      }, () => {
        R(c, 0, 0, 100, 100, '#f0e0c8'); R(c, 0, 94, 100, 6, '#a0663a');
        // a big happy dog
        oval(c, 50, 24, 36, 24, INK); oval(c, 50, 24, 35, 23, '#e8a848');
        oval(c, 18, 26, 9, 16, '#b87a28'); oval(c, 82, 26, 9, 16, '#b87a28');
        disc(c, 38, 16, 3, INK); disc(c, 62, 16, 3, INK);
        oval(c, 50, 28, 6, 4, INK);
        oval(c, 50, 40, 16, 6, '#c0507a'); R(c, 46, 40, 8, 6, '#f08ab0');
        for (const d of s.strands) {
          R(c, d.x - 1, s.top, 3, d.len, '#bfe6ff'); R(c, d.x, s.top, 1, d.len, '#ffffff');
          disc(c, d.x, s.top + d.len, 2.5, '#bfe6ff');
        }
        R(c, rag.x - 8, rag.y - 6, 16, 12, INK); R(c, rag.x - 7, rag.y - 5, 14, 10, '#f08ab0'); R(c, rag.x - 7, rag.y - 1, 14, 2, '#fff4e0');
      });
    },
    async solve(b, s) {
      await b.until(() => s.strands.every(d => d.len > 10));
      while (!b.over()) {
        const y = s.top + Math.min(...s.strands.map(d => d.len)) / 2;
        await b.drag({ x: 18, y }, { x: 82, y }, 120, 8);
        await b.wait(60);
      }
    },
  },

  {
    id: 'gr-burp', cmd: 'Burp it!', theme: 'gross', time: 5,
    setup(api) {
      const { win, sfx, speed, pos, stage } = api;
      const c = board(api);
      const need = 7 + Math.round(speed * 2);
      const s = api.expose({ meter: 0, need, back: { x: 50, y: 62 } });
      let pat = 0, burp = -1;
      follow(stage, pos, (p, ph) => {
        if (ph !== 'down' || burp >= 0) return;
        if (Math.abs(p.x - s.back.x) < 22 && Math.abs(p.y - s.back.y) < 20) {
          s.meter++; pat = 0.15; sfx('tap');
          if (s.meter >= need) { burp = 0; sfx('woof'); }
        }
      });
      note(api, 'Pat the baby’s back');
      loop(api, dt => {
        pat = Math.max(0, pat - dt);
        if (burp >= 0) { burp += dt; if (burp > 0.5) win(); return; }
        s.meter = Math.max(0, s.meter - dt * 1.1 * speed);
      }, () => {
        R(c, 0, 0, 100, 100, '#d8ecf8');
        // a shoulder, and a baby leaning on it
        oval(c, 50, 100, 50, 26, '#a46ad0');
        disc(c, 50, 28, 17, INK); disc(c, 50, 28, 16, SKIN); R(c, 44, 24, 4, 2, INK); R(c, 54, 24, 4, 2, INK);
        R(c, 34, 12, 32, 6, '#ffe27a');
        oval(c, 50, 62 + (pat ? 1 : 0), 22, 20, INK); oval(c, 50, 62 + (pat ? 1 : 0), 21, 19, '#9fd3f2');
        if (pat) for (let k = 0; k < 3; k++) R(c, 68 + k * 4, 50 - k * 4, 3, 1, '#fff4e0');
        if (burp >= 0) { txt(c, 'BUUURP!', 50, 8, '#d0463c', 14); oval(c, 50, 34, 4, 3, INK); }
        else oval(c, 50, 34, 2, 1, INK);
        R(c, 8, 94, 84, 3, INK); R(c, 8, 94, 84 * Math.min(1, s.meter / need), 3, '#6fb04a');
      });
    },
    async solve(b, s) { while (!b.over()) { await b.tap(s.back); await b.wait(20); } },
  },

  {
    id: 'gr-roach', cmd: 'Squash it!', theme: 'gross', time: 6,
    setup(api) {
      const { win, sfx, speed, pos, stage } = api;
      const c = board(api);
      const s = api.expose({ bugs: [0, 1, 2].map(() => ({ x: 10 + Math.random() * 80, y: 15 + Math.random() * 70, a: Math.random() * 6, dead: false })) });
      follow(stage, pos, (p, ph) => {
        if (ph !== 'down') return;
        const bg = s.bugs.find(q => !q.dead && dist(q, p) < 9);
        if (bg) { bg.dead = true; sfx('pop', 1); if (s.bugs.every(q => q.dead)) win(); }
        else sfx('tap');
      });
      loop(api, (dt, t) => {
        for (const q of s.bugs) {
          if (q.dead) continue;
          q.a += Math.sin(t * 5 + q.y) * dt * 4;
          q.x += Math.cos(q.a) * (28 + 14 * speed) * dt; q.y += Math.sin(q.a) * (28 + 14 * speed) * dt;
          if (q.x < 6 || q.x > 94) { q.a = Math.PI - q.a; q.x = clamp(q.x, 6, 94); }
          if (q.y < 6 || q.y > 94) { q.a = -q.a; q.y = clamp(q.y, 6, 94); }
        }
      }, t => {
        R(c, 0, 0, 100, 100, '#d8c8a0');
        for (let y = 0; y < 100; y += 10) R(c, 0, y, 100, 1, '#c0ac80');
        for (const q of s.bugs) {
          if (q.dead) { oval(c, q.x, q.y, 6, 3, '#4a3020'); R(c, q.x - 7, q.y - 1, 14, 1, '#6b4a2a'); continue; }
          const legs = (t * 20 | 0) % 2;
          for (let k = -1; k <= 1; k++) { R(c, q.x - 6, q.y + k * 3 + legs, 3, 1, INK); R(c, q.x + 4, q.y + k * 3 - legs, 3, 1, INK); }
          oval(c, q.x, q.y, 4, 5, '#5a3418'); R(c, q.x - 1, q.y - 3, 2, 5, '#8a5a30');
          R(c, q.x - 3, q.y - 9, 1, 4, INK); R(c, q.x + 2, q.y - 9, 1, 4, INK);
        }
      });
    },
    async solve(b, s) {
      while (!b.over()) { const q = s.bugs.find(q => !q.dead); if (q) await b.tap({ x: q.x, y: q.y }); await b.wait(20); }
    },
  },

  {
    id: 'gr-splinter', cmd: 'Pull it!', theme: 'gross', time: 5,
    setup(api) {
      const { win, lose, sfx, pos, stage } = api;
      const c = board(api);
      const ang = pick([-0.5, -1.2, -2.0, -2.6]);
      const base = { x: 50, y: 56 };
      const dir = { x: Math.cos(ang), y: Math.sin(ang) };
      const s = api.expose({ end: { x: base.x + dir.x * 14, y: base.y + dir.y * 14 }, dir });
      let grab = null, out = 0, gone = false;
      follow(stage, pos, (p, ph) => {
        if (ph === 'down' && dist(p, s.end) < 11) { grab = p; sfx('select'); }
        if (ph === 'move' && grab) {
          const dx = p.x - grab.x, dy = p.y - grab.y, along = dx * dir.x + dy * dir.y, side = Math.abs(-dx * dir.y + dy * dir.x);
          if (side > 12 && side > along) { grab = null; sfx('nope'); lose(); return; }
          out = Math.max(0, along);
          if (out > 20) { gone = true; grab = null; sfx('pop'); win(); }
        }
        if (ph === 'up') { grab = null; if (!gone) out = 0; }
      });
      note(api, 'Pull the splinter straight out');
      loop(api, null, () => {
        R(c, 0, 0, 100, 100, '#e0f0d8');
        // a big fingertip
        oval(c, 50, 70, 34, 40, INK); oval(c, 50, 70, 33, 39, SKIN);
        oval(c, 50, 44, 16, 12, '#f8e0d0'); R(c, 40, 82, 20, 1, SKIN2); R(c, 38, 90, 24, 1, SKIN2);
        disc(c, base.x, base.y, 4, '#f08a8a');
        const L = 16, o = gone ? 40 : out;
        for (let k = 0; k <= L; k++) R(c, base.x + dir.x * (k + o) - 1, base.y + dir.y * (k + o) - 1, 2, 2, k > L - 3 ? '#6b3d22' : '#a0663a');
      });
    },
    async solve(b, s) {
      await b.drag(s.end, { x: s.end.x + s.dir.x * 30, y: s.end.y + s.dir.y * 30 }, 200, 8);
    },
  },

  {
    id: 'gr-drain', cmd: 'Unclog it!', theme: 'gross', time: 6,
    setup(api) {
      const { win, sfx, speed, pos, stage } = api;
      const c = board(api);
      const need = speed > 1.5 ? 4 : 3;
      const D = { x: 50, y: 74 };
      const s = api.expose({ got: 0, need, D });
      let pulling = false, len = 0, fly = [];
      follow(stage, pos, (p, ph) => {
        if (ph === 'down') pulling = dist(p, D) < 14;
        if (ph === 'move' && pulling) {
          len = Math.max(0, D.y - p.y);
          if (len > 30) { pulling = false; len = 0; s.got++; fly.push({ x: p.x, y: p.y, t: 0 }); sfx('pop', s.got); if (s.got >= need) win(); }
        }
        if (ph === 'up') { pulling = false; len = 0; }
      });
      note(api, 'Drag the hair up out of the drain');
      loop(api, dt => fly.forEach(f => (f.t += dt)), () => {
        R(c, 0, 0, 100, 100, '#dfeef4');
        oval(c, 50, 70, 44, 26, INK); oval(c, 50, 70, 43, 25, '#f4f4f8'); oval(c, 50, 72, 36, 18, '#c8d8e4');
        disc(c, D.x, D.y, 8, INK); disc(c, D.x, D.y, 7, '#8a8a9a');
        for (let k = -2; k <= 2; k++) R(c, D.x + k * 2.5, D.y - 5, 1, 10, INK);
        if (s.got < need) for (let k = 0; k < 7; k++) R(c, D.x - 6 + k * 2, D.y - 2 - len - (k % 3) * 2, 1, len + 4 + (k % 2) * 3, '#3a2a1a');
        for (const f of fly) if (f.t < 0.8) { oval(c, f.x + f.t * 60, f.y - f.t * 30, 5, 3, '#3a2a1a'); }
        R(c, 8, 8, 84, 4, INK); R(c, 8, 8, 84 * s.got / need, 4, '#6fb04a');
      });
    },
    async solve(b, s) {
      while (!b.over()) { await b.drag({ x: s.D.x, y: s.D.y }, { x: s.D.x + 4, y: s.D.y - 40 }, 120, 6); await b.wait(30); }
    },
  },

  {
    id: 'gr-sock', cmd: 'Wring it!', theme: 'gross', time: 6,
    setup(api) {
      const { win, sfx, speed, pos, stage } = api;
      const c = board(api);
      const need = Math.PI * 2 * (2 + (speed > 1.6 ? 0.5 : 0));
      const s = api.expose({ turned: 0, need });
      let lastA = null, drops = [];
      follow(stage, pos, (p, ph) => {
        if (ph === 'hover') return;
        if (ph === 'up') { lastA = null; return; }
        if (dist(p, { x: 50, y: 50 }) < 6) return;
        const a = Math.atan2(p.y - 50, p.x - 50);
        if (lastA != null) {
          let d = a - lastA;
          if (d > Math.PI) d -= Math.PI * 2;
          if (d < -Math.PI) d += Math.PI * 2;
          s.turned += Math.abs(d);
          if (Math.random() < 0.35) drops.push({ x: 50 + Math.cos(a) * 14, y: 50 + Math.sin(a) * 14, t: 0 });
          if (s.turned >= need) { sfx('drip'); win(); }
        }
        lastA = a;
      });
      note(api, 'Twist round and round');
      loop(api, dt => drops.forEach(d => { d.t += dt; d.y += 60 * dt; }), () => {
        R(c, 0, 0, 100, 100, '#f8f0d8');
        const k = s.turned / need, tw = k * 12;
        // a striped, very sweaty sock, twisting
        for (let y = 14; y < 86; y++) {
          const w = 12 - Math.abs(Math.sin((y / 8) + tw)) * (2 + k * 6);
          R(c, 50 - w - 1, y, w * 2 + 2, 1, INK);
          R(c, 50 - w, y, w * 2, 1, ((y / 6) | 0) % 2 ? '#ffe27a' : '#d0463c');
        }
        R(c, 37, 10, 26, 6, INK); R(c, 38, 11, 24, 4, '#fff4e0');
        for (const d of drops) if (d.t < 0.6) disc(c, d.x, d.y, 1.5, '#9fd3f2');
        R(c, 8, 92, 84, 3, INK); R(c, 8, 92, 84 * Math.min(1, k), 3, '#4f8fd0');
      });
    },
    async solve(b) {
      b.down({ x: 75, y: 50 });
      for (let i = 1; !b.over() && i < 400; i++) { const a = i * 0.35; b.move({ x: 50 + Math.cos(a) * 25, y: 50 + Math.sin(a) * 25 }); await b.wait(12); }
      b.up({ x: 75, y: 50 });
    },
  },

  {
    id: 'gr-icecream', cmd: 'Lick it!', theme: 'gross', time: 6,
    setup(api) {
      const { win, lose, sfx, speed, pos, stage } = api;
      const c = board(api);
      const need = 4;
      const s = api.expose({ drips: [], licked: 0 });
      let next = 0.15, sticky = false;
      follow(stage, pos, (p, ph) => {
        if (ph !== 'down') return;
        const d = s.drips.find(d => !d.gone && dist(d, p) < 10);
        if (d) { d.gone = true; s.licked++; sfx('pop', s.licked); if (s.licked >= need) win(); }
      });
      note(api, 'Tap the drips before they reach your hand');
      loop(api, (dt, t) => {
        if (sticky) return;
        if (t >= next && s.drips.length < need + 3) { next = t + 0.85 / speed; const x = 34 + Math.random() * 32; s.drips.push({ x, y: 36, v: 12 + 7 * speed }); }
        for (const d of s.drips) {
          if (d.gone) continue;
          d.y += d.v * dt;
          if (d.y > 86) { sticky = true; sfx('drip'); lose(); }
        }
      }, () => {
        R(c, 0, 0, 100, 100, '#c8ecf8');
        // cone and hand
        for (let y = 38; y < 80; y++) { const w = 18 * (1 - (y - 38) / 46); R(c, 50 - w, y, w * 2, 1, ((y / 4) | 0) % 2 ? '#d8a050' : '#c08838'); }
        oval(c, 50, 92, 26, 10, INK); oval(c, 50, 92, 25, 9, SKIN);
        disc(c, 50, 28, 18, INK); disc(c, 50, 28, 17, '#f8b0d4'); disc(c, 44, 22, 4, '#ffd8ec');
        R(c, 46, 12, 2, 3, '#d0463c'); R(c, 54, 16, 2, 3, '#4f8fd0'); R(c, 40, 30, 2, 3, '#ffe27a');
        for (const d of s.drips) if (!d.gone) { R(c, d.x - 1, 36, 3, d.y - 36, '#f8b0d4'); disc(c, d.x, d.y, 3, '#f08ab0'); }
        txt(c, `${s.licked}/${need}`, 88, 8, '#c0507a', 8);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const d = s.drips.filter(d => !d.gone).sort((p, q) => q.y - p.y)[0];
        if (d) await b.tap({ x: d.x, y: d.y }); else await b.wait(25);
      }
    },
  },

  {
    id: 'gr-floss', cmd: 'Floss!', theme: 'gross', time: 6,
    setup(api) {
      const { win, sfx, pos, stage } = api;
      const c = board(api);
      const gaps = [32, 50, 68];
      const s = api.expose({ gaps, cur: 0, rub: 0 });
      let last = null, fy = 50;
      follow(stage, pos, (p, ph) => {
        if (ph === 'hover') return;
        fy = p.y;
        if (ph === 'move' && last && Math.abs(p.x - gaps[s.cur]) < 7) {
          s.rub += Math.abs(p.y - last.y);
          if (s.rub > 55) { s.rub = 0; s.cur++; sfx('ring'); if (s.cur >= gaps.length) win(); }
        }
        last = ph === 'up' ? null : p;
      });
      note(api, 'Saw up and down in the glowing gap');
      loop(api, null, t => {
        R(c, 0, 0, 100, 100, '#7a2a40'); R(c, 0, 0, 100, 18, '#c0507a'); R(c, 0, 82, 100, 18, '#c0507a');
        for (const x of [23, 41, 59, 77]) { R(c, x - 8, 18, 16, 64, INK); R(c, x - 7, 18, 14, 63, '#fffaf0'); R(c, x - 5, 22, 3, 12, '#ffffff'); }
        gaps.forEach((g, i) => {
          if (i < s.cur) { R(c, g - 1, 18, 2, 64, '#9fd3f2'); return; }
          if (i === s.cur && (t * 4 | 0) % 2) R(c, g - 2, 18, 4, 64, '#ffe27a');
          R(c, g - 1, 46, 2, 6, '#8a9a3a');
        });
        if (s.cur < gaps.length) { R(c, 0, fy, gaps[s.cur] - 2, 1, '#ffffff'); R(c, gaps[s.cur] + 2, fy, 100, 1, '#ffffff'); }
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const g = s.gaps[s.cur];
        if (g == null) break;
        b.down({ x: g, y: 30 });
        for (let k = 0; k < 8 && !b.over() && s.gaps[s.cur] === g; k++) { for (const y of [40, 55, 70, 55, 40, 30]) { b.move({ x: g, y }); await b.wait(12); } }
        b.up({ x: g, y: 30 });
        await b.wait(20);
      }
    },
  },

  {
    id: 'gr-slime', cmd: 'Shake it off!', theme: 'gross', time: 5,
    setup(api) {
      const { win, sfx, speed, pos, stage } = api;
      const c = board(api);
      const need = 5 + Math.round(speed);
      const s = api.expose({ shed: 0, need, hx: 50 });
      let last = null, dir = 0, anchor = 50, flung = [];
      const blobs = Array.from({ length: need }, (_, i) => ({ dx: -14 + (i * 29) % 28, dy: -18 + (i * 17) % 34 }));
      follow(stage, pos, (p, ph) => {
        if (ph === 'hover') return;
        s.hx = clamp(p.x, 15, 85);
        if (ph === 'down') { last = p.x; anchor = p.x; dir = 0; return; }
        if (ph === 'up') { last = null; return; }
        const d = Math.sign(p.x - last);
        if (d && d !== dir) {
          if (dir && Math.abs(last - anchor) > 12 && s.shed < need) {
            const bl = blobs[s.shed++];
            flung.push({ x: s.hx + bl.dx, y: 55 + bl.dy, vx: -dir * 90, t: 0 });
            sfx('pop', s.shed);
            if (s.shed >= need) win();
          }
          dir = d; anchor = last;
        }
        last = p.x;
      });
      note(api, 'Shake left and right, fast!');
      loop(api, dt => flung.forEach(f => { f.t += dt; f.x += f.vx * dt; f.y += 40 * dt; }), () => {
        R(c, 0, 0, 100, 100, '#e8d8f8');
        // a hand, slimed
        R(c, s.hx - 16, 40, 32, 56, INK); R(c, s.hx - 15, 41, 30, 56, SKIN);
        for (let k = 0; k < 4; k++) { R(c, s.hx - 15 + k * 8, 22, 7, 20, INK); R(c, s.hx - 14 + k * 8, 23, 5, 19, SKIN); }
        blobs.forEach((bl, i) => { if (i >= s.shed) { disc(c, s.hx + bl.dx, 55 + bl.dy, 4, '#3d7a34'); disc(c, s.hx + bl.dx, 54 + bl.dy, 3, '#8ac850'); } });
        for (const f of flung) if (f.t < 0.8) disc(c, f.x, f.y, 3, '#8ac850');
        txt(c, `${s.shed}/${need}`, 88, 8, '#6a3e94', 8);
      });
    },
    async solve(b) {
      b.down({ x: 50, y: 60 });
      let x = 50, d = 1;
      while (!b.over()) { x += d * 6; if (x > 82 || x < 18) d = -d; b.move({ x, y: 60 }); await b.wait(10); }
      b.up({ x, y: 60 });
    },
  },

  {
    id: 'gr-gum', cmd: 'Blow it!', theme: 'gross', time: 6,
    setup(api) {
      const { win, lose, sfx, speed, stage } = api;
      const c = board(api);
      const zlo = 20 + Math.random() * 8, zhi = zlo + 7;
      const s = api.expose({ size: 3, zlo, zhi });
      let blowing = false, popped = false, done = false;
      holdable(stage, () => { if (!done) { blowing = true; sfx('select'); } }, () => {
        if (!blowing || done) return;
        blowing = false;
        if (s.size >= zlo && s.size <= zhi) { done = true; sfx('pop', 5); win(); }
      });
      note(api, 'Hold to blow, let go in the ring');
      loop(api, dt => {
        if (done) return;
        if (blowing) s.size += 22 * Math.pow(speed, 0.6) * dt;
        else s.size = Math.max(3, s.size - 14 * dt);
        if (s.size > 40) { done = popped = true; sfx('nope'); lose(); }
      }, t => {
        R(c, 0, 0, 100, 100, '#fff0f8');
        face(c, 50, 58, 34, 50, 40);
        // target ring
        if (!done) for (const r of [zlo, zhi]) { c.strokeStyle = '#6fb04a'; c.lineWidth = 1; c.beginPath(); c.arc(50, 68 - r * 0.2, r, 0, Math.PI * 2); c.stroke(); }
        if (popped) { for (let k = 0; k < 12; k++) R(c, 30 + (k * 23) % 40, 50 + (k * 17) % 30, 4, 3, '#f08ab0'); }
        else {
          const r = s.size, y = 68 - r * 0.2;
          disc(c, 50, y, r + 1, '#c0507a'); disc(c, 50, y, r, '#f8b0d4'); disc(c, 50 - r * 0.4, y - r * 0.4, Math.max(1, r * 0.2), '#ffe0f0');
        }
      });
    },
    async solve(b, s) {
      b.down({ x: 50, y: 50 });
      await b.until(() => s.size >= s.zlo + 2.5);
      b.up({ x: 50, y: 50 });
    },
  },

  {
    id: 'gr-pair', cmd: 'Pair it!', theme: 'gross', time: 5,
    setup(api) {
      const { win, lose, sfx, speed, pos, stage } = api;
      const c = board(api);
      const COLS = ['#d0463c', '#4f8fd0', '#6fb04a', '#ffe27a', '#a46ad0', '#f39a3a'];
      const STR = ['#fff4e0', '#1a1220', '#f08ab0'];
      const n = speed > 1.4 ? 8 : 6;
      const all = shuffle(COLS.flatMap(a => STR.map(b => ({ a, b }))));
      const socks = all.slice(0, n).map((k, i) => ({ ...k, x: 14 + (i % 4) * 24, y: 50 + ((i / 4) | 0) * 26 }));
      const want = socks[rnd(n)];
      const s = api.expose({ want });
      let pickd = null;
      follow(stage, pos, (p, ph) => {
        if (ph !== 'down' || pickd) return;
        const k = socks.find(q => Math.abs(q.x - p.x) < 10 && Math.abs(q.y + 6 - p.y) < 12);
        if (!k) return;
        pickd = k;
        if (k === want) { sfx('coin'); win(); } else { sfx('nope'); lose(); }
      });
      const sock = (x, y, k, glow) => {
        if (glow) R(c, x - 9, y - 9, 18, 26, glow);
        R(c, x - 6, y - 7, 9, 18, INK); R(c, x - 6, y + 7, 15, 7, INK);
        R(c, x - 5, y - 6, 7, 17, k.a); R(c, x - 5, y + 8, 13, 5, k.a);
        R(c, x - 5, y - 3, 7, 2, k.b); R(c, x - 5, y + 1, 7, 2, k.b);
      };
      loop(api, null, t => {
        R(c, 0, 0, 100, 100, '#e0d4c0');
        R(c, 0, 12, 100, 1, '#6b3d22');
        R(c, 49, 8, 3, 6, '#a0663a');
        sock(50, 22, want);
        txt(c, 'Find its pair', 50, 40, '#6b3d22', 7);
        for (const k of socks) sock(k.x, k.y, k, pickd === k ? (k === want ? '#6fb04a' : '#d0463c') : null);
        // stink lines
        for (let k = 0; k < 4; k++) R(c, 10 + k * 25, 92 - Math.sin(t * 5 + k) * 2, 1, 4, '#8ac850');
      });
    },
    async solve(b, s) { await b.tap({ x: s.want.x, y: s.want.y + 6 }); },
  },

  {
    id: 'gr-bathroom', cmd: 'Clean up!', theme: 'gross', time: 13, boss: true,
    setup(api) {
      const { win, sfx, speed, pos, stage } = api;
      const c = board(api);
      // three jobs in a row: squash the bugs, scrub the mirror, plunge the toilet
      const s = api.expose({
        step: 0,
        bugs: [0, 1].map(() => ({ x: 20 + Math.random() * 60, y: 60 + Math.random() * 28, a: Math.random() * 6, dead: false })),
        grime: 0, py: 40, pumps: 0, need: 3,
      });
      let last = null, low = false;
      const STEPS = ['Squash the bugs!', 'Scrub the mirror!', 'Plunge the toilet!'];
      const next = () => { s.step++; sfx('ring'); if (s.step >= 3) win(); };
      follow(stage, pos, (p, ph) => {
        if (ph === 'hover') return;
        if (s.step === 0 && ph === 'down') {
          const bg = s.bugs.find(q => !q.dead && dist(q, p) < 10);
          if (bg) { bg.dead = true; sfx('pop', 1); if (s.bugs.every(q => q.dead)) next(); }
        } else if (s.step === 1 && ph === 'move' && last && p.y < 50 && p.x > 26 && p.x < 74) {
          s.grime += dist(p, last);
          if (s.grime > 150) next();
        } else if (s.step === 2 && ph !== 'up') {
          s.py = clamp(p.y, 40, 80);
          if (s.py > 70 && !low) low = true;
          if (s.py < 50 && low) { low = false; s.pumps++; sfx('pop', s.pumps); if (s.pumps >= s.need) next(); }
        }
        last = ph === 'up' ? null : p;
      });
      loop(api, (dt, t) => {
        if (s.step !== 0) return;
        for (const q of s.bugs) {
          if (q.dead) continue;
          q.a += Math.sin(t * 4 + q.x) * dt * 3;
          q.x += Math.cos(q.a) * (22 + 10 * speed) * dt; q.y += Math.sin(q.a) * (22 + 10 * speed) * dt;
          if (q.x < 8 || q.x > 92) { q.a = Math.PI - q.a; q.x = clamp(q.x, 8, 92); }
          if (q.y < 58 || q.y > 94) { q.a = -q.a; q.y = clamp(q.y, 58, 94); }
        }
      }, t => {
        tiles(c);
        R(c, 0, 56, 100, 44, '#a8c8d8');
        // mirror
        R(c, 25, 6, 50, 42, INK); R(c, 26, 7, 48, 40, '#dff4ff');
        const g = Math.max(0, 1 - s.grime / 150);
        if (g > 0) { c.fillStyle = `rgba(122,140,60,${0.85 * g})`; c.fillRect(26, 7, 48, 40); for (let k = 0; k < 8; k++) R(c, 30 + (k * 13) % 40, 10 + (k * 7) % 32, 3, 2, `rgba(80,90,30,${g})`); }
        else R(c, 30, 10, 4, 12, '#ffffff');
        // toilet
        R(c, 78, 52, 18, 12, INK); R(c, 79, 53, 16, 10, '#f4f4f8');
        oval(c, 86, 76, 12, 9, INK); oval(c, 86, 76, 11, 8, '#f4f4f8'); oval(c, 86, 75, 8, 5, '#8a7a4a');
        if (s.step === 2) { R(c, 85, s.py - 26, 3, 26, '#c07a3a'); oval(c, 86, s.py + 1, 7, 3, '#d0463c'); R(c, 8, 92, 60, 3, INK); R(c, 8, 92, 60 * s.pumps / s.need, 3, '#6fb04a'); }
        for (const q of s.bugs) {
          if (q.dead) { oval(c, q.x, q.y, 5, 2, '#4a3020'); continue; }
          const l = (t * 20 | 0) % 2;
          for (let k = -1; k <= 1; k++) { R(c, q.x - 5, q.y + k * 3 + l, 2, 1, INK); R(c, q.x + 4, q.y + k * 3 - l, 2, 1, INK); }
          oval(c, q.x, q.y, 4, 4, '#5a3418');
        }
        if (s.step < 3) {
          R(c, 0, 49, 100, 9, 'rgba(26,18,32,0.75)');
          txt(c, `${s.step + 1}/3  ${STEPS[s.step]}`, 50, 54, '#ffe27a', 8);
        }
      });
    },
    async solve(b, s) {
      while (!b.over() && s.step === 0) { const q = s.bugs.find(q => !q.dead); if (q) await b.tap({ x: q.x, y: q.y }); await b.wait(20); }
      if (s.step === 1) {
        b.down({ x: 30, y: 15 });
        for (let i = 0; !b.over() && s.step === 1 && i < 300; i++) { b.move({ x: i % 2 ? 70 : 30, y: 12 + (i % 7) * 5 }); await b.wait(16); }
        b.up({ x: 50, y: 20 });
      }
      if (s.step === 2) {
        b.down({ x: 86, y: 45 });
        while (!b.over()) {
          for (const y of [55, 66, 78]) { b.move({ x: 86, y }); await b.wait(20); }
          for (const y of [66, 55, 44]) { b.move({ x: 86, y }); await b.wait(20); }
        }
        b.up({ x: 86, y: 45 });
      }
    },
  },
];
