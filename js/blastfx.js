import { sleep, tween, ease } from './pixel.js';
import { ICONS } from './sprites.js';

// Themed blasts. Instead of every target tile popping at once, each kind of charged tile delivers
// its blast in its own way and knocks tiles out as it hits them:
//   cw    letters rain down from the sky and smash into the tiles
//   pegs  a pinball is shot into the board and ricochets from tile to tile
//   ttt   storm clouds roll along the row and column and strike them with lightning
//   mew   cats pounce from tile to tile
//   micro lightning bolts and flying microgame props
// A mashup runs both kinds at once; two of a kind (supercharged) floods the whole board.

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const LETTERS = 'ABCDEFGHIJKLMNOPRSTUWY';
const PROPS = ['star', 'coin', 'heart', 'shard', 'cat', 'pumpkin', 'flowers', 'wheat'];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export async function blastFx(board, kinds, at, cells) {
  if (reduced() || !cells.length) return board.pop(cells, at);
  const g = board.geom();
  // Supercharged (two of a kind): that kind's effect over everything, quicker.
  if (kinds.length === 2 && kinds[0] === kinds[1]) return run(board, g, kinds[0], cells, at, 0.55);
  if (kinds.length === 1) return run(board, g, kinds[0], cells, at, 1);
  // Mashup: share the targets out by which blast they belong to, and run both together.
  const key = p => p.r * g.COLS + p.c;
  const own = kinds.map(k => new Set(board.blastCells([k], at).map(key)));
  const parts = kinds.map(() => []);
  cells.forEach((p, i) => {
    const mine = kinds.map((_, k) => own[k].has(key(p)));
    const k = mine[0] && mine[1] ? i % 2 : mine[0] ? 0 : mine[1] ? 1 : i % 2;
    parts[k].push(p);
  });
  await Promise.all(kinds.map((k, i) => run(board, g, k, parts[i], at, 0.85)));
}

function run(board, g, kind, cells, at, pace) {
  const fx = { cw: letters, pegs: pinball, ttt: stamps, mew: pounce, micro: storm }[kind] || plain;
  return fx(board, g, cells, at, pace);
}

const plain = (board, g, cells, at) => board.pop(cells, at);

// Knock one tile out with a burst; returns the pop promise.
function hit(board, p, color, n = 8) {
  board.burst(p, color || board.colorAt(p), n);
  return board.pop([p]);
}

// Add a drawable for the duration of an effect.
function actor(board, draw) {
  const a = { draw };
  board.actors.push(a);
  return () => { board.actors = board.actors.filter(x => x !== a); };
}

// ---------- Word Search: letters fall from the sky ----------
async function letters(board, g, cells, at, pace) {
  const order = shuffle(cells.slice());
  const jobs = order.map(async (p, i) => {
    await sleep(i * 45 * pace);
    const ch = LETTERS[(Math.random() * LETTERS.length) | 0];
    const x = g.cx(p.c), y1 = g.cy(p.r), y0 = -14 - Math.random() * 20;
    const spin = (Math.random() - 0.5) * 1.2;
    let y = y0, rot = 0;
    const done = actor(board, ctx => {
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.font = '13px "Jersey 10", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1a1220'; ctx.fillRect(-6, -7, 12, 14);
      ctx.fillStyle = '#f2e6c9'; ctx.fillRect(-5, -6, 10, 12);
      ctx.fillStyle = '#1a1220'; ctx.fillText(ch, 0, 1);
    });
    await tween(260 + (y1 - y0) * 1.6, t => { y = y0 + (y1 - y0) * ease.inQuad(t); rot = spin * (1 - t); });
    done();
    board.hooks.sfx('type');
    board.ring(p, 8, '#f2e6c9');
    await hit(board, p, '#f2e6c9', 10);
  });
  await Promise.all(jobs);
}

// ---------- Star Pegs: a pinball ricochets through the targets ----------
async function pinball(board, g, cells, at, pace) {
  // visit targets in a nearest-neighbour chain, starting from the top
  const left = cells.slice();
  const path = [];
  let cur = { r: -2, c: (g.COLS - 1) / 2 };
  while (left.length) {
    let bi = 0, bd = Infinity;
    left.forEach((p, i) => { const d = Math.hypot(p.r - cur.r, p.c - cur.c); if (d < bd) { bd = d; bi = i; } });
    cur = left.splice(bi, 1)[0];
    path.push(cur);
  }
  let bx = g.LW / 2, by = -6;
  const trail = [];
  const done = actor(board, ctx => {
    trail.forEach((t, i) => {
      ctx.globalAlpha = (i / trail.length) * 0.6;
      ctx.fillStyle = i > trail.length - 4 ? '#fff8e0' : '#9fd3f2';
      ctx.fillRect(Math.round(t.x - 1), Math.round(t.y - 1), 2, 2);
    });
    ctx.globalAlpha = 1;
    const x = Math.round(bx), y = Math.round(by);
    ctx.fillStyle = 'rgba(255,226,122,0.35)'; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1220'; ctx.fillRect(x - 4, y - 3, 8, 6); ctx.fillRect(x - 3, y - 4, 6, 8);
    ctx.fillStyle = '#fff4e0'; ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.fillStyle = '#d8d8e8'; ctx.fillRect(x, y, 3, 3);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 2, 2, 2);
  });
  board.hooks.sfx('swap');
  const pops = [];
  for (const [i, p] of path.entries()) {
    const x0 = bx, y0 = by, x1 = g.cx(p.c), y1 = g.cy(p.r);
    const d = Math.hypot(x1 - x0, y1 - y0);
    const hop = Math.min(18, 4 + d * 0.25);
    await tween(Math.max(55, Math.min(150, d * 3.2)) * pace, t => {
      bx = x0 + (x1 - x0) * t;
      by = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * hop;
      trail.push({ x: bx, y: by });
      if (trail.length > 12) trail.shift();
    });
    board.hooks.sfx('peg', i + 1);
    board.shake = Math.max(board.shake, 3);
    pops.push(hit(board, p, '#ffe27a', 9));
  }
  // and out the bottom
  const x0 = bx, y0 = by;
  await tween(260, t => { bx = x0 + (Math.random() - 0.5); by = y0 + (g.LH + 10 - y0) * ease.inQuad(t); trail.push({ x: bx, y: by }); if (trail.length > 12) trail.shift(); });
  done();
  await Promise.all(pops);
}

// ---------- Storm Sweeper: storm clouds roll out along the row and column and strike ----------
async function stamps(board, g, cells, at, pace) {
  const order = cells.slice().sort((a, b) => Math.abs(a.r - at.r) + Math.abs(a.c - at.c) - (Math.abs(b.r - at.r) + Math.abs(b.c - at.c)));
  const jobs = order.map(async (p, i) => {
    await sleep(i * 34 * pace);
    const x = g.cx(p.c), y = g.cy(p.r);
    let a = 0, bolt = 0;
    const done = actor(board, ctx => {
      ctx.globalAlpha = a;
      ctx.fillStyle = '#6e6878'; ctx.fillRect(x - 6, y - 12, 12, 4); ctx.fillRect(x - 4, y - 14, 8, 2);
      ctx.fillStyle = '#9a94a8'; ctx.fillRect(x - 5, y - 13, 6, 2);
      if (bolt) {
        ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x - 2, y - 3); ctx.lineTo(x + 2, y - 2); ctx.lineTo(x, y + 3); ctx.stroke();
      }
    });
    await tween(140, t => { a = t; });
    bolt = 1;
    board.hooks.sfx(i % 3 ? 'pop' : 'thunder');
    board.shake = Math.max(board.shake, 2);
    const pop = hit(board, p, '#ffe27a', 8);
    await tween(160, t => { a = 1 - t; });
    done();
    await pop;
  });
  await Promise.all(jobs);
}

// ---------- Mewdoku: cats pounce across the area ----------
async function pounce(board, g, cells, at, pace) {
  const cats = Math.min(3, cells.length);
  const lanes = Array.from({ length: cats }, () => []);
  cells.slice().sort((a, b) => a.c - b.c || a.r - b.r).forEach((p, i) => lanes[i % cats].push(p));
  const jobs = lanes.map(async (lane, k) => {
    const img = ICONS['cat' + ((k * 2) % 6)] || ICONS.cat;
    let x = k % 2 ? g.LW + 10 : -10, y = g.cy(lane[0] ? lane[0].r : 0), flip = k % 2 ? -1 : 1, squash = 1;
    const done = actor(board, ctx => {
      ctx.translate(Math.round(x), Math.round(y));
      ctx.scale(flip, squash);
      ctx.drawImage(img, -6, -6, 12, 12);
    });
    const pops = [];
    await sleep(k * 90 * pace);
    for (const p of lane) {
      const x0 = x, y0 = y, x1 = g.cx(p.c), y1 = g.cy(p.r);
      flip = x1 < x0 ? -1 : 1;
      const d = Math.hypot(x1 - x0, y1 - y0);
      await tween(Math.max(70, Math.min(170, d * 3)) * pace, t => {
        x = x0 + (x1 - x0) * t;
        y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * Math.min(14, 4 + d * 0.3);
        squash = 1 + Math.sin(t * Math.PI) * 0.15;
      });
      board.hooks.sfx('mew');
      squash = 0.75;
      pops.push(hit(board, p, '#f08ab0', 7));
    }
    await tween(220, t => { x += flip * 2; y -= 1.5; squash = 1; });
    done();
    await Promise.all(pops);
  });
  await Promise.all(jobs);
}

// ---------- Micro Rush: lightning and flying props ----------
async function storm(board, g, cells, at, pace) {
  const order = shuffle(cells.slice());
  const jobs = order.map(async (p, i) => {
    await sleep(i * 55 * pace);
    const x = g.cx(p.c), y = g.cy(p.r);
    if (i % 2 === 0) {
      // a lightning bolt from the sky
      const pts = [];
      for (let yy = -4, xx = x + (Math.random() - 0.5) * 10; yy < y; yy += 6) { pts.push([xx, yy]); xx += (Math.random() - 0.5) * 6; }
      pts.push([x, y]);
      let life = 1;
      const done = actor(board, ctx => {
        ctx.globalAlpha = life;
        ctx.strokeStyle = '#fff8e0'; ctx.lineWidth = 2;
        ctx.beginPath(); pts.forEach(([a, b], k) => (k ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.stroke();
        ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 1;
        ctx.beginPath(); pts.forEach(([a, b], k) => (k ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.stroke();
      });
      board.flash = Math.max(board.flash, 0.25);
      board.hooks.sfx('thunder');
      const pop = hit(board, p, '#ffe27a', 10);
      await tween(200, t => { life = 1 - t; });
      done();
      return pop;
    }
    // a microgame prop flung in from the side, spinning
    const img = ICONS[PROPS[(Math.random() * PROPS.length) | 0]];
    const fromLeft = Math.random() < 0.5;
    let px = fromLeft ? -10 : g.LW + 10, py = y - 20 - Math.random() * 20, rot = 0;
    const done = actor(board, ctx => { ctx.translate(Math.round(px), Math.round(py)); ctx.rotate(rot); if (img) ctx.drawImage(img, -5, -5, 10, 10); });
    const x0 = px, y0 = py;
    await tween(240 * pace + 80, t => { px = x0 + (x - x0) * t; py = y0 + (y - y0) * ease.inQuad(t); rot = t * 8 * (fromLeft ? 1 : -1); });
    done();
    board.hooks.sfx('pop');
    return hit(board, p, board.colorAt(p), 10);
  });
  await Promise.all((await Promise.all(jobs)).filter(Boolean));
}


// ---------- Treasure chest: it bursts open in a fountain of coins ----------
export async function treasureFx(board, p) {
  const g = board.geom();
  board.hooks.sfx('boom');
  board.hooks.buzz && board.hooks.buzz([60, 40, 80]);
  board.shake = 16;
  board.flash = 1;
  board.ring(p, 90, '#ffe27a');
  setTimeout(() => board.ring(p, 60, '#fff8e0'), 120);
  board.say('Treasure!', '#ffe27a');
  for (let i = 0; i < 4; i++) board.burst(p, i % 2 ? '#ffe27a' : '#fff8e0', 16);
  if (reduced()) return sleep(500);
  const x0 = g.cx(p.c), y0 = g.cy(p.r);
  const coins = Array.from({ length: 26 }, () => ({ x: x0, y: y0, vx: (Math.random() - 0.5) * 2.6, vy: -2.5 - Math.random() * 3, spin: Math.random() * 6, img: Math.random() < 0.8 ? ICONS.coin : ICONS.shard }));
  const done = actor(board, ctx => {
    for (const c of coins) {
      const w = Math.max(1, Math.abs(Math.cos(c.spin)) * 8);
      if (c.img) ctx.drawImage(c.img, Math.round(c.x - w / 2), Math.round(c.y - 4), w, 8);
    }
  });
  let last = 0;
  await tween(1100, t => {
    const steps = Math.round(t * 66) - last;
    last += steps;
    for (let s = 0; s < steps; s++) for (const c of coins) { c.x += c.vx; c.y += c.vy; c.vy += 0.12; c.spin += 0.3; }
    if (Math.random() < 0.3) board.hooks.sfx('coin');
  });
  done();
}

// ---------- magic tiles (no mini-game) ----------
//   star / supernova     gold stars burst outward and smash the tiles around it
//   beam / moon cross /  moonbeams sweep out along the row and column (and diagonals)
//   double moon
//   orb / eclipse        Saturn's ring spreads out and zaps every target
export async function magicFx(board, kind, at, cells) {
  if (!cells.length) return;
  if (reduced()) return board.pop(cells, at);
  if (kind === 'rainbow') return rainbow(board, at, cells);
  const g = board.geom();
  const x0 = g.cx(at.c), y0 = g.cy(at.r);
  const dist = p => Math.hypot(p.r - at.r, p.c - at.c);
  if (kind === 'star' || kind === 'supernova') {
    const jobs = cells.map(async p => {
      await sleep(dist(p) * 45);
      const x1 = g.cx(p.c), y1 = g.cy(p.r);
      let x = x0, y = y0, rot = 0;
      const done = actor(board, ctx => { ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(rot); star5(ctx, 4, '#ffe27a'); });
      await tween(120 + dist(p) * 20, t => { x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t; rot = t * 4; });
      done();
      board.hooks.sfx('peg', 1 + Math.round(dist(p) * 2));
      return hit(board, p, '#ffe27a', 9);
    });
    return Promise.all(await Promise.all(jobs));
  }
  if (kind === 'beam' || kind === 'moonCross' || kind === 'doubleMoon') {
    // beams grow from the centre; each tile goes when the beam front reaches it
    let reach = 0;
    const maxD = Math.max(...cells.map(p => Math.max(Math.abs(p.r - at.r), Math.abs(p.c - at.c))));
    const done = actor(board, ctx => {
      const len = reach * g.CELL + 6;
      ctx.globalAlpha = 0.85;
      const beam = (dx, dy) => {
        ctx.strokeStyle = '#9fd3f2'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + dx * len, y0 + dy * len); ctx.stroke();
        ctx.strokeStyle = '#fff8e0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + dx * len, y0 + dy * len); ctx.stroke();
      };
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      if (kind === 'doubleMoon') dirs.push([1, 1], [-1, -1], [1, -1], [-1, 1]);
      if (kind === 'moonCross') for (const d of [-1, 1]) { ctx.save(); ctx.translate(d * g.CELL, d * g.CELL); dirs.forEach(([a, b]) => beam(a, b)); ctx.restore(); }
      dirs.forEach(([a, b]) => beam(a, b));
    });
    board.hooks.sfx('ring');
    const popped = new Set();
    const pops = [];
    await tween(260 + maxD * 40, t => {
      reach = t * (maxD + 1);
      for (const p of cells) {
        const k = p.r * g.COLS + p.c;
        if (!popped.has(k) && Math.max(Math.abs(p.r - at.r), Math.abs(p.c - at.c)) <= reach) { popped.add(k); pops.push(hit(board, p, '#bfe6ff', 7)); }
      }
    });
    done();
    return Promise.all(pops);
  }
  // orb / eclipse: a ring expands and zaps the targets one after another
  let ring = 0, zaps = [];
  const done = actor(board, ctx => {
    ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x0, y0, ring * 1.6, ring * 0.5, -0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#d8c4f0'; ctx.lineWidth = 1;
    for (const z of zaps) { ctx.globalAlpha = z.life; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(z.x, z.y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  });
  board.hooks.sfx('sparkle');
  const order = cells.slice().sort((a, b) => dist(a) - dist(b));
  const pops = [];
  const step = Math.max(12, Math.min(40, 700 / order.length));
  await tween(200, t => { ring = t * 30; });
  for (const p of order) {
    zaps.push({ x: g.cx(p.c), y: g.cy(p.r), life: 1 });
    zaps.forEach(z => (z.life *= 0.7));
    zaps = zaps.filter(z => z.life > 0.05);
    pops.push(hit(board, p, '#d8c4f0', 6));
    board.hooks.sfx('pop');
    await sleep(step);
  }
  await tween(160, t => { ring = 30 + t * 20; zaps.forEach(z => (z.life *= 0.8)); });
  done();
  return Promise.all(pops);
}

// ---------- Rainbow Bomb (two Star Bombs): the whole screen floods with rainbows ----------
const RAINBOW = ['#ff5a5a', '#f39a3a', '#ffe27a', '#8fe08a', '#7ec8f2', '#9a7ef2', '#f08ab0'];

async function rainbow(board, at, cells) {
  const g = board.geom();
  const x0 = g.cx(at.c), y0 = g.cy(at.r);
  // over the whole screen: a spinning rainbow wash, arcs and falling sparkles
  const veil = document.createElement('div');
  veil.className = 'rainbow-fx';
  veil.append(Object.assign(document.createElement('div'), { className: 'rb-wash' }));
  for (let i = 0; i < 3; i++) veil.append(Object.assign(document.createElement('div'), { className: 'rb-arc', style: `animation-delay:${i * 0.25}s` }));
  for (let i = 0; i < 28; i++) {
    const sp = document.createElement('i');
    sp.className = 'rb-spark';
    sp.style.cssText = `left:${Math.random() * 100}%;background:${RAINBOW[i % RAINBOW.length]};animation-delay:${Math.random() * 0.9}s;animation-duration:${0.9 + Math.random() * 0.8}s`;
    veil.append(sp);
  }
  document.body.append(veil);
  setTimeout(() => veil.remove(), 2600);
  // on the board: rainbow rings ripple out and every tile bursts in the colour of its band
  let ring = 0;
  const done = actor(board, ctx => {
    ctx.lineWidth = 2;
    RAINBOW.forEach((col, i) => {
      const r = ring - i * 3;
      if (r <= 0) return;
      ctx.strokeStyle = col;
      ctx.globalAlpha = Math.max(0, 1 - ring / 160);
      ctx.beginPath(); ctx.arc(x0, y0, r, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.globalAlpha = 1;
  });
  board.hooks.sfx('sparkle');
  const dist = p => Math.hypot(p.r - at.r, p.c - at.c);
  const order = cells.slice().sort((a, b) => dist(a) - dist(b));
  const pops = [];
  let n = 0;
  await tween(1100, t => {
    ring = t * 160;
    const reach = (ring / g.CELL) - 0.5;
    while (n < order.length && dist(order[n]) <= reach) {
      const p = order[n++];
      pops.push(hit(board, p, RAINBOW[Math.floor(dist(p)) % RAINBOW.length], 7));
      if (n % 6 === 0) board.hooks.sfx('pop');
    }
  });
  while (n < order.length) { const p = order[n++]; pops.push(hit(board, p, RAINBOW[n % RAINBOW.length], 7)); }
  done();
  return Promise.all(pops);
}

function star5(ctx, r, color) {
  ctx.fillStyle = '#1a1220';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r + 1; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.4 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.fill();
}
