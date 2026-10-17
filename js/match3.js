import { fitCanvas, toLogical, sleep, tween, ease } from './pixel.js';
import { TILES, TILES_WHITE, TILES_GREY, TILE_COLORS } from './sprites.js';

export const COLS = 7, ROWS = 9;
const CELL = 14, PAD = 4;
const LW = COLS * CELL + PAD * 2, LH = ROWS * CELL + PAD * 2;
export const BIG_MATCH = 5;

const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const key = p => p.r * COLS + p.c;
let uid = 0;

export class Board {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.hooks = hooks; // onUpdate(board), onBigMatch(board) -> Promise<'win'|'lose'|'draw'>, onEnd(board, won), sfx(name, arg), toast(msg)
    this.grid = [];
    this.particles = [];
    this.floaters = [];
    this.shake = 0;
    this.flash = 0;
    this.busy = true;
    this.running = false;
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    const up = () => (this.drag = null);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  resize() {
    if (this.running) this.ctx = fitCanvas(this.canvas, LW, LH).ctx;
  }

  start(cfg) {
    this.gen = (this.gen || 0) + 1; // invalidates async work from a previous board
    this.cfg = cfg;
    this.moves = cfg.moves;
    this.score = 0;
    this.blasts = 0;
    this.ended = false;
    this.sel = null;
    this.hint = null;
    this.particles = [];
    this.floaters = [];
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
  newTile(t, c, r) { return { t, x: c, y: r, s: 1, a: 1, charged: false, dead: false, id: ++uid }; }
  T(r, c) { const t = this.grid[r] && this.grid[r][c]; return t ? t.t : -1; }

  fillInitial() {
    do {
      this.grid = [];
      for (let r = 0; r < ROWS; r++) {
        this.grid.push([]);
        for (let c = 0; c < COLS; c++) {
          let t;
          do t = this.rnd();
          while ((c >= 2 && this.T(r, c - 1) === t && this.T(r, c - 2) === t) || (r >= 2 && this.T(r - 1, c) === t && this.T(r - 2, c) === t));
          this.grid[r].push(this.newTile(t, c, r));
        }
      }
    } while (!this.findMoves().length);
  }

  // Groups of connected same-type cells that belong to a line of 3+.
  // A horizontal and a vertical run sharing a cell merge, so L/T shapes count as one large match.
  findGroups() {
    const N = ROWS * COLS;
    const parent = Array.from({ length: N }, (_, i) => i);
    const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
    const inRun = new Uint8Array(N);
    const scan = (outer, inner, at) => {
      for (let o = 0; o < outer; o++) {
        let i = 0;
        while (i < inner) {
          const t = this.T(...at(o, i));
          let e = i + 1;
          while (e < inner && this.T(...at(o, e)) === t) e++;
          if (t >= 0 && e - i >= 3) {
            const [r0, c0] = at(o, i);
            for (let k = i; k < e; k++) {
              const [r, c] = at(o, k);
              inRun[r * COLS + c] = 1;
              union(r * COLS + c, r0 * COLS + c0);
            }
          }
          i = e;
        }
      }
    };
    scan(ROWS, COLS, (r, c) => [r, c]);
    scan(COLS, ROWS, (c, r) => [r, c]);
    const groups = new Map();
    for (let i = 0; i < N; i++) {
      if (!inRun[i]) continue;
      const root = find(i);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push({ r: Math.floor(i / COLS), c: i % COLS });
    }
    return [...groups.values()];
  }

  lineAt(r, c) {
    const t = this.T(r, c);
    if (t < 0) return 0;
    let h = 1, v = 1;
    for (let k = c - 1; k >= 0 && this.T(r, k) === t; k--) h++;
    for (let k = c + 1; k < COLS && this.T(r, k) === t; k++) h++;
    for (let k = r - 1; k >= 0 && this.T(k, c) === t; k--) v++;
    for (let k = r + 1; k < ROWS && this.T(k, c) === t; k++) v++;
    return Math.max(h >= 3 ? h : 0, v >= 3 ? v : 0) + (h >= 3 && v >= 3 ? Math.min(h, v) - 1 : 0);
  }

  findMoves() {
    const moves = [];
    const g = this.grid;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + dr, c2 = c + dc;
        if (!inBounds(r2, c2)) continue;
        [g[r][c], g[r2][c2]] = [g[r2][c2], g[r][c]];
        const size = Math.max(this.lineAt(r, c), this.lineAt(r2, c2));
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
    this.sel = p;
    this.hooks.sfx('select');
    this.drag = { ...p, x: e.clientX, y: e.clientY };
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

  // ---------- turn flow ----------
  async attemptSwap(a, b) {
    const gen = this.gen;
    this.busy = true;
    this.hint = null;
    this.hooks.sfx('swap');
    const A = this.grid[a.r][a.c], B = this.grid[b.r][b.c];
    await this.animSwap(A, B, a, b);
    this.grid[a.r][a.c] = B;
    this.grid[b.r][b.c] = A;
    const groups = this.findGroups();
    if (!groups.length) {
      this.hooks.sfx('nope');
      await this.animSwap(A, B, b, a);
      this.grid[a.r][a.c] = A;
      this.grid[b.r][b.c] = B;
      this.busy = false;
      return;
    }
    this.moves--;
    this.hooks.onUpdate(this);
    await this.resolve(groups, gen);
    if (gen !== this.gen || !this.running || this.checkEnd()) return;
    await this.ensureMoves();
    this.busy = false;
    this.lastInput = performance.now();
  }

  animSwap(A, B, a, b) {
    return tween(130, t => {
      A.x = a.c + (b.c - a.c) * t; A.y = a.r + (b.r - a.r) * t;
      B.x = b.c + (a.c - b.c) * t; B.y = b.r + (a.r - b.r) * t;
    }, ease.inOut);
  }

  async resolve(groups, gen) {
    let combo = 0;
    while (groups.length && this.running && gen === this.gen) {
      combo++;
      const small = groups.filter(g => g.length < BIG_MATCH);
      const big = groups.filter(g => g.length >= BIG_MATCH);
      if (small.length) {
        let pts = 0;
        for (const g of small) pts += g.length * 10 * combo + (g.length === 4 ? 40 : 0);
        const cells = small.flat();
        this.addScore(pts, cells);
        this.hooks.sfx('pop', combo);
        await this.pop(cells);
      }
      for (const g of big) {
        const live = g.filter(p => this.grid[p.r][p.c]);
        if (live.length) await this.bigMatch(live, combo);
        if (gen !== this.gen) return;
      }
      await this.collapse();
      groups = this.findGroups();
    }
  }

  // The large match is held, glowing, until the mini-game is decided.
  async bigMatch(cells, combo) {
    const tiles = cells.map(p => this.grid[p.r][p.c]);
    tiles.forEach(t => (t.charged = true));
    this.hooks.sfx('charge');
    await sleep(750);
    const result = await this.hooks.onBigMatch(this);
    tiles.forEach(t => (t.charged = false));
    if (!this.running || this.grid[cells[0].r][cells[0].c] !== tiles[0]) return;

    if (result === 'win') {
      const cr = cells.reduce((s, p) => s + p.r, 0) / cells.length;
      const cc = cells.reduce((s, p) => s + p.c, 0) / cells.length;
      const center = cells.reduce((best, p) => (Math.hypot(p.r - cr, p.c - cc) < Math.hypot(best.r - cr, best.c - cc) ? p : best));
      const area = new Map(cells.map(p => [key(p), p]));
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const p = { r: center.r + dr, c: center.c + dc };
        if (inBounds(p.r, p.c) && this.grid[p.r][p.c]) area.set(key(p), p);
      }
      const all = [...area.values()];
      this.blasts++;
      this.hooks.sfx('boom');
      this.shake = 10;
      this.flash = 1;
      this.addScore(300 + all.length * 15 * combo, [center], 'BLAST!');
      this.hooks.onUpdate(this);
      await this.pop(all, center);
    } else {
      tiles.forEach(t => (t.dead = true));
      this.hooks.sfx('fizzle');
      await sleep(350);
      this.addScore(cells.length * 5, cells, 'fizzle');
      await this.pop(cells);
    }
  }

  async pop(cells, center) {
    const items = cells.map(p => ({ p, tile: this.grid[p.r][p.c], burst: false })).filter(x => x.tile);
    const delay = x => (center ? (Math.abs(x.p.r - center.r) + Math.abs(x.p.c - center.c)) * 45 : 0);
    const dur = 190;
    const total = dur + Math.max(0, ...items.map(delay));
    await tween(total, t => {
      const now = t * total;
      for (const x of items) {
        const lt = Math.min(1, Math.max(0, (now - delay(x)) / dur));
        if (lt > 0 && !x.burst) {
          x.burst = true;
          this.burst(x.p, x.tile.dead ? '#6e6878' : TILE_COLORS[x.tile.t], center ? 9 : 5);
        }
        x.tile.s = lt < 0.3 ? 1 + lt : 1.3 * (1 - (lt - 0.3) / 0.7);
      }
    });
    for (const x of items) this.grid[x.p.r][x.p.c] = null;
  }

  async collapse() {
    const moving = [];
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        const t = this.grid[r][c];
        if (!t) continue;
        if (r !== write) { this.grid[write][c] = t; this.grid[r][c] = null; }
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
    const dist = Math.max(...moving.map(t => t.toY - t.fromY));
    await tween(120 + dist * 45, k => {
      for (const t of moving) t.y = t.fromY + (t.toY - t.fromY) * k;
    }, ease.inQuad);
    for (const t of moving) t.y = t.toY;
    this.hooks.sfx('land');
  }

  async ensureMoves() {
    if (this.findMoves().length) return;
    this.hooks.toast('No moves left. Shuffling!');
    await sleep(500);
    const tiles = this.grid.flat();
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
    if (won || this.moves <= 0) {
      this.ended = true;
      this.hooks.onEnd(this, won);
      return true;
    }
    return false;
  }

  addScore(pts, cells, label) {
    this.score += pts;
    const p = cells[Math.floor(cells.length / 2)];
    this.floaters.push({ x: PAD + p.c * CELL + CELL / 2, y: PAD + p.r * CELL + 4, text: label ? `${label} +${pts}` : `+${pts}`, life: 1, big: !!label });
    this.hooks.onUpdate(this);
  }

  burst(p, color, n) {
    const cx = PAD + p.c * CELL + CELL / 2, cy = PAD + p.r * CELL + CELL / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 0.6 + Math.random() * 1.6;
      this.particles.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.8, life: 1, c: color, s: Math.random() < 0.3 ? 2 : 1 });
    }
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
    if (!this.busy && !this.ended && !this.hint && performance.now() - this.lastInput > 6000) {
      const moves = this.findMoves();
      this.hint = moves[Math.floor(Math.random() * moves.length)] || null;
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

    ctx.save();
    ctx.beginPath(); ctx.rect(PAD, PAD, COLS * CELL, ROWS * CELL); ctx.clip();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.grid[r][c];
      if (!t || t.s <= 0.01) continue;
      let px = Math.round(PAD + t.x * CELL + 1), py = Math.round(PAD + t.y * CELL + 1);
      if (hintIds.includes(t.id)) py += Math.round(Math.sin(now / 110));
      if (t.charged) {
        px += Math.round((Math.random() - 0.5) * 2);
        py += Math.round((Math.random() - 0.5) * 2);
        ctx.fillStyle = `rgba(255,226,122,${0.35 + pulse * 0.45})`;
        ctx.fillRect(PAD + t.x * CELL, PAD + t.y * CELL, CELL, CELL);
      }
      const img = t.dead ? TILES_GREY[t.t] : TILES[t.t];
      if (t.s !== 1) {
        const w = 12 * t.s;
        ctx.drawImage(img, px + 6 - w / 2, py + 6 - w / 2, w, w);
      } else ctx.drawImage(img, px, py);
      if (t.charged) {
        ctx.globalAlpha = pulse * 0.7;
        ctx.drawImage(TILES_WHITE[t.t], px, py);
        ctx.globalAlpha = 1;
      }
    }
    // little sparks between charged tiles
    const charged = this.grid.flat().filter(t => t && t.charged);
    if (charged.length) {
      ctx.fillStyle = '#fff8e0';
      for (let i = 0; i < 6; i++) {
        const t = charged[(Math.random() * charged.length) | 0];
        ctx.fillRect(Math.round(PAD + t.x * CELL + Math.random() * CELL), Math.round(PAD + t.y * CELL + Math.random() * CELL), 1, 1);
      }
    }
    ctx.restore();

    if (this.sel) {
      const x = PAD + this.sel.c * CELL, y = PAD + this.sel.r * CELL;
      ctx.fillStyle = pulse > 0.5 ? '#ffe27a' : '#fff4e0';
      ctx.fillRect(x, y, CELL, 1); ctx.fillRect(x, y + CELL - 1, CELL, 1);
      ctx.fillRect(x, y, 1, CELL); ctx.fillRect(x + CELL - 1, y, 1, CELL);
    }

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
      ctx.font = `${f.big ? 11 : 9}px "Jersey 10", monospace`;
      const x = Math.min(LW - 24, Math.max(24, f.x)), y = Math.max(10, Math.round(f.y));
      ctx.fillStyle = '#1a1220'; ctx.fillText(f.text, x + 1, y + 1);
      ctx.fillStyle = f.big ? '#ffe27a' : '#fff4e0'; ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;

    if (this.flash > 0.02) {
      ctx.fillStyle = `rgba(255,248,224,${this.flash * 0.8})`;
      ctx.fillRect(0, 0, LW, LH);
    }
    ctx.restore();
  }
}
