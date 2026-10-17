import { fitCanvas, toLogical, hash } from './pixel.js';
import { RainWindow } from './rainview.js';
import { S, persist } from './state.js';
import { CROPS, PLANTERS, WALLS, SPOTS_PER_WALL, DELIVERY_CONTACT } from './data.js';
import { CROPS_SPR, ICONS } from './sprites.js';
import { h, icon, showModal, toast } from './ui.js';

const LW = 144, LH = 208;
const SW = 60, SH = 50; // planter spot size
const SPOTS = [[8, 64], [76, 64], [8, 120], [76, 120]];
const FLOOR = 180;
const CROP_COLORS = { wheat: '#e8d070', cotton: '#fff4e0', flowers: '#f08ab0', pumpkin: '#f08a2a' };

export const nightsNeeded = p => Math.max(1, CROPS[p.crop].nights - (PLANTERS[p.level].faster ? 1 : 0));
export const cropProgress = p => (p.crop ? Math.min(1, p.nights / nightsNeeded(p)) : 0);
export const harvestSize = p => CROPS[p.crop].yield * PLANTERS[p.level].plants;

// Called when you sleep: the leaky roof waters everything overnight.
export function growOvernight() {
  for (const p of S.planters) if (p.level && p.crop) p.nights = Math.min(nightsNeeded(p), p.nights + 1);
}

const have = k => (k in S.mats ? S.mats[k] : k === 'coins' ? S.coins : 0);
const canPay = cost => Object.entries(cost).every(([k, n]) => have(k) >= n);
function pay(cost) {
  for (const [k, n] of Object.entries(cost)) { if (k === 'coins') S.coins -= n; else S.mats[k] -= n; }
}
const costChips = cost => h('span', { class: 'costs' }, Object.entries(cost).map(([k, n]) =>
  h('span', { class: 'cost' + (have(k) < n ? ' short' : '') }, icon(k === 'coins' ? 'coin' : k), n)));

export class Attic {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.hooks = hooks; // onHatch, changed, sfx, onWall(index)
    this.wall = 0;
    this.sky = new RainWindow(32, 26, { trees: false, onThunder: () => hooks.sfx('thunder') });
    this.round = new RainWindow(26, 26, { trees: true });
    this.drips = [];
    this.floaters = [];
    this.parts = [];
    this.active = false;
    let down = null;
    canvas.addEventListener('pointerdown', e => (down = { x: e.clientX, y: e.clientY }));
    canvas.addEventListener('pointerup', e => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) return this.turn(dx < 0 ? 1 : -1);
      this.tap(toLogical(canvas, LW, LH, e));
    });
  }

  setActive(on) {
    this.active = on;
    if (on) { this.resize(); this.hooks.onWall(this.wall); if (!this.raf) this.loop(); }
  }

  resize() {
    if (this.active) this.ctx = fitCanvas(this.canvas, LW, LH).ctx;
  }

  turn(dir) {
    this.wall = (this.wall + dir + WALLS.length) % WALLS.length;
    this.drips = [];
    this.floaters = [];
    this.parts = [];
    this.slide = dir;
    this.slideAt = performance.now();
    this.hooks.sfx('select');
    this.hooks.onWall(this.wall);
  }

  spot(k) { return this.wall * SPOTS_PER_WALL + k; }

  // Particles from a planter on the current wall: 'leaves', 'dirt' or 'gold'.
  spray(i, kind, crop) {
    const k = i - this.wall * SPOTS_PER_WALL;
    if (k < 0 || k >= SPOTS_PER_WALL) return;
    const [x, y] = SPOTS[k];
    const colors = { leaves: ['#6fb04a', '#a8d870', '#3d7a34', CROP_COLORS[crop] || '#ffe27a'], dirt: ['#5a3622', '#7a4a2c', '#2e1c12'], gold: ['#ffe27a', '#fff4e0', '#f39a3a'] }[kind];
    for (let n = 0; n < (kind === 'dirt' ? 10 : 16); n++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = 0.8 + Math.random() * 1.6;
      this.parts.push({ x: x + SW / 2 + (Math.random() - 0.5) * 20, y: y + SH - 18, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: colors[n % colors.length], life: 1 });
    }
  }

  loop = () => {
    if (!this.active) { this.raf = 0; return; }
    const now = performance.now();
    this.sky.update(now);
    this.round.update(now);
    this.update();
    this.draw(now);
    this.raf = requestAnimationFrame(this.loop);
  };

  // ---------- interaction ----------
  tap(p) {
    if (this.wall === 2 && p.y > FLOOR + 4 && p.x > 52 && p.x < 92) return this.hooks.onHatch();
    const k = SPOTS.findIndex(([x, y]) => p.x >= x && p.x <= x + SW && p.y >= y && p.y <= y + SH);
    if (k < 0) return;
    const i = this.spot(k), pl = S.planters[i];
    if (!pl.level) return this.build(i);
    if (pl.crop && cropProgress(pl) >= 1) return this.harvest(i, k);
    this.menu(i);
  }

  build(i) {
    if (!S.mats.kit) return toast(`An empty spot. A planter kit from ${DELIVERY_CONTACT} builds a clay pot here.`);
    showModal({
      title: 'Build a planter',
      body: h('p', {}, 'Unpack a kit and pot up a clay pot in this spot. ', h('span', { class: 'cost' }, icon('kit'), ' 1')),
      buttons: [
        { label: 'Not now' },
        {
          label: 'Build it', cls: 'primary',
          onClick: () => {
            S.mats.kit--;
            S.planters[i] = { level: 1, crop: null, nights: 0 };
            persist();
            this.hooks.sfx('plant');
            this.hooks.changed();
          },
        },
      ],
    });
  }

  // Planter menu: plant seeds if empty, check on growth, and upgrade.
  menu(i) {
    const pl = S.planters[i];
    const lv = PLANTERS[pl.level];
    const next = PLANTERS[pl.level + 1];
    const parts = [];
    if (pl.crop) {
      const left = nightsNeeded(pl) - pl.nights;
      parts.push(h('p', {}, `${CROPS[pl.crop].name} is growing. Ready after ${left} more night${left > 1 ? 's' : ''}, giving ${harvestSize(pl)}.`));
    } else {
      parts.push(h('p', { class: 'muted small' }, `One seed packet plants ${lv.plants === 1 ? 'the pot' : `all ${lv.plants} plants`}.`));
      if (!Object.values(S.seeds).some(Boolean)) parts.push(h('p', { class: 'note' }, `No seeds. ${DELIVERY_CONTACT} delivers them if you call.`));
      parts.push(h('div', { class: 'shop' }, Object.entries(CROPS).map(([id, c]) => {
        const nn = Math.max(1, c.nights - (lv.faster ? 1 : 0));
        return h('div', { class: 'shop-row' },
          h('div', { class: 'shop-ico' }, icon(id, 'ico big')),
          h('div', { class: 'shop-info' },
            h('b', {}, `${c.name} seeds ×${S.seeds[id]}`),
            h('small', {}, `Ready after ${nn} night${nn > 1 ? 's' : ''} · harvest ${c.yield * lv.plants}`)),
          h('button', { class: 'btn small primary', disabled: !S.seeds[id], onclick: () => { close(); this.plant(i, id); } }, 'Plant'));
      })));
    }
    if (next) {
      parts.push(h('div', { class: 'upgrade' },
        h('div', { class: 'shop-info' },
          h('b', {}, `Upgrade to ${next.name}`),
          h('small', {}, `Holds ${next.plants} plants${next.faster ? ', and crops grow a night faster' : ''}.`),
          costChips(next.upgrade)),
        h('button', { class: 'btn small primary', disabled: !canPay(next.upgrade), onclick: () => { close(); this.upgrade(i); } }, 'Upgrade')));
    } else {
      parts.push(h('p', { class: 'muted small' }, 'Fully upgraded. Nothing grows faster than a greenhouse bed.'));
    }
    const close = showModal({ title: `${lv.name} · level ${pl.level}`, body: h('div', {}, parts), buttons: [{ label: 'Close' }] });
  }

  plant(i, id) {
    if (!S.seeds[id]) return;
    S.seeds[id]--;
    S.planters[i] = { ...S.planters[i], crop: id, nights: 0 };
    persist();
    this.spray(i, 'dirt');
    this.hooks.sfx('plant');
    this.hooks.changed();
  }

  upgrade(i) {
    const pl = S.planters[i], next = PLANTERS[pl.level + 1];
    if (!next || !canPay(next.upgrade)) return;
    pay(next.upgrade);
    pl.level++;
    if (pl.crop) pl.nights = Math.min(pl.nights, nightsNeeded(pl));
    persist();
    this.spray(i, 'gold');
    this.hooks.sfx('sparkle');
    this.hooks.changed();
    toast(`Upgraded to a ${next.name}!`);
  }

  harvest(i, k) {
    const pl = S.planters[i];
    const n = harvestSize(pl);
    S.crops[pl.crop] += n;
    const [x, y] = SPOTS[k];
    this.floaters.push({ x: x + SW / 2, y: y + 10, crop: pl.crop, n, life: 1 });
    this.spray(i, 'leaves', pl.crop);
    S.planters[i] = { level: pl.level, crop: null, nights: 0 };
    persist();
    this.hooks.sfx('harvest');
    this.hooks.changed();
  }

  // ---------- simulation ----------
  update() {
    SPOTS.forEach(([x, y], k) => {
      const pl = S.planters[this.spot(k)];
      if (!pl.level || !pl.crop || cropProgress(pl) >= 1 || Math.random() > 0.008) return;
      this.drips.push({ x: x + 14 + Math.floor(Math.random() * 32), y: 50, to: y + 30, v: 0.5, splash: 0 });
    });
    for (const d of this.drips) {
      if (d.splash) { d.splash++; continue; }
      d.v += 0.08; d.y += d.v;
      if (d.y >= d.to) { d.y = d.to; d.splash = 1; if (Math.random() < 0.3) this.hooks.sfx('drip'); }
    }
    this.drips = this.drips.filter(d => d.splash < 10);
    for (const f of this.floaters) { f.y -= 0.3; f.life -= 0.012; }
    for (const q of this.parts) { q.x += q.vx; q.y += q.vy; q.vy += 0.09; q.life -= 0.025; }
    this.parts = this.parts.filter(q => q.life > 0);
    this.floaters = this.floaters.filter(f => f.life > 0);
  }

  drawWall(R, now) {
    const ctx = this.ctx;
    for (let x = 0, i = 0; x < LW; x += 12, i++) {
      R(i % 2 ? '#4a2e1e' : '#442a1b', x, 0, 12, FLOOR);
      R('#3a2216', x, 0, 1, FLOOR);
    }
    for (let y = 0; y < 58; y++) {
      const w = 58 - y;
      R('#24160f', 0, y, w, 1); R('#24160f', LW - w, y, w, 1);
      R('#6b3d22', w - 2, y, 3, 1); R('#6b3d22', LW - w - 1, y, 3, 1);
      if (y % 10 === 0) { R('#3a2216', 0, y, w, 1); R('#3a2216', LW - w, y, w, 1); }
    }
    R('#24160f', 58, 0, 28, 6);
    let flash = 0;
    if (this.wall === 0) {
      // north: the skylight
      R('#6b3d22', 53, 5, 38, 32); R('#a0663a', 54, 6, 36, 30);
      flash = this.sky.draw(ctx, 56, 8, now);
      R('#a0663a', 71, 8, 2, 26);
    } else if (this.wall === 1) {
      // east: a round window
      ctx.save();
      ctx.beginPath(); ctx.arc(72, 30, 13, 0, Math.PI * 2); ctx.clip();
      flash = this.round.draw(ctx, 59, 17, now);
      ctx.restore();
      ctx.strokeStyle = '#a0663a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(72, 30, 14, 0, Math.PI * 2); ctx.stroke();
      R('#a0663a', 71, 16, 2, 28); R('#a0663a', 58, 29, 28, 2);
    } else if (this.wall === 2) {
      // south: a hanging lantern over the hatch
      R('#2a1a14', 71, 0, 1, 22);
      const glow = 0.18 + Math.sin(now / 400) * 0.04;
      R('#3a2216', 67, 22, 10, 2); R('#f4c27a', 68, 24, 8, 9); R('#3a2216', 67, 33, 10, 2); R('#ffe27a', 71, 26, 2, 5);
      const g = ctx.createRadialGradient(72, 28, 2, 72, 28, 50);
      g.addColorStop(0, `rgba(255,200,120,${glow})`); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fillRect(22, 0, 100, 80);
    } else {
      // west: drying herbs on a string
      R('#2a1a14', 30, 22, 84, 1);
      for (let k = 0; k < 6; k++) {
        const x = 36 + k * 14, sway = Math.round(Math.sin(now / 900 + k) * 0.6);
        R('#3d7a34', x + sway, 23, 1, 6); R(k % 2 ? '#6fb04a' : '#a8d870', x - 2 + sway, 27, 5, 4);
        R(['#f08ab0', '#ffe27a', '#d8c4f0'][k % 3], x - 1 + sway, 31, 3, 2);
      }
    }
    // leaky ceiling stains
    R('#2e1c12', 20, 44, 6, 2); R('#2e1c12', 112, 46, 8, 2);
    return flash;
  }

  drawFloor(R, now) {
    for (let y = FLOOR, row = 0; y < LH; y += 8, row++) {
      R(row % 2 ? '#6e4228' : '#664026', 0, y, LW, 8);
      R('#4e2e1c', 0, y, LW, 1);
    }
    R('#3a2216', 0, FLOOR - 2, LW, 2);
    if (this.wall === 2) {
      R('#1a0f0c', 58, 188, 28, 14); R('#f4c27a', 60, 190, 24, 10);
      R('#6b3d22', 63, 190, 2, 10); R('#6b3d22', 79, 190, 2, 10);
      R('#8a5a34', 63, 193, 18, 1); R('#8a5a34', 63, 197, 18, 1);
      if (Math.floor(now / 600) % 2) { R('#fff4e0', 71, 204, 2, 1); R('#fff4e0', 70, 203, 4, 1); }
    } else if (this.wall === 3) {
      R('#5a3622', 50, 184, 44, 18); R('#8a5a34', 50, 184, 44, 3); R('#c9a040', 70, 190, 4, 4); R('#3a2216', 50, 192, 44, 1);
    } else if (this.wall === 1) {
      R('#efdcb4', 56, 188, 10, 12); R('#c9ad7f', 56, 188, 10, 2); R('#efdcb4', 70, 192, 8, 8); R('#6b3d22', 82, 186, 6, 14);
    }
  }

  drawPlanter(R, x, y, pl, now, i) {
    const ctx = this.ctx;
    const base = y + SH - 4; // ground line
    if (!pl.level) {
      ctx.globalAlpha = 0.35;
      for (let k = 0; k < SW; k += 4) { R('#c9ad7f', x + k, base, 2, 1); R('#c9ad7f', x + k, y + 18, 2, 1); }
      for (let k = 18; k < SH - 4; k += 4) { R('#c9ad7f', x, y + k, 1, 2); R('#c9ad7f', x + SW - 1, y + k, 1, 2); }
      ctx.globalAlpha = 1;
      if (S.mats.kit) ctx.drawImage(ICONS.kit, x + SW / 2 - 4, y + 26);
      else { R('rgba(201,173,127,0.5)', x + SW / 2 - 3, y + 30, 7, 1); R('rgba(201,173,127,0.5)', x + SW / 2, y + 27, 1, 7); }
      return;
    }
    const n = PLANTERS[pl.level].plants;
    const boxW = [0, 18, 34, 50, 54][pl.level];
    const bx = x + Math.round((SW - boxW) / 2);
    let soil;
    if (pl.level === 1) {
      R('#a0503a', bx + 1, base - 11, boxW - 2, 11); R('#c06a4a', bx, base - 12, boxW, 3); R('#7a3a28', bx + 2, base - 1, boxW - 4, 1);
      soil = base - 12;
    } else if (pl.level === 2) {
      R('#3a2216', bx, base - 12, boxW, 12); R('#7a4a2c', bx + 1, base - 11, boxW - 2, 10); R('#a0663a', bx + 1, base - 11, boxW - 2, 2);
      R('#5a3622', bx + 1, base - 6, boxW - 2, 1);
      soil = base - 12;
    } else {
      R('#3b2418', bx + 3, base - 6, 3, 6); R('#3b2418', bx + boxW - 6, base - 6, 3, 6);
      R('#3a2216', bx, base - 18, boxW, 13); R('#7a4a2c', bx + 1, base - 17, boxW - 2, 11); R('#a0663a', bx + 1, base - 17, boxW - 2, 2);
      R('#5a3622', bx + 1, base - 11, boxW - 2, 1);
      soil = base - 18;
    }
    R('#2e1c12', bx + 2, soil + 2, boxW - 4, 2);
    if (pl.crop) {
      const prog = cropProgress(pl);
      const spr = prog >= 1 ? CROPS_SPR[pl.crop] : prog >= 0.4 ? CROPS_SPR.young : CROPS_SPR.sprout;
      for (let k = 0; k < n; k++) {
        const cx = bx + Math.round(((k + 0.5) * boxW) / n) - 4;
        const sway = prog >= 1 && Math.floor(now / 500 + k) % 4 === 0 ? 1 : 0;
        ctx.drawImage(spr, cx + sway, soil + 3 - spr.height);
      }
      if (prog < 1) {
        R('#1a1220', x + 6, base + 2, SW - 12, 2);
        R('#6fb04a', x + 6, base + 2, Math.round((SW - 12) * prog), 2);
      } else {
        for (let k = 0; k < 3; k++) {
          if ((Math.floor(now / 200) + k * 3 + i) % 5) continue;
          R('#ffe27a', x + 4 + Math.floor(hash(k + i * 3 + Math.floor(now / 1000)) * (SW - 8)), y + 6 + k * 4, 1, 1);
        }
      }
    }
    if (pl.level === 4) {
      // greenhouse cloche
      R('rgba(180,220,255,0.18)', bx + 1, y + 2, boxW - 2, soil - y - 2);
      R('#c8d8e8', bx, y + 2, boxW, 1); R('#c8d8e8', bx, y + 2, 1, soil - y - 2); R('#c8d8e8', bx + boxW - 1, y + 2, 1, soil - y - 2);
      R('#c8d8e8', bx + Math.round(boxW / 2), y + 2, 1, soil - y - 2);
      R('rgba(255,255,255,0.35)', bx + 3, y + 5, 1, 6);
    }
    for (let k = 0; k < pl.level; k++) R('#ffe27a', x + 2 + k * 3, y + SH - 2, 2, 2);
  }

  draw(now) {
    const ctx = this.ctx;
    if (!ctx) return;
    const R = (c, x, y, w, hh) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, hh); };
    const st = Math.min(1, (now - (this.slideAt || 0)) / 260);
    ctx.save();
    if (st < 1) ctx.translate(Math.round((this.slide || 0) * LW * 0.35 * (1 - st) ** 3), 0);
    const flash = this.drawWall(R, now);
    this.drawFloor(R, now);
    SPOTS.forEach(([x, y], k) => this.drawPlanter(R, x, y, S.planters[this.spot(k)], now, k));

    for (const d of this.drips) {
      if (d.splash) {
        R('#9fd3f2', d.x - d.splash / 2, d.y - 1, 1, 1);
        R('#9fd3f2', d.x + 1 + d.splash / 2, d.y - 1, 1, 1);
      } else R('#9fd3f2', d.x, Math.round(d.y), 1, 2);
    }

    for (const q of this.parts) {
      ctx.globalAlpha = Math.min(1, q.life * 1.5);
      R(q.c, Math.round(q.x), Math.round(q.y), 2, 2);
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '10px "Jersey 10", monospace';
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.drawImage(ICONS[f.crop], Math.round(f.x - 12), Math.round(f.y - 4));
      ctx.fillStyle = '#1a1220'; ctx.fillText(`+${f.n}`, f.x + 5, f.y + 1);
      ctx.fillStyle = '#fff4e0'; ctx.fillText(`+${f.n}`, f.x + 4, f.y);
    }
    ctx.globalAlpha = 1;

    R('rgba(12,8,28,0.22)', 0, 0, LW, LH);
    if (flash > 0) R(`rgba(200,215,255,${flash * 0.2})`, 0, 0, LW, LH);
    ctx.restore();
    if (st < 1) R(`rgba(12,8,28,${0.5 * (1 - st)})`, 0, 0, LW, LH);
  }
}

