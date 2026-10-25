import { fitCanvas, toLogical, sleep, tween, ease } from './pixel.js';
import { TILES, TILES_WHITE, TILES_GREY, TILE_COLORS, SPECIALS, CHEST, MAGIC, MAGIC_MARK } from './sprites.js';
import { blastFx, treasureFx, magicFx } from './blastfx.js';

const CELL = 14, PAD = 4;
// The board grows as you progress, so its size is set per level in start().
let COLS = 7, ROWS = 9, LW = COLS * CELL + PAD * 2, LH = ROWS * CELL + PAD * 2;

const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const key = p => p.r * COLS + p.c;
const cx = c => PAD + c * CELL + CELL / 2, cy = r => PAD + r * CELL + CELL / 2;
const COMBO_WORDS = ['', '', 'Dang!', 'Lovely!', 'Magical!', 'Spellbinding!'];
export const MAGIC_NAME = { star: 'Star Bomb', beam: 'Moon Beam', orb: 'Saturn Orb', supernova: 'Supernova', rainbow: 'Rainbow Bomb', moonCross: 'Moon Cross', doubleMoon: 'Double Moon', eclipse: 'Total Eclipse' };
let uid = 0;

// Which charged tile a match shape makes: the first rule that fits and is unlocked wins,
// so a big shape made before its tile unlocks still earns the best tile you have.
export function kindOf(g, allowed = ['pegs', 'mew', 'cw', 'ttt']) {
  const fits = [];
  if (Math.max(g.h, g.v) >= 5) fits.push('pegs');
  if (g.h >= 3 && g.v >= 3) fits.push('mew');
  if (g.sq) fits.push('cw');
  if (Math.max(g.h, g.v) >= 4) fits.push('ttt');
  return fits.find(k => allowed.includes(k)) || null;
}

export class Board {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    // onUpdate(board), onSpecial(board, kinds) -> Promise<'win'|'lose'|'draw'>, onEnd(board, won), sfx(name, arg), toast(msg)
    this.hooks = hooks;
    this.grid = [];
    this.particles = [];
    this.floaters = [];
    this.shake = 0;
    this.flash = 0;
    this.cover = 0;
    this.rings = [];
    this.twinkles = [];
    this.actors = []; // themed blast effects drawn over the board (see blastfx.js)
    this.banner = null;
    this.busy = true;
    this.running = false;
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', () => (this.drag = null));
  }

  resize() {
    if (this.running) this.ctx = fitCanvas(this.canvas, LW, LH).ctx;
  }

  start(cfg) {
    this.gen = (this.gen || 0) + 1; // invalidates async work from a previous board
    this.cfg = cfg;
    [COLS, ROWS] = cfg.size || [7, 9];
    LW = COLS * CELL + PAD * 2;
    LH = ROWS * CELL + PAD * 2;
    this.moves = cfg.moves;
    this.score = 0;
    this.blasts = 0;
    this.ended = false;
    this.sel = null;
    this.hint = null;
    this.particles = [];
    this.floaters = [];
    this.cover = 0;
    this.rings = [];
    this.twinkles = [];
    this.banner = null;
    this.warnedNoMoves = false;
    this.fillInitial();
    this.running = true;
    this.resize();
    this.hooks.onUpdate(this);
    if (!this.raf) this.loop();
    this.intro();
  }

  stop() {
    this.running = false;
    this.ended = true;
  }

  async intro() {
    this.busy = true;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) this.grid[r][c].y = r - ROWS - 1;
    await this.collapse();
    this.busy = false;
    this.lastInput = performance.now();
  }

  // ---------- board logic ----------
  rnd() { return Math.floor(Math.random() * this.cfg.types); }
  newTile(t, c, r) { return { t, sp: null, x: c, y: r, s: 1, charged: false, dead: false, id: ++uid }; }
  // Colour at a cell: -1 empty, -2 charged tile, -3 treasure chest, -4 Saturn Orb (none ever match).
  // Star Bombs and Moon Beams keep their colour and match like any tile of it.
  T(r, c) {
    const t = this.grid[r] && this.grid[r][c];
    return !t ? -1 : t.sp ? -2 : t.chest ? -3 : t.mg === 'orb' ? -4 : t.t;
  }
  specials() { return this.grid.flat().filter(t => t && t.sp); }
  magics() { return this.grid.flat().filter(t => t && t.mg); }

  fillInitial() {
    do {
      this.grid = [];
      for (let r = 0; r < ROWS; r++) {
        this.grid.push([]);
        for (let c = 0; c < COLS; c++) {
          let t;
          do t = this.rnd();
          while (
            (c >= 2 && this.T(r, c - 1) === t && this.T(r, c - 2) === t) ||
            (r >= 2 && this.T(r - 1, c) === t && this.T(r - 2, c) === t) ||
            (r >= 1 && c >= 1 && this.T(r - 1, c) === t && this.T(r, c - 1) === t && this.T(r - 1, c - 1) === t)
          );
          this.grid[r].push(this.newTile(t, c, r));
        }
      }
    } while (!this.findMoves().length);
  }

  // Connected same-colour cells belonging to a line of 3+ or a 2x2 box.
  // Returns [{ cells, h, v, sq }] with the longest horizontal/vertical run and whether a box is inside.
  findGroups() {
    const N = ROWS * COLS;
    const parent = Array.from({ length: N }, (_, i) => i);
    const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
    const inRun = new Uint8Array(N), hRun = new Uint8Array(N), vRun = new Uint8Array(N), sq = new Uint8Array(N);
    const scan = (outer, inner, at, runs) => {
      for (let o = 0; o < outer; o++) {
        let i = 0;
        while (i < inner) {
          const t = this.T(...at(o, i));
          let e = i + 1;
          while (e < inner && this.T(...at(o, e)) === t) e++;
          if (t >= 0 && e - i >= 3) {
            const [r0, c0] = at(o, i);
            for (let k = i; k < e; k++) {
              const [r, c] = at(o, k), idx = r * COLS + c;
              inRun[idx] = 1;
              runs[idx] = e - i;
              union(idx, r0 * COLS + c0);
            }
          }
          i = e;
        }
      }
    };
    scan(ROWS, COLS, (r, c) => [r, c], hRun);
    scan(COLS, ROWS, (c, r) => [r, c], vRun);
    for (let r = 0; r < ROWS - 1; r++) for (let c = 0; c < COLS - 1; c++) {
      const t = this.T(r, c);
      if (t < 0 || this.T(r, c + 1) !== t || this.T(r + 1, c) !== t || this.T(r + 1, c + 1) !== t) continue;
      const box = [r * COLS + c, r * COLS + c + 1, (r + 1) * COLS + c, (r + 1) * COLS + c + 1];
      for (const i of box) { inRun[i] = 1; sq[i] = 1; union(i, box[0]); }
    }
    const groups = new Map();
    for (let i = 0; i < N; i++) {
      if (!inRun[i]) continue;
      const root = find(i);
      if (!groups.has(root)) groups.set(root, { cells: [], h: 0, v: 0, sq: false });
      const g = groups.get(root);
      g.cells.push({ r: Math.floor(i / COLS), c: i % COLS });
      g.h = Math.max(g.h, hRun[i]);
      g.v = Math.max(g.v, vRun[i]);
      g.sq = g.sq || !!sq[i];
    }
    return [...groups.values()];
  }

  // How big a match a cell is part of right now (0 if none). Boxes count as 4, crosses as 5.
  matchAt(r, c) {
    const t = this.T(r, c);
    if (t < 0) return 0;
    let h = 1, v = 1;
    for (let k = c - 1; k >= 0 && this.T(r, k) === t; k--) h++;
    for (let k = c + 1; k < COLS && this.T(r, k) === t; k++) h++;
    for (let k = r - 1; k >= 0 && this.T(k, c) === t; k--) v++;
    for (let k = r + 1; k < ROWS && this.T(k, c) === t; k++) v++;
    let size = Math.max(h >= 3 ? h : 0, v >= 3 ? v : 0);
    if (h >= 3 && v >= 3) size = Math.max(size, 5);
    for (const [dr, dc] of [[0, 0], [0, -1], [-1, 0], [-1, -1]]) {
      const r0 = r + dr, c0 = c + dc;
      if (r0 >= 0 && c0 >= 0 && r0 < ROWS - 1 && c0 < COLS - 1 &&
        this.T(r0, c0) === t && this.T(r0, c0 + 1) === t && this.T(r0 + 1, c0) === t && this.T(r0 + 1, c0 + 1) === t) size = Math.max(size, 4);
    }
    return size;
  }

  findMoves() {
    const moves = [];
    const g = this.grid;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + dr, c2 = c + dc;
        if (!inBounds(r2, c2) || !g[r][c] || !g[r2][c2]) continue;
        if (g[r][c].sp && g[r2][c2].sp) { moves.push({ a: { r, c }, b: { r: r2, c: c2 }, size: 9 }); continue; }
        const ma = g[r][c].mg, mb = g[r2][c2].mg;
        if ((ma && mb) || ma === 'orb' || mb === 'orb') { moves.push({ a: { r, c }, b: { r: r2, c: c2 }, size: 8 }); continue; }
        if (g[r][c].sp || g[r2][c2].sp || g[r][c].chest || g[r2][c2].chest) continue;
        [g[r][c], g[r2][c2]] = [g[r2][c2], g[r][c]];
        const size = Math.max(this.matchAt(r, c), this.matchAt(r2, c2));
        [g[r][c], g[r2][c2]] = [g[r2][c2], g[r][c]];
        if (size) moves.push({ a: { r, c }, b: { r: r2, c: c2 }, size });
      }
    }
    return moves;
  }

  // ---------- input ----------
  cellAt(e) {
    const p = toLogical(this.canvas, LW, LH, e);
    const c = Math.floor((p.x - PAD) / CELL), r = Math.floor((p.y - PAD) / CELL);
    return inBounds(r, c) ? { r, c } : null;
  }

  onDown(e) {
    if (this.busy || this.ended) return;
    e.preventDefault();
    const p = this.cellAt(e);
    if (!p) return;
    this.lastInput = performance.now();
    this.hint = null;
    if (this.sel && Math.abs(this.sel.r - p.r) + Math.abs(this.sel.c - p.c) === 1) {
      const a = this.sel;
      this.sel = null;
      this.attemptSwap(a, p);
      return;
    }
    if (this.sel && key(this.sel) === key(p)) { this.sel = null; return; }
    const tile = this.grid[p.r][p.c];
    this.drag = { ...p, x: e.clientX, y: e.clientY, special: !!(tile.sp || tile.mg === 'orb') };
    if (!this.drag.special) { this.sel = p; this.hooks.sfx('select'); }
    this.canvas.setPointerCapture?.(e.pointerId);
  }

  onMove(e) {
    if (!this.drag || this.busy) return;
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    const th = (this.canvas.getBoundingClientRect().width / COLS) * 0.35;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < th) return;
    const a = { r: this.drag.r, c: this.drag.c };
    const b = Math.abs(dx) > Math.abs(dy) ? { r: a.r, c: a.c + Math.sign(dx) } : { r: a.r + Math.sign(dy), c: a.c };
    this.drag = null;
    if (!inBounds(b.r, b.c)) return;
    this.sel = null;
    this.attemptSwap(a, b);
  }

  // A tap (no drag) on a charged tile plays its mini-game. The Saturn Orb goes off when swapped.
  onUp() {
    const d = this.drag;
    this.drag = null;
    if (!d || !d.special || this.busy || this.ended) return;
    const t = this.grid[d.r][d.c];
    if (t.sp) return this.activate({ r: d.r, c: d.c });
    t.sx = 1.25; t.sy = 0.8;
    this.hooks.sfx('nope');
    this.hooks.toast('Swap the Saturn Orb with a tile to clear every tile of that colour.');
  }

  // ---------- turn flow ----------
  // A turn never leaves the board stuck: if anything throws, put the board back together.
  async attemptSwap(a, b) { return this.safely(() => this.doSwap(a, b)); }
  async activate(p) { return this.safely(() => this.doActivate(p)); }
  async safely(turn) {
    try { return await turn(); } catch (err) {
      console.error('match3 turn failed', err);
      const gen = this.gen;
      try {
        for (const t of this.grid.flat()) if (t) { t.going = false; t.charged = false; t.s = 1; t.x = Math.round(t.x); t.y = Math.round(t.y); }
        this.actors = [];
        await this.collapse();
      } catch (e2) { console.error('match3 recover failed', e2); }
      if (gen === this.gen && this.running && !this.checkEnd()) { this.busy = false; this.lastInput = performance.now(); }
    }
  }

  async doSwap(a, b) {
    if (this.moves <= 0) {
      this.hooks.toast('Out of moves!');
      return;
    }
    const gen = this.gen;
    this.busy = true;
    this.hint = null;
    const A = this.grid[a.r][a.c], B = this.grid[b.r][b.c];

    if (A.sp && B.sp) {
      this.hooks.sfx('swap');
      await tween(160, t => { A.x = a.c + (b.c - a.c) * t * 0.6; A.y = a.r + (b.r - a.r) * t * 0.6; }, ease.inOut);
      this.moves--;
      this.hooks.onUpdate(this);
      await this.detonate([A, B], b, gen);
      return this.afterTurn(gen);
    }

    // Magic tiles: swap two together for a giant combo. A Saturn Orb goes off when swapped with
    // any tile; Star Bombs and Moon Beams only go off when matched with their colour.
    if ((A.mg && B.mg) || A.mg === 'orb' || B.mg === 'orb') {
      this.hooks.sfx('swap');
      if (A.mg && B.mg) {
        await tween(160, t => { A.x = a.c + (b.c - a.c) * t * 0.6; A.y = a.r + (b.r - a.r) * t * 0.6; }, ease.inOut);
        this.moves--;
        this.hooks.onUpdate(this);
        await this.magicCombo(A, B, b, gen);
        return this.afterTurn(gen);
      }
      const [M, O, mAt, oAt] = A.mg === 'orb' ? [A, B, a, b] : [B, A, b, a];
      if (O.sp || O.chest) {
        // can't trade places with a charged tile or chest: it just goes off where it is
        this.moves--;
        this.hooks.onUpdate(this);
        await this.explodeMagic(M, mAt, gen);
        return this.afterTurn(gen);
      }
      this.grid[a.r][a.c] = B; this.grid[b.r][b.c] = A;
      await this.animSwap(A, B, a, b);
      this.moves--;
      this.hooks.onUpdate(this);
      await this.explodeMagic(M, oAt, gen, O.t);
      return this.afterTurn(gen);
    }

    this.hooks.sfx('swap');
    this.grid[a.r][a.c] = B;
    this.grid[b.r][b.c] = A;
    const groups = this.findGroups();
    if (!groups.length) {
      this.grid[a.r][a.c] = A;
      this.grid[b.r][b.c] = B;
      this.hooks.sfx('nope');
      this.hooks.buzz && this.hooks.buzz(20);
      await this.animNope(A, B, a, b);
      this.busy = false;
      return;
    }
    this.hooks.buzz && this.hooks.buzz(8);
    await this.animSwap(A, B, a, b);
    this.moves--;
    this.hooks.onUpdate(this);
    await this.resolve(groups, gen, [a, b]);
    return this.afterTurn(gen);
  }

  async doActivate(p) {
    const gen = this.gen;
    if (this.moves <= 0) { this.hooks.toast('Out of moves!'); return; }
    this.busy = true;
    this.hint = null;
    const t = this.grid[p.r][p.c];
    this.moves--;
    this.hooks.onUpdate(this);
    if (t.mg) await this.explodeMagic(t, p, gen);
    else await this.detonate([t], p, gen);
    return this.afterTurn(gen);
  }

  async afterTurn(gen) {
    if (gen === this.gen && this.running) await this.openChests(gen);
    if (gen !== this.gen || !this.running || this.checkEnd()) return;
    await this.ensureMoves();
    this.busy = false;
    this.lastInput = performance.now();
  }

  // Snappy swap with a little overshoot.
  async animSwap(A, B, a, b) {
    await tween(150, t => {
      A.x = a.c + (b.c - a.c) * t; A.y = a.r + (b.r - a.r) * t;
      B.x = b.c + (a.c - b.c) * t; B.y = b.r + (a.r - b.r) * t;
    }, ease.outBack);
    A.x = b.c; A.y = b.r; B.x = a.c; B.y = a.r;
  }

  // A swap that doesn't match: the tiles lean in, then wobble back home.
  async animNope(A, B, a, b) {
    const dr = b.r - a.r, dc = b.c - a.c;
    await tween(300, t => {
      const k = t < 0.35 ? ease.outQuad(t / 0.35) * 0.4 : 0.4 * Math.cos(((t - 0.35) / 0.65) * Math.PI * 2.5) * (1 - (t - 0.35) / 0.65);
      A.x = a.c + dc * k; A.y = a.r + dr * k;
      B.x = b.c - dc * k; B.y = b.r - dr * k;
    });
    A.x = a.c; A.y = a.r; B.x = b.c; B.y = b.r;
  }

  // Tiles of a big shape fly into the cell that becomes the charged tile.
  async suck(items, to) {
    const from = items.map(x => ({ x: x.tile.x, y: x.tile.y }));
    await tween(220, t => {
      items.forEach((x, i) => {
        x.tile.x = from[i].x + (to.c - from[i].x) * t;
        x.tile.y = from[i].y + (to.r - from[i].y) * t;
        x.tile.s = 1 - t * 0.7;
        x.tile.flash = t;
      });
    }, ease.inOut);
    for (const x of items) if (this.grid[x.p.r][x.p.c] === x.tile) this.grid[x.p.r][x.p.c] = null;
  }

  ring(p, max, color = '#ffe27a') {
    this.rings.push({ x: cx(p.c), y: cy(p.r), r: 1, max, life: 1, color });
  }

  say(text, color = '#ffe27a') {
    this.banner = { text, color, t0: performance.now() };
  }

  async resolve(groups, gen, origins = []) {
    let combo = 0;
    while (groups.length && this.running && gen === this.gen) {
      combo++;
      const clear = [], sucks = [], fire = [];
      let pts = 0;
      // The first link of a chain reaction ("Dang!") leaves a Dang! tile behind.
      let dang = combo === 2 && this.cfg.kinds?.includes('micro') && this.grid.flat().filter(t => t && t.sp === 'micro').length < 2;
      // Magic tiles: big shapes and long chains. A swap that makes two matches at once, or a
      // 3-step chain, makes a Star Bomb; 6 in a row or a 4-step chain a Moon Beam; 7+ tiles or a
      // 5-step chain a Saturn Orb.
      const magic = this.cfg.magic || [];
      const chainMagic = combo >= 5 ? 'orb' : combo === 4 ? 'beam' : combo === 3 ? 'star' : combo === 1 && groups.length >= 2 ? 'star' : null;
      let pending = chainMagic && magic.includes(chainMagic) ? chainMagic : null;
      for (const g0 of groups) {
        pts += g0.cells.length * 10 * combo + Math.max(0, g0.cells.length - 3) * 20;
        // Star Bombs and Moon Beams caught in a match go off; the rest of the match plays out as usual
        const isMg = p => this.grid[p.r][p.c].mg;
        fire.push(...g0.cells.filter(isMg));
        const g = { ...g0, cells: g0.cells.filter(p => !isMg(p)) };
        if (!g.cells.length) continue;
        let mg = g.cells.length >= 7 && magic.includes('orb') ? 'orb' : Math.max(g.h, g.v) >= 6 && magic.includes('beam') ? 'beam' : null;
        let kind = mg ? null : kindOf(g, this.cfg.kinds);
        if (!kind && !mg && pending) { mg = pending; pending = null; }
        if (!kind && !mg && dang) { kind = 'micro'; dang = false; }
        if (mg) {
          const keep = (combo === 1 && origins.find(o => g.cells.some(p => key(p) === key(o)))) || g.cells[Math.floor(g.cells.length / 2)];
          const t = this.grid[keep.r][keep.c];
          t.mg = mg;
          t.born = performance.now();
          t.s = 0.2;
          this.hooks.onMagic && this.hooks.onMagic(mg);
          sucks.push({ to: keep, items: g.cells.filter(p => key(p) !== key(keep)).map(p => ({ p, tile: this.grid[p.r][p.c] })) });
          continue;
        }
        let keep = null;
        if (kind) {
          keep = (combo === 1 && origins.find(o => g.cells.some(p => key(p) === key(o)))) || g.cells[Math.floor(g.cells.length / 2)];
          const t = this.grid[keep.r][keep.c];
          t.sp = kind;
          t.born = performance.now();
          t.s = 0.2;
          this.hooks.onCreate && this.hooks.onCreate(kind);
          sucks.push({ to: keep, items: g.cells.filter(p => key(p) !== key(keep)).map(p => ({ p, tile: this.grid[p.r][p.c] })) });
        } else {
          for (const p of g.cells) clear.push(p);
        }
      }
      this.addScore(pts, groups.flatMap(g => g.cells));
      this.hooks.sfx('pop', combo);
      this.hooks.buzz && this.hooks.buzz(combo > 1 ? 25 : 12);
      if (combo >= 2) {
        this.say(COMBO_WORDS[Math.min(combo, COMBO_WORDS.length - 1)]);
        this.ring(groups[0].cells[0], 10 + combo * 4, '#fff4e0');
      }
      await Promise.all([
        this.pop(clear),
        ...sucks.map(async s => {
          await this.suck(s.items, s.to);
          const t = this.grid[s.to.r][s.to.c];
          this.hooks.sfx('charge');
          this.ring(s.to, 16);
          this.burst(s.to, '#ffe27a', 14);
          await tween(220, k => (t.s = 0.2 + 0.8 * ease.outBack(k)));
          t.s = 1;
        }),
      ]);
      if (fire.length) await this.blastWith(c => this.pop(c), fire);
      await this.collapse();
      await this.openChests(gen);
      groups = this.findGroups();
    }
  }

  // A chest that reaches the bottom row bursts open: loot, then the bonus Plinko (hooks.onTreasure).
  async openChests(gen) {
    for (let c = 0; c < COLS; c++) {
      const t = this.grid[ROWS - 1][c];
      if (!t || !t.chest || gen !== this.gen) continue;
      const p = { r: ROWS - 1, c };
      await treasureFx(this, p);
      t.chest = false;
      await this.pop([p], p);
      await this.collapse();
      if (this.hooks.onTreasure) await this.hooks.onTreasure(this);
    }
  }

  // Cells a charged tile clears. Charged tiles themselves are never caught in a blast.
  blastCells(kinds, at) {
    let big = !!this.cfg.bigBlasts;
    const out = new Map();
    const add = (r, c) => { if (inBounds(r, c) && this.grid[r][c] && !this.grid[r][c].sp && !this.grid[r][c].chest) out.set(r * COLS + c, { r, c }); };
    // two of a kind merged (supercharged): that kind's big blast
    const sup = kinds.length === 2 && kinds[0] === kinds[1];
    if (sup) kinds = [kinds[0]];
    const bigOne = big || sup;
    for (const k of kinds) {
      if (k === 'ttt') {
        for (let w = bigOne ? -1 : 0; w <= (bigOne ? 1 : 0); w++) {
          for (let c = 0; c < COLS; c++) add(at.r + w, c);
          for (let r = 0; r < ROWS; r++) add(r, at.c + w);
        }
      } else if (k === 'mew') {
        const rad = bigOne ? 3 : 2;
        for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) add(at.r + dr, at.c + dc);
      } else if (k === 'cw') {
        for (let d = -ROWS; d <= ROWS; d++) { add(at.r + d, at.c + d); add(at.r + d, at.c - d); }
        if (bigOne) for (let c = 0; c < COLS; c++) add(at.r, c);
      } else if (k === 'micro') {
        // a 3x3 zap where it sits, plus lightning on random tiles
        const rad = bigOne ? 2 : 1;
        for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) add(at.r + dr, at.c + dc);
        const rest = [];
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.grid[r][c] && !this.grid[r][c].sp) rest.push({ r, c });
        rest.sort(() => Math.random() - 0.5).slice(0, bigOne ? 12 : 8).forEach(p => add(p.r, p.c));
      } else if (k === 'pegs') {
        const counts = {};
        for (const t of this.grid.flat()) if (t && !t.sp) counts[t.t] = (counts[t.t] || 0) + 1;
        const ranked = Object.keys(counts).sort((x, y) => counts[y] - counts[x]).map(Number).slice(0, bigOne ? 2 : 1);
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (ranked.includes(this.T(r, c))) add(r, c);
      }
    }
    return [...out.values()];
  }

  // Play the mini-game for one charged tile (or two, swapped together), then blast or fizzle.
  async detonate(tiles, at, gen) {
    tiles.forEach(t => (t.charged = true));
    this.hooks.sfx('charge');
    await sleep(350);
    const result = await this.hooks.onSpecial(this, tiles.map(t => t.sp));
    tiles.forEach(t => (t.charged = false));
    if (gen !== this.gen || !this.running) return;
    const where = tiles.map(t => this.find(t));

    if (result === 'win') {
      const cells = this.blastCells(tiles.map(t => t.sp), at);
      this.blasts += tiles.length;
      this.hooks.sfx('boom');
      this.hooks.buzz && this.hooks.buzz([40, 30, 60]);
      this.shake = 14;
      this.flash = 1;
      this.ring(at, 90, '#fff8e0');
      setTimeout(() => this.ring(at, 60, '#ffe27a'), 90);
      this.say(tiles.length > 1 ? 'Mashup!' : 'Storm Blast!');
      tiles.forEach(t => { t.was = t.sp; t.sp = null; });
      this.addScore(250 * tiles.length + cells.length * 15, [at], '', true);
      this.hooks.onUpdate(this);
      // each kind delivers its own blast: falling letters, a pinball, stamped marks, pouncing cats...
      const kinds = tiles.map(t => t.sp || t.was);
      await this.blastWith(c => blastFx(this, kinds, at, c), cells);
      await this.pop(where, at);
    } else {
      tiles.forEach(t => (t.dead = true));
      this.hooks.sfx('fizzle');
      await sleep(350);
      await this.pop(where);
    }
    await this.collapse();
    await this.resolve(this.findGroups(), gen);
  }

  // ---------- magic tiles ----------
  // Cells a magic tile clears. Charged tiles and chests are never caught; other magic tiles are,
  // and go off in turn (chain reactions).
  magicCells(kind, at, colour) {
    const out = new Map();
    const add = (r, c) => { if (inBounds(r, c) && this.grid[r][c] && !this.grid[r][c].sp && !this.grid[r][c].chest) out.set(r * COLS + c, { r, c }); };
    const area = rad => { for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) add(at.r + dr, at.c + dc); };
    const cross = (r, c) => { for (let k = 0; k < COLS; k++) add(r, k); for (let k = 0; k < ROWS; k++) add(k, c); };
    if (kind === 'star') area(1);
    else if (kind === 'supernova') area(2);
    else if (kind === 'beam') cross(at.r, at.c);
    else if (kind === 'moonCross') for (let d = -1; d <= 1; d++) cross(at.r + d, at.c + d);
    else if (kind === 'doubleMoon') { cross(at.r, at.c); for (let d = -ROWS; d <= ROWS; d++) { add(at.r + d, at.c + d); add(at.r + d, at.c - d); } }
    else if (kind === 'orb') { const col = colour ?? this.commonColour(); for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const t = this.grid[r][c]; if (t && !t.mg && t.t === col) add(r, c); } }
    else if (kind === 'eclipse' || kind === 'rainbow') for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) add(r, c);
    out.delete(at.r * COLS + at.c);
    return [...out.values()];
  }

  commonColour() {
    const n = {};
    for (const t of this.grid.flat()) if (t && !t.sp && !t.mg && !t.chest && !t.dead) n[t.t] = (n[t.t] || 0) + 1;
    return Number(Object.keys(n).sort((a, b) => n[b] - n[a])[0] ?? 0);
  }

  // Blast cells with an effect; any magic tiles among them set off their own blast afterwards.
  async blastWith(fx, cells, depth = 0) {
    const chain = [], rest = [];
    for (const p of cells) {
      const t = this.grid[p.r][p.c];
      if (t && t.mg && !t.going && depth < 6) { t.going = true; chain.push(t); } else rest.push(p);
    }
    await fx(rest);
    // chained magic tiles go off together, a beat apart, rather than one long queue
    await Promise.all(chain.map(async (t, i) => {
      await sleep(Math.min(i, 12) * 70);
      const at = this.find(t);
      if (!at) return;
      const kind = t.mg;
      this.say(MAGIC_NAME[kind] + '!', '#f8b0d4');
      this.ring(at, 40, '#f8b0d4');
      this.addScore(100 + 15 * depth, [at], '', false);
      await this.blastWith(c => magicFx(this, kind, at, c), this.magicCells(kind, at), depth + 1);
      await this.pop([at], at);
    }));
  }

  // One magic tile goes off at `at`. colour: the tile it was swapped with (for the Saturn Orb).
  async explodeMagic(M, at, gen, colour) {
    M.going = true;
    const kind = M.mg;
    this.hooks.sfx('boom');
    this.hooks.buzz && this.hooks.buzz([30, 20, 50]);
    this.shake = 10;
    this.ring(at, 60, '#f8b0d4');
    this.say(MAGIC_NAME[kind] + '!', '#f8b0d4');
    const cells = this.magicCells(kind, at, colour);
    this.addScore(150 + cells.length * 20, [at], MAGIC_NAME[kind], true);
    await this.blastWith(c => magicFx(this, kind, at, c), cells);
    await this.pop([at], at);
    if (gen !== this.gen) return;
    await this.collapse();
    await this.openChests(gen);
    await this.resolve(this.findGroups(), gen);
  }

  // Two magic tiles swapped together: a giant combo.
  async magicCombo(A, B, at, gen) {
    A.going = B.going = true;
    const pair = [A.mg, B.mg].sort().join('+');
    const big = { 'star+star': 'rainbow', 'beam+star': 'moonCross', 'beam+beam': 'doubleMoon', 'orb+orb': 'eclipse' }[pair];
    this.hooks.sfx('boom');
    this.hooks.buzz && this.hooks.buzz([60, 30, 60, 30, 120]);
    this.shake = 18;
    this.flash = 1;
    this.ring(at, 120, '#fff8e0');
    setTimeout(() => this.ring(at, 90, '#f8b0d4'), 120);
    const where = [this.find(A), this.find(B)].filter(Boolean);
    if (big) {
      this.say(MAGIC_NAME[big] + '!', '#f8b0d4');
      const cells = this.magicCells(big, at).filter(p => !where.some(w => w.r === p.r && w.c === p.c));
      this.addScore(600 + cells.length * 25, [at], MAGIC_NAME[big], true);
      await this.blastWith(c => magicFx(this, big, at, c), cells);
    } else {
      // Saturn Orb + Star or Beam: every tile of the most common colour becomes that magic, then they all go off.
      const other = A.mg === 'orb' ? B.mg : A.mg;
      const col = this.commonColour();
      const targets = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const t = this.grid[r][c]; if (t && !t.sp && !t.mg && !t.chest && t.t === col) { t.mg = other; t.born = performance.now(); targets.push({ r, c }); } }
      this.say('Saturn Storm!', '#f8b0d4');
      this.addScore(800 + targets.length * 40, [at], 'Saturn Storm', true);
      this.hooks.sfx('sparkle');
      await sleep(450);
      await this.blastWith(c => magicFx(this, 'orb', at, c), targets);
    }
    await this.pop(where, at);
    if (gen !== this.gen) return;
    await this.collapse();
    await this.openChests(gen);
    await this.resolve(this.findGroups(), gen);
  }

  find(tile) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.grid[r][c] === tile) return { r, c };
    return null;
  }

  async pop(cells, center) {
    const items = cells.filter(Boolean).map(p => ({ p, tile: this.grid[p.r][p.c], burst: false })).filter(x => x.tile);
    const delay = x => (center ? (Math.abs(x.p.r - center.r) + Math.abs(x.p.c - center.c)) * 40 : 0);
    const dur = 190;
    const total = dur + Math.max(0, ...items.map(delay));
    await tween(total, t => {
      const now = t * total;
      for (const x of items) {
        const lt = Math.min(1, Math.max(0, (now - delay(x)) / dur));
        if (lt > 0 && !x.burst) {
          x.burst = true;
          this.burst(x.p, x.tile.dead ? '#6e6878' : x.tile.sp ? '#ffe27a' : TILE_COLORS[x.tile.t], center ? 9 : 5);
        }
        x.tile.s = lt < 0.3 ? 1 + lt : 1.3 * (1 - (lt - 0.3) / 0.7);
        x.tile.flash = lt < 0.3 ? lt / 0.3 : 1 - (lt - 0.3) / 0.7;
      }
    });
    for (const x of items) if (this.grid[x.p.r][x.p.c] === x.tile) this.grid[x.p.r][x.p.c] = null;
  }

  async collapse() {
    const moving = [];
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        const t = this.grid[r][c];
        if (!t) continue;
        if (r !== write) { this.grid[write][c] = t; this.grid[r][c] = null; }
        t.x = c;
        t.fromY = t.y; t.toY = write;
        if (t.y !== write) moving.push(t);
        write--;
      }
      for (let r = write; r >= 0; r--) {
        const t = this.newTile(this.rnd(), c, r - (write + 1));
        t.fromY = t.y; t.toY = r;
        this.grid[r][c] = t;
        moving.push(t);
      }
    }
    if (!moving.length) return;
    // Now and then (1 in 200 refills) a treasure chest drops in with the new tiles. One at a time.
    const fresh = moving.filter(t => t.fromY < 0);
    if (fresh.length && Math.random() < (this.cfg.chestChance ?? 1 / 200) && !this.grid.flat().some(x => x && x.chest)) {
      fresh[(Math.random() * fresh.length) | 0].chest = true;
    }
    const dist = Math.max(...moving.map(t => t.toY - t.fromY));
    const fall = 120 + dist * 45, stagger = 14, total = fall + stagger * (COLS - 1);
    await tween(total, k => {
      const now = k * total;
      for (const t of moving) {
        const lt = Math.min(1, Math.max(0, (now - t.x * stagger) / fall));
        t.y = t.fromY + (t.toY - t.fromY) * ease.inQuad(lt);
        if (lt >= 1 && !t.landed) { t.landed = true; t.sx = 1.25; t.sy = 0.72; }
      }
    });
    for (const t of moving) { t.y = t.toY; t.landed = false; }
    this.hooks.sfx('land');
  }

  async ensureMoves() {
    if (this.findMoves().length) return;
    this.hooks.toast('No swaps left. Shuffling!');
    await sleep(500);
    const tiles = this.grid.flat().filter(t => !t.sp && !t.chest);
    do {
      for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiles[i].t, tiles[j].t] = [tiles[j].t, tiles[i].t];
      }
    } while (this.findGroups().length || !this.findMoves().length);
    await tween(300, t => tiles.forEach(x => (x.s = 1 - Math.sin(t * Math.PI) * 0.6)));
  }

  checkEnd() {
    const c = this.cfg;
    const won = this.score >= c.target && this.blasts >= c.blasts;
    const stuck = this.moves <= 0;
    if (won || stuck) {
      this.ended = true;
      this.hooks.onEnd(this, won);
      return true;
    }
    if (this.moves <= 0 && !this.warnedNoMoves) {
      this.warnedNoMoves = true;
      this.hooks.toast('Out of moves!');
    }
    return false;
  }

  addScore(pts, cells, label, big = false) {
    pts = Math.round(pts * (this.cfg.scoreMult || 1));
    this.score += pts;
    const p = cells[Math.floor(cells.length / 2)];
    this.floaters.push({ x: PAD + p.c * CELL + CELL / 2, y: PAD + p.r * CELL + 4, text: label ? `${label} +${pts}` : `+${pts}`, life: 1, big: big || !!label });
    this.hooks.onUpdate(this);
  }

  // Geometry and helpers for blast effects.
  geom() { return { CELL, PAD, COLS, ROWS, LW, LH, cx, cy }; }
  tileAt(p) { return inBounds(p.r, p.c) ? this.grid[p.r][p.c] : null; }
  colorAt(p) { const t = this.tileAt(p); return t ? (t.dead ? '#6e6878' : t.sp ? '#ffe27a' : TILE_COLORS[t.t]) : '#fff4e0'; }

  burst(p, color, n) {
    const cx = PAD + p.c * CELL + CELL / 2, cy = PAD + p.r * CELL + CELL / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 0.6 + Math.random() * 1.6;
      this.particles.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.8, life: 1, c: color, s: Math.random() < 0.3 ? 2 : 1 });
    }
    // keep giant chain reactions light on phones
    if (this.particles.length > 500) this.particles.splice(0, this.particles.length - 500);
  }

  // Pixel-dissolve the board away (1) or back in (0) around a mini-game.
  morph(target) {
    const from = this.cover;
    this.hooks.sfx(target ? 'morph' : 'morphBack');
    return tween(target ? 520 : 420, t => (this.cover = from + (target - from) * t));
  }

  // ---------- render ----------
  loop = () => {
    if (!this.running) { this.raf = 0; return; }
    this.update();
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  update() {
    for (const p of this.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= 0.03; }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const f of this.floaters) { f.y -= 0.25; f.life -= f.big ? 0.008 : 0.015; }
    this.floaters = this.floaters.filter(f => f.life > 0);
    this.shake *= 0.88;
    this.flash *= 0.9;
    for (const row of this.grid) for (const t of row) {
      if (!t) continue;
      if (t.sx && t.sx !== 1) { t.sx += (1 - t.sx) * 0.25; t.sy += (1 - t.sy) * 0.25; if (Math.abs(1 - t.sx) < 0.01) t.sx = t.sy = 1; }
    }
    for (const r of this.rings) { r.r += (r.max - r.r) * 0.16 + 0.3; r.life -= 0.04; }
    this.rings = this.rings.filter(r => r.life > 0);
    if (!this.busy && Math.random() < 0.04) {
      const t = this.grid[(Math.random() * ROWS) | 0][(Math.random() * COLS) | 0];
      if (t) this.twinkles.push({ x: PAD + t.x * CELL + 2 + Math.random() * 10, y: PAD + t.y * CELL + 2 + Math.random() * 6, life: 1 });
    }
    for (const w of this.twinkles) w.life -= 0.04;
    this.twinkles = this.twinkles.filter(w => w.life > 0);
    const wait = this.cfg.wand ? 2500 : 6000;
    if (!this.busy && !this.ended && !this.hint && this.moves > 0 && performance.now() - this.lastInput > wait) {
      const moves = this.findMoves();
      if (this.cfg.wand) moves.sort((a, b) => b.size - a.size);
      this.hint = (this.cfg.wand ? moves[0] : moves[Math.floor(Math.random() * moves.length)]) || null;
    }
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = performance.now();
    ctx.save();
    ctx.clearRect(0, 0, LW, LH);
    if (this.shake > 0.5) ctx.translate(Math.round((Math.random() - 0.5) * this.shake), Math.round((Math.random() - 0.5) * this.shake));

    ctx.fillStyle = '#2a1a14'; ctx.fillRect(0, 0, LW, LH);
    ctx.fillStyle = '#6b3d22'; ctx.fillRect(1, 1, LW - 2, LH - 2);
    ctx.fillStyle = '#3a2216'; ctx.fillRect(PAD - 1, PAD - 1, COLS * CELL + 2, ROWS * CELL + 2);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = (r + c) % 2 ? '#4a2e1e' : '#432819';
      ctx.fillRect(PAD + c * CELL, PAD + r * CELL, CELL, CELL);
    }

    const hintIds = this.hint ? [this.grid[this.hint.a.r][this.hint.a.c], this.grid[this.hint.b.r][this.hint.b.c]].map(t => t && t.id) : [];
    const pulse = (Math.sin(now / 90) + 1) / 2;
    const slow = (Math.sin(now / 260) + 1) / 2;

    ctx.save();
    ctx.beginPath(); ctx.rect(PAD, PAD, COLS * CELL, ROWS * CELL); ctx.clip();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.grid[r][c];
      if (!t || t.s <= 0.01) continue;
      let px = Math.round(PAD + t.x * CELL + 1), py = Math.round(PAD + t.y * CELL + 1);
      if (hintIds.includes(t.id)) py += Math.round(Math.sin(now / 110));
      const selected = this.sel && this.sel.r === r && this.sel.c === c && !this.busy;
      if (selected) {
        ctx.fillStyle = 'rgba(10,6,14,0.35)';
        ctx.fillRect(px + 2, py + 11, 9, 2);
        py -= 2 + Math.round(Math.abs(Math.sin(now / 160)));
      }
      if (t.sp && !t.dead) {
        // charged tiles glow so they read as tappable
        ctx.fillStyle = `rgba(255,226,122,${0.18 + slow * 0.3})`;
        ctx.fillRect(PAD + t.x * CELL, PAD + t.y * CELL, CELL, CELL);
      }
      if (t.charged) {
        px += Math.round((Math.random() - 0.5) * 2);
        py += Math.round((Math.random() - 0.5) * 2);
        ctx.fillStyle = `rgba(255,226,122,${0.35 + pulse * 0.45})`;
        ctx.fillRect(PAD + t.x * CELL, PAD + t.y * CELL, CELL, CELL);
      }
      if (t.chest) {
        // the chest shimmers gold so it's easy to spot
        ctx.fillStyle = `rgba(255,226,122,${0.25 + slow * 0.35})`;
        ctx.fillRect(PAD + t.x * CELL, PAD + t.y * CELL, CELL, CELL);
      }
      if (t.mg) {
        ctx.fillStyle = `rgba(240,138,176,${0.2 + slow * 0.35})`;
        ctx.fillRect(PAD + t.x * CELL, PAD + t.y * CELL, CELL, CELL);
      }
      const marked = t.mg && MAGIC_MARK[t.mg];
      const img = t.chest ? CHEST : t.mg && !marked ? MAGIC[t.mg] : t.sp ? SPECIALS[t.sp] : t.dead ? TILES_GREY[t.t] : TILES[t.t];
      if (t.dead) ctx.globalAlpha = 0.5;
      const sw = 12 * t.s * (t.sx || 1), sh = 12 * t.s * (t.sy || 1);
      const dx = px + 6 - sw / 2, dy = (t.sy || 1) < 1 ? py + 12 - sh : py + 6 - sh / 2;
      if (sw !== 12 || sh !== 12) ctx.drawImage(img, dx, dy, sw, sh);
      else ctx.drawImage(img, px, py);
      if (marked) {
        // a star or beam badge in the corner; the tile underneath shows its colour
        ctx.drawImage(MAGIC_MARK[t.mg], dx + 1, dy - 2 + Math.round(slow), sw, sh);
      }
      if (t.flash > 0.02 && !t.sp && !t.dead && !t.chest && !t.mg) {
        ctx.globalAlpha = Math.min(1, t.flash);
        ctx.drawImage(TILES_WHITE[t.t], dx, dy, sw, sh);
      }
      ctx.globalAlpha = 1;
      if (t.sp && !t.dead) {
        const k = Math.floor(now / 140 + t.id) % 24;
        const edge = [[0, 0], [11, 0], [11, 11], [0, 11]][k % 4];
        if (k < 8) { ctx.fillStyle = '#fff8e0'; ctx.fillRect(px + edge[0], py + edge[1], 1, 1); }
        const born = now - (t.born || 0);
        if (born < 600) {
          ctx.fillStyle = `rgba(255,248,224,${1 - born / 600})`;
          ctx.fillRect(px - 1, py - 1, 14, 14);
        }
      }
    }
    ctx.restore();

    if (this.sel) {
      const x = PAD + this.sel.c * CELL, y = PAD + this.sel.r * CELL;
      ctx.fillStyle = pulse > 0.5 ? '#ffe27a' : '#fff4e0';
      ctx.fillRect(x, y, CELL, 1); ctx.fillRect(x, y + CELL - 1, CELL, 1);
      ctx.fillRect(x, y, 1, CELL); ctx.fillRect(x + CELL - 1, y, 1, CELL);
    }

    for (const w of this.twinkles) {
      ctx.globalAlpha = Math.sin(w.life * Math.PI);
      ctx.fillStyle = '#fff8e0';
      const x = Math.round(w.x), y = Math.round(w.y);
      ctx.fillRect(x, y - 1, 1, 3); ctx.fillRect(x - 1, y, 3, 1);
    }
    for (const ring of this.rings) {
      ctx.globalAlpha = Math.max(0, ring.life);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 1 + ring.life * 2;
      ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (const a of this.actors) { ctx.save(); a.draw(ctx, now); ctx.restore(); }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, p.life * 1.5);
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      const pop = 1 + Math.max(0, f.life - 0.85) * 4; // starts big, settles
      ctx.font = `${Math.round((f.big ? 11 : 9) * pop)}px "Jersey 10", monospace`;
      const x = Math.min(LW - 24, Math.max(24, f.x)), y = Math.max(10, Math.round(f.y));
      ctx.fillStyle = '#1a1220'; ctx.fillText(f.text, x + 1, y + 1);
      ctx.fillStyle = f.big ? '#ffe27a' : '#fff4e0'; ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;

    if (this.banner) {
      const age = now - this.banner.t0;
      if (age > 1100) this.banner = null;
      else {
        const s = age < 260 ? ease.outBack(age / 260) : 1;
        ctx.globalAlpha = age > 800 ? 1 - (age - 800) / 300 : 1;
        ctx.font = `${Math.max(1, Math.round(18 * s))}px "Jersey 10", monospace`;
        const y = Math.round(LH * 0.42 - (age > 800 ? (age - 800) / 30 : 0));
        ctx.fillStyle = '#1a1220';
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 2], [1, 2]]) ctx.fillText(this.banner.text, LW / 2 + ox, y + oy);
        ctx.fillStyle = this.banner.color; ctx.fillText(this.banner.text, LW / 2, y);
        ctx.globalAlpha = 1;
      }
    }

    if (this.cover > 0.001) {
      const B = 6, cols = Math.ceil(LW / B), rows = Math.ceil(LH / B);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const order = (((i * 7 + j * 13) % 17) / 17) * 0.6 + (Math.abs(j - rows / 2) / rows) * 0.4;
        if (order >= this.cover) continue;
        ctx.fillStyle = (i + j) % 5 === 0 ? '#3a2a5c' : '#1a1430';
        ctx.fillRect(i * B, j * B, B, B);
      }
    }

    if (this.flash > 0.02) {
      ctx.fillStyle = `rgba(255,248,224,${this.flash * 0.8})`;
      ctx.fillRect(0, 0, LW, LH);
    }
    ctx.restore();
  }
}
