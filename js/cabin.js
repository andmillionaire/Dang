import { fitCanvas, toLogical, hash } from './pixel.js';
import { RainWindow } from './rainview.js';
import { S } from './state.js';
import { drawHero, fullSaturn, W as HW } from './hero.js';
import { GIRLS } from './sprites.js';

const LW = 144, LH = 208;
const WX = 48, WY = 26, WW = 48, WH = 56;
const FLOOR = 152;
const HERO = { x: 28, y: 160 };

export class Cabin {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.hooks = hooks; // onLadder, onCat, sfx
    this.win = new RainWindow(WW, WH, { onThunder: () => hooks.sfx('thunder') });
    this.active = false;
    this.purrUntil = 0;
    this.sparkleAt = 0;
    this.win.moon = true;
    canvas.addEventListener('pointerdown', e => {
      const p = toLogical(canvas, LW, LH, e);
      if (p.x >= HERO.x - 2 && p.x <= HERO.x + HW + 2 && p.y >= HERO.y - 4 && p.y <= HERO.y + 28) { this.sparkleAt = performance.now(); hooks.onHero(); }
      else if (S.arcade.owned && p.x >= 114 && p.x <= 142 && p.y >= 140 && p.y <= 200) hooks.onArcade();
      else if (p.x >= 108 && p.x <= 138 && p.y < FLOOR) hooks.onLadder();
      else if (S.decor.catbed && p.x >= 58 && p.x <= 90 && p.y >= 160) { this.purrUntil = performance.now() + 1500; hooks.onCat(); }
      else if (p.x >= WX && p.x <= WX + WW && p.y >= WY && p.y <= WY + WH) this.win.strike();
    });
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
    this.win.saturn = fullSaturn();
    this.win.update(now);
    this.draw(now);
    this.raf = requestAnimationFrame(this.loop);
  };

  draw(now) {
    const ctx = this.ctx;
    if (!ctx) return;
    const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    const D = S.decor;
    const tq = Math.floor(now / 90);

    // walls
    R('#2a1a14', 0, 0, LW, 10);
    for (let x = 0, i = 0; x < LW; x += 12, i++) {
      R(i % 2 ? '#5c3a26' : '#553422', x, 10, 12, FLOOR - 10);
      R('#432819', x, 10, 1, FLOOR - 10);
      const ky = 20 + Math.floor(hash(i) * 110);
      R('#4a2c1c', x + 4 + Math.floor(hash(i + 9) * 5), ky, 2, 1);
    }
    R('#3a2216', 0, 10, LW, 2);
    // floor
    for (let y = FLOOR, row = 0; y < LH; y += 8, row++) {
      R(row % 2 ? '#7a4a2c' : '#714428', 0, y, LW, 8);
      R('#4e2e1c', 0, y, LW, 1);
      for (let x = row % 2 ? 0 : 20; x < LW; x += 40) R('#4e2e1c', x, y, 1, 8);
    }
    R('#3a2216', 0, FLOOR - 4, LW, 4);
    R('#5a3622', 0, FLOOR - 4, LW, 1);

    // window
    R('#6b3d22', WX - 4, WY - 4, WW + 8, WH + 8);
    R('#a0663a', WX - 3, WY - 3, WW + 6, WH + 6);
    const flash = this.win.draw(ctx, WX, WY, now);
    R('#a0663a', WX + WW / 2 - 1, WY, 2, WH);
    R('#a0663a', WX, WY + WH / 2 - 1, WW, 2);
    R('#6b3d22', WX - 8, WY + WH + 3, WW + 16, 5);
    R('#b87a48', WX - 8, WY + WH + 3, WW + 16, 2);

    if (D.vase) {
      const vx = WX + 4, vy = WY + WH + 3;
      R('#4f8fd0', vx, vy - 6, 6, 6); R('#9fd3f2', vx + 1, vy - 5, 1, 3); R('#2c5a9a', vx + 4, vy - 6, 2, 6);
      R('#3d7a34', vx + 2, vy - 11, 1, 5); R('#3d7a34', vx + 4, vy - 10, 1, 4); R('#3d7a34', vx, vy - 9, 1, 3);
      R('#f08ab0', vx + 1, vy - 13, 3, 2); R('#ffe27a', vx + 2, vy - 13, 1, 1);
      R('#c0507a', vx + 3, vy - 12, 3, 2); R('#f08ab0', vx - 1, vy - 11, 2, 2);
    }

    if (D.curtains) {
      R('#3b2418', WX - 10, WY - 7, WW + 20, 2);
      R('#c9a040', WX - 11, WY - 8, 2, 4); R('#c9a040', WX + WW + 9, WY - 8, 2, 4);
      for (const side of [0, 1]) {
        const x0 = side ? WX + WW - 2 : WX - 8;
        for (let i = 0; i < 10; i++) {
          const sway = Math.round(Math.sin(now / 900 + i * 0.6 + side) * 0.6);
          R(i % 3 === 0 ? '#a46ad0' : '#6a3e94', x0 + i + (i > 4 ? sway : 0), WY - 5, 1, WH + 14);
        }
        R('#c9a040', x0, WY + 30, 10, 2);
      }
    }

    // chimney and fireplace
    R('#3e3a44', 4, 10, 36, FLOOR - 10);
    for (let y = 10, row = 0; y < FLOOR - 4; y += 6, row++) {
      for (let x = row % 2 ? 2 : 6; x < 40; x += 8) {
        const sx = Math.max(5, x), sw = Math.min(x + 7, 39) - sx;
        if (sw <= 0) continue;
        R(hash(row * 7 + x) > 0.5 ? '#6a6470' : '#625c69', sx, y + 1, sw, 5);
        R('#57525e', sx, y + 5, sw, 1);
      }
    }
    if (D.painting) {
      R('#8a6a20', 10, 34, 24, 20); R('#c9a040', 11, 35, 22, 18);
      R('#9fd3f2', 13, 37, 18, 8); R('#ffe27a', 26, 38, 3, 3);
      R('#6fb04a', 13, 45, 18, 6); R('#3d7a34', 13, 48, 18, 3);
      R('#f08ab0', 16, 46, 1, 1); R('#ffe27a', 21, 47, 1, 1); R('#f08ab0', 27, 46, 1, 1);
    }
    R('#4e2e1c', 1, 88, 42, 6); R('#8a5a34', 1, 88, 42, 2);
    R('#120a08', 12, 112, 20, FLOOR - 112);
    R('#120a08', 14, 110, 16, 2);
    R('#2a1a14', 12, FLOOR - 6, 20, 2);
    // fire
    for (let x = 14; x < 30; x++) {
      const base = 3 + 9 * Math.sin(((x - 13) / 17) * Math.PI);
      const hh = Math.round(base + hash(x * 7 + tq) * 4);
      const yb = FLOOR - 8;
      R('#d0463c', x, yb - hh, 1, hh);
      R('#f39a3a', x, yb - Math.round(hh * 0.66), 1, Math.round(hh * 0.66));
      R('#ffe27a', x, yb - Math.round(hh * 0.33), 1, Math.round(hh * 0.33));
    }
    R('#5a3622', 13, FLOOR - 8, 18, 3); R('#3b2418', 15, FLOOR - 11, 14, 3); R('#7a4a2c', 13, FLOOR - 8, 18, 1);
    if (hash(tq * 3) > 0.7) R('#ffe27a', 16 + Math.floor(hash(tq) * 12), FLOOR - 20 - Math.floor(hash(tq + 1) * 10), 1, 1);
    // mantel candle
    R('#efdcb4', 34, 82, 3, 6); R(tq % 3 ? '#ffe27a' : '#f39a3a', 35, 80, 1, 2);

    if (D.shelf) {
      R('#8a5a34', 101, 50, 12, 2); R('#5a3622', 101, 52, 12, 1);
      const books = [['#d0463c', 7], ['#4f8fd0', 8], ['#6fb04a', 6], ['#f2c84b', 7], ['#a46ad0', 8], ['#efdcb4', 6]];
      books.forEach(([c, hgt], i) => { if (i < 5) R(c, 102 + i * 2, 50 - hgt, 2, hgt); });
      R('#8a5a34', 101, 70, 12, 2); R('#5a3622', 101, 72, 12, 1);
      R('#c79a5a', 103, 64, 4, 6); R('#efdcb4', 103, 64, 4, 1); R('#d0463c', 109, 66, 3, 4);
    }

    // ladder to the attic
    R('#1a0f0c', 110, 0, 26, 10);
    R('#f4c27a', 112, 1, 22, 8);
    R('#6b3d22', 114, 10, 3, FLOOR - 6); R('#6b3d22', 129, 10, 3, FLOOR - 6);
    R('#a0663a', 115, 10, 1, FLOOR - 6); R('#a0663a', 130, 10, 1, FLOOR - 6);
    for (let y = 18; y < FLOOR; y += 12) { R('#8a5a34', 117, y, 12, 2); R('#5a3622', 117, y + 2, 12, 1); }
    if (Math.floor(now / 600) % 2) { R('#ffe27a', 122, 22, 2, 1); R('#ffe27a', 121, 23, 4, 1); }

    if (D.lights) {
      const colors = ['#d0463c', '#ffe27a', '#6fb04a', '#4f8fd0', '#f08ab0'];
      for (let x = 0; x < 108; x++) {
        const y = 12 + Math.round(Math.abs(Math.sin((x / 27) * Math.PI)) * 3);
        R('#2a1a14', x, y, 1, 1);
        if (x % 9 === 4) {
          const on = (Math.floor(now / 400) + x) % 4 !== 0;
          R(on ? colors[(x / 9 | 0) % 5] : '#3a2a2a', x, y + 1, 2, 2);
        }
      }
    }

    if (D.rug) {
      R('#7a2424', 26, 164, 92, 26);
      R('#b8433a', 28, 166, 88, 22);
      R('#f4c27a', 32, 170, 80, 1); R('#f4c27a', 32, 183, 80, 1);
      for (let x = 36; x < 108; x += 8) { R('#f4c27a', x, 175, 3, 3); R('#6a3e94', x + 1, 176, 1, 1); }
      for (let y = 166; y < 188; y += 2) { R('#efdcb4', 24, y, 2, 1); R('#efdcb4', 118, y, 2, 1); }
    }

    // armchair
    R('#5e1c1c', 54, 110, 36, 28); R('#8e2a2a', 56, 112, 32, 24);
    for (const [x, y] of [[62, 118], [72, 118], [82, 118], [67, 126], [77, 126]]) R('#6e2222', x, y, 2, 2);
    R('#5e1c1c', 48, 126, 10, 26); R('#a33a34', 49, 127, 8, 3); R('#8e2a2a', 49, 130, 8, 21);
    R('#5e1c1c', 86, 126, 10, 26); R('#a33a34', 87, 127, 8, 3); R('#8e2a2a', 87, 130, 8, 21);
    R('#b8433a', 58, 136, 28, 7); R('#d0564a', 58, 136, 28, 2);
    R('#7a2424', 58, 143, 28, 9);
    R('#3b2418', 50, 152, 3, 4); R('#3b2418', 91, 152, 3, 4);
    if (D.quilt) {
      const pc = ['#efdcb4', '#a46ad0', '#6fb04a', '#f4c27a', '#4f8fd0'];
      for (let j = 0; j < 9; j++) for (let i = 0; i < 6; i++) {
        if (j < 3 && i === 0) continue;
        R(pc[(i + j * 2) % 5], 62 + i * 4, 112 + j * 4 + (j > 5 ? 0 : 0), 4, 4);
      }
      for (let i = 0; i < 6; i++) R('#1a1220', 62 + i * 4, 148, 4, 1);
    }

    // side table + tea
    R('#6b3d22', 98, 136, 16, 3); R('#a0663a', 98, 136, 16, 1);
    R('#4e2e1c', 100, 139, 2, FLOOR - 139); R('#4e2e1c', 110, 139, 2, FLOOR - 139);
    R('#efdcb4', 100, 131, 5, 5); R('#efdcb4', 105, 132, 1, 3); R('#a0663a', 101, 131, 3, 1);
    const st = Math.floor(now / 250) % 3;
    R('rgba(230,230,240,0.6)', 101 + (st === 1 ? 1 : 0), 127 - st, 1, 2);
    R('rgba(230,230,240,0.4)', 103 - (st === 2 ? 1 : 0), 125 - st, 1, 2);
    if (D.lantern) {
      R('#3d7a34', 109, 126, 1, 2);
      R('#f08a2a', 106, 128, 7, 8); R('#b85a18', 108, 128, 1, 8); R('#b85a18', 111, 128, 1, 8);
      const fl = hash(tq) > 0.3 ? '#ffe27a' : '#f39a3a';
      R(fl, 107, 130, 1, 1); R(fl, 111, 130, 1, 1); R(fl, 108, 133, 3, 1);
    }

    if (D.fern) {
      R('#a0663a', 8, 174, 10, 10); R('#6b3d22', 8, 174, 10, 2); R('#6b3d22', 9, 184, 8, 2);
      const leaves = [[-6, -10], [-4, -14], [0, -16], [4, -14], [7, -9], [-8, -5], [9, -4]];
      for (const [dx, dy] of leaves) {
        const sway = Math.round(Math.sin(now / 1200 + dx) * 0.6);
        for (let k = 0; k <= 8; k++) {
          const x = 13 + Math.round((dx * k) / 8) + (k > 4 ? sway : 0), y = 174 + Math.round((dy * k) / 8);
          R(k % 2 ? '#6fb04a' : '#3d7a34', x, y, 1, 1);
        }
      }
    }

    if (S.arcade.owned) {
      const blink = Math.floor(now / 400) % 2;
      R('#2a1840', 116, 146, 24, 52); R('#4a2468', 118, 148, 20, 48);
      R('#e86aa8', 116, 142, 24, 7); R(blink ? '#ffe27a' : '#fff4e0', 118, 144, 2, 2); R(blink ? '#fff4e0' : '#ffe27a', 136, 144, 2, 2);
      R('#1a1220', 120, 152, 16, 14); R('#24305a', 121, 153, 14, 12);
      ctx.drawImage(GIRLS[Math.floor(now / 1500) % GIRLS.length], 122, 153);
      R('#6a3e94', 118, 168, 20, 6); R('#1a1220', 122, 165, 1, 4); R('#d0463c', 121, 164, 3, 2);
      R(blink ? '#4f8fd0' : '#9fd3f2', 128, 170, 2, 2); R(blink ? '#f08ab0' : '#d0463c', 132, 170, 2, 2);
      R('#2a1840', 120, 176, 16, 1); R('#1a1220', 116, 196, 24, 2);
      R(`rgba(160,200,255,${0.08 + 0.04 * blink})`, 112, 148, 32, 30);
    }

    if (D.catbed) {
      R('#6b3d22', 62, 178, 26, 9); R('#8a5a34', 62, 178, 26, 2);
      R('#a46ad0', 64, 176, 22, 4);
      const purr = now < this.purrUntil ? Math.round(Math.sin(now / 40)) : 0;
      R('#f39a3a', 67, 170 + purr, 14, 7); R('#c06a20', 70, 171 + purr, 1, 5); R('#c06a20', 74, 171 + purr, 1, 5);
      R('#f39a3a', 78, 167, 7, 6); R('#f39a3a', 78, 165, 2, 2); R('#f39a3a', 83, 165, 2, 2);
      R('#f08ab0', 79, 166, 1, 1); R('#f08ab0', 84, 166, 1, 1);
      R('#1a1220', 79, 170, 2, 1); R('#1a1220', 82, 170, 2, 1); R('#f08ab0', 81, 171, 1, 1);
      const tail = Math.round(Math.sin(now / 500) * 2);
      R('#f39a3a', 63, 174 + tail, 5, 2); R('#c06a20', 62, 174 + tail, 2, 2);
      const z = (now / 1400) % 1;
      ctx.globalAlpha = 1 - z;
      const zx = 86 + Math.round(z * 6), zy = 162 - Math.round(z * 12);
      R('#efdcb4', zx, zy, 3, 1); R('#efdcb4', zx + 1, zy + 1, 1, 1); R('#efdcb4', zx, zy + 2, 3, 1);
      ctx.globalAlpha = 1;
    }

    // you
    const bob = Math.floor(now / 700) % 2;
    R('rgba(20,10,10,0.35)', HERO.x + 2, HERO.y + 26, 12, 2);
    drawHero(ctx, HERO.x, HERO.y - bob, { now });
    const sp = now - this.sparkleAt;
    if (sp < 900) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + sp / 300, r = 4 + sp / 60;
        R(i % 2 ? '#ffe27a' : '#f08ab0', Math.round(HERO.x + 8 + Math.cos(a) * r), Math.round(HERO.y + 12 + Math.sin(a) * r), 1, 1);
      }
    }

    // lighting: the room gets cozier as it fills up
    const owned = Object.keys(D).length;
    R(`rgba(12,8,28,${Math.max(0.08, 0.34 - owned * 0.025)})`, 0, 0, LW, LH);
    const glow = (x, y, r, a, rgb = '255,160,70') => {
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    glow(22, FLOOR - 14, 90, 0.18 + hash(tq) * 0.05);
    glow(35, 80, 18, 0.12);
    glow(123, 8, 34, 0.22 + Math.sin(now / 500) * 0.04, '255,200,120');
    if (D.lantern) glow(109, 131, 30, 0.15 + hash(tq + 5) * 0.05);
    if (D.lights) glow(54, 14, 70, 0.08, '255,220,150');
    if (flash > 0) R(`rgba(200,215,255,${flash * 0.18})`, 0, 0, LW, LH);
  }
}
