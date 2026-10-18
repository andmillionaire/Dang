import { sleep, tween, ease } from './pixel.js';
import { ICONS } from './sprites.js';

// Themed blasts. Instead of every target tile popping at once, each kind of charged tile delivers
// its blast in its own way and knocks tiles out as it hits them:
//   cw    letters rain down from the sky and smash into the tiles
//   pegs  a pinball is shot into the board and ricochets from tile to tile
//   ttt   giant X and O marks stamp down along the row and column
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

// ---------- Tic-Tac-Toe: X and O marks stamp down ----------
async function stamps(board, g, cells, at, pace) {
  const order = cells.slice().sort((a, b) => Math.abs(a.r - at.r) + Math.abs(a.c - at.c) - (Math.abs(b.r - at.r) + Math.abs(b.c - at.c)));
  const jobs = order.map(async (p, i) => {
    await sleep(i * 32 * pace);
    const mark = (p.r + p.c) % 2 ? 'X' : 'O';
    const x = g.cx(p.c), y = g.cy(p.r);
    let s = 3, a = 0;
    const done = actor(board, ctx => {
      ctx.globalAlpha = a;
      ctx.strokeStyle = mark === 'X' ? '#ffe27a' : '#9fd3f2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (mark === 'X') { ctx.moveTo(x - 5 * s, y - 5 * s); ctx.lineTo(x + 5 * s, y + 5 * s); ctx.moveTo(x + 5 * s, y - 5 * s); ctx.lineTo(x - 5 * s, y + 5 * s); }
      else ctx.arc(x, y, 5 * s, 0, Math.PI * 2);
      ctx.stroke();
    });
    await tween(170, t => { s = 3 - 2 * ease.inQuad(t); a = Math.min(1, t * 2); });
    board.hooks.sfx(mark === 'X' ? 'place' : 'aiplace');
    board.shake = Math.max(board.shake, 2);
    const pop = hit(board, p, mark === 'X' ? '#ffe27a' : '#9fd3f2', 8);
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

