// A rainy sky seen through glass: sky, hills, pines, rain, lightning, drops on the pane.
const PALETTES = {
  night: { sky: ['#141c34', '#19223e', '#1d2848'], flash: ['#5a6a9a', '#4a5a8a', '#3a4a78'], hill: '#111a30', tree: '#0b1324', rain: 'rgba(140,170,220,0.55)' },
  dawn: { sky: ['#6a7698', '#7c86a4', '#9a98aa'], flash: ['#b8c0dc', '#a8b0cc', '#9aa0bc'], hill: '#4a5672', tree: '#36405a', rain: 'rgba(230,236,250,0.5)' },
};

export class RainWindow {
  constructor(w, h, { onThunder, trees = true, palette = 'night' } = {}) {
    this.w = w; this.h = h; this.onThunder = onThunder;
    this.pal = PALETTES[palette];
    this.moon = false;
    this.saturn = false;
    this.drops = Array.from({ length: Math.floor((w * h) / 45) }, () => this.newDrop(true));
    this.glass = Array.from({ length: Math.max(3, ((w * h) / 260) | 0) }, () => ({
      x: (Math.random() * w) | 0, y: Math.random() * h, v: 0.01 + Math.random() * 0.04, slide: 0,
    }));
    this.hills = Array.from({ length: w }, (_, i) => Math.round(7 + 3 * Math.sin(i * 0.13) + 2 * Math.sin(i * 0.41 + 1)));
    this.trees = trees ? [[0.12, 14], [0.3, 10], [0.62, 16], [0.85, 11]].map(([fx, th]) => [Math.round(fx * w), th]) : [];
    this.flashes = [];
    this.nextBolt = performance.now() + 5000 + Math.random() * 8000;
  }
  newDrop(init) {
    return { x: Math.random() * (this.w + 12), y: init ? Math.random() * this.h : -4 - Math.random() * 8, v: 1.3 + Math.random() * 1.5, l: 2 + ((Math.random() * 3) | 0) };
  }
  strike(now = performance.now()) {
    this.flashes = [now, now + 140];
    this.nextBolt = now + 9000 + Math.random() * 15000;
    setTimeout(() => this.onThunder && this.onThunder(), 350 + Math.random() * 500);
  }
  flashLevel(now) {
    let f = 0;
    for (const t of this.flashes) if (now >= t) f = Math.max(f, Math.max(0, 1 - (now - t) / 260));
    return f;
  }
  update(now) {
    for (const d of this.drops) {
      d.y += d.v; d.x -= d.v * 0.3;
      if (d.y > this.h) Object.assign(d, this.newDrop(false));
    }
    for (const g of this.glass) {
      if (g.slide <= 0 && Math.random() < 0.004) g.slide = 20 + Math.random() * 30;
      g.y += g.slide > 0 ? 0.5 : g.v;
      g.slide--;
      if (g.y > this.h) { g.y = -2; g.x = (Math.random() * this.w) | 0; }
    }
    if (now > this.nextBolt) this.strike(now);
  }
  draw(ctx, x, y, now) {
    const { w, h } = this;
    const f = this.flashLevel(now);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const P = this.pal, sky = f > 0.3 ? P.flash : P.sky;
    ctx.fillStyle = sky[0]; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = sky[1]; ctx.fillRect(x, y + (h * 0.35 | 0), w, h);
    ctx.fillStyle = sky[2]; ctx.fillRect(x, y + (h * 0.6 | 0), w, h);
    if (this.moon) {
      const mx = x + Math.round(w * 0.74), my = y + 9;
      ctx.fillStyle = 'rgba(242,230,201,0.12)'; disc(ctx, mx, my, 8);
      ctx.fillStyle = '#f2e6c9'; disc(ctx, mx, my, 4);
      ctx.fillStyle = '#d8c8a8'; ctx.fillRect(mx - 1, my - 1, 2, 2); ctx.fillRect(mx + 1, my + 2, 1, 1);
    }
    if (this.saturn) {
      const sx = x + Math.round(w * 0.24), sy = y + 12;
      ctx.fillStyle = 'rgba(164,106,208,0.18)'; disc(ctx, sx, sy, 7);
      ctx.fillStyle = '#c8a0ec'; disc(ctx, sx, sy, 3);
      ctx.fillStyle = '#efdcb4'; ctx.fillRect(sx - 7, sy, 15, 1); ctx.fillRect(sx - 5, sy + 1, 2, 1); ctx.fillRect(sx + 4, sy - 1, 2, 1);
    }
    ctx.fillStyle = P.hill;
    for (let i = 0; i < w; i++) ctx.fillRect(x + i, y + h - this.hills[i], 1, this.hills[i]);
    ctx.fillStyle = P.tree;
    for (const [tx, th] of this.trees) {
      const base = y + h - 4;
      for (let k = 0; k < th; k++) {
        const hw = Math.floor((k % 5) / 1.6 + k / 4);
        ctx.fillRect(x + tx - hw, base - th + k, hw * 2 + 1, 1);
      }
      ctx.fillRect(x + tx, base, 1, 4);
    }
    ctx.fillStyle = P.rain;
    for (const d of this.drops) {
      for (let i = 0; i < d.l; i++) ctx.fillRect(x + ((d.x - i * 0.3) | 0), y + ((d.y + i) | 0), 1, 1);
    }
    if (f > 0) { ctx.fillStyle = `rgba(220,230,255,${f * 0.5})`; ctx.fillRect(x, y, w, h); }
    for (const g of this.glass) {
      ctx.fillStyle = '#7fa2cc'; ctx.fillRect(x + g.x, y + (g.y | 0), 1, 2);
      ctx.fillStyle = '#d8e8fa'; ctx.fillRect(x + g.x, y + (g.y | 0), 1, 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 6; i++) ctx.fillRect(x + 3 + i, y + 2 + i * 2, 1, 2);
    ctx.restore();
    return f;
  }
}

function disc(ctx, cx, cy, r) {
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.round(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
}
