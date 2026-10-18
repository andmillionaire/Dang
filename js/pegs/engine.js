import { h, icon, sparkle, confetti } from '../ui.js';
import { fitCanvas, toLogical, sleep } from '../pixel.js';
import { mount, banner } from '../minigames/common.js';
import { W, H } from './levels.js';

// Star Pegs: a Peggle-style game. Clear every orange peg with 10 balls.
// - A rounded bucket slides along the bottom; land in it for a free ball.
// - Points: blue 10, orange 100, purple 500, green 10, times the multiplier, which climbs as
//   oranges are cleared (x2, x3, x5, x10). Big single-shot scores earn free balls.
// - One purple bonus peg moves to a new spot every shot.
// - Two green pegs per level each grant a random power-up for the rest of that shot + 2 more.
// - Light the last orange and it's FEVER: slow motion and bonus bins worth big points.

const LAUNCH = { x: 60, y: 10 };
const SPEED = 2.6, GRAV = 0.085, SUB = 4, BOUNCE = 0.78, PEG_R = 2.5;
const BUCKET_Y = 162, BUCKET_W = 24;
const FREE_AT = [2500, 7500, 12500];
const FEVER_BINS = [10000, 25000, 50000, 25000, 10000];
const MULTS = [[0.88, 10], [0.76, 5], [0.6, 3], [0.4, 2]];

export const POWERS = {
  guide:    { name: 'Super Guide', desc: 'a long aiming line through the bounces', color: '#9fd3f2' },
  spooky:   { name: 'Spooky Ball', desc: 'falls out the bottom, pops back in at the top', color: '#d8c4f0' },
  multi:    { name: 'Multiball', desc: 'your first hit splits off a second ball', color: '#f8c8a8' },
  fire:     { name: 'Fireball', desc: 'burns straight through pegs', color: '#f39a3a' },
  big:      { name: 'Moon Ball', desc: 'a big ball that hits more', color: '#fff4e0' },
  flippers: { name: 'Flippers', desc: 'flippers knock the ball back up', color: '#c8ecb0' },
  wide:     { name: 'Wide Bucket', desc: 'a bucket twice as wide', color: '#a0663a' },
  blast:    { name: 'Star Blast', desc: 'your first hit explodes, lighting pegs around it', color: '#ffe27a' },
  magnet:   { name: 'Orange Magnet', desc: 'the ball is drawn toward orange pegs', color: '#f08ab0' },
  double:   { name: 'Double Points', desc: 'every point counts twice', color: '#b4ece4' },
};
const POWER_KEYS = Object.keys(POWERS);

const PEG_COL = { blue: ['#4f8fd0', '#bfe6ff'], orange: ['#f39a3a', '#ffe27a'], green: ['#6fb04a', '#d8f8b0'], purple: ['#a46ad0', '#f0c8ff'] };

// Draw the rounded bucket: a U-shaped pot with a rim. Shared with the mashup modes.
export function drawBucket(ctx, x, y, w, glow = 0) {
  const hw = w / 2;
  ctx.fillStyle = '#3a2216';
  ctx.beginPath(); ctx.moveTo(x - hw, y); ctx.quadraticCurveTo(x - hw, y + 12, x, y + 12); ctx.quadraticCurveTo(x + hw, y + 12, x + hw, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#a0663a';
  ctx.beginPath(); ctx.moveTo(x - hw + 2, y); ctx.quadraticCurveTo(x - hw + 2, y + 10, x, y + 10); ctx.quadraticCurveTo(x + hw - 2, y + 10, x + hw - 2, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c79a5a'; ctx.fillRect(Math.round(x - hw + 3), y + 3, 2, 4);
  ctx.fillStyle = '#6b3d22'; ctx.fillRect(Math.round(x - hw - 1), y - 1, Math.round(w + 2), 2);
  ctx.fillStyle = '#ffe27a'; ctx.fillRect(Math.round(x - hw - 1), y - 2, 2, 2); ctx.fillRect(Math.round(x + hw - 1), y - 2, 2, 2);
  if (glow > 0.05) { ctx.fillStyle = `rgba(255,226,122,${glow * 0.6})`; ctx.fillRect(Math.round(x - hw - 2), y - 8, Math.round(w + 4), 20); }
}

// Play one level. opts: { level (from levelData), sfx, title, tip, extraBalls, auto }
// Resolves { won, score, balls } (balls left when won).
export function playStarPegs(root, { level: L, sfx, title, tip, extraBalls = 0, auto = false }) {
  const ui = mount(root, { title: title || `Star Pegs · ${L.theme}`, tip: tip || 'Drag to aim, let go to shoot. Clear every orange peg. Catch the ball in the bucket for a free one. Green pegs give power-ups.' });
  ui.wrap.classList.add('sp');
  const canvas = h('canvas', { class: 'pegs-canvas sp-canvas' });
  ui.body.append(h('div', { class: 'mg-canvas sp-wrap' }, canvas));

  const pegs = L.pegs.map(p => ({ ...p, x0: p.x, y0: p.y, lit: false, gone: false }));
  const oranges = () => pegs.filter(p => p.kind === 'orange');
  const orangeTotal = oranges().length;
  let balls = L.balls + extraBalls, score = 0, shotScore = 0, shooting = false, done = false, fever = false, feverBin = -1;
  let aim = Math.PI / 2, angle = 0, frame = 0, slow = 0, stuck = 0, bucketT = Math.random() * 6, callouts = [], pops = [], power = null, powerFresh = false;
  let live = [], trail = [];
  let purple = null;
  const S = {}; // exposed for tests

  const mult = () => {
    const f = oranges().filter(p => p.lit || p.gone).length / orangeTotal;
    for (const [at, m] of MULTS) if (f >= at) return m;
    return 1;
  };
  const say = (text, color = '#ffe27a', big = false) => callouts.push({ text, color, t: 0, big });
  const has = k => power && power.kind === k;

  // ---------- HUD ----------
  const scoreEl = h('b', { class: 'sp-score' }, '0');
  const ballsEl = h('span', { class: 'mg-stat sp-balls' });
  const multEl = h('span', { class: 'sp-mult' });
  const meter = h('span', { class: 'sp-meter' }, h('i'));
  const powerEl = h('span', { class: 'sp-power' });
  ui.info.append(h('span', { class: 'mg-stat' }, scoreEl), ballsEl, h('span', { class: 'mg-stat sp-multwrap' }, meter, multEl), powerEl);
  function hud() {
    scoreEl.textContent = score.toLocaleString();
    ballsEl.replaceChildren(h('i', { class: 'dot ball' }), ` ${balls}`);
    const left = oranges().filter(p => !p.lit && !p.gone).length;
    meter.firstChild.style.width = `${((orangeTotal - left) / orangeTotal) * 100}%`;
    multEl.textContent = `x${mult()}`;
    powerEl.textContent = power ? `${POWERS[power.kind].name} · ${power.shots}` : '';
    powerEl.style.color = power ? POWERS[power.kind].color : '';
    Object.assign(S, { balls, score, left, power: power && power.kind, shooting, done });
  }

  // ---------- purple peg ----------
  function movePurple() {
    if (purple && !purple.lit && !purple.gone) purple.kind = 'blue';
    const blues = pegs.filter(p => p.kind === 'blue' && !p.lit && !p.gone);
    purple = blues.length ? blues[(Math.random() * blues.length) | 0] : null;
    if (purple) purple.kind = 'purple';
  }
  movePurple();
  hud();
  ui.status('Drag to aim, let go to shoot.');

  // ---------- geometry ----------
  // The whole layout can slowly turn (later levels). Pegs keep their spot relative to the centre.
  function place() {
    if (!L.spin) return;
    const c = Math.cos(angle), s = Math.sin(angle);
    for (const p of pegs) { const dx = p.x0 - 60, dy = p.y0 - 90; p.x = 60 + dx * c - dy * s; p.y = 90 + dx * s + dy * c; }
  }
  const bucketW = () => (has('wide') ? BUCKET_W * 2 : BUCKET_W);
  const bucketX = () => 60 + Math.sin(bucketT) * (W / 2 - bucketW() / 2 - 2);

  // Advance one ball one sub-step. collide=false is for the aiming line (returns the first peg it would hit).
  function stepBall(b, collide, onHit) {
    b.vy += GRAV / SUB;
    if (collide && has('magnet')) {
      const t = oranges().filter(p => !p.lit && !p.gone).sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))[0];
      if (t) { const d = Math.hypot(t.x - b.x, t.y - b.y) || 1; b.vx += ((t.x - b.x) / d) * 0.012; b.vy += ((t.y - b.y) / d) * 0.012; }
    }
    b.x += b.vx / SUB; b.y += b.vy / SUB;
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.9; }
    if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.9; }
    if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
    for (const p of pegs) {
      if (p.gone) continue;
      const HIT = PEG_R + b.r, dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy;
      if (d2 >= HIT * HIT) continue;
      if (!collide) return p;
      const burn = has('fire') && b.fireT > 0;
      if (!burn) {
        const d = Math.sqrt(d2) || 0.01, nx = dx / d, ny = dy / d;
        b.x = p.x + nx * HIT; b.y = p.y + ny * HIT;
        const dot = b.vx * nx + b.vy * ny;
        if (dot < 0) { b.vx -= (1 + BOUNCE) * dot * nx; b.vy -= (1 + BOUNCE) * dot * ny; }
      }
      if (!p.lit) onHit(p, b);
    }
    // bucket rims are solid
    if (collide && !fever) for (const rx of [bucketX() - bucketW() / 2, bucketX() + bucketW() / 2]) {
      const dx = b.x - rx, dy = b.y - BUCKET_Y, d = Math.hypot(dx, dy), min = 1.5 + b.r;
      if (d < min) { const nx = dx / (d || 1), ny = dy / (d || 1); b.x = rx + nx * min; b.y = BUCKET_Y + ny * min; const dot = b.vx * nx + b.vy * ny; if (dot < 0) { b.vx -= 1.6 * dot * nx; b.vy -= 1.6 * dot * ny; } }
    }
    return null;
  }

  // The dotted aim line: short normally, through several bounces with Super Guide.
  function guidePoints() {
    const g = { x: LAUNCH.x + Math.cos(aim) * 6, y: LAUNCH.y + Math.sin(aim) * 6, vx: Math.cos(aim) * SPEED, vy: Math.sin(aim) * SPEED, r: has('big') ? 4 : 2 };
    const pts = [];
    const long = has('guide');
    let bounces = 0;
    for (let i = 0; i < (long ? 900 : 160); i++) {
      const p = stepBall(g, false);
      if (p) {
        if (!long || ++bounces > 4) break;
        const dx = g.x - p.x, dy = g.y - p.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
        g.x = p.x + nx * (PEG_R + g.r + 0.1); g.y = p.y + ny * (PEG_R + g.r + 0.1);
        const dot = g.vx * nx + g.vy * ny; g.vx -= (1 + BOUNCE) * dot * nx; g.vy -= (1 + BOUNCE) * dot * ny;
      }
      if (g.y > H) break;
      if (i % 3 === 0) pts.push([g.x, g.y]);
    }
    return pts;
  }

  // ---------- scoring ----------
  function hit(p, b) {
    p.lit = true;
    const base = { blue: 10, orange: 100, purple: 500, green: 10 }[p.kind];
    const pts = base * mult() * (has('double') ? 2 : 1);
    shotScore += pts;
    score += pts;
    pops.push({ x: p.x, y: p.y, t: 0, c: PEG_COL[p.kind][1], pts });
    sfx('peg', Math.min(12, ++S.combo || (S.combo = 1)));
    if (p.kind === 'purple') say('Purple bonus!', '#f0c8ff');
    if (p.kind === 'green') givePower();
    if (b && !b.firstHit) {
      b.firstHit = true;
      if (has('multi') && live.length < 3 && !b.split) {
        live.push({ x: b.x, y: b.y, vx: -b.vx || 0.8, vy: b.vy - 0.4, r: b.r, split: true, fireT: b.fireT, spooky: false });
        b.split = true;
        say('Multiball!', POWERS.multi.color);
      }
      if (has('blast')) {
        say('Star Blast!', POWERS.blast.color);
        for (const q of pegs) if (!q.lit && !q.gone && Math.hypot(q.x - p.x, q.y - p.y) < 20) hit(q);
      }
    }
    if (p.kind === 'orange' && oranges().every(o => o.lit || o.gone) && !fever) startFever();
    hud();
  }

  function givePower(forced) {
    // a second green while a power is still running tops up that same power instead of swapping it
    if (power && !forced) {
      const kind = power.kind;
      power.shots += 2;
      powerFresh = true;
      say(`More ${POWERS[kind].name}!`, POWERS[kind].color, true);
      ui.status(`${POWERS[kind].name} topped up: lasts this shot and ${power.shots} more.`);
      sfx('sparkle');
      if (kind === 'fire') live.forEach(b => (b.fireT = 150));
      if (kind === 'big') live.forEach(b => (b.r = 4));
      return;
    }
    const kind = forced || POWER_KEYS[(Math.random() * POWER_KEYS.length) | 0];
    power = { kind, shots: 2 };
    powerFresh = true;
    say(`${POWERS[kind].name}!`, POWERS[kind].color, true);
    ui.status(`${POWERS[kind].name}: ${POWERS[kind].desc}. Lasts this shot and 2 more.`);
    sfx('sparkle');
    if (kind === 'fire') live.forEach(b => (b.fireT = 150));
    if (kind === 'big') live.forEach(b => (b.r = 4));
  }

  function startFever() {
    fever = true;
    slow = 70;
    say('FEVER!', '#f08ab0', true);
    sfx('alarm');
    ui.status('Last orange! Drop it into a bonus bin!');
  }

  // ---------- input ----------
  const setAim = p => {
    aim = Math.max(0.1, Math.min(Math.PI - 0.1, Math.atan2(p.y - LAUNCH.y, p.x - LAUNCH.x)));
    if (p.y < LAUNCH.y) aim = p.x > LAUNCH.x ? 0.1 : Math.PI - 0.1;
  };
  let aiming = false;
  canvas.addEventListener('pointerdown', e => { if (shooting || done) return; aiming = true; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } setAim(toLogical(canvas, W, H, e)); });
  canvas.addEventListener('pointermove', e => { if (aiming) setAim(toLogical(canvas, W, H, e)); });
  canvas.addEventListener('pointerup', e => { if (!aiming) return; aiming = false; setAim(toLogical(canvas, W, H, e)); shoot(); });
  S.aimAt = (x, y) => { setAim({ x, y }); shoot(); };
  S.pegs = pegs;
  S.give = kind => { givePower(kind); powerFresh = false; hud(); };
  S.green = () => { givePower(); hud(); return power && { ...power }; };

  function shoot() {
    if (shooting || done || balls <= 0) return;
    balls--;
    shooting = true;
    shotScore = 0;
    S.combo = 0;
    powerFresh = false;
    const r = has('big') ? 4 : 2;
    live = [{ x: LAUNCH.x + Math.cos(aim) * 6, y: LAUNCH.y + Math.sin(aim) * 6, vx: Math.cos(aim) * SPEED, vy: Math.sin(aim) * SPEED, r, fireT: has('fire') ? 150 : 0, flips: has('flippers') ? 3 : 0, spooky: has('spooky') }];
    sfx('swap');
    hud();
  }

  return new Promise(resolve => {
    requestAnimationFrame(() => { ctx = fitCanvas(canvas, W, H).ctx; loop(); });
    let ctx;

    async function endShot() {
      shooting = false;
      trail = [];
      // clear the lit pegs, one after another
      const lit = pegs.filter(p => p.lit && !p.gone);
      for (const [i, p] of lit.entries()) setTimeout(() => { p.gone = true; pops.push({ x: p.x, y: p.y, t: 0, c: PEG_COL[p.kind][1] }); }, i * 35);
      await sleep(lit.length * 35 + 120);
      // free balls for a big shot
      const free = FREE_AT.filter(t => shotScore >= t).length;
      if (free) { balls += free; say(free > 1 ? `${free} free balls!` : 'Free ball!', '#ffe27a', true); sfx('coin'); }
      if (power && !powerFresh && --power.shots <= 0) { say(`${POWERS[power.kind].name} wore off`, '#c9ad7f'); power = null; }
      else if (power && powerFresh) powerFresh = false;
      hud();
      if (oranges().every(o => o.gone)) return finish(true);
      if (balls <= 0) return finish(false);
      movePurple();
      hud();
      ui.status(power ? `${POWERS[power.kind].name} is ready. Aim and shoot!` : 'Aim and shoot!');
    }

    async function finish(won) {
      done = true;
      hud();
      if (won) {
        const bonus = balls * 5000;
        if (bonus) { score += bonus; say(`+${bonus.toLocaleString()} for ${balls} ball${balls === 1 ? '' : 's'} left`, '#ffe27a'); hud(); }
        confetti(80);
      }
      sfx(won ? 'tttwin' : 'tttlose');
      await sleep(900);
      await banner(ui, won ? 'win' : 'lose', won ? `Every orange peg is gone! ${score.toLocaleString()} points.` : 'Out of balls.');
      resolve({ won, score, balls });
    }

    function update() {
      frame++;
      if (L.spin) { angle += L.spin / 60; place(); }
      bucketT += (L.bucketSpeed || 0.6) / 60;
      for (const p of pops) p.t++;
      pops = pops.filter(p => p.t < 30);
      for (const c of callouts) c.t++;
      callouts = callouts.filter(c => c.t < 75);
      if (!shooting) return;
      if (slow > 0 && frame % 3) { slow--; return; } // fever slow motion
      for (const b of live) {
        if (b.out) continue;
        for (let s = 0; s < SUB; s++) stepBall(b, true, hit);
        if (b.fireT > 0) b.fireT--;
        trail.push({ x: b.x, y: b.y, fire: b.fireT > 0 });
        // flippers kick it back up from the bottom corners
        if (b.flips > 0 && b.y > 150 && b.vy > 0 && (b.x < 30 || b.x > 90)) { b.flips--; b.vy = -3.6; b.vx = b.x < 60 ? 1.1 : -1.1; say('Flip!', POWERS.flippers.color); sfx('land'); }
        if (fever) {
          if (b.y > BUCKET_Y + 2) { b.out = true; feverBin = Math.min(4, Math.max(0, Math.floor((b.x / W) * 5))); const pts = FEVER_BINS[feverBin]; score += pts; say(`+${pts.toLocaleString()}!`, '#f08ab0', true); sfx('win'); confetti(40); hud(); }
        } else {
          const bx = bucketX(), hw = bucketW() / 2;
          if (b.vy > 0 && b.y > BUCKET_Y + 1 && b.y < BUCKET_Y + 10 && Math.abs(b.x - bx) < hw - 1) {
            b.out = true; balls++; say('Free ball!', '#ffe27a', true); sfx('coin'); hud();
          } else if (b.y > H + 4) {
            if (b.spooky) { b.spooky = false; b.y = 2; b.vy = 0.4; b.vx *= 0.5; say('Spooky!', POWERS.spooky.color, true); sfx('morph'); }
            else b.out = true;
          }
        }
      }
      if (trail.length > 14 * live.length) trail.splice(0, trail.length - 14 * live.length);
      // a stuck ball: clear what it's lit so it can fall
      const moving = live.some(b => !b.out && Math.hypot(b.vx, b.vy) > 0.25);
      stuck = moving ? 0 : stuck + 1;
      if (stuck > 50) { stuck = 0; pegs.filter(p => p.lit && !p.gone).forEach(p => (p.gone = true)); live.forEach(b => (b.vy += 0.5)); }
      if (live.every(b => b.out)) endShot();
    }

    function drawPeg(p) {
      const [base, lit] = PEG_COL[p.kind];
      const x = Math.round(p.x), y = Math.round(p.y);
      ctx.fillStyle = '#1a1220'; ctx.fillRect(x - 3, y - 2, 6, 4); ctx.fillRect(x - 2, y - 3, 4, 6);
      ctx.fillStyle = p.lit ? lit : base; ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.fillStyle = p.lit ? '#ffffff' : 'rgba(255,255,255,0.45)'; ctx.fillRect(x - 1, y - 2, 1, 1);
      if (p.kind === 'purple' && !p.lit && frame % 30 < 15) { ctx.fillStyle = '#f0c8ff'; ctx.fillRect(x + 2, y - 4, 1, 1); ctx.fillRect(x - 3, y + 3, 1, 1); }
      if (p.kind === 'green' && !p.lit) { ctx.fillStyle = `rgba(216,248,176,${0.25 + 0.25 * Math.sin(frame / 8)})`; ctx.fillRect(x - 4, y - 4, 8, 8); }
    }

    function draw() {
      ctx.fillStyle = '#141c34'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1e2850';
      for (let i = 0; i < 40; i++) ctx.fillRect((i * 37) % W, (i * 53 + frame * 0.05) % H, 1, 1);
      // theme tint
      ctx.globalAlpha = 0.08; ctx.fillStyle = L.color || '#9fd3f2'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      ctx.fillStyle = '#3a2216'; ctx.fillRect(0, 0, 1, H); ctx.fillRect(W - 1, 0, 1, H);
      // aim line
      if (!shooting && !done) {
        ctx.fillStyle = has('guide') ? 'rgba(159,211,242,0.85)' : 'rgba(255,244,224,0.55)';
        for (const [x, y] of guidePoints()) ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      for (const p of pegs) if (!p.gone) drawPeg(p);
      for (const p of pops) {
        ctx.globalAlpha = 1 - p.t / 30;
        ctx.fillStyle = p.c;
        const r = p.t / 3;
        ctx.fillRect(Math.round(p.x - r), Math.round(p.y), 1, 1); ctx.fillRect(Math.round(p.x + r), Math.round(p.y), 1, 1);
        ctx.fillRect(Math.round(p.x), Math.round(p.y - r), 1, 1); ctx.fillRect(Math.round(p.x), Math.round(p.y + r), 1, 1);
        if (p.pts && p.t < 24) { ctx.font = '6px "Jersey 10", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff4e0'; ctx.fillText(String(p.pts), p.x, p.y - 4 - p.t / 3); }
      }
      ctx.globalAlpha = 1;
      // launcher
      ctx.fillStyle = '#ffe27a';
      ctx.fillRect(LAUNCH.x - 5, 2, 10, 2); ctx.fillRect(LAUNCH.x - 6, 4, 2, 5); ctx.fillRect(LAUNCH.x + 4, 4, 2, 5); ctx.fillRect(LAUNCH.x - 5, 9, 10, 2);
      ctx.fillStyle = '#fff4e0'; ctx.fillRect(Math.round(LAUNCH.x + Math.cos(aim) * 8), Math.round(LAUNCH.y + Math.sin(aim) * 8), 2, 2);
      // bottom: fever bins, or the bucket (and flippers)
      if (fever) {
        FEVER_BINS.forEach((pts, i) => {
          const x = (i * W) / 5;
          ctx.fillStyle = feverBin === i ? '#ffe27a' : i % 2 ? '#c0507a' : '#f08ab0';
          ctx.fillRect(Math.round(x), BUCKET_Y, Math.ceil(W / 5), H - BUCKET_Y);
          ctx.fillStyle = '#1a1220'; ctx.font = '6px "Jersey 10", monospace'; ctx.textAlign = 'center';
          ctx.fillText(`${pts / 1000}k`, x + W / 10, BUCKET_Y + 8);
        });
      } else {
        drawBucket(ctx, bucketX(), BUCKET_Y, bucketW(), 0);
        if (has('flippers')) { ctx.fillStyle = POWERS.flippers.color; ctx.fillRect(4, 152, 14, 2); ctx.fillRect(W - 18, 152, 14, 2); }
      }
      // balls and trails
      trail.forEach((t, i) => { ctx.globalAlpha = (i / trail.length) * 0.6; ctx.fillStyle = t.fire ? '#f39a3a' : '#9fd3f2'; ctx.fillRect(Math.round(t.x - 1), Math.round(t.y - 1), 2, 2); });
      ctx.globalAlpha = 1;
      for (const b of live) if (!b.out) {
        const x = Math.round(b.x), y = Math.round(b.y), r = b.r;
        ctx.fillStyle = b.fireT > 0 ? '#d0463c' : '#1a1220'; ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = b.fireT > 0 ? '#ffe27a' : b.spooky ? '#d8c4f0' : '#fff4e0'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      if (!shooting && !done) { ctx.fillStyle = '#fff4e0'; ctx.fillRect(LAUNCH.x - 1, LAUNCH.y - 1, 3, 3); }
      // callouts
      callouts.forEach((c, i) => {
        const s = Math.min(1, c.t / 8);
        ctx.globalAlpha = c.t > 55 ? 1 - (c.t - 55) / 20 : 1;
        ctx.font = `${Math.max(1, Math.round((c.big ? 14 : 10) * (0.6 + 0.4 * s)))}px "Jersey 10", monospace`;
        ctx.textAlign = 'center';
        const y = 30 + i * 12 - c.t * 0.15;
        ctx.fillStyle = '#1a1220'; ctx.fillText(c.text, W / 2 + 1, y + 1);
        ctx.fillStyle = c.color; ctx.fillText(c.text, W / 2, y);
      });
      ctx.globalAlpha = 1;
      if (slow > 0) { ctx.fillStyle = `rgba(240,138,176,${0.08 + 0.06 * Math.sin(frame / 4)})`; ctx.fillRect(0, 0, W, H); }
    }

    function loop() {
      if (!canvas.isConnected) return;
      update();
      draw();
      requestAnimationFrame(loop);
    }

    // Test autopilot: aim at a random unlit orange each shot.
    if (auto) {
      const tick = setInterval(() => {
        if (!canvas.isConnected || done) return clearInterval(tick);
        if (shooting) return;
        const t = oranges().filter(p => !p.lit && !p.gone);
        const p = t[(Math.random() * t.length) | 0];
        if (p) S.aimAt(p.x + (Math.random() - 0.5) * 2, p.y);
      }, 300);
    }
    root.__sp = S;
  });
}
