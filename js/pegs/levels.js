// Star Pegs level layouts: 20 themed shapes x 10 variations = 200 levels.
// Pure data and maths (no DOM), so levels can be generated and checked in Node.
// Board is 120 x 176 logical pixels; pegs live roughly in x 8..112, y 34..146.

export const LEVEL_COUNT = 200;
export const W = 120, H = 176;
const CX = 60, CY = 90;

// Small seeded RNG so a level is the same every time it's played.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

const ring = (cx, cy, rx, ry, n, a0 = 0, arc = Math.PI * 2) =>
  Array.from({ length: n }, (_, i) => { const a = a0 + (arc * i) / (arc >= Math.PI * 2 - 0.01 ? n : n - 1); return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
const line = (x0, y0, x1, y1, n) => Array.from({ length: n }, (_, i) => [x0 + ((x1 - x0) * i) / Math.max(1, n - 1), y0 + ((y1 - y0) * i) / Math.max(1, n - 1)]);
const grid = (x0, y0, cols, rows, dx, dy, stagger = 0) => {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols - (stagger && r % 2 ? 1 : 0); c++) out.push([x0 + c * dx + (stagger && r % 2 ? dx / 2 : 0), y0 + r * dy]);
  return out;
};

// Each theme: name, a colour accent, and a builder (density k = 0..1 → more pegs).
export const THEMES = [
  { name: 'Twinkle Rows', color: '#9fd3f2', build: k => grid(12, 40, 8, 6 + Math.round(k * 2), 13.5, 14, true) },
  { name: 'Heart', color: '#f08ab0', build: k => {
    const n = 26 + Math.round(k * 14), out = [];
    for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; out.push([CX + 3.1 * 16 * Math.sin(t) ** 3, CY - 6 - 2.6 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); }
    return out.concat(ring(CX, CY - 8, 14, 12, 8 + Math.round(k * 4)));
  } },
  { name: 'Shooting Star', color: '#ffe27a', build: k => {
    const out = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 18 : 42; out.push([CX + Math.cos(a) * r, CY + Math.sin(a) * r]); }
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, b = -Math.PI / 2 + ((i + 1) * Math.PI) / 5, ra = i % 2 ? 18 : 42, rb = i % 2 ? 42 : 18; out.push(...line(CX + Math.cos(a) * ra, CY + Math.sin(a) * ra, CX + Math.cos(b) * rb, CY + Math.sin(b) * rb, 3 + Math.round(k)).slice(1, -1)); }
    return out.concat(ring(CX, CY, 8, 8, 5));
  } },
  { name: 'Crescent Moon', color: '#fff4e0', build: k => ring(CX, CY, 46, 50, 22 + Math.round(k * 8), Math.PI * 0.35, Math.PI * 1.3).concat(ring(CX + 14, CY - 2, 34, 40, 14 + Math.round(k * 6), Math.PI * 0.45, Math.PI * 1.1), grid(78, 50, 3, 4, 10, 18, true)) },
  { name: 'Saturn', color: '#d8c4f0', build: k => ring(CX, CY, 20, 20, 14 + Math.round(k * 6)).concat(ring(CX, CY, 50, 14, 22 + Math.round(k * 8)), ring(CX, CY, 8, 8, 6), ring(CX, CY - 46, 3, 3, 1), ring(CX - 40, CY + 38, 3, 3, 1), ring(CX + 38, CY - 40, 3, 3, 1)) },
  { name: 'Kitty', color: '#f8c8a8', build: k => {
    const out = ring(CX, CY + 6, 40, 34, 26 + Math.round(k * 8));
    out.push(...line(CX - 38, CY - 12, CX - 30, CY - 46, 4), ...line(CX - 30, CY - 46, CX - 14, CY - 26, 3), ...line(CX + 38, CY - 12, CX + 30, CY - 46, 4), ...line(CX + 30, CY - 46, CX + 14, CY - 26, 3));
    out.push(...ring(CX - 15, CY - 2, 5, 5, 6), ...ring(CX + 15, CY - 2, 5, 5, 6), [CX, CY + 10], ...line(CX - 26, CY + 12, CX - 8, CY + 14, 3), ...line(CX + 26, CY + 12, CX + 8, CY + 14, 3));
    return out;
  } },
  { name: 'Spiral', color: '#c8ecb0', build: k => { const n = 40 + Math.round(k * 16), out = []; for (let i = 0; i < n; i++) { const t = 0.6 + i * 0.32, r = 3 + t * 4.4; out.push([CX + Math.cos(t) * r, CY + Math.sin(t) * r * 1.05]); } return out.filter(([x, y]) => x > 6 && x < 114 && y > 34 && y < 148); } },
  { name: 'Flower', color: '#f6b8c8', build: k => {
    const out = ring(CX, CY, 10, 10, 8);
    for (let p = 0; p < 6; p++) { const a = (p * Math.PI) / 3; out.push(...ring(CX + Math.cos(a) * 30, CY + Math.sin(a) * 30, 13, 13, 7 + Math.round(k * 3), a)); }
    return out;
  } },
  { name: 'Smiley', color: '#ffe27a', build: k => ring(CX, CY, 46, 46, 30 + Math.round(k * 8)).concat(ring(CX - 16, CY - 14, 4, 6, 6), ring(CX + 16, CY - 14, 4, 6, 6), ring(CX, CY + 6, 26, 22, 11 + Math.round(k * 4), Math.PI * 0.15, Math.PI * 0.7)) },
  { name: 'Diamond Mine', color: '#b4ece4', build: k => { const out = []; const step = 12 - k * 2; for (let y = -48; y <= 48; y += step) { const w = 50 - Math.abs(y); for (let x = -w; x <= w; x += step) out.push([CX + x, CY + y]); } return out; } },
  { name: 'Pyramid', color: '#f8e0a0', build: k => { const out = []; const rows = 8 + Math.round(k * 2); for (let r = 0; r < rows; r++) for (let c = 0; c <= r; c++) out.push([CX + (c - r / 2) * 12, 40 + r * 12]); return out; } },
  { name: 'Rainy Waves', color: '#9fd3f2', build: k => { const out = []; for (let w = 0; w < 6 + Math.round(k * 2); w++) for (let x = 10; x <= 110; x += 9) out.push([x, 42 + w * 14 + Math.sin(x / 10 + w) * 5]); return out; } },
  { name: 'Zigzag', color: '#d0463c', build: k => { const out = []; for (let z = 0; z < 5 + Math.round(k); z++) { const y = 42 + z * 20; out.push(...line(10, y, 60, y + 12, 6), ...line(60, y + 12, 110, y, 6).slice(1)); } return out; } },
  { name: 'Cabin', color: '#a0663a', build: k => line(18, 92, CX, 46, 8).concat(line(CX, 46, 102, 92, 8).slice(1), line(24, 92, 24, 142, 6), line(96, 92, 96, 142, 6), line(24, 142, 96, 142, 9), grid(46, 104, 3, 3 + Math.round(k), 9, 9), ring(80, 72, 3, 3, 1), line(80, 56, 80, 70, 3)) },
  { name: 'Mushroom', color: '#d0463c', build: k => ring(CX, CY - 4, 46, 34, 26 + Math.round(k * 8), Math.PI, Math.PI).concat(line(14, CY - 4, 106, CY - 4, 10), line(48, CY + 4, 48, 140, 6), line(72, CY + 4, 72, 140, 6), ring(CX - 18, CY - 22, 6, 6, 6), ring(CX + 18, CY - 24, 7, 7, 6), ring(CX, CY - 32, 4, 4, 5)) },
  { name: 'Raindrops', color: '#4f8fd0', build: k => { const out = []; for (const [x, y] of [[30, 56], [70, 48], [96, 76], [46, 92], [84, 116], [26, 126], [60, 132]].slice(0, 5 + Math.round(k * 2))) out.push(...ring(x, y + 4, 8, 8, 7, 0, Math.PI), ...line(x - 8, y + 4, x, y - 10, 3).slice(0, -1), ...line(x, y - 10, x + 8, y + 4, 3).slice(1, -1), [x, y - 10]); return out; } },
  { name: 'D A N G', color: '#ffe27a', build: () => [
    ...line(10, 60, 10, 116, 6), ...ring(10, 88, 18, 28, 7, -Math.PI / 2, Math.PI),
    ...line(36, 116, 46, 60, 6), ...line(46, 60, 56, 116, 6).slice(1), ...line(40, 94, 52, 94, 2),
    ...line(62, 116, 62, 60, 6), ...line(62, 60, 80, 116, 6).slice(1, -1), ...line(80, 116, 80, 60, 6),
    ...ring(100, 88, 14, 28, 9, Math.PI * 0.25, Math.PI * 1.5), ...line(102, 92, 112, 92, 2),
  ] },
  { name: 'Target Rings', color: '#f39a3a', build: k => ring(CX, CY, 48, 48, 30 + Math.round(k * 6)).concat(ring(CX, CY, 34, 34, 22 + Math.round(k * 4), 0.2), ring(CX, CY, 20, 20, 12, 0.4), ring(CX, CY, 6, 6, 4)) },
  { name: 'Hourglass', color: '#c9ad7f', build: k => { const out = []; for (let y = -48; y <= 48; y += 10 - Math.round(k * 2)) { const w = 8 + Math.abs(y) * 0.9; out.push([CX - w, CY + y], [CX + w, CY + y]); if (Math.abs(y) > 30) for (let x = -w + 10; x < w - 4; x += 12) out.push([CX + x, CY + y]); } return out; } },
  { name: 'Starry Tree', color: '#6fb04a', build: k => { const out = []; for (let t = 0; t < 4; t++) { const y0 = 46 + t * 20, w = 14 + t * 12; out.push(...line(CX, y0, CX - w, y0 + 22, 4 + t), ...line(CX, y0, CX + w, y0 + 22, 4 + t).slice(1)); } out.push(...line(CX, 132, CX, 146, 2), [CX, 40]); if (k > 0.5) out.push(...ring(CX, 40, 5, 5, 5)); return out; } },
];

// A level's layout and settings. n = 1..200.
export function levelData(n) {
  const theme = THEMES[(n - 1) % THEMES.length];
  const tier = Math.floor((n - 1) / THEMES.length); // 0..9: denser, more orange, faster bucket, spinning later
  const R = rng(n * 7919 + 13);
  const k = tier / 9;
  let pegs = theme.build(k).map(([x, y]) => ({ x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2 }));
  // keep inside the board and apart from each other
  pegs = pegs.filter(p => p.x > 5 && p.x < 115 && p.y > 32 && p.y < 150);
  const kept = [];
  for (const p of pegs) if (kept.every(q => Math.hypot(q.x - p.x, q.y - p.y) >= 6)) kept.push(p);
  // a light jitter on later tiers so repeats of a shape don't play the same
  if (tier >= 3) kept.forEach(p => { p.x += (R() - 0.5) * tier * 0.3; p.y += (R() - 0.5) * tier * 0.3; });
  const orange = Math.min(Math.floor(kept.length * 0.55), 10 + tier * 2 + Math.round(R() * 2));
  const idx = kept.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  idx.slice(0, orange).forEach(i => (kept[i].kind = 'orange'));
  idx.slice(orange, orange + 2).forEach(i => (kept[i].kind = 'green'));
  kept.forEach(p => (p.kind ||= 'blue'));
  return {
    n, theme: theme.name, color: theme.color, pegs: kept,
    balls: n <= 20 ? 12 : 10, // a gentler start
    bucketSpeed: 0.55 + tier * 0.08,
    spin: tier >= 6 && n % 3 === 0 ? (n % 2 ? 1 : -1) * (0.08 + (tier - 6) * 0.02) : 0, // radians/sec, whole layout turns
    // stars: 2 at goal2 points, 3 at goal3
    goal2: 8000 + tier * 2500, goal3: 20000 + tier * 6000,
  };
}
