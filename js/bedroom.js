import { fitCanvas, sleep } from './pixel.js';
import { RainWindow } from './rainview.js';
import { S } from './state.js';
import { heroSprite, drawHero, W, H } from './hero.js';
import { drawSleepingPet } from './pet.js';

const LW = 144, LH = 208;
const WX = 40, WY = 24, WW = 64, WH = 48;
const FLOOR = 176;

// Morning: asleep -> alarm -> sitting up -> (transformation) -> off to match.
export class Bedroom {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.hooks = hooks; // sfx
    this.win = new RainWindow(WW, WH, { palette: 'dawn', onThunder: () => hooks.sfx('thunder') });
    this.mode = 'sleep';
    this.t0 = 0;
    this.active = false;
  }

  setActive(on) {
    this.active = on;
    if (on) { this.resize(); if (!this.raf) this.loop(); }
  }

  resize() {
    if (this.active) this.ctx = fitCanvas(this.canvas, LW, LH).ctx;
  }

  async wake() {
    this.mode = 'sleep';
    await sleep(1100);
    this.mode = 'alarm';
    this.t0 = performance.now();
    for (let i = 0; i < 3; i++) { this.hooks.sfx('alarm'); await sleep(380); }
    this.mode = 'awake';
    this.t0 = performance.now();
  }

  async transform() {
    this.mode = 'transform';
    this.t0 = performance.now();
    this.hooks.sfx('sparkle');
    await sleep(1400);
  }

  loop = () => {
    if (!this.active) { this.raf = 0; return; }
    const now = performance.now();
    this.win.update(now);
    this.draw(now);
    this.raf = requestAnimationFrame(this.loop);
  };

  draw(now) {
    const ctx = this.ctx;
    if (!ctx || !S.hero) return;
    const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    const t = now - this.t0;

    R('#3a2418', 0, 0, LW, 10);
    for (let x = 0, i = 0; x < LW; x += 12, i++) {
      R(i % 2 ? '#6a4630' : '#634029', x, 10, 12, FLOOR - 10);
      R('#4e301f', x, 10, 1, FLOOR - 10);
    }
    for (let y = FLOOR, row = 0; y < LH; y += 8, row++) {
      R(row % 2 ? '#7e5030' : '#76492c', 0, y, LW, 8);
      R('#523220', 0, y, LW, 1);
    }
    R('#3a2216', 0, FLOOR - 3, LW, 3);

    R('#6b3d22', WX - 4, WY - 4, WW + 8, WH + 8);
    R('#a0663a', WX - 3, WY - 3, WW + 6, WH + 6);
    const flash = this.win.draw(ctx, WX, WY, now);
    R('#a0663a', WX + WW / 2 - 1, WY, 2, WH);
    R('#a0663a', WX, WY + WH / 2 - 1, WW, 2);
    R('#6b3d22', WX - 8, WY + WH + 3, WW + 16, 5);
    R('#b87a48', WX - 8, WY + WH + 3, WW + 16, 2);
    // dawn light spilling in
    const g = ctx.createLinearGradient(0, WY, 0, FLOOR);
    g.addColorStop(0, 'rgba(200,210,255,0.10)'); g.addColorStop(1, 'rgba(200,210,255,0)');
    ctx.fillStyle = g; ctx.fillRect(WX - 10, WY, WW + 20, FLOOR - WY);

    // calendar
    R('#efdcb4', 112, 36, 18, 20); R('#d0463c', 112, 36, 18, 5);
    ctx.fillStyle = '#1a1220'; ctx.font = '9px "Jersey 10", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(S.day), 121, 49);

    // bed
    R('#5a3622', 8, 116, 7, FLOOR - 116); R('#8a5a34', 8, 116, 7, 2);
    R('#5a3622', 108, 138, 6, FLOOR - 138); R('#8a5a34', 108, 138, 6, 2);
    R('#efdcb4', 12, 150, 98, 10);
    R('#6b3d22', 10, 160, 102, 8); R('#8a5a34', 10, 160, 102, 1);
    R('#3b2418', 12, 168, 3, 8); R('#3b2418', 104, 168, 3, 8);
    R('#fff4e0', 15, 142, 22, 9); R('#d8d0c8', 15, 149, 22, 2);

    const sitting = this.mode === 'awake' || this.mode === 'transform';
    if (!sitting) {
      const jolt = this.mode === 'alarm' && Math.floor(t / 90) % 2 ? -1 : 0;
      ctx.save();
      ctx.translate(17, 158 + jolt);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(heroSprite(S.hero, { outfit: 'pajamas', closed: this.mode === 'sleep' }), 0, 0);
      ctx.restore();
    } else if (this.mode === 'awake') {
      const rise = Math.min(1, t / 400);
      const y = Math.round(140 - 20 * rise);
      ctx.drawImage(heroSprite(S.hero, { outfit: 'pajamas' }), 0, 0, W, 20, 18, y, W, 20);
    }

    // quilt
    for (let j = 0; j < 5; j++) for (let i = 0; i < 18; i++) {
      R(['#a46ad0', '#f08ab0', '#efdcb4', '#8fd0b0'][(i + j * 2) % 4], 34 + i * 4, 138 + j * 4, 4, 4);
    }
    R('#6a3e94', 34, 158, 72, 2);

    R('#8a4a6a', 46, 180, 32, 10); R('#a46ad0', 48, 182, 28, 6);
    drawSleepingPet(ctx, 54, 176, now);

    // nightstand + alarm clock
    R('#6b3d22', 120, 152, 18, 24); R('#8a5a34', 120, 152, 18, 2); R('#4e2e1c', 122, 162, 14, 1);
    const ring = this.mode === 'alarm';
    const jx = ring ? Math.round(Math.sin(now / 25)) : 0;
    R('#d0463c', 124 + jx, 144, 9, 8); R('#fff4e0', 126 + jx, 146, 5, 4); R('#1a1220', 128 + jx, 147, 1, 2); R('#1a1220', 129 + jx, 148, 1, 1);
    R('#ffe27a', 123 + jx, 142, 3, 2); R('#ffe27a', 131 + jx, 142, 3, 2);
    if (ring && Math.floor(now / 120) % 2) {
      R('#fff4e0', 120, 140, 1, 3); R('#fff4e0', 136, 140, 1, 3); R('#fff4e0', 118, 144, 1, 2); R('#fff4e0', 138, 144, 1, 2);
    }

    if (this.mode === 'sleep') {
      const z = (now / 1300) % 1;
      ctx.globalAlpha = 1 - z;
      const zx = 30 + Math.round(z * 8), zy = 132 - Math.round(z * 16);
      R('#efdcb4', zx, zy, 3, 1); R('#efdcb4', zx + 1, zy + 1, 1, 1); R('#efdcb4', zx, zy + 2, 3, 1);
      ctx.globalAlpha = 1;
    }
    if (this.mode === 'awake' && t < 900) {
      R('#ffe27a', 25, 112, 2, 4); R('#ffe27a', 25, 117, 2, 1);
    }

    if (this.mode === 'transform') {
      const k = Math.min(1, t / 1400);
      const cx = 72, cy = 120;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2 + k * 6;
        const r = 6 + k * 40 + (i % 3) * 3;
        R(['#ffe27a', '#f08ab0', '#a46ad0', '#9fd3f2'][i % 4], Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), 2, 2);
      }
      const flashA = k < 0.45 ? k / 0.45 : Math.max(0, 1 - (k - 0.45) / 0.3);
      R(`rgba(255,244,224,${flashA * 0.85})`, 0, 0, LW, LH);
      if (k > 0.45) {
        ctx.globalAlpha = Math.min(1, (k - 0.45) / 0.2);
        drawHero(ctx, cx - W / 2, cy - H / 2 - Math.round(Math.sin(now / 200) * 2), { now });
        ctx.globalAlpha = 1;
      }
    }

    R('rgba(30,24,50,0.12)', 0, 0, LW, LH);
    if (flash > 0) R(`rgba(220,230,255,${flash * 0.15})`, 0, 0, LW, LH);
  }
}
