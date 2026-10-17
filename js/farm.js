import { fitCanvas, toLogical, hash } from './pixel.js';
import { RainWindow } from './rainview.js';
import { S, persist } from './state.js';
import { CROPS, DELIVERY_CONTACT } from './data.js';
import { CROPS_SPR, ICONS } from './sprites.js';
import { h, icon, showModal, toast } from './ui.js';

const LW = 144, LH = 208;
const PW = 52, PH = 36;
const PLOTS = [[12, 62], [80, 62], [12, 100], [80, 100], [12, 138], [80, 138]];
const SKY = { x: 56, y: 8, w: 32, h: 26 };
const FLOOR = 180;

export function cropProgress(plot) {
  if (!plot.crop) return 0;
  return Math.min(1, plot.nights / CROPS[plot.crop].nights);
}

// Called when you sleep: the leaky roof waters everything overnight.
export function growOvernight() {
  for (const p of S.plots) if (p.crop) p.nights = Math.min(CROPS[p.crop].nights, p.nights + 1);
}

export class Attic {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.hooks = hooks; // onHatch, changed, sfx
    this.win = new RainWindow(SKY.w, SKY.h, { trees: false, onThunder: () => hooks.sfx('thunder') });
    this.drips = [];
    this.floaters = [];
    this.active = false;
    canvas.addEventListener('pointerdown', e => this.tap(toLogical(canvas, LW, LH, e)));
  }

  setActive(on) {
    this.active = on;
    if (on) { this.resize(); if (!this.raf) this.loop(); }
  }

  resize() {
    if (this.active) this.ctx = fitCanvas(this.canvas, LW, LH).ctx;
  }

  loop = () => {
    if (!this.active) { this.raf = 0; return; }
    const now = performance.now();
    this.win.update(now);
    this.update();
    this.draw(now);
    this.raf = requestAnimationFrame(this.loop);
  };

  // ---------- interaction ----------
  tap(p) {
    if (p.y > FLOOR + 4 && p.x > 52 && p.x < 92) return this.hooks.onHatch();
    const i = PLOTS.findIndex(([x, y]) => p.x >= x && p.x <= x + PW && p.y >= y && p.y <= y + PH);
    if (i < 0) return;
    const plot = S.plots[i];
    if (i >= S.plotsOwned) return this.buyPlot(i);
    if (!plot.crop) return this.choosePlant(i);
    if (cropProgress(plot) >= 1) return this.harvest(i);
    const left = CROPS[plot.crop].nights - plot.nights;
    toast(`${CROPS[plot.crop].name}: ready after ${left} more night${left > 1 ? 's' : ''} of rain.`);
  }

  buyPlot(i) {
    if (i !== S.plotsOwned) return toast('Build the planter before this one first.');
    if (!S.mats.kit) return toast(`You need a planter kit. Call ${DELIVERY_CONTACT} tonight.`);
    showModal({
      title: 'Build a planter',
      body: h('p', {}, 'Unpack the kit, hammer it together, fill it with soil. ', h('span', { class: 'cost' }, icon('kit'), ' 1')),
      buttons: [
        { label: 'Not now' },
        {
          label: 'Build it', cls: 'primary',
          onClick: () => {
            S.mats.kit--; S.plotsOwned++; persist();
            this.hooks.sfx('plant'); this.hooks.changed();
          },
        },
      ],
    });
  }

  choosePlant(i) {
    const rows = Object.entries(CROPS).map(([id, c]) =>
      h('div', { class: 'shop-row' },
        h('div', { class: 'shop-ico' }, icon(id, 'ico big')),
        h('div', { class: 'shop-info' },
          h('b', {}, `${c.name} seeds ×${S.seeds[id]}`),
          h('small', {}, `Ready after ${c.nights} night${c.nights > 1 ? 's' : ''} · yields ${c.yield}`)),
        h('button', {
          class: 'btn small primary', disabled: !S.seeds[id],
          onclick: () => { close(); this.plant(i, id); },
        }, 'Plant')));
    const none = !Object.values(S.seeds).some(Boolean);
    const close = showModal({
      title: 'Plant seeds',
      body: h('div', {}, none && h('p', { class: 'note' }, `No seeds. ${DELIVERY_CONTACT} delivers them if you call tonight.`), h('div', { class: 'shop' }, rows)),
      buttons: [{ label: 'Close' }],
    });
  }

  plant(i, id) {
    if (!S.seeds[id]) return;
    S.seeds[id]--;
    S.plots[i] = { crop: id, nights: 0 };
    persist();
    this.hooks.sfx('plant');
    this.hooks.changed();
  }

  harvest(i) {
    const plot = S.plots[i];
    const c = CROPS[plot.crop];
    S.crops[plot.crop] += c.yield;
    const [x, y] = PLOTS[i];
    this.floaters.push({ x: x + PW / 2, y: y + 8, crop: plot.crop, n: c.yield, life: 1 });
    S.plots[i] = { crop: null, nights: 0 };
    persist();
    this.hooks.sfx('harvest');
    this.hooks.changed();
  }

  // ---------- simulation ----------
  update() {
    for (let i = 0; i < S.plotsOwned; i++) {
      if (!S.plots[i].crop || cropProgress(S.plots[i]) >= 1) continue;
      if (Math.random() < 0.008) {
        const [x, y] = PLOTS[i];
        this.drips.push({ x: x + 10 + Math.floor(Math.random() * 3) * 16, y: 46, to: y + 24, v: 0.5, splash: 0 });
      }
    }
    for (const d of this.drips) {
      if (d.splash) { d.splash++; continue; }
      d.v += 0.08; d.y += d.v;
      if (d.y >= d.to) { d.y = d.to; d.splash = 1; if (Math.random() < 0.3) this.hooks.sfx('drip'); }
    }
    this.drips = this.drips.filter(d => d.splash < 10);
    for (const f of this.floaters) { f.y -= 0.3; f.life -= 0.012; }
    this.floaters = this.floaters.filter(f => f.life > 0);
  }

  draw(now) {
    const ctx = this.ctx;
    if (!ctx) return;
    const R = (c, x, y, w, hh) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, hh); };

    for (let x = 0, i = 0; x < LW; x += 12, i++) {
      R(i % 2 ? '#4a2e1e' : '#442a1b', x, 0, 12, FLOOR);
      R('#3a2216', x, 0, 1, FLOOR);
    }
    // sloped roof
    for (let y = 0; y < 58; y++) {
      const w = 58 - y;
      R('#24160f', 0, y, w, 1); R('#24160f', LW - w, y, w, 1);
      R('#6b3d22', w - 2, y, 3, 1); R('#6b3d22', LW - w - 1, y, 3, 1);
      if (y % 10 === 0) { R('#3a2216', 0, y, w, 1); R('#3a2216', LW - w, y, w, 1); }
    }
    R('#24160f', 58, 0, 28, 6);
    // skylight
    R('#6b3d22', SKY.x - 3, SKY.y - 3, SKY.w + 6, SKY.h + 6);
    R('#a0663a', SKY.x - 2, SKY.y - 2, SKY.w + 4, SKY.h + 4);
    const flash = this.win.draw(ctx, SKY.x, SKY.y, now);
    R('#a0663a', SKY.x + SKY.w / 2 - 1, SKY.y, 2, SKY.h);
    // leaky ceiling stains
    R('#2e1c12', 20, 44, 6, 2); R('#2e1c12', 112, 46, 8, 2); R('#2e1c12', 66, 42, 10, 2);

    // floor + hatch
    for (let y = FLOOR, row = 0; y < LH; y += 8, row++) {
      R(row % 2 ? '#6e4228' : '#664026', 0, y, LW, 8);
      R('#4e2e1c', 0, y, LW, 1);
    }
    R('#3a2216', 0, FLOOR - 2, LW, 2);
    R('#1a0f0c', 58, 188, 28, 14); R('#f4c27a', 60, 190, 24, 10);
    R('#6b3d22', 63, 190, 2, 10); R('#6b3d22', 79, 190, 2, 10);
    R('#8a5a34', 63, 193, 18, 1); R('#8a5a34', 63, 197, 18, 1);
    if (Math.floor(now / 600) % 2) { R('#fff4e0', 71, 204, 2, 1); R('#fff4e0', 70, 203, 4, 1); }

    // planters
    PLOTS.forEach(([x, y], i) => {
      const plot = S.plots[i];
      const owned = i < S.plotsOwned;
      ctx.globalAlpha = owned ? 1 : 0.35;
      R('#3a2216', x, y + 21, PW, 15);
      R('#7a4a2c', x + 1, y + 22, PW - 2, 13); R('#a0663a', x + 1, y + 22, PW - 2, 2);
      R('#5a3622', x + 1, y + 29, PW - 2, 1);
      R('#2e1c12', x + 3, y + 24, PW - 6, 3);
      ctx.globalAlpha = 1;
      if (!owned) {
        if (i === S.plotsOwned) ctx.drawImage(S.mats.kit ? ICONS.kit : ICONS.lock, x + PW / 2 - 4, y + 8);
        return;
      }
      if (!plot.crop) {
        if (Math.floor(now / 700) % 2) { R('#a8d870', x + PW / 2 - 1, y + 14, 3, 1); R('#a8d870', x + PW / 2, y + 13, 1, 3); }
        return;
      }
      const prog = cropProgress(plot);
      const spr = prog >= 1 ? CROPS_SPR[plot.crop] : prog >= 0.4 ? CROPS_SPR.young : CROPS_SPR.sprout;
      for (let k = 0; k < 3; k++) {
        const sway = prog >= 1 && Math.floor(now / 500 + k) % 4 === 0 ? 1 : 0;
        ctx.drawImage(spr, x + 6 + k * 16 + sway, y + 25 - spr.height);
      }
      if (prog < 1) {
        R('#1a1220', x + 4, y + 33, PW - 8, 2);
        R('#6fb04a', x + 4, y + 33, Math.round((PW - 8) * prog), 2);
      } else {
        for (let k = 0; k < 3; k++) {
          if ((Math.floor(now / 200) + k * 3 + i) % 5) continue;
          R('#ffe27a', x + 4 + Math.floor(hash(k + i * 3 + Math.floor(now / 1000)) * (PW - 8)), y + 2 + k * 4, 1, 1);
        }
      }
    });

    for (const d of this.drips) {
      if (d.splash) {
        R('#9fd3f2', d.x - d.splash / 2, d.y - 1, 1, 1);
        R('#9fd3f2', d.x + 1 + d.splash / 2, d.y - 1, 1, 1);
      } else R('#9fd3f2', d.x, Math.round(d.y), 1, 2);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '10px "Jersey 10", monospace';
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.drawImage(ICONS[f.crop], Math.round(f.x - 10), Math.round(f.y - 4));
      ctx.fillStyle = '#1a1220'; ctx.fillText(`+${f.n}`, f.x + 5, f.y + 1);
      ctx.fillStyle = '#fff4e0'; ctx.fillText(`+${f.n}`, f.x + 4, f.y);
    }
    ctx.globalAlpha = 1;

    R('rgba(12,8,28,0.22)', 0, 0, LW, LH);
    const g = ctx.createRadialGradient(72, 195, 2, 72, 195, 60);
    g.addColorStop(0, 'rgba(255,190,110,0.22)');
    g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 130, LW, 78);
    if (flash > 0) R(`rgba(200,215,255,${flash * 0.2})`, 0, 0, LW, LH);
  }
}
