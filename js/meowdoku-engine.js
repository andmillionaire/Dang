// Mewdoku: an N x N grid split into N coloured regions. Place one cat per row, per column and
// per region, and no two cats may touch, not even diagonally. Pure logic, no DOM, so it runs in Node.
//
// A puzzle is { N, regions: number[N*N], solution: number[N] } where solution[row] = column.

const shuffle = (a, rand) => {
  for (let i = a.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// A random placement of N non-touching cats, one per row and column.
function placeCats(N, rand) {
  const sol = [], used = new Array(N).fill(false);
  const go = r => {
    if (r === N) return true;
    for (const c of shuffle([...Array(N).keys()], rand)) {
      if (used[c] || (r > 0 && Math.abs(sol[r - 1] - c) <= 1)) continue;
      used[c] = true; sol[r] = c;
      if (go(r + 1)) return true;
      used[c] = false;
    }
    return false;
  };
  return go(0) ? sol : null;
}

const nbrs4 = (N, i) => {
  const r = (i / N) | 0, c = i % N, out = [];
  if (r > 0) out.push(i - N);
  if (r < N - 1) out.push(i + N);
  if (c > 0) out.push(i - 1);
  if (c < N - 1) out.push(i + 1);
  return out;
};

// Grow one region from each cat until every cell belongs to a region.
function growRegions(N, sol, rand) {
  const reg = new Array(N * N).fill(-1);
  sol.forEach((c, r) => (reg[r * N + c] = r));
  let left = N * N - N;
  while (left > 0) {
    const r = (rand() * N) | 0;
    const frontier = [];
    for (let i = 0; i < N * N; i++) if (reg[i] === r) for (const j of nbrs4(N, i)) if (reg[j] === -1) frontier.push(j);
    if (!frontier.length) continue;
    reg[frontier[(rand() * frontier.length) | 0]] = r;
    left--;
  }
  return reg;
}

// All solutions up to `limit` (one cat per row/col/region, none touching).
export function solveAll(N, reg, limit = 2) {
  const out = [], sol = [], colUsed = new Array(N).fill(false), regUsed = new Array(N).fill(false);
  const go = r => {
    if (out.length >= limit) return;
    if (r === N) { out.push(sol.slice()); return; }
    for (let c = 0; c < N; c++) {
      const g = reg[r * N + c];
      if (colUsed[c] || regUsed[g] || (r > 0 && Math.abs(sol[r - 1] - c) <= 1)) continue;
      colUsed[c] = regUsed[g] = true; sol[r] = c;
      go(r + 1);
      colUsed[c] = regUsed[g] = false;
    }
  };
  go(0);
  return out;
}

function connectedWithout(N, reg, region, removed) {
  const cells = [];
  for (let i = 0; i < N * N; i++) if (reg[i] === region && i !== removed) cells.push(i);
  if (!cells.length) return false;
  const seen = new Set([cells[0]]), stack = [cells[0]];
  while (stack.length) for (const j of nbrs4(N, stack.pop())) if (j !== removed && reg[j] === region && !seen.has(j)) { seen.add(j); stack.push(j); }
  return seen.size === cells.length;
}

// Break an alternative solution by moving one of its cat cells into a neighbouring region.
function repair(N, reg, sol, alt, rand) {
  const rows = shuffle([...Array(N).keys()].filter(r => alt[r] !== sol[r]), rand);
  for (const r of rows) {
    const i = r * N + alt[r], from = reg[i];
    if (!connectedWithout(N, reg, from, i)) continue;
    const to = shuffle(nbrs4(N, i).map(j => reg[j]).filter(g => g !== from), rand)[0];
    if (to === undefined) continue;
    reg[i] = to;
    return true;
  }
  return false;
}

// ---------- logic solver: only deductions a person would make, no guessing ----------
// Returns { solved, steps, cats, order }: steps = deduction rounds needed, order = cells in the
// order they were proven. `start` lists cells that already hold correct cats.
export function logicSolve(N, reg, start = []) {
  const NN = N * N;
  const state = new Array(NN).fill(0); // 0 open, 1 cat, -1 ruled out
  const R = i => (i / N) | 0, C = i => i % N;
  const groups = [];
  for (let k = 0; k < N; k++) {
    groups.push([...Array(N).keys()].map(c => k * N + c));
    groups.push([...Array(N).keys()].map(r => r * N + k));
    groups.push([...Array(NN).keys()].filter(i => reg[i] === k));
  }
  const kills = i => {
    const out = [];
    for (let j = 0; j < NN; j++) {
      if (j === i) continue;
      if (R(j) === R(i) || C(j) === C(i) || reg[j] === reg[i] || (Math.abs(R(j) - R(i)) <= 1 && Math.abs(C(j) - C(i)) <= 1)) out.push(j);
    }
    return out;
  };
  const KILLS = [...Array(NN).keys()].map(kills);
  const order = [];
  const place = i => { state[i] = 1; order.push(i); for (const j of KILLS[i]) if (state[j] === 0) state[j] = -1; };
  for (const i of start) place(i);
  order.length = 0;
  const open = g => g.filter(i => state[i] === 0);
  const done = g => g.some(i => state[i] === 1);
  let steps = 0;

  for (;;) {
    if (state.filter(v => v === 1).length === N) return { solved: true, steps, order, cats: [...Array(N).keys()].map(r => state.slice(r * N, r * N + N).indexOf(1)) };
    let progress = false;
    // 1. a row, column or region with a single open cell
    for (const g of groups) {
      if (done(g)) continue;
      const o = open(g);
      if (o.length === 0) return { solved: false, steps, order };
      if (o.length === 1) { place(o[0]); progress = true; }
    }
    if (progress) { steps++; continue; }
    // 2. a group whose open cells all share a line or region: rule out the rest of that line/region
    for (const g of groups) {
      if (done(g)) continue;
      const o = open(g);
      for (const key of [R, C, i => reg[i]]) {
        const v = key(o[0]);
        if (!o.every(i => key(i) === v)) continue;
        for (let j = 0; j < NN; j++) if (state[j] === 0 && key(j) === v && !o.includes(j)) { state[j] = -1; progress = true; }
      }
      // every open cell of the group "sees" cell j -> j can't hold a cat
      for (let j = 0; j < NN; j++) {
        if (state[j] !== 0 || o.includes(j)) continue;
        if (o.every(i => KILLS[i].includes(j))) { state[j] = -1; progress = true; }
      }
    }
    if (progress) { steps++; continue; }
    // 3. k regions squeezed into k rows (or columns) own those lines
    for (const key of [R, C]) {
      const regs = [...Array(N).keys()].filter(g => !done(groups[3 * g + 2]));
      for (let a = 0; a < regs.length; a++) for (let b = a + 1; b < regs.length; b++) {
        for (const set of [[regs[a], regs[b]], ...regs.slice(b + 1).map(c => [regs[a], regs[b], c])]) {
          const lines = new Set();
          for (const g of set) for (const i of open(groups[3 * g + 2])) lines.add(key(i));
          if (lines.size !== set.length) continue;
          for (let j = 0; j < NN; j++) if (state[j] === 0 && lines.has(key(j)) && !set.includes(reg[j])) { state[j] = -1; progress = true; }
        }
      }
    }
    if (progress) { steps++; continue; }
    // 4. a cell that would leave some row/column/region with no room is impossible
    for (let i = 0; i < NN && !progress; i++) {
      if (state[i] !== 0) continue;
      const k = new Set(KILLS[i]);
      for (const g of groups) {
        if (done(g) || g.includes(i)) continue;
        if (open(g).every(j => k.has(j))) { state[i] = -1; progress = true; break; }
      }
    }
    if (progress) { steps++; continue; }
    return { solved: false, steps, order };
  }
}

// A puzzle with exactly one solution that the logic solver can finish without guessing.
export function generate(N, rand = Math.random, { tries = 4000 } = {}) {
  for (let t = 0; t < tries; t++) {
    const sol = placeCats(N, rand);
    if (!sol) continue;
    const reg = growRegions(N, sol, rand);
    for (let fix = 0; fix < 60; fix++) {
      const all = solveAll(N, reg, 2);
      if (all.length === 1) {
        const ls = logicSolve(N, reg);
        if (ls.solved) return { N, regions: reg, solution: sol, steps: ls.steps };
        break;
      }
      const alt = all.find(s => s.some((c, r) => c !== sol[r]));
      if (!repair(N, reg, sol, alt, rand)) break;
    }
  }
  return null;
}

// Rotate/flip a puzzle (any of the 8 symmetries) for variety; it stays valid and unique.
export function transform(p, k) {
  const N = p.N;
  const map = (r, c) => {
    let [x, y] = [r, c];
    for (let i = 0; i < (k & 3); i++) [x, y] = [y, N - 1 - x];
    if (k & 4) y = N - 1 - y;
    return [x, y];
  };
  const regions = new Array(N * N), solution = new Array(N);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const [x, y] = map(r, c);
    regions[x * N + y] = p.regions[r * N + c];
  }
  p.solution.forEach((c, r) => { const [x, y] = map(r, c); solution[x] = y; });
  return { ...p, regions, solution };
}
