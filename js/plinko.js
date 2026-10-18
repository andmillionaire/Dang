// Plinko physics for the treasure chest bonus. Pure (no DOM), so the odds can be tested in Node.

export const LW = 120, LH = 176;
const ROWS = 9, PEG_R = 1.6, BALL_R = 2.4, GRAV = 0.06, GAP_Y = 13;
export const TOP = 30;
export const CHUTE_Y = TOP + ROWS * GAP_Y + 4;

// Chutes left to right. `w` is relative width; the jackpot's is slim.
export const CHUTES = [
  { w: 1, label: '25', prize: { coins: 25 } },
  { w: 1, label: 'Seeds', prize: { seeds: 2 } },
  { w: 1, label: '60', prize: { coins: 60 } },
  { w: 1, label: 'Shards', prize: { shards: 5 } },
  { w: 0.42, label: 'MEGA', prize: { mega: true } },
  { w: 1, label: 'Shards', prize: { shards: 5 } },
  { w: 1, label: '60', prize: { coins: 60 } },
  { w: 1, label: 'Wood', prize: { lumber: 4, fabric: 3 } },
  { w: 1, label: '25', prize: { coins: 25 } },
];
export const MEGA = { coins: 1000, shards: 25, seeds: 5, lumber: 8, fabric: 8, kit: 2 };

const totalW = CHUTES.reduce((a, c) => a + c.w, 0);
export const edges = (() => { let x = 0; return CHUTES.map(c => { const a = x; x += (c.w / totalW) * LW; return [a, x]; }); })();
export const chuteAt = x => Math.max(0, edges.findIndex(([a, b]) => x >= a && x < b));

export const PEGS = [];
for (let r = 0; r < ROWS; r++) {
  const n = r % 2 ? 8 : 9;
  for (let i = 0; i < n; i++) PEGS.push({ x: (r % 2 ? 13 : 6) + i * 13.5, y: TOP + r * GAP_Y });
}

// One physics step; mutates b. rnd gives the tiny wobble that makes each drop different.
export function step(b, rnd = Math.random) {
  b.vy += GRAV;
  b.x += b.vx; b.y += b.vy;
  if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.6; }
  if (b.x > LW - BALL_R) { b.x = LW - BALL_R; b.vx = -Math.abs(b.vx) * 0.6; }
  let hit = null;
  for (const p of PEGS) {
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy), min = PEG_R + BALL_R;
    if (d < min) {
      const nx = dx / (d || 1), ny = dy / (d || 1);
      b.x = p.x + nx * min; b.y = p.y + ny * min;
      const dot = b.vx * nx + b.vy * ny;
      b.vx -= 1.5 * dot * nx; b.vy -= 1.5 * dot * ny;
      b.vx += (rnd() - 0.5) * 0.5;
      b.vx *= 0.85; b.vy *= 0.6;
      hit = p;
    }
  }
  // chute walls
  if (b.y > CHUTE_Y) for (const [a] of edges) if (Math.abs(b.x - a) < BALL_R && a > 0) { b.vx = -b.vx * 0.5; b.x += b.x < a ? -1 : 1; }
  return hit;
}

// Simulate a whole drop from x (for tests and odds); returns the chute index.
export function simulate(x, rnd = Math.random) {
  const b = { x, y: 8, vx: 0, vy: 0 };
  for (let i = 0; i < 3000 && b.y < LH - 6; i++) step(b, rnd);
  return chuteAt(b.x);
}

