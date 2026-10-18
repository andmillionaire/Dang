import { h } from '../ui.js';
import { rnd, pick, shuffle, clamp, dist, tapper, follow, holdable, art, canvas, addStyle } from './kit.js';

// Funtendo, assorted: quick parodies of classic Nintendo moments (Duck Hunt, Punch-Out!!, Excitebike,
// Ice Climber, Pikmin, Splatoon, Smash, F-Zero, Game & Watch, Wii Sports and friends), with a few
// magical-girl twists. Art is our own pixel drawing on a 100x100 canvas, so canvas units == stage %.

addStyle('fun-mix', `
[class*="mcs-fx-"] .mc-canvas { position: absolute; inset: 0; width: 100% !important; height: 100% !important; display: block; image-rendering: pixelated; }
.fx-brain { position: absolute; inset: 0; background: #f4f0e4; display: grid; align-content: center; justify-items: center; gap: 14px; }
.fx-brain .fx-q { font-size: 56px; color: #1a1220; margin: 0; line-height: 1; }
.fx-step { position: absolute; top: 8px; left: 0; right: 0; text-align: center; color: #6a5a7a; font-size: 18px; margin: 0; pointer-events: none; }
.fx-brain .fx-row, .fx-tri .fx-row { display: flex; gap: 10px; }
.fx-brain button { width: 66px; height: 58px; font: inherit; font-size: 32px; border: 0; background: #1a1220; color: #fff4e0; box-shadow: 0 4px 0 #6a5a7a; touch-action: none; }
.fx-brain .fx-tick { position: absolute; bottom: 10px; left: 0; right: 0; text-align: center; color: #c0507a; font-size: 20px; margin: 0; }
.fx-tri { position: absolute; inset: 0; background: linear-gradient(#2c5a9a, #1a2a4a); display: grid; align-content: center; justify-items: center; gap: 10px; }
.fx-tri .fx-foe { display: grid; justify-items: center; gap: 2px; color: #fff4e0; font-size: 19px; margin: 0; }
.fx-tri .fx-foe img { width: 64px; image-rendering: pixelated; }
.fx-tri button { width: 78px; height: 78px; border: 0; background: #f2e6c9; box-shadow: 0 4px 0 #a0663a; display: grid; place-items: center; padding: 4px; font: inherit; font-size: 15px; color: #1a1220; touch-action: none; }
.fx-tri button img { width: 44px; image-rendering: pixelated; pointer-events: none; }
.fx-tri .fx-hint { color: #9fd3f2; font-size: 16px; margin: 0; }
.fx-tri .fx-step { color: #ffe27a; }
`);

// ---------- drawing helpers ----------
const SPR = new Map();
function spr(rows, pal = {}) {
  const key = rows.join('/') + JSON.stringify(pal);
  if (!SPR.has(key)) {
    const i = new Image();
    i.src = art(rows, pal);
    SPR.set(key, { i, w: Math.max(...rows.map(r => r.length)), h: rows.length });
  }
  return SPR.get(key);
}
function put(ctx, s, x, y, sc = 1, flip = false) {
  if (!s.i.complete) return;
  const w = s.w * sc, hh = s.h * sc;
  if (flip) {
    ctx.save();
    ctx.translate(Math.round(x), 0);
    ctx.scale(-1, 1);
    ctx.drawImage(s.i, Math.round(-w / 2), Math.round(y - hh / 2), w, hh);
    ctx.restore();
  } else ctx.drawImage(s.i, Math.round(x - w / 2), Math.round(y - hh / 2), w, hh);
}
const R = (ctx, x, y, w, hh, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hh)); };
function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function ring(ctx, x, y, r, c, lw = 1) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.stroke(); }
function txt(ctx, s, x, y, col = '#fff4e0', size = 10) {
  ctx.font = `${size}px "Jersey 10", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1a1220';
  ctx.fillText(s, x + 0.6, y + 0.6);
  ctx.fillStyle = col;
  ctx.fillText(s, x, y);
}
const scene = stage => canvas(stage, 100, 100).ctx;
function reflect(x, lo, hi) {
  const w = hi - lo;
  let u = (x - lo) % (2 * w);
  if (u < 0) u += 2 * w;
  return u <= w ? lo + u : lo + 2 * w - u;
}
function stars(ctx, seed = 3, n = 24, col = '#2a3a5c') {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) ctx.fillRect(((i * 37 + seed * 11) % 97) + 1, ((i * 53 + seed * 7) % 95) + 1, 1, 1);
}
const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch { /* synthetic */ } };
// a wandering target: moves toward a random point, picking a new one on arrival
function wander(o, v, dt, box = [10, 90, 10, 60]) {
  if (o.tx === undefined || Math.hypot(o.tx - o.x, o.ty - o.y) < 3) { o.tx = box[0] + Math.random() * (box[1] - box[0]); o.ty = box[2] + Math.random() * (box[3] - box[2]); }
  const d = Math.hypot(o.tx - o.x, o.ty - o.y) || 1;
  o.vx = ((o.tx - o.x) / d) * v; o.vy = ((o.ty - o.y) / d) * v;
  o.x += o.vx * dt; o.y += o.vy * dt;
}

// ---------- sprites ----------
const DUCK = ['......GG...', '.....GGkG..', '.....GGGyy.', '..BBBBGG...', 'BbbBbbbB...', '.bcccbbbB..', '..bbbbbbB..', '...yy.yy...'];
const DUCK_FLAP = ['.cc...GG...', 'ccc..GGkG..', '.ccb.GGGyy.', '..BBBBGG...', 'BbbBbbbB...', '.bbbbbbbB..', '..bbbbbbB..', '...yy.yy...'];
const DUCK_HIT = ['...yy.yy...', '..bbbbbbB..', '.bcccbbbB..', 'BbbBbbbB...', '..BBBBGG...', '.....GGGyy.', '.....GGkG..', '......GG...'];
const DOG = ['.BB......BB.', 'BbbB....BbbB', 'BbbbbbbbbbbB', '.bbwkbbwkbb.', '.bbbbbbbbbb.', '..bbbkkkbb..', '..bbkffkbb..', '.bbbbkkbbbb.', 'bbbbbbbbbbbb'];
const BOXER = ['...GGGGGG...', '..GGGGGGGG..', '..ccwkcwkc..', '..cccccccc..', '..cccRRccc..', '...cccccc...', '.GGGGGGGGGG.', 'GGGGggggGGGG', 'GGGGGGGGGGGG'];
const CLIMBER = ['..pppp..', '.pppppp.', '.pccccp.', '.ckcckc.', '.pccccp.', 'pppppppp', 'pPPPPPPp', '.pp..pp.', '.BB..BB.'];
const CLIMBER_UP = ['b.pppp..', 'b.ppppp.', 'bppcccpp', '.pkcckc.', '.pccccp.', 'pppppppp', '.PPPPPP.', '.pp..pp.', 'BB....BB'];
const FLYER = ['...rr.uu...', '..rrrruuuu.', '..rrrruuuu.', '...rr.uu...', '....k.k....', '....kkk....', '...ccccc...', '...ckckc...', '..UUUUUUU..', '..UU...UU..'];
const FOE_FLY = ['...gg.gg...', '..gggggggg.', '..gggggggg.', '...gg.gg...', '....k.k....', '....kkk....', '...RRRRR...', '...RwkwR...', '..RRRRRRR..', '..RR...RR..'];
const PIK_R = ['..y..', '.yky.', '..k..', '.rrr.', 'rwrwr', 'rrrrr', '.rrr.', '.r.r.'];
const PIK_Y = ['..w..', '.wkw.', '..k..', '.yyy.', 'ykyky', 'yyyyy', '.yyy.', '.y.y.'];
const PIK_B = ['..y..', '.yky.', '..k..', '.UUU.', 'UwUwU', 'UUUUU', '.UUU.', '.U.U.'];
const PELLET = ['..rrrrrr..', '.rrrrrrrr.', 'rrrwwrrrrr', 'rrwwrrrrrr', 'rrrrr55rrr', 'rrrr5555rr', 'rrrrr55rrr', 'rrrrrrrrrr', '.rrrrrrrr.', '..rrrrrr..'];
const LEADER = ['..rrrr..', '.rrrrrr.', '.cccccc.', '.ckcckc.', '..cccc..', '.UUUUUU.', 'UUUyyUUU', '.UU..UU.', '.kk..kk.'];
const SQUID = ['...ff...', '..ffff..', '.ffffff.', 'ffwkkwff', 'ffwkkwff', 'ffffffff', 'f.f..f.f', 'f.f..f.f'];
const SQUID_R = ['...uu...', '..uuuu..', '.uuuuuu.', 'uuwkkwuu', 'uuwkkwuu', 'uuuuuuuu', 'u.u..u.u', 'u.u..u.u'];
const FIGHTER = ['..ffff..', '.ffffff.', '.fcccff.', '.ckcckf.', '..cccc..', '.yffffy.', 'yffwwffy', '.ff..ff.', '.ww..ww.'];
const RIVAL = ['..GGGG..', '.GGGGGG.', '.Gcccc..', '.ckcckc.', '..cccc..', '.RRRRRR.', 'RRRRRRRR', '.RR..RR.', '.BB..BB.'];
const CAR = ['..ff..', '.fwwf.', 'ffffff', 'fUffUf', 'ffffff', 'kffffk', 'k.yy.k'];
const NOSE = ['....cccc....', '...cccccc...', '...cccccc...', '..cccccccc..', '..cccccccc..', '.cccccccccc.', '.cccccccccc.', 'cccccccccccc', 'cccRRccRRccc', '.ccRRccRRcc.', '..cccccccc..'];
const FINGER = ['.cc.', 'cccc', 'cwwc', 'cccc', 'cccc', 'cccc', 'cccc', 'cccc', 'CCCC'];
const PUP = ['.tt......tt.', 'tTTt....tTTt', 'tTTtccccTTt.', '.ttccccccct.', '..cwkcckwc..', '..cccccccc..', '..cccTTccc..', '...ccffcc...', '..cccccccc..', '.cccccccccc.', 'cccccccccccc', 'cc.cc..cc.cc'];
const GNAT = ['k.k', '.k.', 'kkk'];
const POT = ['.BBBB.', 'BttttB', 'BtBBtB', 'BttttB', '.BBBB.'];
const KARATE = ['..kkkk..', '.kkkkkk.', '.kcccck.', '.ckcckc.', '..cccc..', 'wwwwwwww', 'wwwkkwww', '.ww..ww.', '.cc..cc.'];
const CROW = ['....kkk...', '...kkkkk..', '..kkkwkk..', '.kkkkkkkyy', 'kkkkkkkk..', 'kkkkkkkk..', '.kkkkkkk..', '..k...k...'];
const ANGEL = ['.w....w.', 'ww.yy.ww', 'wwyyyyww', '.wcccc.w', '..ckck..', '..cccc..', '.wwwwww.', '..wwww..', '..c..c..'];
const GIRL = ['..ffff..', '.ffyfff.', 'ffccccff', 'f.ckkc.f', 'f.cccc.f', '..pFFp..', '.cpppc..', 'c.pppp.c', '..p..p..', '..w..w..'];
const SWORD = ['........ss', '.......sws', '......sws.', '.....sws..', '....sws...', '.y.sws....', '..yys.....', '..Byy.....', '.B..y.....', 'B.........'];
const LANCE = ['........ws', '.......wsw', '......sws.', '.....bs...', '....bb....', '...bb.....', '..bb......', '.bb.......', 'bb........', 'b.........'];
const AXE = ['...ss.....', '..ssss....', '.ssswss...', '.ssssbs...', '..ssbb....', '....bb....', '...bb.....', '..bb......', '.bb.......', 'bb........'];
const SMASHBALL = ['...yyyy...', '.yyrrrryy.', '.yrrffrry.', 'yrrfwwfrry', 'yrfwkkwfry', 'yrfwkkwfry', 'yrrfwwfrry', '.yrrffrry.', '.yyrrrryy.', '...yyyy...'];

const RAINBOW = ['#d0463c', '#f39a3a', '#ffe27a', '#6fb04a', '#4f8fd0', '#a46ad0'];

// Find move times for "step forward when it's safe" games: safe(step, t) says whether standing on
// `step` at time t is safe. Returns the list of move times reaching `goal` before `limit`, or null.
function planSteps(safe, from, goal, t0, limit, DT = 0.04, hold = 3) {
  const steps = Math.ceil((limit - t0) / DT);
  const seen = new Set();
  const stack = [[from, 0, []]];
  while (stack.length) {
    const [st, k, moves] = stack.pop();
    if (st >= goal) return moves;
    if (k >= steps) continue;
    const key = st * 100000 + k;
    if (seen.has(key)) continue;
    seen.add(key);
    if (safe(st, t0 + (k + 1) * DT)) stack.push([st, k + 1, moves]);
    let ok = true;
    for (let j = 0; j <= hold; j++) if (!safe(st + 1, t0 + (k + j) * DT)) { ok = false; break; }
    if (ok) stack.push([st + 1, k + 3, [...moves, t0 + k * DT]]);
  }
  return null;
}

// ---------- the microgames ----------
export default [
  // 1. Duck Hunt: shoot the ducks, never the laughing dog.
  {
    id: 'fx-duckhunt', cmd: 'Shoot the ducks!', theme: 'funtendo', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const n = speed > 1.6 ? 3 : 2;
      const s = expose({
        ducks: Array.from({ length: n }, () => ({ x: 20 + rnd(60), y: 54, vx: (22 + rnd(12)) * speed * (Math.random() < 0.5 ? -1 : 1), vy: -(20 + rnd(10)) * speed, hit: false, fall: 0 })),
        shells: n + 2, dog: { x: 50, up: 0, next: 0.6 }, flash: 0,
      });
      let ft = 0, done = false;
      tapper(stage, e => {
        if (done || s.shells <= 0) return;
        const p = pos(e);
        if (s.dog.up > 0 && Math.abs(p.x - s.dog.x) < 9 && p.y > 62 && p.y < 86) { done = true; s.dogShot = true; sfx('nope'); return lose(); }
        s.shells--; s.flash = 0.06; sfx('boom');
        const d = s.ducks.find(q => !q.hit && dist(q, p) < 8);
        if (d) { d.hit = true; sfx('pop'); }
        if (!s.ducks.every(q => q.hit) && s.shells <= 0) { done = true; setTimeout(lose, 150); }
      });
      frame(dt => {
        ft += dt; s.flash = Math.max(0, s.flash - dt);
        // the dog pops up out of the grass now and then, laughing at you
        s.dog.next -= dt;
        if (s.dog.up > 0) s.dog.up -= dt;
        else if (s.dog.next <= 0) { s.dog.up = 0.7; s.dog.x = 20 + rnd(60); s.dog.next = 1.2 + Math.random(); sfx('woof'); }
        for (const d of s.ducks) {
          if (d.hit) { d.fall += dt; d.y += 80 * dt; continue; }
          d.x += d.vx * dt; d.y += d.vy * dt;
          if (d.x < 8) { d.x = 8; d.vx = Math.abs(d.vx); } else if (d.x > 92) { d.x = 92; d.vx = -Math.abs(d.vx); }
          if (d.y < 8) { d.y = 8; d.vy = Math.abs(d.vy); } else if (d.y > 56) { d.y = 56; d.vy = -Math.abs(d.vy); }
        }
        if (s.ducks.every(q => q.hit && q.fall > 0.35)) return win();
        R(ctx, 0, 0, 100, 100, s.flash > 0 ? '#ffffff' : '#64b0ff');
        if (s.flash > 0) return;
        R(ctx, 74, 30, 10, 44, '#6b3d22'); circ(ctx, 79, 28, 14, '#3d7a34'); circ(ctx, 71, 34, 9, '#6fb04a');
        for (const d of s.ducks) if (d.y < 78) put(ctx, spr(d.hit ? DUCK_HIT : Math.floor(ft * 8) % 2 ? DUCK_FLAP : DUCK), d.x, d.y, 1.3, d.vx < 0);
        if (s.dog.up > 0) put(ctx, spr(DOG), s.dog.x, 70 + Math.sin(ft * 30) * 1, 1.4);
        R(ctx, 0, 74, 100, 26, '#3d7a34'); for (let x = 0; x < 100; x += 6) R(ctx, x, 72, 3, 4, '#6fb04a');
        R(ctx, 0, 88, 100, 12, '#a0663a');
        for (let i = 0; i < s.shells; i++) R(ctx, 6 + i * 5, 91, 3, 6, '#d0463c');
        txt(ctx, 'NOT THE DOG!', 66, 94, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const d = s.ducks.find(q => !q.hit);
        if (!d) break;
        await b.tap({ x: d.x + d.vx * 0.02, y: Math.min(57, d.y + d.vy * 0.02) });
        await b.wait(60);
      }
    },
  },

  // 2. Punch-Out!!: dodge away from the glowing glove, then counter while he's dizzy.
  {
    id: 'fx-punchout', cmd: 'Dodge & counter!', theme: 'funtendo', time: 7,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ st: 'idle', t: 0, side: 'L', dodge: null, hits: 0, need: 2 });
      const idle = 0.5 / Math.sqrt(speed), tell = 0.8 / Math.sqrt(speed), dizzy = 0.9;
      tapper(stage, e => {
        const p = pos(e);
        if (s.st === 'tell') { if (p.x < 35) s.dodge = 'L'; else if (p.x > 65) s.dodge = 'R'; sfx('swap'); return; }
        if (s.st === 'dizzy' && p.x >= 25 && p.x <= 75 && p.y < 65) { s.hits++; s.st = 'hit'; s.t = 0; sfx('boom'); }
      });
      let ft = 0;
      frame(dt => {
        ft += dt; s.t += dt;
        if (s.st === 'idle' && s.t > idle) { s.st = 'tell'; s.t = 0; s.side = Math.random() < 0.5 ? 'L' : 'R'; s.dodge = null; sfx('select'); }
        else if (s.st === 'tell' && s.t > tell) {
          if (s.dodge === (s.side === 'L' ? 'R' : 'L')) { s.st = 'dizzy'; s.t = 0; sfx('land'); }
          else { s.st = 'ko'; sfx('nope'); return lose(); }
        } else if (s.st === 'dizzy' && s.t > dizzy) { s.st = 'idle'; s.t = 0; }
        else if (s.st === 'hit' && s.t > 0.35) { if (s.hits >= s.need) return win(); s.st = 'idle'; s.t = 0; }
        // ring
        R(ctx, 0, 0, 100, 100, '#1a1430'); for (let i = 0; i < 40; i++) R(ctx, (i * 29) % 100, 6 + ((i * 13) % 20), 1, 1, '#4a3a6a');
        R(ctx, 0, 30, 100, 1, '#d0463c'); R(ctx, 0, 40, 100, 1, '#fff4e0'); R(ctx, 0, 50, 100, 1, '#4f8fd0');
        R(ctx, 0, 60, 100, 40, '#3a6a9a');
        const shake = s.st === 'hit' ? (Math.random() - 0.5) * 4 : 0;
        put(ctx, spr(BOXER), 50 + shake, 38, 3.2);
        // gloves: the telling glove pulls back and glows
        const gl = (side, x) => {
          const telling = s.st === 'tell' && s.side === side;
          const gx = x + (telling ? (side === 'L' ? -6 : 6) : 0), gy = telling ? 44 : 58;
          circ(ctx, gx, gy, 8, telling && Math.floor(ft * 12) % 2 ? '#ffe27a' : '#d0463c');
          circ(ctx, gx - 2, gy - 2, 3, '#ff8a7a');
        };
        gl('L', 28); gl('R', 72);
        if (s.st === 'dizzy') for (let i = 0; i < 3; i++) { const a = ft * 6 + i * 2.1; txt(ctx, '★', 50 + Math.cos(a) * 12, 18 + Math.sin(a) * 4, '#ffe27a', 9); }
        // you, from behind
        const px = 50 + (s.dodge === 'L' && s.st !== 'idle' ? -22 : s.dodge === 'R' && s.st !== 'idle' ? 22 : 0);
        R(ctx, px - 9, 72, 18, 28, '#6fb04a'); circ(ctx, px, 72, 9, '#2a1a10');
        txt(ctx, s.st === 'dizzy' ? 'PUNCH HIS FACE!' : s.st === 'tell' ? 'DODGE AWAY!' : '', 50, 94, '#ffe27a', 8);
        for (let i = 0; i < s.need; i++) R(ctx, 4 + i * 6, 4, 4, 4, i < s.hits ? '#ffe27a' : '#3a2a5c');
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        await b.until(() => s.st === 'tell');
        if (b.over()) break;
        await b.tap({ x: s.side === 'L' ? 88 : 12, y: 82 });
        await b.until(() => s.st === 'dizzy');
        if (b.over()) break;
        await b.tap({ x: 50, y: 30 });
        await b.until(() => s.st !== 'hit');
      }
    },
  },

  // 3. Excitebike: land the jump flat.
  {
    id: 'fx-excite', cmd: 'Land flat!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const s = expose({ t: 0, ang: 0, A: 38, w: 2.4 * speed, ph: 0.5 + Math.random() * 2, landed: false, tol: 11 / Math.sqrt(speed), drop: 0 });
      const angAt = t => s.A * Math.sin(s.w * t + s.ph);
      s.angAt = angAt;
      tapper(stage, () => {
        if (s.landed) return;
        s.landed = true;
        s.ok = Math.abs(s.ang) < s.tol;
        sfx(s.ok ? 'land' : 'nope');
        setTimeout(() => (s.ok ? win() : lose()), 450);
      });
      frame(dt => {
        s.t += dt;
        if (!s.landed) s.ang = angAt(s.t);
        else s.drop = Math.min(1, s.drop + dt * 4);
        const bx = Math.min(70, 26 + s.t * 10);
        const by = s.landed ? 30 + s.drop * 36 : 30 + Math.sin(s.t * 3) * 3;
        R(ctx, 0, 0, 100, 100, '#64b0ff');
        for (let i = 0; i < 50; i++) R(ctx, (i * 7) % 100, 52 + ((i * 3) % 8), 2, 2, RAINBOW[i % 6]);
        R(ctx, 0, 60, 100, 6, '#d8d8e8');
        R(ctx, 0, 66, 100, 34, '#c79a5a'); for (let x = 0; x < 100; x += 10) R(ctx, x, 80, 6, 2, '#a0663a');
        ctx.fillStyle = '#a0663a'; ctx.beginPath(); ctx.moveTo(0, 66); ctx.lineTo(18, 46); ctx.lineTo(24, 46); ctx.lineTo(24, 66); ctx.fill();
        // the bike
        ctx.save();
        ctx.translate(bx, by);
        const a = s.landed && !s.ok ? s.ang * 2 : s.ang;
        ctx.rotate((a * Math.PI) / 180);
        circ(ctx, -9, 4, 5, '#1a1220'); circ(ctx, 9, 4, 5, '#1a1220'); circ(ctx, -9, 4, 2, '#d8d8e8'); circ(ctx, 9, 4, 2, '#d8d8e8');
        R(ctx, -9, -2, 18, 4, '#d0463c'); R(ctx, 4, -6, 6, 4, '#d0463c');
        R(ctx, -4, -12, 6, 10, '#ffffff'); circ(ctx, -1, -15, 4, '#d0463c');
        ctx.restore();
        // angle gauge
        R(ctx, 30, 6, 40, 6, '#1a1220'); R(ctx, 50 - s.tol / 38 * 20, 6, s.tol / 38 * 40, 6, '#6fb04a');
        R(ctx, 50 + (s.ang / 38) * 20 - 1, 4, 2, 10, '#fff4e0');
        txt(ctx, s.landed ? (s.ok ? 'PERFECT!' : 'CRASH!') : 'TAP WHEN LEVEL', 50, 20, '#fff4e0', 8);
      });
    },
    async solve(b, s) {
      await b.until(() => s.t > 0.2 && Math.abs(s.ang) < s.tol * 0.6);
      await b.tap({ x: 50, y: 50 });
    },
  },

  // 4. Ice Climber: jump up through the gaps in the ice.
  {
    id: 'fx-iceclimb', cmd: 'Bonk up!', theme: 'funtendo', time: 7,
    setup({ stage, win, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const rows = [70, 50, 30];
      const s = expose({ t: 0, level: 0, busy: 0, jump: 0, bonk: 0, gaps: rows.map((_, i) => ({ w: (1.3 + i * 0.35) * speed, ph: Math.random() * 6 })) });
      const gapAt = (i, t) => 50 + 34 * Math.sin(t * s.gaps[i].w + s.gaps[i].ph);
      s.gapAt = gapAt;
      const feet = () => (s.level === 0 ? 88 : rows[s.level - 1] - 3);
      tapper(stage, () => {
        if (s.busy > 0 || s.level >= 3) return;
        if (Math.abs(gapAt(s.level, s.t) - 50) < 5.5) { s.jump = 0.35; s.busy = 0.35; sfx('swap'); }
        else { s.bonk = 0.4; s.busy = 0.45; sfx('land'); }
      });
      frame(dt => {
        s.t += dt;
        s.busy = Math.max(0, s.busy - dt); s.bonk = Math.max(0, s.bonk - dt);
        if (s.jump > 0) { s.jump -= dt; if (s.jump <= 0) { s.level++; sfx('coin'); if (s.level >= 3) return win(); } }
        R(ctx, 0, 0, 100, 100, '#1a2a4a'); stars(ctx, 6, 30, '#4a6a9a');
        ctx.fillStyle = '#2c5a9a'; ctx.beginPath(); ctx.moveTo(0, 100); ctx.lineTo(30, 20); ctx.lineTo(60, 100); ctx.fill();
        R(ctx, 0, 90, 100, 10, '#d8d8e8');
        rows.forEach((y, i) => {
          const g = gapAt(i, s.t);
          for (let x = 0; x < 100; x += 6) {
            if (Math.abs(x + 3 - g) < 9) continue;
            R(ctx, x, y, 6, 5, i < s.level ? '#9fd3f2' : '#c8ecff'); R(ctx, x, y, 6, 1, '#ffffff'); R(ctx, x + 5, y, 1, 5, '#4f8fd0');
          }
        });
        let fy = feet();
        if (s.jump > 0) { const u = 1 - s.jump / 0.35; fy = feet() - u * 20; }
        if (s.bonk > 0) fy = feet() - Math.sin((1 - s.bonk / 0.4) * Math.PI) * 8;
        put(ctx, spr(s.jump > 0 || s.bonk > 0 ? CLIMBER_UP : CLIMBER), 50, fy - 5, 1.2);
        if (s.bonk > 0.25) txt(ctx, 'BONK!', 50, fy - 18, '#ffe27a', 8);
        txt(ctx, `${s.level}/3`, 90, 8, '#fff4e0', 8);
        txt(ctx, 'TAP UNDER A GAP', 50, 96, '#1a2a4a', 7);
      });
    },
    async solve(b, s) {
      while (!b.over() && s.level < 3) {
        await b.until(() => s.busy <= 0 && Math.abs(s.gapAt(s.level, s.t) - 50) < 2.5);
        if (b.over()) break;
        await b.tap({ x: 50, y: 50 });
        await b.until(() => s.busy <= 0);
      }
    },
  },

  // 5. Balloon Fight: land on the other guy's balloons from above.
  {
    id: 'fx-balloon', cmd: 'Pop from above!', theme: 'funtendo', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ px: 50, py: 82, tx: 50, ty: 82, ex: 25 + rnd(50), ey: 40 + rnd(14), evx: 14 * speed * (Math.random() < 0.5 ? -1 : 1), popped: 0, need: speed > 1.5 ? 2 : 1, fall: 0 });
      follow(stage, pos, p => { s.tx = clamp(p.x, 6, 94); s.ty = clamp(p.y, 12, 88); });
      let ft = 0, base = s.ey, dead = false;
      frame(dt => {
        ft += dt;
        const dx = s.tx - s.px, dy = s.ty - s.py, d = Math.hypot(dx, dy);
        if (d > 0.5) { const v = Math.min(d, 75 * dt); s.px += (dx / d) * v; s.py += (dy / d) * v; }
        s.ex += s.evx * dt; if (s.ex < 15) { s.ex = 15; s.evx = Math.abs(s.evx); } else if (s.ex > 85) { s.ex = 85; s.evx = -Math.abs(s.evx); }
        s.ey = base + Math.sin(ft * 2.5) * 4;
        if (s.fall > 0) s.fall -= dt;
        if (!dead && s.fall <= 0 && dist({ x: s.px, y: s.py + 7 }, { x: s.ex, y: s.ey - 6 }) < 6 && s.py < s.ey - 5) {
          s.popped++; sfx('pop'); s.fall = 0.5;
          if (s.popped >= s.need) { dead = true; setTimeout(win, 300); }
          else { s.ex = s.px < 50 ? 75 : 25; base = 40 + rnd(14); s.ey = base; }
        }
        if (!dead && s.fall <= 0 && dist({ x: s.ex, y: s.ey + 7 }, { x: s.px, y: s.py - 6 }) < 5 && s.ey < s.py - 5) { dead = true; sfx('nope'); return lose(); }
        R(ctx, 0, 0, 100, 100, '#0a0a1a'); stars(ctx, 2, 30, '#3a3a6a');
        R(ctx, 0, 92, 100, 8, '#2c5a9a'); for (let x = 0; x < 100; x += 8) R(ctx, x + ((ft * 10) % 8), 92, 4, 1, '#9fd3f2');
        R(ctx, 8, 70, 18, 4, '#6fb04a'); R(ctx, 74, 64, 18, 4, '#6fb04a');
        if (s.fall <= 0) put(ctx, spr(FOE_FLY), s.ex, s.ey, 1.3);
        else txt(ctx, 'POP!', s.ex, s.ey, '#ffe27a', 9);
        put(ctx, spr(FLYER), s.px, s.py, 1.3);
        txt(ctx, 'LAND ON THEIR BALLOONS', 50, 96, '#fff4e0', 6);
      });
    },
    async solve(b, s) {
      b.down({ x: s.px, y: s.py });
      let diving = false;
      while (!b.over()) {
        let tx, ty;
        const ex = s.ex + s.evx * 0.12;
        if (diving && (Math.abs(s.px - ex) > 6 || s.fall > 0)) diving = false;
        if (diving) { tx = ex; ty = s.ey - 4; }
        else if (s.py > s.ey - 18) {
          if (Math.abs(s.px - s.ex) < 16) { tx = s.ex + (s.px < s.ex ? -24 : 24); ty = s.py; }
          else { tx = s.px; ty = s.ey - 26; }
        } else if (Math.abs(s.px - ex) > 3) { tx = ex; ty = s.ey - 24; }
        else { diving = true; tx = ex; ty = s.ey - 4; }
        b.move({ x: clamp(tx, 6, 94), y: clamp(ty, 12, 88) });
        await b.wait(20);
      }
      b.up({ x: s.px, y: s.py });
    },
  },

  // 6. Pikmin: pluck the sprouts.
  {
    id: 'fx-pluck', cmd: 'Pluck ’em!', theme: 'funtendo',
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const n = speed > 1.4 ? 4 : 3;
      const kinds = [PIK_R, PIK_Y, PIK_B];
      const s = expose({ sprouts: Array.from({ length: n }, (_, i) => ({ x: 20 + i * (60 / (n - 1)), k: kinds[i % 3], plucked: false, fly: 0 })) });
      let grab = null, start = null, done = false, ft = 0;
      follow(stage, pos, (p, ph) => {
        if (ph === 'down') { grab = s.sprouts.find(q => !q.plucked && Math.abs(q.x - p.x) < 10 && p.y > 50 && p.y < 88); start = p; }
        else if (ph === 'move' && grab && start.y - p.y > 12) {
          grab.plucked = true; sfx('pop'); grab = null;
          if (!done && s.sprouts.every(q => q.plucked)) { done = true; setTimeout(win, 350); }
        } else if (ph === 'up') grab = null;
      });
      frame(dt => {
        ft += dt;
        R(ctx, 0, 0, 100, 100, '#9fd3f2'); circ(ctx, 18, 16, 8, '#ffe27a');
        R(ctx, 0, 62, 100, 38, '#7a5230'); R(ctx, 0, 62, 100, 4, '#6fb04a');
        for (const q of s.sprouts) {
          if (q.plucked) {
            q.fly += dt;
            put(ctx, spr(q.k), q.x + Math.sin(q.fly * 10) * 3, 60 - q.fly * 60, 2.2);
          } else {
            const sway = Math.sin(ft * 3 + q.x) * 1.5;
            R(ctx, q.x - 0.5, 54, 1, 10, '#3d7a34');
            circ(ctx, q.x + sway, 52, 3, q.k === PIK_Y ? '#fff4e0' : '#ffe27a');
            circ(ctx, q.x + sway, 52, 1.2, '#f39a3a');
            R(ctx, q.x - 3, 63, 6, 3, '#4a2a18');
          }
        }
        txt(ctx, 'SWIPE UP ON EACH SPROUT', 50, 90, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      for (const q of s.sprouts) {
        if (b.over()) break;
        await b.drag({ x: q.x, y: 70 }, { x: q.x, y: 40 }, 120, 5);
        await b.wait(40);
      }
    },
  },

  // 7. Pikmin: throw five onto the treasure so they can carry it home.
  {
    id: 'fx-throw', cmd: 'Throw Pikmin!', theme: 'funtendo', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ tx: 30 + rnd(40), tvx: 12 * speed * (Math.random() < 0.5 ? -1 : 1), attached: [], need: 5, squad: 8, flying: [], landed: [], carry: 0 });
      const kinds = [PIK_R, PIK_Y, PIK_B];
      let done = false;
      tapper(stage, e => {
        if (done || s.squad <= 0) return;
        const p = pos(e);
        s.squad--;
        s.flying.push({ x: 50, y: 84, sx: 50, sy: 84, ex: p.x, ey: p.y, u: 0, k: kinds[s.squad % 3] });
        sfx('swap');
      });
      frame(dt => {
        if (!s.carry) { s.tx += s.tvx * dt; if (s.tx < 22) { s.tx = 22; s.tvx = Math.abs(s.tvx); } else if (s.tx > 78) { s.tx = 78; s.tvx = -Math.abs(s.tvx); } }
        for (const f of s.flying) {
          f.u = Math.min(1, f.u + dt / 0.45);
          f.x = f.sx + (f.ex - f.sx) * f.u; f.y = f.sy + (f.ey - f.sy) * f.u - Math.sin(f.u * Math.PI) * 18;
          if (f.u >= 1 && !f.done) {
            f.done = true;
            if (Math.abs(f.ex - s.tx) < 10 && Math.abs(f.ey - 32) < 10) { s.attached.push({ dx: f.ex - s.tx, k: f.k }); sfx('pop'); }
            else { s.landed.push(f); sfx('land'); }
          }
        }
        s.flying = s.flying.filter(f => !f.done);
        if (!done && s.attached.length >= s.need) { done = true; s.carry = 0.01; sfx('coin'); setTimeout(win, 600); }
        if (!done && s.squad <= 0 && !s.flying.length) { done = true; return lose(); }
        if (s.carry) s.carry += dt;
        const ty = 32 - s.carry * 20;
        R(ctx, 0, 0, 100, 100, '#7aa848'); for (let i = 0; i < 60; i++) R(ctx, (i * 31) % 100, (i * 17) % 100, 2, 1, '#6a9838');
        circ(ctx, 50, 96, 10, '#5a8a38');
        put(ctx, spr(PELLET, { 5: '#fff4e0' }), s.tx, ty, 1.6);
        txt(ctx, `${Math.min(s.need, s.attached.length)}/${s.need}`, s.tx, ty - 11, '#fff4e0', 8);
        for (const a of s.attached) put(ctx, spr(a.k), s.tx + a.dx * 0.6, ty + 9, 1.1);
        for (const l of s.landed) put(ctx, spr(l.k), l.ex, l.ey, 1.1);
        for (const f of s.flying) put(ctx, spr(f.k), f.x, f.y, 1.2);
        put(ctx, spr(LEADER), 50, 86, 1.4);
        for (let i = 0; i < s.squad; i++) put(ctx, spr(kinds[i % 3]), i < 4 ? 30 + i * 4 : 58 + (i - 4) * 4, 92, 0.9);
        txt(ctx, 'TAP THE PELLET', 50, 8, '#fff4e0', 8);
      });
    },
    async solve(b, s) {
      while (!b.over() && s.squad > 0 && s.attached.length + s.flying.length < s.need) {
        const T = 0.47;
        const x = reflect(s.tx + s.tvx * T, 22, 78);
        await b.tap({ x, y: 32 });
        await b.wait(110);
      }
    },
  },

  // 8. Splatoon, magical-girl style: ink more turf than the rival before time's up.
  {
    id: 'fx-splat', cmd: 'Moon Ink!', theme: 'funtendo', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, time, expose }) {
      const ctx = scene(stage);
      const C = 20, Rr = 18; // 20 columns x 18 rows of 5% cells, from y = 10
      const grid = new Array(C * Rr).fill(0);
      const s = expose({ rx: 70, ry: 60, heading: Math.random() * 6, p: 0, b: 0, decided: false });
      const paint = (x, y, r, team) => {
        for (let gy = 0; gy < Rr; gy++) for (let gx = 0; gx < C; gx++) {
          const cx = gx * 5 + 2.5, cy = 10 + gy * 5 + 2.5;
          if ((cx - x) ** 2 + (cy - y) ** 2 < r * r) grid[gy * C + gx] = team;
        }
      };
      follow(stage, pos, (p, ph) => { if (ph !== 'up' && ph !== 'hover') { paint(p.x, p.y, 9, 1); if (Math.random() < 0.3) sfx('drip'); } });
      let ft = 0;
      frame((dt, t) => {
        ft += dt;
        s.heading += (Math.random() - 0.5) * 6 * dt;
        s.rx += Math.cos(s.heading) * 30 * speed * dt; s.ry += Math.sin(s.heading) * 30 * speed * dt;
        if (s.rx < 6 || s.rx > 94) { s.heading = Math.PI - s.heading; s.rx = clamp(s.rx, 6, 94); }
        if (s.ry < 14 || s.ry > 96) { s.heading = -s.heading; s.ry = clamp(s.ry, 14, 96); }
        paint(s.rx, s.ry, 7, 2);
        s.p = grid.filter(v => v === 1).length; s.b = grid.filter(v => v === 2).length;
        if (!s.decided && t >= time - 0.15) { s.decided = true; return s.p > s.b ? win() : lose(); }
        R(ctx, 0, 10, 100, 90, '#5a5a6a');
        for (let i = 0; i < grid.length; i++) {
          if (!grid[i]) continue;
          R(ctx, (i % C) * 5, 10 + ((i / C) | 0) * 5, 5, 5, grid[i] === 1 ? '#f08ab0' : '#4fb0d0');
        }
        put(ctx, spr(SQUID_R), s.rx, s.ry, 1.3);
        // HUD: who's winning
        const tot = s.p + s.b || 1;
        R(ctx, 0, 0, 100, 10, '#1a1220');
        R(ctx, 0, 2, (s.p / tot) * 100, 6, '#f08ab0'); R(ctx, (s.p / tot) * 100, 2, 100 - (s.p / tot) * 100, 6, '#4fb0d0');
        txt(ctx, '☾ MOON INK', 18, 5, '#fff4e0', 6);
        txt(ctx, 'RIVAL', 90, 5, '#fff4e0', 6);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        for (let i = 0; i < 6 && !b.over(); i++) {
          const y = 16 + i * 14;
          await b.drag({ x: i % 2 ? 94 : 6, y }, { x: i % 2 ? 6 : 94, y }, 200, 9);
        }
      }
    },
  },

  // 9. Splatoon: swim up the wall, staying in your ink.
  {
    id: 'fx-squidwall', cmd: 'Swim up!', theme: 'funtendo', time: 7,
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ sx: 50, sy: 88, ph: Math.random() * 6, off: false });
      const cx = y => 50 + 24 * Math.sin(y * 0.075 + s.ph);
      s.cx = cx;
      s.sx = cx(88);
      follow(stage, pos, p => { s.sx = clamp(p.x, 4, 96); });
      let ft = 0;
      frame(dt => {
        ft += dt;
        s.off = Math.abs(s.sx - cx(s.sy)) > 9;
        if (s.off) s.sy = Math.min(90, s.sy + 10 * dt);
        else s.sy -= 16 * speed * dt;
        if (s.sy < 12) { sfx('coin'); return win(); }
        R(ctx, 0, 0, 100, 100, '#8a8a9a');
        for (let y = 0; y < 100; y += 10) for (let x = (y / 10) % 2 ? 0 : 10; x < 100; x += 20) R(ctx, x, y, 20, 10, '#7a7a8a');
        for (let y = 0; y < 100; y += 2) { const c = cx(y); R(ctx, c - 9, y, 18, 2, '#f08ab0'); }
        R(ctx, 0, 0, 100, 8, '#ffe27a'); txt(ctx, 'TOP', 50, 4, '#1a1220', 7);
        put(ctx, spr(s.off ? SQUID_R : SQUID), s.sx, s.sy, 1.5);
        if (s.off) txt(ctx, 'STAY IN THE INK!', 50, 94, '#ffe27a', 7);
      });
    },
    async solve(b, s) {
      b.down({ x: s.sx, y: 80 });
      while (!b.over()) { b.move({ x: s.cx(s.sy - 3), y: 80 }); await b.wait(20); }
      b.up({ x: s.sx, y: 80 });
    },
  },

  // 10. Smash: hold to charge a smash attack, let go at full power to launch them off the stage.
  {
    id: 'fx-smash', cmd: 'Smash ’em!', theme: 'funtendo',
    setup({ stage, win, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const s = expose({ held: false, ht: 0, charge: 0, dmg: rnd(60) + 40, fly: 0, bump: 0, ko: false });
      const period = 1.3 / speed;
      holdable(stage, () => { if (s.ko) return; s.held = true; s.ht = 0; sfx('charge'); }, () => {
        if (!s.held || s.ko) return;
        s.held = false;
        if (s.charge >= 78) { s.ko = true; s.fly = 0.01; sfx('boom'); setTimeout(win, 700); }
        else { s.bump = 0.3; s.dmg += Math.round(s.charge / 4); sfx('land'); }
        s.charge = 0;
      });
      let ft = 0;
      frame(dt => {
        ft += dt;
        if (s.held) { s.ht += dt; const u = (s.ht / period) % 2; s.charge = 100 * (u < 1 ? u : 2 - u); }
        if (s.fly) s.fly += dt; s.bump = Math.max(0, s.bump - dt);
        R(ctx, 0, 0, 100, 100, '#0a0820'); stars(ctx, 9, 40, '#5a4a8a');
        circ(ctx, 80, 18, 10, '#2a1a4a');
        R(ctx, 12, 62, 76, 6, '#4a4a6a'); R(ctx, 12, 62, 76, 1, '#9fd3f2'); R(ctx, 20, 68, 60, 6, '#2a2a4a');
        put(ctx, spr(FIGHTER), 44 + (s.held ? -1 : 0), 55, 1.4);
        if (s.held) circ(ctx, 52, 55, 2 + s.charge / 25, s.charge >= 78 ? '#ffe27a' : '#fff4e0');
        let ex = 66 + s.bump * 20, ey = 55;
        if (s.fly) { ex = 66 + s.fly * 90; ey = 55 - s.fly * 70; }
        if (ex < 104 && ey > -4) put(ctx, spr(RIVAL), ex, ey, 1.4);
        else if (s.fly < 1.2) txt(ctx, '✦', 92, 6, '#ffe27a', 12);
        txt(ctx, `${s.dmg}%`, 72, 80, '#ffe27a', 11);
        R(ctx, 20, 88, 60, 5, '#1a1220'); R(ctx, 20 + 60 * 0.78, 88, 60 * 0.22, 5, '#ffe27a');
        R(ctx, 20, 88, 60 * (s.charge / 100), 5, s.charge >= 78 ? '#f39a3a' : '#9fd3f2');
        txt(ctx, s.ko ? 'K.O.!' : 'HOLD, LET GO AT FULL POWER', 50, 96, '#fff4e0', 6);
      });
    },
    async solve(b, s) {
      while (!b.over() && !s.ko) {
        b.down({ x: 50, y: 50 });
        await b.until(() => s.charge >= 86);
        b.up({ x: 50, y: 50 });
        await b.wait(200);
      }
    },
  },

  // 11. Smash: break the Smash Ball.
  {
    id: 'fx-smashball', cmd: 'Hit the Smash Ball!', theme: 'funtendo', time: 6,
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ ball: { x: 50, y: 40 }, hits: 0, need: speed > 1.6 ? 4 : 3, flash: 0, broke: 0 });
      tapper(stage, e => {
        if (s.broke) return;
        const p = pos(e);
        if (dist(p, s.ball) < 10) {
          s.hits++; s.flash = 0.15; sfx('boom');
          s.ball.tx = undefined;
          if (s.hits >= s.need) { s.broke = 0.01; setTimeout(win, 600); }
        } else sfx('tap');
      });
      let ft = 0;
      frame(dt => {
        ft += dt; s.flash = Math.max(0, s.flash - dt);
        if (!s.broke) wander(s.ball, (36 + s.hits * 8) * speed, dt, [10, 90, 10, 80]);
        else s.broke += dt;
        R(ctx, 0, 0, 100, 100, s.broke ? RAINBOW[Math.floor(ft * 20) % 6] : '#1a1430');
        if (!s.broke) { stars(ctx, 4, 40, '#4a3a6a'); R(ctx, 10, 86, 80, 4, '#4a4a6a'); }
        const sc = 1.6 + Math.sin(ft * 10) * 0.1;
        if (!s.broke) {
          for (let i = 0; i < 6; i++) circ(ctx, s.ball.x, s.ball.y, 9 + i * 0.6, RAINBOW[(i + Math.floor(ft * 8)) % 6] + '30');
          put(ctx, spr(SMASHBALL), s.ball.x, s.ball.y, s.flash > 0 ? sc * 1.2 : sc);
        } else txt(ctx, 'FINAL SMASH!', 50, 50, '#1a1220', 14);
        for (let i = 0; i < s.need; i++) R(ctx, 4 + i * 6, 4, 4, 4, i < s.hits ? '#ffe27a' : '#3a2a5c');
      });
    },
    async solve(b, s) {
      while (!b.over() && !s.broke) {
        await b.tap({ x: s.ball.x + (s.ball.vx || 0) * 0.03, y: s.ball.y + (s.ball.vy || 0) * 0.03 });
        await b.wait(70);
      }
    },
  },

  // 12. F-Zero: keep the hover car on the twisting track.
  {
    id: 'fx-fzero', cmd: 'Stay on track!', theme: 'funtendo', time: 6, timeoutWins: true,
    setup({ stage, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ scroll: 0, car: 50, energy: 100, ph: Math.random() * 6 });
      const cAt = y => 50 + 24 * Math.sin((s.scroll - y) * 0.035 + s.ph);
      s.cAt = cAt;
      s.car = cAt(80);
      follow(stage, pos, p => { s.car = clamp(p.x, 4, 96); });
      let dead = false;
      frame(dt => {
        if (dead) return;
        s.scroll += 85 * speed * dt;
        const off = Math.abs(s.car - cAt(80)) > 14;
        if (off) { s.energy -= 110 * dt; if (Math.random() < 0.3) sfx('tap'); }
        if (s.energy <= 0) { dead = true; sfx('boom'); return lose(); }
        R(ctx, 0, 0, 100, 100, '#140a24');
        for (let y = 0; y < 100; y += 2) {
          const c = cAt(y);
          R(ctx, c - 16, y, 32, 2, '#3a3a5a');
          R(ctx, c - 17, y, 2, 2, Math.floor((y + s.scroll) / 6) % 2 ? '#f08ab0' : '#ffe27a');
          R(ctx, c + 15, y, 2, 2, Math.floor((y + s.scroll) / 6) % 2 ? '#ffe27a' : '#f08ab0');
          if (Math.floor((y + s.scroll) / 8) % 4 === 0) R(ctx, c - 0.5, y, 1, 2, '#6a6a8a');
        }
        put(ctx, spr(CAR), s.car, 80, 1.8);
        if (off) txt(ctx, 'OFF TRACK!', 50, 66, '#ffe27a', 9);
        R(ctx, 4, 4, 40, 4, '#1a1220'); R(ctx, 4, 4, 40 * Math.max(0, s.energy) / 100, 4, s.energy > 40 ? '#6fb04a' : '#d0463c');
        txt(ctx, 'POWER', 54, 6, '#fff4e0', 6);
      });
    },
    async solve(b, s) {
      b.down({ x: s.car, y: 80 });
      while (!b.over()) { b.move({ x: s.cAt(80 - 2), y: 80 }); await b.wait(20); }
      b.up({ x: s.car, y: 80 });
    },
  },

  // 13. The original WarioWare microgame: pick the nose!
  {
    id: 'fx-wnose', cmd: 'Pick the nose!', theme: 'funtendo', time: 5,
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const s = expose({ t: 0, w: 2 * speed, ph: Math.random() * 6, fly: -1, res: null });
      const nx = t => 50 + 30 * Math.sin(t * s.w + s.ph);
      s.nx = nx;
      const TRAVEL = 0.22;
      tapper(stage, () => { if (s.fly >= 0) return; s.fly = 0; sfx('swap'); });
      frame(dt => {
        s.t += dt;
        let fy = 90;
        if (s.fly >= 0) {
          s.fly += dt;
          fy = 90 - Math.min(1, s.fly / TRAVEL) * 50;
          if (s.fly >= TRAVEL && !s.res) {
            s.res = Math.abs(nx(s.t) - 50) < 6 ? 'win' : 'lose';
            sfx(s.res === 'win' ? 'pop' : 'nope');
            setTimeout(s.res === 'win' ? win : lose, 450);
          }
        }
        const x = s.res ? s.frozen ?? (s.frozen = nx(s.t)) : nx(s.t);
        R(ctx, 0, 0, 100, 100, '#ffe27a');
        for (let i = 0; i < 12; i++) R(ctx, i * 9, 0, 4, 100, '#ffd84a');
        // the face: a big chin-up view of a nose
        circ(ctx, x, -6, 34, '#efdcb4'); put(ctx, spr(NOSE), x, 26, 2.2);
        R(ctx, x - 20, 2, 6, 3, '#1a1220'); R(ctx, x + 14, 2, 6, 3, '#1a1220');
        put(ctx, spr(FINGER), 50, fy + 18, 3);
        if (s.res === 'win') txt(ctx, 'GOT IT!', 50, 60, '#d0463c', 12);
        if (s.res === 'lose') txt(ctx, 'OUCH!', 50, 60, '#d0463c', 12);
      });
    },
    async solve(b, s) {
      await b.until(() => Math.abs(s.nx(s.t + 0.22 + 0.02) - 50) < 1.5);
      await b.tap({ x: 50, y: 80 });
    },
  },

  // 14. Game & Watch Fire: bounce the jumpers along to the ambulance.
  {
    id: 'fx-gwfire', cmd: 'Bounce ’em!', theme: 'funtendo', time: 7,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const H = 0.7 / speed, n = speed > 1.5 ? 3 : 2;
      const X = [12, 30, 55, 80, 95];
      const s = expose({ slot: 1, H, jumpers: Array.from({ length: n }, (_, i) => ({ start: 0.4 + i * 1.5 * H, p: -1, done: false })), t: 0, saved: 0 });
      tapper(stage, e => { const p = pos(e); s.slot = p.x < 42 ? 0 : p.x < 68 ? 1 : 2; sfx('select'); });
      let dead = false;
      frame(dt => {
        if (dead) return;
        s.t += dt;
        for (const j of s.jumpers) {
          if (j.done || s.t < j.start) continue;
          const prev = j.p;
          j.p = (s.t - j.start) / H;
          for (let k = 1; k <= 3; k++) if (prev < k && j.p >= k) {
            if (s.slot !== k - 1) { dead = true; j.miss = k; sfx('nope'); return lose(); }
            sfx('peg', k);
          }
          if (j.p >= 4) { j.done = true; s.saved++; sfx('coin'); }
        }
        if (s.jumpers.every(j => j.done)) { dead = true; return win(); }
        // LCD look
        R(ctx, 0, 0, 100, 100, '#a8b090'); R(ctx, 0, 0, 100, 1, '#7a8268');
        R(ctx, 0, 10, 10, 70, '#3a4030'); for (let y = 14; y < 76; y += 10) R(ctx, 2, y, 6, 4, '#a8b090');
        R(ctx, 86, 62, 14, 18, '#3a4030'); R(ctx, 90, 66, 6, 4, '#a8b090'); txt(ctx, '+', 93, 72, '#a8b090', 8);
        R(ctx, 0, 80, 100, 2, '#3a4030');
        for (const j of s.jumpers) {
          if (j.done || s.t < j.start) continue;
          const k = Math.floor(j.p), u = j.p - k;
          const x = X[Math.min(4, k)] + (X[Math.min(4, k + 1)] - X[Math.min(4, k)]) * u;
          const y = 74 - Math.sin(u * Math.PI) * (k === 0 ? 40 : 46) - (k === 0 ? (1 - u) * 30 : 0);
          R(ctx, x - 2, y - 6, 4, 4, '#1a2018'); R(ctx, x - 3, y - 2, 6, 5, '#1a2018'); R(ctx, x - 3, y + 3, 2, 3, '#1a2018'); R(ctx, x + 1, y + 3, 2, 3, '#1a2018');
        }
        // the firefighters and their stretcher
        const sx = X[s.slot + 1];
        R(ctx, sx - 9, 74, 18, 2, '#1a2018');
        R(ctx, sx - 12, 70, 3, 10, '#1a2018'); R(ctx, sx + 9, 70, 3, 10, '#1a2018');
        for (let i = 0; i < 3; i++) R(ctx, X[i + 1] - 4, 90, 8, 4, i === s.slot ? '#1a2018' : '#8a9278');
        txt(ctx, `SAVED ${s.saved}`, 70, 6, '#1a2018', 7);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        let best = null;
        for (const j of s.jumpers) {
          if (j.done) continue;
          const p = Math.max(0, (s.t - j.start) / s.H);
          const k = Math.floor(p) + 1;
          if (k > 3) continue;
          const at = j.start + k * s.H;
          if (!best || at < best.at) best = { at, k };
        }
        if (best && s.slot !== best.k - 1) await b.tap({ x: [30, 55, 80][best.k - 1], y: 50 });
        await b.wait(16);
      }
    },
  },

  // 15. Game & Watch Octopus: step down to the treasure between the tentacles.
  {
    id: 'fx-gwoct', cmd: 'Grab the gold!', theme: 'funtendo', time: 8,
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const P = [{ x: 14, y: 22 }, { x: 30, y: 40 }, { x: 46, y: 56 }, { x: 62, y: 70 }, { x: 80, y: 82 }];
      const s = expose({ t: 0, step: 0, cool: 0, thr: 0.8, tent: [0, 1, 2].map(i => ({ w: (1.5 + 0.35 * i) * speed, ph: Math.random() * 6 })) });
      const ext = (i, t) => 0.5 + 0.5 * Math.sin(t * s.tent[i].w + s.tent[i].ph); // tentacle i reaches step i + 1
      s.safe = (st, t) => st <= 0 || st >= 4 || ext(st - 1, t) < s.thr;
      let dead = false;
      tapper(stage, () => { if (dead || s.cool > 0 || s.step >= 4) return; s.step++; s.cool = 0.05; sfx('select'); if (s.step >= 4) { dead = true; sfx('coin'); setTimeout(win, 250); } });
      frame(dt => {
        s.t += dt; s.cool = Math.max(0, s.cool - dt);
        if (!dead && !s.safe(s.step, s.t)) { dead = true; sfx('nope'); return lose(); }
        R(ctx, 0, 0, 100, 100, '#a8b090');
        R(ctx, 0, 14, 26, 4, '#3a4030'); R(ctx, 4, 8, 18, 6, '#3a4030');
        R(ctx, 70, 84, 22, 12, '#3a4030'); R(ctx, 72, 86, 18, 3, '#a8b090'); txt(ctx, '$', 81, 91, '#a8b090', 8);
        // the octopus and its three tentacles reaching out to the path
        circ(ctx, 88, 28, 12, '#3a4030'); R(ctx, 82, 26, 3, 3, '#a8b090'); R(ctx, 90, 26, 3, 3, '#a8b090');
        for (let i = 0; i < 3; i++) {
          const e = ext(i, s.t), tgt = P[i + 1];
          const segs = Math.round(e * 6);
          for (let k = 0; k < segs; k++) {
            const u = (k + 1) / 6;
            R(ctx, 84 + (tgt.x - 84) * u - 2, 34 + (tgt.y - 4 - 34) * u - 2, 4, 4, e >= s.thr && k === segs - 1 ? '#1a2018' : '#4a5040');
          }
        }
        for (let i = 1; i < 4; i++) R(ctx, P[i].x - 4, P[i].y + 6, 8, 1, '#7a8268');
        const d = P[s.step];
        R(ctx, d.x - 3, d.y - 4, 6, 6, '#1a2018'); R(ctx, d.x - 4, d.y + 2, 8, 4, '#1a2018');
        txt(ctx, 'TAP TO STEP DOWN', 34, 94, '#1a2018', 7);
      });
    },
    async solve(b, s) {
      while (!b.over() && s.step < 4) {
        const plan = planSteps((st, t) => s.safe(st, t) && (st <= 0 || st >= 4 || s.safe(st, t + 0.08)), s.step, 4, s.t, s.t + 6, 0.04, 4);
        if (!plan || !plan.length) { await b.wait(30); continue; }
        await b.until(() => s.t >= plan[0]);
        if (b.over()) break;
        await b.tap({ x: 50, y: 50 });
        await b.wait(20);
      }
    },
  },

  // 16. Nintendogs: rub the pup where the sparkle says.
  {
    id: 'fx-dog', cmd: 'Rub the pup!', theme: 'funtendo',
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const SP = [{ x: 44, y: 34 }, { x: 58, y: 56 }, { x: 40, y: 64 }];
      const s = expose({ spot: SP[0], love: 0, need: 140 + speed * 30, sw: 0 });
      let last = null, done = false, ft = 0, hearts = [];
      follow(stage, pos, (p, ph) => {
        if (ph === 'down') { last = p; return; }
        if (ph !== 'move' || !last || done) { last = null; return; }
        if (dist(p, s.spot) < 12) {
          s.love += dist(p, last);
          if (Math.random() < 0.15) { hearts.push({ x: p.x, y: p.y, t: 0 }); sfx('purr'); }
          if (s.love >= s.need) { done = true; sfx('woof'); setTimeout(win, 300); }
        }
        last = p;
      });
      frame(dt => {
        ft += dt; s.sw += dt;
        if (s.sw > 1.3 / Math.sqrt(speed)) { s.sw = 0; s.spot = pick(SP.filter(q => q !== s.spot)); }
        R(ctx, 0, 0, 100, 100, '#fde8d0'); R(ctx, 0, 76, 100, 24, '#d8b890');
        for (let i = 0; i < 10; i++) R(ctx, i * 10, 76, 1, 24, '#c8a880');
        put(ctx, spr(PUP, { t: '#c79a5a', T: '#a0663a' }), 50, 52, 4.2);
        const tw = Math.floor(ft * 8) % 2;
        txt(ctx, '✦', s.spot.x, s.spot.y, tw ? '#ffe27a' : '#fff4e0', 10);
        ring(ctx, s.spot.x, s.spot.y, 9 + tw, '#f08ab0', 1);
        hearts = hearts.filter(q => (q.t += dt) < 0.8);
        for (const q of hearts) txt(ctx, '♥', q.x, q.y - q.t * 20, '#d0463c', 9);
        R(ctx, 20, 92, 60, 4, '#1a1220'); R(ctx, 20, 92, 60 * Math.min(1, s.love / s.need), 4, '#f08ab0');
        txt(ctx, 'RUB THE SPARKLE', 50, 8, '#a0663a', 8);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const sp = s.spot;
        b.down({ x: sp.x - 6, y: sp.y });
        for (let i = 0; i < 10 && !b.over() && s.spot === sp; i++) { b.move({ x: sp.x + (i % 2 ? -6 : 6), y: sp.y + (i % 3) - 1 }); await b.wait(25); }
        b.up({ x: sp.x, y: sp.y });
      }
    },
  },

  // 17. Brain Age: quick maths, three in a row.
  {
    id: 'fx-brain', cmd: 'Brain training!', theme: 'funtendo', time: 8,
    setup({ stage, win, lose, sfx, expose }) {
      const q = h('p', { class: 'fx-q' }), row = h('div', { class: 'fx-row' }), step = h('p', { class: 'fx-step' }), tick = h('p', { class: 'fx-tick' });
      stage.append(h('div', { class: 'fx-brain' }, step, q, row, tick));
      const s = expose({ round: 0, ans: 0, btns: [] });
      const make = () => {
        const kind = rnd(3);
        let a, b, ans, sym;
        if (kind === 0) { a = 2 + rnd(8); b = 2 + rnd(8); ans = a + b; sym = '+'; }
        else if (kind === 1) { a = 6 + rnd(10); b = 1 + rnd(a - 1); ans = a - b; sym = '−'; }
        else { a = 2 + rnd(4); b = 2 + rnd(4); ans = a * b; sym = '×'; }
        const opts = shuffle([...new Set([ans, ans + 1 + rnd(2), Math.max(0, ans - 1 - rnd(2)) === ans ? ans + 3 : Math.max(0, ans - 1 - rnd(2))])]);
        while (opts.length < 3) opts.push(ans + opts.length + 2);
        q.textContent = `${a} ${sym} ${b}`;
        step.textContent = `Problem ${s.round + 1} of 3`;
        s.ans = ans;
        s.btns = opts.map(v => tapper(h('button', { type: 'button' }, String(v)), () => {
          if (v !== s.ans) { sfx('nope'); tick.textContent = '✗'; return lose(); }
          sfx('type'); s.round++; tick.textContent = '✓'.repeat(s.round);
          if (s.round >= 3) return win();
          make();
        }));
        row.replaceChildren(...s.btns);
      };
      make();
    },
    async solve(b, s) {
      while (!b.over() && s.round < 3) {
        const r = s.round;
        await b.tap(s.btns.find(x => x.textContent === String(s.ans)));
        await b.until(() => s.round > r);
      }
    },
  },

  // 18. Wii Sports bowling: release down the middle for a strike.
  {
    id: 'fx-bowling', cmd: 'Strike!', theme: 'funtendo',
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const period = 2.2 / Math.sqrt(speed);
      const s = expose({ t: 0, x: 50, tol: 6 / Math.sqrt(speed), roll: -1, rx: 50, res: null });
      const xAt = t => 50 + 26 * Math.sin((t / period) * Math.PI * 2 + 1);
      s.xAt = xAt;
      tapper(stage, () => { if (s.roll >= 0) return; s.roll = 0; s.rx = s.x; sfx('swap'); });
      frame(dt => {
        s.t += dt;
        if (s.roll < 0) s.x = xAt(s.t);
        else {
          s.roll += dt;
          if (s.roll >= 0.6 && !s.res) {
            s.res = Math.abs(s.rx - 50) < s.tol ? 'strike' : 'miss';
            sfx(s.res === 'strike' ? 'boom' : 'nope');
            setTimeout(s.res === 'strike' ? win : lose, 500);
          }
        }
        R(ctx, 0, 0, 100, 100, '#2a1a3a');
        ctx.fillStyle = '#e0b878'; ctx.beginPath(); ctx.moveTo(38, 10); ctx.lineTo(62, 10); ctx.lineTo(84, 100); ctx.lineTo(16, 100); ctx.fill();
        for (let i = 0; i < 7; i++) { const u = i / 6; R(ctx, 38 + u * 24 - 1 + (1 - u) * 0, 70, 1, 3, '#a0663a'); }
        // pins
        const pins = [[50, 14], [47, 12], [53, 12], [44, 10], [50, 10], [56, 10]];
        pins.forEach(([px, py], i) => {
          const down = s.res === 'strike' || (s.res === 'miss' && Math.abs(px - (50 + (s.rx - 50) * 0.3)) < 3);
          if (down) R(ctx, px - 3 + i % 3, py + 2, 4, 1.5, '#fff4e0');
          else { R(ctx, px - 1, py - 4, 2, 6, '#fff4e0'); R(ctx, px - 1, py - 2, 2, 1, '#d0463c'); }
        });
        // aim arrow or the rolling ball
        if (s.roll < 0) {
          R(ctx, s.x - 0.5, 60, 1, 24, '#ffe27a'); txt(ctx, '▲', s.x, 58, '#ffe27a', 9);
          circ(ctx, s.x, 88, 5, '#4f8fd0');
        } else {
          const u = Math.min(1, s.roll / 0.6);
          circ(ctx, 50 + (s.rx - 50) * (1 - u * 0.7), 88 - u * 74, 5 - u * 3, '#4f8fd0');
        }
        if (s.res === 'strike') txt(ctx, 'STRIKE!', 50, 40, '#ffe27a', 14);
        txt(ctx, 'TAP WHEN CENTRED', 50, 96, '#fff4e0', 7);
      });
    },
    async solve(b, s) {
      await b.until(() => s.t > 0.1 && Math.abs(s.x - 50) < s.tol * 0.6);
      await b.tap({ x: 50, y: 50 });
    },
  },

  // 19. Wii Sports tennis: swing as the ball reaches you, twice.
  {
    id: 'fx-tennis', cmd: 'Swing!', theme: 'funtendo', time: 7,
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const T = 1.05 / speed;
      const s = expose({ u: 0, dir: 1, wait: 0.3, hits: 0, need: 2, swing: 0, x0: 40 + rnd(20) });
      let dead = false;
      tapper(stage, () => {
        if (dead || s.dir < 0 || s.wait > 0) return;
        s.swing = 0.2;
        if (s.u >= 0.84 && s.u <= 1.02) { s.dir = -1; s.hits++; sfx('boom'); }
        else { dead = true; sfx('nope'); setTimeout(lose, 200); }
      });
      frame(dt => {
        if (dead) return;
        s.swing = Math.max(0, s.swing - dt);
        if (s.wait > 0) { s.wait -= dt; }
        else {
          s.u += (s.dir * dt) / T;
          if (s.dir > 0 && s.u > 1.08) { dead = true; sfx('nope'); return lose(); }
          if (s.dir < 0 && s.u <= 0) {
            if (s.hits >= s.need) { dead = true; return win(); }
            s.u = 0; s.dir = 1; s.wait = 0.3; s.x0 = 40 + rnd(20);
          }
        }
        R(ctx, 0, 0, 100, 100, '#64b0ff');
        R(ctx, 0, 30, 100, 70, '#3a8a4a');
        ctx.fillStyle = '#4f9a6a'; ctx.beginPath(); ctx.moveTo(30, 30); ctx.lineTo(70, 30); ctx.lineTo(96, 100); ctx.lineTo(4, 100); ctx.fill();
        R(ctx, 30, 30, 40, 1, '#fff4e0'); R(ctx, 4, 99, 92, 1, '#fff4e0'); R(ctx, 18, 52, 64, 1, '#fff4e0');
        R(ctx, 14, 50, 72, 3, '#1a1220'); for (let x = 14; x < 86; x += 3) R(ctx, x, 50, 1, 3, '#d8d8e8');
        // ball: from the far player down to you
        const u = clamp(s.u, 0, 1.08);
        const bx = s.x0 + (70 - s.x0) * u, by = 28 + u * 52 - Math.sin(clamp(u * 1.4, 0, 1) * Math.PI) * 14;
        circ(ctx, bx, by + 6 + u * 4, 1.5 + u, '#2a6a3a');
        circ(ctx, bx, by, 1.5 + u * 2, '#e8f050');
        put(ctx, spr(RIVAL), 50, 24, 0.9);
        // you, racket ready
        R(ctx, 74, 70, 8, 22, '#fff4e0'); circ(ctx, 78, 66, 4, '#efdcb4');
        ctx.save(); ctx.translate(74, 78); ctx.rotate(s.swing > 0 ? -1.2 : 0.4); R(ctx, -14, -1, 12, 2, '#6b3d22'); ring(ctx, -17, 0, 4, '#d0463c', 1.5); ctx.restore();
        if (s.dir > 0 && s.u > 0.84 && s.u < 1.02) ring(ctx, bx, by, 6, '#ffe27a', 1);
        for (let i = 0; i < s.need; i++) R(ctx, 4 + i * 6, 4, 4, 4, i < s.hits ? '#ffe27a' : '#2a6a3a');
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        await b.until(() => s.dir > 0 && s.wait <= 0 && s.u >= 0.9);
        if (b.over()) break;
        await b.tap({ x: 50, y: 50 });
        await b.until(() => s.dir > 0 && s.u < 0.5);
      }
    },
  },

  // 20. Wii Fit, magical-girl style: hold the moon pose, keeping your balance in the circle.
  {
    id: 'fx-wiifit', cmd: 'Hold the pose!', theme: 'funtendo', timeoutWins: true,
    setup({ stage, lose, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const sg = Math.random() < 0.5 ? 1 : -1;
      const s = expose({ t: 0, fx: 50, fy: 56, out: 0, sp: Math.sqrt(speed), a: Math.random() * 6, b: Math.random() * 6, c: Math.random() * 6 });
      const W = t => ({
        x: sg * 30 * Math.sin(1.1 * s.sp * t) + 8 * Math.sin(2.7 * s.sp * t + s.a),
        y: 16 * Math.sin(0.9 * s.sp * t + s.b) + 6 * Math.sin(2.3 * s.sp * t + s.c),
      });
      s.W = W;
      follow(stage, pos, (p, ph) => { if (ph === 'up') { s.fx = 50; s.fy = 56; } else { s.fx = p.x; s.fy = p.y; } });
      let dead = false;
      frame(dt => {
        if (dead) return;
        s.t += dt;
        const w = W(s.t);
        const dx = w.x - (s.fx - 50), dy = w.y - (s.fy - 56);
        s.d = Math.hypot(dx, dy);
        s.out = s.d > 22 ? s.out + dt : 0;
        if (s.out > 0.35) { dead = true; sfx('nope'); return lose(); }
        R(ctx, 0, 0, 100, 100, '#f4f0f8'); R(ctx, 0, 80, 100, 20, '#d8d0e8');
        // the girl in her pose, tilting with the wobble
        ctx.save(); ctx.translate(50, 44); ctx.rotate(dx * 0.008);
        put(ctx, spr(GIRL), 0, 0, 3);
        txt(ctx, '☾', -16, -14, '#ffe27a', 12);
        ctx.restore();
        R(ctx, 30, 76, 40, 5, '#fff4e0'); R(ctx, 30, 80, 40, 1, '#a8a0b8');
        // balance circle
        ring(ctx, 80, 22, 13, '#a46ad0', 1);
        circ(ctx, 80 + clamp(dx, -30, 30) * 0.6, 22 + clamp(dy, -30, 30) * 0.6, 2.5, s.d > 22 ? '#d0463c' : '#f08ab0');
        txt(ctx, 'DRAG AGAINST THE WOBBLE', 50, 92, '#6a3e94', 7);
      });
    },
    async solve(b, s) {
      b.down({ x: 50, y: 56 });
      while (!b.over()) { const w = s.W(s.t + 0.02); b.move({ x: 50 + w.x, y: 56 + w.y }); await b.wait(20); }
      b.up({ x: 50, y: 56 });
    },
  },

  // 21. Mario Paint: swat the gnats.
  {
    id: 'fx-gnats', cmd: 'Swat the gnats!', theme: 'funtendo', time: 6,
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const n = speed > 1.4 ? 6 : 5;
      const s = expose({ gnats: Array.from({ length: n }, () => ({ x: 15 + rnd(70), y: 15 + rnd(55), dead: 0 })) });
      let hand = { x: 50, y: 60, t: 0 }, ft = 0;
      tapper(stage, e => {
        const p = pos(e);
        hand = { x: p.x, y: p.y, t: 0.15 };
        const g = s.gnats.find(q => !q.dead && dist(q, p) < 8);
        sfx(g ? 'pop' : 'tap');
        if (g) { g.dead = 0.01; if (s.gnats.every(q => q.dead)) setTimeout(win, 250); }
      });
      frame(dt => {
        ft += dt; hand.t = Math.max(0, hand.t - dt);
        for (const g of s.gnats) { if (g.dead) g.dead += dt; else wander(g, 40 * speed, dt, [8, 92, 12, 80]); }
        R(ctx, 0, 0, 100, 100, '#f8f8f0');
        for (let x = 0; x < 100; x += 10) R(ctx, x, 0, 1, 100, '#e8e8e0');
        R(ctx, 0, 86, 100, 14, '#d0463c'); for (let i = 0; i < 8; i++) R(ctx, 4 + i * 12, 89, 8, 8, RAINBOW[i % 6]);
        for (const g of s.gnats) {
          if (g.dead) { if (g.dead < 0.5) txt(ctx, '✶', g.x, g.y, '#1a1220', 8); continue; }
          put(ctx, spr(GNAT), g.x, g.y + Math.sin(ft * 40 + g.x) * 0.6, 1.6);
        }
        // the swatter hand
        R(ctx, hand.x - 5, hand.y - (hand.t > 0 ? 6 : 9), 10, 8, '#efdcb4'); R(ctx, hand.x - 1, hand.y - 1, 2, 12, '#a0663a');
        txt(ctx, `${s.gnats.filter(q => !q.dead).length}`, 92, 6, '#1a1220', 9);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const g = s.gnats.find(q => !q.dead);
        if (!g) break;
        await b.tap({ x: g.x + (g.vx || 0) * 0.03, y: g.y + (g.vy || 0) * 0.03 });
        await b.wait(50);
      }
    },
  },

  // 22. Rhythm Heaven Karate Man: punch each pot as it arrives on the beat.
  {
    id: 'fx-karate', cmd: 'Punch on the beat!', theme: 'funtendo', time: 7,
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const F = 0.8 / speed, B = 1.0 / speed;
      const s = expose({ t: 0, F, pots: [0, 1, 2].map(i => ({ start: 0.5 + i * B, hit: false, smash: 0 })), cool: 0, punch: 0, done: 0 });
      let dead = false;
      const uOf = p => (s.t - p.start) / F;
      s.uOf = uOf;
      tapper(stage, () => {
        if (dead || s.cool > 0) return;
        s.punch = 0.15; s.cool = 0.2;
        const p = s.pots.find(q => !q.hit && Math.abs(uOf(q) - 1) < 0.14);
        if (p) { p.hit = true; s.done++; sfx('boom'); if (s.done >= 3) { dead = true; setTimeout(win, 300); } }
        else sfx('tap');
      });
      frame(dt => {
        s.t += dt; s.cool = Math.max(0, s.cool - dt); s.punch = Math.max(0, s.punch - dt);
        for (const p of s.pots) { if (p.hit) p.smash += dt; else if (!dead && uOf(p) > 1.15) { dead = true; sfx('nope'); return lose(); } }
        R(ctx, 0, 0, 100, 100, '#ffe8a8'); R(ctx, 0, 72, 100, 28, '#c8a060');
        for (let i = 0; i < 5; i++) circ(ctx, 10 + i * 20, 20 + (i % 2) * 10, 6, '#fff4c8');
        put(ctx, spr(KARATE), 68, 56, 3);
        if (s.punch > 0) { R(ctx, 50, 50, 14, 4, '#efdcb4'); circ(ctx, 50, 52, 4, '#efdcb4'); }
        for (const p of s.pots) {
          const u = uOf(p);
          if (u < 0) continue;
          if (p.hit) { if (p.smash < 0.4) for (let k = 0; k < 5; k++) R(ctx, 46 - p.smash * 60 + k * 6, 50 - p.smash * 40 + k * 3, 3, 3, '#a0663a'); continue; }
          const x = 4 + (46 - 4) * Math.min(u, 1.2), y = 52 - Math.sin(Math.min(u, 1) * Math.PI) * 26;
          put(ctx, spr(POT), x, y, 1.6);
        }
        ring(ctx, 46, 52, 5, '#d0463c', 1);
        txt(ctx, `${s.done}/3`, 90, 6, '#6b3d22', 9);
        txt(ctx, 'TAP AS THE POT REACHES THE RING', 50, 92, '#6b3d22', 6);
      });
    },
    async solve(b, s) {
      while (!b.over() && s.done < 3) {
        await b.until(() => s.pots.some(p => !p.hit && s.uOf(p) >= 0.99));
        if (b.over()) break;
        await b.tap({ x: 50, y: 50 });
        await b.wait(60);
      }
    },
  },

  // 23. EarthBound: SMAAAASH! Tap when the ring closes on the enemy, before your HP rolls down.
  {
    id: 'fx-bash', cmd: 'SMAAAASH!', theme: 'funtendo', time: 7,
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      const ctx = scene(stage);
      const period = 1.1 / speed;
      const s = expose({ t: 0, hits: 0, need: 3, hp: 30, r: 30, r0: 10, flash: 0, cool: 0 });
      let dead = false;
      tapper(stage, () => {
        if (dead || s.cool > 0) return;
        s.cool = 0.15;
        if (Math.abs(s.r - s.r0) < 2.6) { s.hits++; s.flash = 0.3; sfx('boom'); if (s.hits >= s.need) { dead = true; setTimeout(win, 450); } }
        else sfx('tap');
      });
      frame(dt => {
        if (dead && s.hits < s.need) return;
        s.t += dt; s.flash = Math.max(0, s.flash - dt); s.cool = Math.max(0, s.cool - dt);
        s.r = 30 - ((s.t / period) % 1) * 26;
        if (!dead) { s.hp -= dt * 4.5 * speed; if (s.hp <= 0) { dead = true; sfx('nope'); return lose(); } }
        // trippy battle background
        for (let y = 0; y < 100; y += 4) for (let x = 0; x < 100; x += 4) {
          const v = Math.sin(x * 0.12 + s.t * 2) + Math.sin(y * 0.1 - s.t * 1.6) + Math.sin((x + y) * 0.07 + s.t);
          R(ctx, x, y, 4, 4, ['#3a1a5a', '#5a2a7a', '#2a4a8a', '#7a3a6a'][Math.floor((v + 3) * 0.66) % 4]);
        }
        put(ctx, spr(CROW), 50 + (s.flash > 0 ? (Math.random() - 0.5) * 6 : 0), 40, 3.2);
        ring(ctx, 50, 40, s.r0, '#ffe27a', 1.5);
        ring(ctx, 50, 40, s.r, '#fff4e0', 1);
        if (s.flash > 0) txt(ctx, 'SMAAAASH!!', 50, 18, '#ffe27a', 12);
        // the rolling HP odometer
        R(ctx, 30, 74, 40, 22, '#1a1220'); R(ctx, 31, 75, 38, 20, '#fff4e0');
        txt(ctx, 'HP', 38, 80, '#1a1220', 7);
        txt(ctx, String(Math.max(0, Math.ceil(s.hp))).padStart(3, '0'), 54, 88, '#1a1220', 12);
        for (let i = 0; i < s.need; i++) R(ctx, 4 + i * 6, 4, 4, 4, i < s.hits ? '#ffe27a' : '#1a1220');
      });
    },
    async solve(b, s) {
      while (!b.over() && s.hits < s.need) {
        await b.until(() => s.cool <= 0 && Math.abs(s.r - s.r0) < 0.9);
        if (b.over()) break;
        await b.tap({ x: 50, y: 50 });
        await b.wait(60);
      }
    },
  },

  // 24. Fire Emblem: pick the weapon with the advantage. Sword beats axe, axe beats lance, lance beats sword.
  {
    id: 'fx-triangle', cmd: 'Weapon triangle!', theme: 'funtendo', time: 8,
    setup({ stage, win, lose, sfx, expose }) {
      const W = { sword: [SWORD, 'Sword'], lance: [LANCE, 'Lance'], axe: [AXE, 'Axe'] };
      const beats = { axe: 'sword', lance: 'axe', sword: 'lance' }; // foe weapon -> what beats it
      const foe = h('p', { class: 'fx-foe' }), row = h('div', { class: 'fx-row' }), step = h('p', { class: 'fx-step' });
      stage.append(h('div', { class: 'fx-tri' }, step, foe, row, h('p', { class: 'fx-hint' }, 'Sword ▸ Axe ▸ Lance ▸ Sword')));
      const s = expose({ round: 0, want: null, btns: {} });
      for (const k of ['sword', 'lance', 'axe']) {
        s.btns[k] = tapper(h('button', { type: 'button' }, h('img', { src: art(W[k][0], { s: '#d8d8e8' }), alt: '' }), W[k][1]), () => {
          if (k !== s.want) { sfx('nope'); return lose(); }
          sfx('boom'); s.round++;
          if (s.round >= 3) return win();
          next();
        });
      }
      row.append(...shuffle(Object.values(s.btns)));
      function next() {
        const f = pick(Object.keys(W));
        s.want = beats[f];
        step.textContent = `Battle ${s.round + 1} of 3`;
        foe.replaceChildren(h('img', { src: art(W[f][0], { s: '#d8d8e8' }), alt: '' }), `Enemy has a ${W[f][1].toLowerCase()}!`);
      }
      next();
    },
    async solve(b, s) {
      while (!b.over() && s.round < 3) { const r = s.round; await b.tap(s.btns[s.want]); await b.until(() => s.round > r); }
    },
  },

  // 25. Kid Icarus: shoot the giant eye while it's open.
  {
    id: 'fx-icarus', cmd: 'Shoot the eye!', theme: 'funtendo', time: 7,
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      const ctx = scene(stage);
      const s = expose({ t: 0, ax: 50, open: true, ct: 0, openFor: 0.9, closedFor: 0.8 / Math.sqrt(speed), w: 1.2 * speed, ph: Math.random() * 6, hits: 0, need: speed > 1.6 ? 3 : 2, arrows: [], hurt: 0 });
      s.ex = t => 50 + 30 * Math.sin(t * s.w + s.ph);
      follow(stage, pos, (p, ph) => {
        s.ax = clamp(p.x, 6, 94);
        if (ph === 'down' && s.arrows.length < 2) { s.arrows.push({ x: s.ax, y: 82 }); sfx('swap'); }
      });
      let done = false;
      frame(dt => {
        s.t += dt; s.ct += dt; s.hurt = Math.max(0, s.hurt - dt);
        if (s.open ? s.ct > s.openFor : s.ct > s.closedFor) { s.open = !s.open; s.ct = 0; }
        const ex = s.ex(s.t);
        for (const a of s.arrows) {
          a.y -= 130 * dt;
          if (!a.spent && a.y <= 24 && Math.abs(a.x - ex) < 9) {
            a.spent = true;
            if (s.open && !done) { s.hits++; s.hurt = 0.3; sfx('boom'); if (s.hits >= s.need) { done = true; setTimeout(win, 400); } }
            else sfx('land');
          }
        }
        s.arrows = s.arrows.filter(a => !a.spent && a.y > -4);
        R(ctx, 0, 0, 100, 100, '#3a2a5a'); for (let i = 0; i < 6; i++) R(ctx, i * 18, 70 + (i % 2) * 4, 12, 30, '#d8c8b0');
        R(ctx, 0, 92, 100, 8, '#c8b8a0');
        // the eye
        circ(ctx, ex, 20, 13, s.hurt > 0 ? '#ffffff' : '#6a8a3a');
        if (s.open) { circ(ctx, ex, 20, 9, '#fff4e0'); circ(ctx, ex, 21, 5, '#d0463c'); circ(ctx, ex, 21, 2, '#1a1220'); }
        else R(ctx, ex - 9, 19, 18, 2, '#3a4a1a');
        for (let i = 0; i < 6; i++) R(ctx, ex - 14 + i * 5, 32 + Math.sin(s.t * 6 + i) * 2, 2, 6, '#6a8a3a');
        for (const a of s.arrows) { R(ctx, a.x - 0.5, a.y - 4, 1, 7, '#fff4e0'); R(ctx, a.x - 1, a.y - 5, 2, 2, '#ffe27a'); }
        put(ctx, spr(ANGEL), s.ax, 86, 1.5);
        for (let i = 0; i < s.need; i++) R(ctx, 4 + i * 6, 4, 4, 4, i < s.hits ? '#ffe27a' : '#1a1220');
        txt(ctx, s.open ? 'FIRE!' : 'WAIT…', 88, 6, s.open ? '#ffe27a' : '#9a8ab8', 8);
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const tt = (82 - 24) / 130;
        const left = s.open ? s.openFor - s.ct : s.closedFor - s.ct;
        const ok = s.open ? left > tt + 0.06 : left < tt - 0.06 && left + s.openFor > tt + 0.06;
        if (ok && !s.arrows.length) { await b.tap({ x: clamp(s.ex(s.t + tt + 0.03), 6, 94), y: 86 }); await b.wait(120); }
        else await b.wait(16);
      }
    },
  },

  // 26. BOSS: Final Destination against a giant floating hand.
  {
    id: 'fx-hand', cmd: 'Final Destination!', theme: 'funtendo', time: 26, boss: true,
    setup({ stage, win, lose, sfx, speed, frame, pos, phase, expose }) {
      const ctx = scene(stage);
      const sp = Math.sqrt(speed);
      const s = expose({
        ph: 0, wait: 0.9, fx: 50, hearts: 3, inv: 0,
        hand: { x: 50, st: 'hover', t: 0, tx: 50, hit: false, ext: 0 }, hits: 0, need1: 3,
        ball: { x: 50, y: 30 }, bhits: 0, need2: 3, bflash: 0,
        held: false, charge: 0, over: 0, fizz: false, blast: 0, girl: false, small: 0,
      });
      const TITLES = ['', 'Dodge the poke!', 'Grab the Smash Ball!', 'Final Smash!'];
      const go = n => { s.ph = n; phase(n, TITLES[n]); };
      let steer = false, done = false;
      stage.addEventListener('pointerdown', e => {
        if (done) return;
        const p = pos(e);
        capture(stage, e);
        if (s.ph === 1 && p.y >= 62) { steer = true; s.fx = clamp(p.x, 6, 94); return; }
        if (s.ph === 1 && s.hand.st === 'stuck' && !s.hand.hit && dist(p, { x: s.hand.tx, y: 42 }) < 11) {
          s.hand.hit = true; s.hits++; sfx('boom');
          if (s.hits >= s.need1) { s.ph = 1.5; s.wait = 1.2; }
          return;
        }
        if (s.ph === 2 && dist(p, s.ball) < 10) {
          s.bhits++; s.bflash = 0.15; sfx('boom'); s.ball.tx = undefined;
          if (s.bhits >= s.need2) { s.ph = 2.5; s.wait = 1.2; s.girl = true; sfx('morph'); }
          return;
        }
        if (s.ph === 3 && !s.blast) { s.held = true; s.charge = 0; s.over = 0; s.fizz = false; sfx('charge'); }
      });
      stage.addEventListener('pointermove', e => { if (steer && s.ph === 1) s.fx = clamp(pos(e).x, 6, 94); });
      const up = () => {
        steer = false;
        if (s.ph === 3 && s.held && !s.blast) {
          s.held = false;
          if (!s.fizz && s.charge >= 70) { s.blast = 0.01; done = true; sfx('boom'); setTimeout(win, 1100); }
          else { s.small = 0.4; s.charge = 0; sfx('land'); }
        }
      };
      stage.addEventListener('pointerup', up);
      stage.addEventListener('pointercancel', up);
      let ft = 0;
      frame(dt => {
        ft += dt; s.inv = Math.max(0, s.inv - dt); s.bflash = Math.max(0, s.bflash - dt); s.small = Math.max(0, s.small - dt);
        if (s.wait > 0) { s.wait -= dt; if (s.wait <= 0) go(s.ph === 0 ? 1 : s.ph === 1.5 ? 2 : 3); }
        const H = s.hand;
        if (s.ph === 1) {
          H.t += dt;
          if (H.st === 'hover') { H.x += (s.fx - H.x) * Math.min(1, dt * 2); if (H.t > 0.7 / sp) { H.st = 'warn'; H.t = 0; H.tx = s.fx; sfx('alarm'); } }
          else if (H.st === 'warn') { H.x += (H.tx - H.x) * Math.min(1, dt * 10); if (H.t > 0.8 / sp) { H.st = 'poke'; H.t = 0; } }
          else if (H.st === 'poke') {
            H.ext = Math.min(1, H.t / 0.18);
            if (H.ext >= 1) {
              if (Math.abs(s.fx - H.tx) < 9 && s.inv <= 0) {
                s.hearts--; s.inv = 1; sfx('nope');
                if (s.hearts <= 0 && !done) { done = true; return lose(); }
              }
              H.st = 'stuck'; H.t = 0; H.hit = false;
            }
          } else if (H.st === 'stuck') { if (H.t > 1.1 / sp || (H.hit && H.t > 0.4)) { H.st = 'back'; H.t = 0; } }
          else if (H.st === 'back') { H.ext = Math.max(0, 1 - H.t / 0.25); if (H.t > 0.25) { H.st = 'hover'; H.t = 0; } }
        } else { H.ext = Math.max(0, H.ext - dt * 4); H.x += (50 + Math.sin(ft) * 20 - H.x) * Math.min(1, dt * 2); }
        if (s.ph === 2) wander(s.ball, 42 * speed, dt, [12, 88, 12, 56]);
        if (s.ph === 3 && s.held && !s.blast) {
          s.charge = Math.min(100, s.charge + (dt * 100) / (1.1 / sp));
          if (s.charge >= 100) { s.over += dt; if (s.over > 0.5 && !s.fizz) { s.fizz = true; s.charge = 0; sfx('fizzle'); } }
        }
        if (s.blast) s.blast += dt;
        // draw: the floating stage in space
        R(ctx, 0, 0, 100, 100, s.blast ? RAINBOW[Math.floor(ft * 16) % 6] : '#0a0820');
        if (!s.blast) stars(ctx, 5, 40, '#5a4a8a');
        R(ctx, 8, 92, 84, 4, '#4a4a6a'); R(ctx, 8, 92, 84, 1, '#9fd3f2'); R(ctx, 20, 96, 60, 4, '#2a2a4a');
        if (s.ph === 1 && H.st === 'warn' && Math.floor(ft * 12) % 2) R(ctx, H.tx - 8, 30, 16, 62, 'rgba(208,70,60,0.35)');
        // the hand: a big white glove
        const hy = 18 + H.ext * 44;
        if (!(s.blast > 0.6)) {
          const hx = H.x + (s.blast ? (Math.random() - 0.5) * 6 : 0);
          R(ctx, hx - 14, 8, 28, 14, s.small > 0 ? '#ffe27a' : '#f4f4f4'); R(ctx, hx - 14, 8, 28, 2, '#ffffff'); R(ctx, hx - 16, 12, 3, 8, '#e0e0e8');
          if (H.ext > 0) { R(ctx, hx - 3, 20, 6, hy - 18, '#f4f4f4'); R(ctx, hx - 3, hy, 6, 4, '#e0e0e8'); }
          for (let i = 0; i < 4; i++) R(ctx, hx - 12 + i * 7, 20, 5, 6, '#e8e8f0');
          if (s.ph === 1 && H.st === 'stuck' && !H.hit) { circ(ctx, H.tx, 42, 6, Math.floor(ft * 10) % 2 ? '#ffe27a' : '#f39a3a'); txt(ctx, 'HIT IT!', H.tx, 52, '#ffe27a', 7); }
        }
        if (s.ph === 2) {
          for (let i = 0; i < 6; i++) circ(ctx, s.ball.x, s.ball.y, 9 + i * 0.6, RAINBOW[(i + Math.floor(ft * 8)) % 6] + '30');
          put(ctx, spr(SMASHBALL), s.ball.x, s.ball.y, s.bflash > 0 ? 1.9 : 1.6);
        }
        // the fighter (a magical girl once she's grabbed the Smash Ball)
        if (!(s.inv > 0 && Math.floor(ft * 16) % 2)) put(ctx, spr(s.girl ? GIRL : FIGHTER), s.fx, 84, s.girl ? 1.4 : 1.3);
        if (s.ph === 3) {
          R(ctx, 25, 70, 50, 4, '#1a1220'); R(ctx, 25 + 50 * 0.7, 70, 50 * 0.3, 4, '#ffe27a');
          R(ctx, 25, 70, 50 * (s.charge / 100), 4, s.fizz ? '#6a5a7a' : s.charge >= 70 ? '#f08ab0' : '#9fd3f2');
          if (s.held) circ(ctx, s.fx, 74, 2 + s.charge / 20, '#f08ab0');
          if (s.blast) { R(ctx, s.fx - 4 - s.blast * 4, 0, 8 + s.blast * 8, 80, '#ffffffcc'); txt(ctx, '☾ MOON SMASH!', 50, 50, '#6a3e94', 12); }
          else txt(ctx, s.fizz ? 'LET GO AND TRY AGAIN' : 'HOLD, LET GO IN THE GOLD', 50, 64, '#fff4e0', 7);
        }
        if (s.ph === 1) txt(ctx, 'DRAG DOWN HERE TO DODGE', 50, 98, '#9fd3f2', 6);
        for (let i = 0; i < 3; i++) R(ctx, 4 + i * 5, 4, 3, 3, i < s.hearts ? '#f08ab0' : '#3a2a5c');
      });
    },
    async solve(b, s) {
      await b.until(() => s.ph >= 1);
      while (!b.over() && s.ph < 1.5) {
        const H = s.hand;
        if (H.st === 'warn' && Math.abs(s.fx - H.tx) < 18) {
          const from = s.fx, to = from < 50 ? from + 34 : from - 34;
          b.down({ x: from, y: 84 });
          for (let i = 1; i <= 6; i++) { b.move({ x: from + ((to - from) * i) / 6, y: 84 }); await b.wait(15); }
          b.up({ x: to, y: 84 });
          await b.until(() => H.st !== 'warn' && H.st !== 'hover');
        } else if (H.st === 'stuck' && !H.hit) { await b.tap({ x: H.tx, y: 42 }); }
        else await b.wait(16);
      }
      await b.until(() => s.ph === 2);
      while (!b.over() && s.ph === 2) { await b.tap({ x: s.ball.x + (s.ball.vx || 0) * 0.03, y: s.ball.y + (s.ball.vy || 0) * 0.03 }); await b.wait(70); }
      await b.until(() => s.ph === 3);
      while (!b.over() && !s.blast) {
        b.down({ x: 50, y: 40 });
        await b.until(() => s.charge >= 82 || s.fizz);
        b.up({ x: 50, y: 40 });
        await b.wait(150);
      }
    },
  },
];
