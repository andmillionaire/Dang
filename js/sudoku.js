// Sudoku engine shared by Mewdoku, the mashups and the arcade.
// Values are 1..N, 0 is empty. Boxes are BR rows x BC cols.

export const SHAPES = { 4: [2, 2], 6: [2, 3], 9: [3, 3] };

// Small seeded PRNG so a level number always produces the same puzzle.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shuffle = (a, rand) => {
  for (let i = a.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

function peersOf(N) {
  const [BR, BC] = SHAPES[N];
  return Array.from({ length: N * N }, (_, i) => {
    const r = (i / N) | 0, c = i % N, set = new Set();
    for (let k = 0; k < N; k++) { set.add(r * N + k); set.add(k * N + c); }
    const r0 = r - (r % BR), c0 = c - (c % BC);
    for (let a = 0; a < BR; a++) for (let b = 0; b < BC; b++) set.add((r0 + a) * N + c0 + b);
    set.delete(i);
    return [...set];
  });
}
const PEERS = {};

// Counts solutions up to `limit`, choosing the most constrained cell first.
export function countSolutions(grid, N, limit = 2) {
  const peers = PEERS[N] || (PEERS[N] = peersOf(N));
  const g = grid.slice();
  const full = (1 << (N + 1)) - 2;
  let found = 0;
  (function solve() {
    let best = -1, bestMask = 0, bestCount = 99;
    for (let i = 0; i < g.length; i++) {
      if (g[i]) continue;
      let used = 0;
      for (const p of peers[i]) used |= 1 << g[p];
      const mask = full & ~used;
      let n = 0;
      for (let m = mask; m; m &= m - 1) n++;
      if (n === 0) return;
      if (n < bestCount) { best = i; bestMask = mask; bestCount = n; if (n === 1) break; }
    }
    if (best < 0) { found++; return; }
    for (let v = 1; v <= N && found < limit; v++) {
      if (!(bestMask & (1 << v))) continue;
      g[best] = v;
      solve();
      g[best] = 0;
    }
  })();
  return found;
}

export function generate(N, givens, rand = Math.random) {
  const [BR, BC] = SHAPES[N];
  const digits = shuffle([...Array(N).keys()].map(v => v + 1), rand);
  const rows = shuffle([...Array(N / BR).keys()], rand).flatMap(b => shuffle([...Array(BR).keys()], rand).map(r => b * BR + r));
  const cols = shuffle([...Array(N / BC).keys()], rand).flatMap(s => shuffle([...Array(BC).keys()], rand).map(c => s * BC + c));
  let solution = [];
  for (const r of rows) for (const c of cols) solution.push(digits[(BC * (r % BR) + ((r / BR) | 0) + c) % N]);
  if (BR === BC && rand() < 0.5) solution = solution.map((_, i) => solution[(i % N) * N + ((i / N) | 0)]);
  const puzzle = solution.slice();
  let filled = N * N;
  for (const i of shuffle([...Array(N * N).keys()], rand)) {
    if (filled <= givens) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle, N) !== 1) puzzle[i] = keep;
    else filled--;
  }
  return { puzzle, solution, N };
}
