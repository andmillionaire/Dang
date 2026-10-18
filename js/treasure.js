import { h, icon, confetti, sparkle } from './ui.js';
import { fitCanvas, toLogical, sleep } from './pixel.js';
import { BALL } from './sprites.js';
import { buzz } from './audio.js';

// The treasure chest's exclusive bonus: drop one ball down a Plinko board into a prize chute.
// The middle chute is narrow and holds the mega prize, the Saturn Jackpot.

import { LW, LH, TOP, CHUTE_Y, CHUTES, MEGA, PEGS, edges, chuteAt, step } from './plinko.js';
export { CHUTES, MEGA };

// Roll the chest's guaranteed loot.
export function rollLoot() {
  const r = n => (Math.random() * n) | 0;
  const seeds = ['wheat', 'cotton', 'flowers', 'pumpkin'];
  return { coins: 40 + r(41), lumber: 1 + r(3), fabric: 1 + r(3), kit: Math.random() < 0.35 ? 1 : 0, seed: seeds[r(4)], seedN: 2 + r(3) };
}

// Show the loot, then play the Plinko drop. Resolves with the chute index the ball lands in.
export function playPlinko(root, { sfx, loot }) {
  return new Promise(resolve => {
    const lootRow = h('div', { class: 'tr-loot' },
      h('span', {}, icon('coin'), ` ${loot.coins}`), h('span', {}, icon('lumber'), ` ${loot.lumber}`), h('span', {}, icon('fabric'), ` ${loot.fabric}`),
      loot.kit ? h('span', {}, icon('kit'), ' 1') : null, h('span', {}, icon(loot.seed), ` ${loot.seedN} seeds`));
    const intro = h('div', { class: 'tr-intro' },
      h('p', { class: 'tr-title' }, 'Treasure chest!'), lootRow,
      h('p', { class: 'muted center' }, 'And a bonus ball! Drag along the top to aim, let go to drop it. Land the gold chute for the Saturn Jackpot.'),
      h('button', { class: 'btn big primary', onclick: () => start() }, 'Drop the bonus ball!'));
    root.replaceChildren(h('div', { class: 'mg tr' }, intro));
    requestAnimationFrame(() => lootRow.childNodes.forEach((el, i) => setTimeout(() => { sparkle(el, { count: 6 }); sfx('coin'); }, i * 120)));

    function start() {
      const canvas = h('canvas', { class: 'pegs-canvas' });
      const status = h('p', { class: 'mg-status' }, 'Aim, then let go!');
      root.replaceChildren(h('div', { class: 'mg tr' }, h('p', { class: 'tr-title' }, 'Bonus ball'), h('div', { class: 'mg-canvas tr-canvas' }, canvas), status));
      let ctx, aimX = LW / 2, ball = null, done = false, frame = 0, landed = -1, glow = [];
      requestAnimationFrame(() => { ctx = fitCanvas(canvas, LW, LH).ctx; loop(); });
      let held = false;
      canvas.addEventListener('pointerdown', e => { if (ball || done) return; held = true; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } aimX = Math.max(4, Math.min(LW - 4, toLogical(canvas, LW, LH, e).x)); });
      canvas.addEventListener('pointermove', e => { if (held) aimX = Math.max(4, Math.min(LW - 4, toLogical(canvas, LW, LH, e).x)); });
      canvas.addEventListener('pointerup', () => {
        if (!held || ball || done) return;
        held = false;
        ball = { x: aimX, y: 8, vx: 0, vy: 0 };
        sfx('swap');
        status.textContent = 'Here it goes…';
      });

      function loop() {
        if (!canvas.isConnected) return;
        frame++;
        if (ball && !done) {
          for (let s = 0; s < 2; s++) {
            const p = step(ball);
            if (p) { glow.push({ p, t: 0 }); sfx('peg', 1 + (frame % 8)); }
          }
          if (ball.y >= LH - 6) {
            done = true;
            landed = chuteAt(ball.x);
            const mega = CHUTES[landed].prize.mega;
            status.textContent = mega ? 'SATURN JACKPOT!!!' : `You won ${CHUTES[landed].label}!`;
            sfx(mega ? 'win' : 'coin');
            setTimeout(() => resolve(landed), mega ? 400 : 1100);
          }
        }
        glow.forEach(g => g.t++);
        glow = glow.filter(g => g.t < 14);
        draw();
        requestAnimationFrame(loop);
      }

      function draw() {
        ctx.fillStyle = '#1a1430'; ctx.fillRect(0, 0, LW, LH);
        ctx.fillStyle = '#2a2050';
        for (let i = 0; i < 24; i++) ctx.fillRect((i * 37) % LW, (i * 53) % LH, 1, 1);
        for (const p of PEGS) {
          const lit = glow.find(g => g.p === p);
          ctx.fillStyle = lit ? '#ffe27a' : '#9fb4d0';
          ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 1), 3, 3);
        }
        // chutes
        edges.forEach(([a, b], i) => {
          const c = CHUTES[i];
          const win = done && i === landed;
          ctx.fillStyle = c.prize.mega ? (Math.floor(frame / 6) % 2 ? '#ffe27a' : '#f39a3a') : win ? '#5a3a7a' : i % 2 ? '#2a3a6a' : '#24305a';
          ctx.fillRect(Math.round(a), CHUTE_Y, Math.ceil(b - a), LH - CHUTE_Y);
          ctx.fillStyle = '#6b3d22'; ctx.fillRect(Math.round(a), CHUTE_Y - 3, 1, LH - CHUTE_Y + 3);
          ctx.fillStyle = c.prize.mega ? '#1a1220' : '#fff4e0';
          ctx.font = '7px "Jersey 10", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.save(); ctx.translate((a + b) / 2, CHUTE_Y + (LH - CHUTE_Y) / 2);
          if (c.label.length > 3) ctx.rotate(-Math.PI / 2);
          ctx.fillText(c.label, 0, 0); ctx.restore();
        });
        // dropper
        if (!ball) {
          ctx.fillStyle = '#ffe27a'; ctx.fillRect(Math.round(aimX - 4), 2, 8, 2);
          ctx.fillStyle = 'rgba(255,244,224,0.4)';
          for (let y = 12; y < TOP - 4; y += 3) ctx.fillRect(Math.round(aimX), y, 1, 1);
          ctx.drawImage(BALL, Math.round(aimX - 2), 6);
        } else ctx.drawImage(BALL, Math.round(ball.x - 2), Math.round(ball.y - 2));
      }
    }
  });
}

// What a chute is worth, merged with the chest loot for display.
export function prizeOf(i) { return CHUTES[i].prize.mega ? MEGA : CHUTES[i].prize; }

// The screen goes crazy: rainbow flashes, a giant JACKPOT, raining coins, shaking, confetti storms.
export function jackpotFx(sfx) {
  return new Promise(resolve => {
    const rain = h('div', { class: 'jp-rain' });
    const over = h('div', { class: 'jp' }, rain,
      h('div', { class: 'jp-text' }, h('b', {}, 'JACKPOT!'), h('span', {}, 'Saturn Jackpot'),
        h('div', { class: 'jp-loot' }, h('span', {}, icon('coin'), ` +${MEGA.coins}`), h('span', {}, icon('shard'), ` +${MEGA.shards}`),
          h('span', {}, icon('lumber'), ` +${MEGA.lumber}`), h('span', {}, icon('fabric'), ` +${MEGA.fabric}`), h('span', {}, icon('kit'), ` +${MEGA.kit}`), h('span', {}, icon('wheat'), ` +${MEGA.seeds} of every seed`))),
      h('p', { class: 'jp-tap' }, 'tap to collect'));
    document.body.append(over);
    document.body.classList.add('jp-shake');
    buzz([100, 60, 100, 60, 200]);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let n = 0;
    const timer = setInterval(() => {
      n++;
      if (!reducedMotion && n % 3 === 0) confetti(60);
      if (n % 2 === 0) sfx(n % 4 ? 'coin' : 'sparkle');
      if (!reducedMotion) for (let i = 0; i < 4; i++) {
        const c = icon(Math.random() < 0.75 ? 'coin' : Math.random() < 0.5 ? 'shard' : 'star', 'ico jp-coin');
        c.style.left = Math.random() * 100 + '%';
        c.style.animationDuration = 0.9 + Math.random() * 1.2 + 's';
        rain.append(c);
        setTimeout(() => c.remove(), 2400);
      }
      if (n === 1) sfx('win');
      if (n > 30) document.body.classList.remove('jp-shake');
    }, 120);
    let ready = false;
    setTimeout(() => (ready = true), 1500);
    over.addEventListener('pointerdown', () => {
      if (!ready) return;
      clearInterval(timer);
      document.body.classList.remove('jp-shake');
      over.classList.add('out');
      setTimeout(() => { over.remove(); resolve(); }, 300);
    });
  });
}
