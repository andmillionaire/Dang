import { h, icon } from '../ui.js';
import { rnd, pick, shuffle, clamp, dist, at, tapper, follow, swipe, holdable, sprite, art, addStyle } from './kit.js';

// Cabin Life: cozy microgames from the rainy cabin, the attic farm, the kitchen and the pets.

// ---------- pixel art ----------
const POT = [
  '.....kkk......',
  '....kfffk.....',
  '..kkkkkkkkk...',
  '.kfffffffffk.k',
  'kfkfffffffffkk',
  'kfkffwfffffffk',
  'kfkfffffffffk.',
  '.kfffffffffk..',
  '..kfffffffk...',
  '...kkkkkkk....',
];
const SPROUT = [
  '..g..g..',
  '.ggllgg.',
  '..gGGg..',
  '...gG...',
  '....G...',
  '....G...',
  '.BBBBBB.',
  '.BbbbbB.',
  '..BBBB..',
];
const CAN = [
  '...sss.....',
  '..s...s....',
  '.uuuuuuu..s',
  'uUUUUUUUu.s',
  'uUwUUUUUUss',
  'uUUUUUUUus.',
  'uUUUUUUUu..',
  '.uuuuuuu...',
];
const CARROT = [
  '.g...g.',
  '..g.g..',
  'g.ggg.g',
  '.ggGgg.',
  '..oqo..',
  '.ooooo.',
  '.oqooo.',
  '..oooo.',
  '..ooqo.',
  '..ooo..',
  '...oo..',
  '...o...',
];
const FISH = [
  '..uuu..u',
  '.uUUuuuu',
  'uUkUUUu.',
  '.uUUuuuu',
  '..uuu..u',
];
const LOG = [
  '.BBBBBBBB.',
  'BbbbbbbbtT',
  'BbTbbbbbtT',
  'BbbbbbbbtT',
  '.BBBBBBBB.',
];
const LOG_SPLIT = [
  '.BBBB..BBBB.',
  'Bbbbt..Bbbbt',
  'BbTbt..Bbbbt',
  'Bbbbt..Bbbbt',
  '.BBBB..BBBB.',
];
const AXE = [
  '....TT....',
  '....TT....',
  '....TT....',
  '....TT....',
  '....TT....',
  '....TT....',
  '.ssssT....',
  'ssswsT....',
  'sssssT....',
  '.ssssT....',
  '....TT....',
  '....kk....',
];
const EGG = [
  '..ww..',
  '.wwww.',
  'wwwwww',
  'wwwwwc',
  'wwwwwc',
  '.wwcc.',
  '..cc..',
];
const DUSTPAN = [
  'kkkkkkk...',
  'ksssssk...',
  'kssssssk..',
  'kssssssskk',
  'kkkkkkkkkT',
  '.........T',
];
const SOCK = [
  '.kkkk..',
  '.kwwk..',
  '.kxxk..',
  '.kxxk..',
  '.kwwk..',
  '.kxxkk.',
  'kxxxxxk',
  'kxxxxxk',
  '.kkkkk.',
];
const ALARM = [
  '.k......k.',
  'kyk....kyk',
  '.kkkkkkkk.',
  'krrrrrrrrk',
  'krwwkwwwrk',
  'krwwkwwwrk',
  'krwwkkkwrk',
  'krwwwwwwrk',
  '.krrrrrrk.',
  '.k......k.',
];
const REMOTE = [
  'kkkkk',
  'kDrDk',
  'kDDDk',
  'kswsk',
  'kDDDk',
  'kswsk',
  'kDDDk',
  'kswsk',
  'kDDDk',
  'kkkkk',
];
const KEY = [
  '..ss..ss..',
  '.s..ss..s.',
  '.s..ss..s.',
  '..ss..ss..',
  '....ss....',
  '....ss....',
  '....ss....',
];
const UMBRELLA = [
  '.....kk.....',
  '...kffffk...',
  '..kfFffFfk..',
  '.kfffffffFk.',
  'kFfffFffffFk',
  'kkkkkkkkkkkk',
  '.....kk.....',
  '.....kk.....',
  '.....kk..k..',
  '......kkk...',
];
const SOCK_COLOURS = { r: '#d0463c', U: '#4f8fd0' };

// ---------- styles ----------
const CSS = `
[class*="mcs-cz-"] .mc-spr { image-rendering: pixelated; pointer-events: none; display: block; }
[class*="mcs-cz-"] .ico { image-rendering: pixelated; pointer-events: none; }
.cz-kitchen { background: linear-gradient(#5a3a4a 0 64%, #8a5a3a 64% 67%, #6b3d22 67%); }
.cz-stove { background: radial-gradient(circle at 50% 62%, #4a3030 0 30%, #2a1c24 70%); }
.cz-garden { background: linear-gradient(#34406a 0 56%, #2c2440 56%); }
.cz-floor { background: repeating-linear-gradient(90deg, #8a5a3a 0 34px, #7a4e32 34px 36px); }
.cz-wall { background: repeating-linear-gradient(90deg, #6a4a6a 0 18px, #74507a 18px 36px); }
.cz-night { background: radial-gradient(circle at 50% 85%, #4a2a1a 0 18%, #141c34 60%); }
.cz-bed { background: linear-gradient(#2a2448 0 60%, #6b3d22 60%); }
.cz-cup { background: #f2e6c9; box-shadow: 0 0 0 4px #1a1220; overflow: hidden; }
.cz-fill { position: absolute; left: 0; right: 0; bottom: 0; height: 0; background: #a0663a; }
.cz-fill.spill { background: #c0507a; }
.cz-band { position: absolute; left: 0; right: 0; background: rgba(255, 226, 122, .45); border-top: 2px dashed #b5862a; border-bottom: 2px dashed #b5862a; }
.cz-stream { width: 2.4%; height: 18%; background: #a0663a; opacity: 0; }
.cz-pot.tilt { transform: translate(-50%, -50%) rotate(28deg); }
.cz-pan { width: 62%; height: 26%; border-radius: 50%; background: #3a3a44; box-shadow: 0 0 0 4px #1a1220, inset 0 -6px 0 #24242c; }
.cz-pan::after { content: ''; position: absolute; left: 98%; top: 40%; width: 34%; height: 18%; background: #1a1220; }
.cz-cake { width: 40%; height: 15%; border-radius: 50%; background: #f2e6c9; box-shadow: 0 3px 0 #1a1220; }
.cz-cake.flip { animation: czflip .5s ease-out; }
@keyframes czflip { 50% { transform: translate(-50%, -260%) scaleY(-1); } }
.cz-meter { width: 7%; height: 60%; background: #1a1220; box-shadow: 0 0 0 2px #1a1220; }
.cz-meter-zone { position: absolute; left: 0; right: 0; background: rgba(255, 226, 122, .5); }
.cz-meter-fill { position: absolute; left: 25%; right: 25%; bottom: 0; height: 0; background: #f39a3a; }
.cz-soil { width: 100%; height: 44%; background: repeating-linear-gradient(0deg, #4a2e1a 0 8px, #3a2216 8px 10px); box-shadow: 0 -4px 0 #6b3d22; }
.cz-carrot { transition: top .35s cubic-bezier(.3, 1.6, .5, 1); }
.cz-carrot.out { top: 22% !important; z-index: 3; }
.cz-carrot.wiggle { animation: czwig .12s steps(2) infinite; }
@keyframes czwig { 50% { transform: translate(-46%, -50%); } }
.cz-grip { width: 34%; height: 4%; background: #1a1220; }
.cz-grip i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: #6fb04a; }
.cz-heart { width: 7%; animation: czfloat .7s ease-out forwards; pointer-events: none; }
@keyframes czfloat { to { transform: translate(-50%, -260%); opacity: 0; } }
.cz-happy { animation: czwag .2s steps(2) infinite; }
@keyframes czwag { 50% { transform: translate(-50%, -50%) rotate(4deg); } }
.cz-yarn { width: 30%; height: 30%; border-radius: 50%; background: repeating-linear-gradient(35deg, #c0507a 0 6px, #f08ab0 6px 10px); box-shadow: 0 0 0 4px #1a1220; }
.cz-ring { width: 30%; height: 30%; border-radius: 50%; box-shadow: 0 0 0 4px #ffe27a; }
.cz-target { width: 30%; height: 30%; border-radius: 50%; box-shadow: 0 0 0 3px rgba(255, 244, 224, .5); outline: 2px dashed rgba(255, 244, 224, .35); outline-offset: 8px; }
.cz-scarf { display: flex; gap: 4px; }
.cz-scarf b { width: 22px; height: 22px; background: #2a2440; box-shadow: 0 0 0 2px #1a1220; }
.cz-scarf b.on { background: repeating-linear-gradient(90deg, #f08ab0 0 4px, #c0507a 4px 8px); }
.cz-stump { width: 70%; height: 16%; background: #7a5230; box-shadow: 0 0 0 4px #1a1220, inset 0 6px 0 #c79a5a; }
.cz-axe.chop { animation: czchop .18s; }
@keyframes czchop { 50% { transform: translate(-50%, -10%) rotate(-12deg); } }
.cz-clip { width: 84%; height: 58%; background: #f2e6c9; box-shadow: 0 0 0 4px #1a1220, inset 0 10px 0 #c9ad7f; color: #1a1220; font-size: 18px; text-align: center; padding-top: 14px; }
.cz-line { width: 72%; height: 3px; background: #1a1220; }
.cz-ink { width: 2.4%; height: 2.4%; background: #24305a; pointer-events: none; }
.cz-dust { width: 20%; height: 10%; border-radius: 50% 50% 20% 20%; background: radial-gradient(#b8a890, #8a7a68); box-shadow: 0 0 0 3px #1a1220; transition: left .18s ease-out; }
.cz-frame { width: 54%; height: 40%; }
.cz-frame i { position: absolute; inset: 0; background: linear-gradient(#9fd3f2 0 55%, #6fb04a 55%); box-shadow: 0 0 0 6px #c79a5a, 0 0 0 9px #1a1220; }
.cz-frame i::after { content: ''; position: absolute; left: 60%; top: 18%; width: 16%; height: 22%; border-radius: 50%; background: #ffe27a; }
.cz-level { width: 40%; height: 5%; background: #6fb04a; box-shadow: 0 0 0 3px #1a1220; }
.cz-level b { position: absolute; top: 15%; width: 16%; height: 70%; border-radius: 50%; background: #e8f8c8; }
.cz-bowl { width: 28%; height: 13%; border-radius: 0 0 50% 50%; background: #4f8fd0; box-shadow: 0 0 0 4px #1a1220, inset 0 5px 0 #9fd3f2; }
.cz-yolk { width: 9%; height: 9%; border-radius: 50%; background: #ffe27a; box-shadow: 0 0 0 5px #fff4e0; }
.cz-splat { width: 18%; height: 6%; border-radius: 50%; background: #ffe27a; box-shadow: 0 0 0 5px #fff4e0; }
.cz-fire { width: 22%; height: 18%; }
.cz-fire i { position: absolute; left: 10%; right: 10%; bottom: 20%; top: 0; background: linear-gradient(0deg, #d0463c, #f39a3a 50%, #ffe27a); clip-path: polygon(50% 0, 70% 35%, 90% 20%, 100% 100%, 0 100%, 10% 25%, 30% 40%); animation: flick .15s steps(2) infinite; }
.cz-fire::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 24%; background: repeating-linear-gradient(90deg, #6b3d22 0 8px, #3a2216 8px 10px); }
.cz-mm { width: 9%; height: 9%; background: #fff4e0; box-shadow: 0 0 0 3px #1a1220; }
.cz-mm::after { content: ''; position: absolute; left: 100%; top: 40%; width: 220%; height: 18%; background: #c79a5a; }
.cz-clock { width: 66%; height: 66%; border-radius: 50%; background: #f2e6c9; box-shadow: 0 0 0 6px #6b3d22, 0 0 0 9px #1a1220; }
.cz-turns { font-size: 22px; color: #ffe27a; }
.cz-basket { width: 26%; height: 20%; box-shadow: 0 0 0 4px #1a1220; background: repeating-linear-gradient(90deg, #c79a5a 0 6px, #a0663a 6px 9px); }
.cz-basket b { position: absolute; left: 0; right: 0; top: 0; height: 30%; }
.cz-alarm.rattle { animation: czrat .08s steps(2) infinite; }
@keyframes czrat { 50% { transform: translate(-46%, -52%) rotate(6deg); } }
.cz-alarm { width: 22%; padding: 0; border: 0; background: none; touch-action: none; }
.cz-alarm img { width: 100%; image-rendering: pixelated; pointer-events: none; display: block; }
.cz-plot { width: 22%; height: 22%; border: 0; padding: 0; background: #4a2e1a; box-shadow: 0 0 0 3px #1a1220, inset 0 -6px 0 #3a2216; display: grid; place-items: center; touch-action: none; }
.cz-plot .ico, .cz-plot img { width: 70%; image-rendering: pixelated; pointer-events: none; }
.cz-plot.picked { opacity: .25; }
.cz-couch { width: 92%; height: 34%; background: #c0507a; box-shadow: 0 0 0 4px #1a1220, inset 0 -10px 0 #8a3058; }
.cz-cushion { width: 27%; height: 19%; background: #f08ab0; box-shadow: 0 0 0 4px #1a1220, inset 0 -5px 0 #c0507a; z-index: 2; touch-action: none; }
.cz-cushion.up { margin-top: -14%; }
.cz-toast { width: 46%; height: 42%; background: #e8a848; box-shadow: 0 0 0 5px #a0663a, 0 0 0 8px #1a1220; }
.cz-toast i { position: absolute; inset: 8%; background: #ffe27a; opacity: 0; }
.cz-glass { width: 30%; height: 42%; background: rgba(191, 230, 255, .35); box-shadow: 0 0 0 4px #1a1220; overflow: hidden; }
.cz-glass .cz-fill { background: #f39a3a; }
.cz-step { font-size: 22px; color: #ffe27a; white-space: nowrap; text-shadow: 2px 2px 0 #1a1220; z-index: 4; }
.cz-pips { display: flex; gap: 5px; z-index: 4; }
.cz-pips b { width: 14px; height: 14px; background: #2a1c24; box-shadow: 0 0 0 2px #1a1220; }
.cz-pips b.now { background: #f08ab0; }
.cz-pips b.on { background: #ffe27a; }
.cz-fried { --b: #f2e6c9; width: 22%; height: 11%; border-radius: 46% 54% 50% 50%; background: radial-gradient(circle at 50% 50%, #ffe27a 0 26%, var(--b) 28%); box-shadow: 0 0 0 3px #1a1220; z-index: 2; }
.cz-fried.ready { box-shadow: 0 0 0 3px #1a1220, 0 0 14px 4px #ffe27a; }
.cz-fried.burnt { background: radial-gradient(circle at 50% 50%, #3a2a1a 0 26%, #1a1210 28%); }
.cz-fried.flip { animation: czflip .45s ease-out; }
.cz-fried.hop { animation: czhop .3s; }
.cz-fried.done { --b: #e8a848; width: 16%; height: 8%; }
@keyframes czhop { 50% { transform: translate(-50%, -80%); } }
.cz-toast.small { width: 16%; height: 14%; box-shadow: 0 0 0 3px #a0663a, 0 0 0 5px #1a1220; }
.cz-plate { width: 28%; height: 7%; border-radius: 50%; background: #fff4e0; box-shadow: 0 0 0 4px #1a1220, inset 0 -4px 0 #c9ad7f; z-index: 3; }
.cz-plate.has1::before, .cz-plate.has2::before { content: ''; position: absolute; left: 18%; top: -60%; width: 36%; height: 90%; border-radius: 50%; background: radial-gradient(circle, #ffe27a 0 28%, #fff4e0 30%); box-shadow: 0 0 0 2px #1a1220; }
.cz-plate.has2::after { content: ''; position: absolute; left: 54%; top: -120%; width: 30%; height: 150%; background: #ffe27a; box-shadow: 0 0 0 3px #a0663a, 0 0 0 5px #1a1220; }
`;
const css = () => addStyle('cozy', CSS);

// ---------- helpers ----------
const div = (cls, style = '', ...kids) => h('div', { class: cls, style }, ...kids);
const place = (stage, node, x, y) => { stage.append(at(node, x, y)); return node; };
const note = (stage, text) => stage.append(h('p', { class: 'mc-note' }, text));
const big = (name, w) => { const i = icon(name, 'ico'); i.style.width = w + '%'; return i; };
const hex = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t, 0, 1))).join(',')})`; };
// pale -> golden -> burnt, with golden around 0.55..0.8
const browned = v => (v < 0.55 ? mix('#f2e6c9', '#e8a848', v / 0.55) : v < 0.8 ? mix('#e8a848', '#c8792e', (v - 0.55) / 0.25) : mix('#c8792e', '#2a1810', (v - 0.8) / 0.2));
function heart(stage, x, y) {
  const el = place(stage, big('heart', 7), x, y);
  el.classList.add('cz-heart');
  setTimeout(() => el.remove(), 700);
}

export default [
  {
    id: 'cz-tea', cmd: 'Pour it!', theme: 'cozy',
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      // Hold to pour; let go once the tea is in the gold band. Past the band, it overflows.
      css();
      stage.classList.add('cz-kitchen');
      const lo = 50 + rnd(18), hi = lo + Math.max(8, 16 - speed * 3);
      const fill = div('cz-fill');
      place(stage, div('cz-cup', 'width:40%;height:42%', fill, div('cz-band', `bottom:${lo}%;height:${hi - lo}%`)), 58, 66);
      const stream = place(stage, div('cz-stream'), 48, 38);
      const pot = place(stage, sprite(POT, {}, 34, 'cz-pot'), 30, 22);
      note(stage, 'Hold to pour · let go in the gold band');
      const s = expose({ level: 0, lo, hi, pouring: false });
      let done = false;
      holdable(stage, () => { if (!done) { s.pouring = true; pot.classList.add('tilt'); sfx('drip'); } }, () => {
        s.pouring = false;
        pot.classList.remove('tilt');
        if (!done && s.level >= lo && s.level <= hi) { done = true; win(); }
      });
      frame(dt => {
        if (s.pouring && !done) {
          s.level += (24 + 12 * speed) * dt;
          if (s.level > hi) { done = true; fill.classList.add('spill'); lose(); }
        }
        fill.style.height = Math.min(100, s.level) + '%';
        stream.style.opacity = s.pouring && !done ? 1 : 0;
      });
    },
    async solve(b, s) {
      b.down({ x: 50, y: 50 });
      await b.until(() => s.level >= (s.lo + s.hi) / 2);
      b.up({ x: 50, y: 50 });
    },
  },
  {
    id: 'cz-pancake', cmd: 'Flip it!', theme: 'cozy',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      // Swipe up to flip once the underside is golden. Too soon is pale, too late is charcoal.
      css();
      stage.classList.add('cz-stove');
      place(stage, div('cz-pan'), 46, 62);
      const cake = place(stage, div('cz-cake'), 46, 58);
      const bar = div('cz-meter-fill');
      place(stage, div('cz-meter', '', div('cz-meter-zone', 'bottom:55%;height:25%'), bar), 90, 48);
      note(stage, 'Swipe up when it’s golden');
      const s = expose({ brown: Math.random() * 0.15 });
      let done = false;
      frame(dt => {
        if (done) return;
        s.brown += (0.2 + 0.07 * speed) * dt;
        cake.style.background = browned(s.brown);
        bar.style.height = Math.min(100, s.brown * 100) + '%';
        if (s.brown > 1) { done = true; sfx('fizzle'); lose(); }
      });
      swipe(stage, pos, dir => {
        if (dir !== 'up' || done) return;
        done = true;
        cake.classList.add('flip');
        sfx('swap');
        s.brown >= 0.55 && s.brown <= 0.8 ? win() : lose();
      });
    },
    async solve(b, s) {
      await b.until(() => s.brown >= 0.65);
      await b.swipe('up', { x: 50, y: 75 });
    },
  },
  {
    id: 'cz-water', cmd: 'Water ’em!', theme: 'cozy', time: 6,
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      // Hold the watering can over every thirsty sprout until it perks up.
      css();
      stage.classList.add('cz-garden');
      const n = speed > 1.5 ? 4 : 3;
      const xs = shuffle([16, 39, 62, 85]).slice(0, n);
      const sprouts = xs.map(x => {
        const el = place(stage, sprite(SPROUT, {}, 12, 'cz-sprout'), x, 76);
        el.style.filter = 'saturate(.2) brightness(.75)';
        return { x, w: 0, done: false, el };
      });
      const can = place(stage, sprite(CAN, {}, 22, 'cz-can'), 50, 30);
      note(stage, 'Drag the can over each sprout');
      const s = expose({ cx: 50, held: false, sprouts });
      follow(stage, pos, (p, phase) => {
        s.held = phase !== 'up';
        s.cx = p.x;
        at(can, p.x, clamp(p.y, 15, 52));
      });
      let drip = 0;
      frame(dt => {
        let pouring = false;
        for (const sp of sprouts) {
          if (sp.done || !s.held || Math.abs(s.cx - sp.x) > 10) continue;
          pouring = true;
          sp.w += dt / 0.5;
          sp.el.style.filter = `saturate(${0.2 + sp.w * 0.8}) brightness(${0.75 + sp.w * 0.25})`;
          if (sp.w >= 1) {
            sp.done = true;
            sp.el.style.width = '17%';
            sfx('plant');
            if (sprouts.every(q => q.done)) win();
          }
        }
        can.style.transform = `translate(-50%, -50%) rotate(${pouring ? 25 : 0}deg)`;
        drip -= dt;
        if (pouring && drip <= 0) {
          drip = 0.08;
          const d = place(stage, h('i', { class: 'mc-drop' }), s.cx + 6, 45);
          d.animate([{ top: '45%' }, { top: '72%' }], { duration: 300 }).onfinish = () => d.remove();
        }
      });
    },
    async solve(b, s) {
      b.down({ x: s.sprouts[0].x, y: 35 });
      for (const sp of s.sprouts) {
        b.move({ x: sp.x, y: 35 });
        await b.until(() => sp.done);
      }
      b.up({ x: 50, y: 35 });
    },
  },
  {
    id: 'cz-carrot', cmd: 'Yank it!', theme: 'cozy',
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      // Grab the leaves and hold till your grip is firm, then pull up. Pull too soon and they tear.
      css();
      stage.classList.add('cz-garden');
      const x = 30 + Math.random() * 40;
      const carrot = place(stage, sprite(CARROT, {}, 16, 'cz-carrot'), x, 64);
      place(stage, div('cz-soil'), 50, 80);
      const fill = h('i');
      place(stage, div('cz-grip', '', fill), x, 40);
      note(stage, 'Hold the leaves till the bar fills, then pull up');
      const s = expose({ x, y: 54, grip: 0, holding: false });
      let y0 = 0, done = false;
      follow(stage, pos, (p, phase) => {
        if (done) return;
        if (phase === 'down') {
          if (Math.abs(p.x - x) < 15 && p.y > 38 && p.y < 72) { s.holding = true; y0 = p.y; s.grip = 0; sfx('select'); }
        } else if (phase === 'move' && s.holding) {
          if (y0 - p.y > 18) {
            done = true;
            carrot.classList.remove('wiggle');
            if (s.grip >= 1) { carrot.classList.add('out'); sfx('harvest'); win(); }
            else { carrot.style.filter = 'grayscale(1)'; sfx('nope'); lose(); }
          }
        } else if (phase === 'up') { s.holding = false; s.grip = 0; }
      });
      frame(dt => {
        if (s.holding && !done) s.grip = Math.min(1, s.grip + dt / (0.4 + 0.15 * speed));
        fill.style.width = s.grip * 100 + '%';
        fill.style.background = s.grip >= 1 ? '#ffe27a' : '#6fb04a';
        carrot.classList.toggle('wiggle', s.holding && !done);
      });
    },
    async solve(b, s) {
      b.down({ x: s.x, y: s.y });
      await b.until(() => s.grip >= 1);
      for (let k = 1; k <= 6; k++) { b.move({ x: s.x, y: s.y - k * 5 }); await b.wait(20); }
      b.up({ x: s.x, y: 20 });
    },
  },
  {
    id: 'cz-feed', cmd: 'Feed it!', theme: 'cozy',
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      // Drag the fish treat into the cat's mouth while it paces about.
      css();
      stage.classList.add('cz-floor');
      const cat = place(stage, big('cat', 26), 50, 28);
      const treat = place(stage, sprite(FISH, {}, 16, 'cz-treat'), 50, 84);
      const s = expose({ cat: { x: 50, y: 28 }, treat: { x: 50, y: 84 }, carrying: false });
      let done = false;
      const check = () => {
        if (!done && s.carrying && dist(s.treat, { x: s.cat.x, y: s.cat.y + 6 }) < 11) {
          done = true; treat.remove(); sfx('purr'); heart(stage, s.cat.x, s.cat.y - 12); win();
        }
      };
      follow(stage, pos, (p, phase) => {
        if (phase === 'down') s.carrying = dist(p, s.treat) < 15;
        else if (phase === 'up') s.carrying = false;
        else if (s.carrying) { s.treat = { x: p.x, y: p.y }; at(treat, p.x, p.y); check(); }
      });
      frame((dt, t) => {
        s.cat.x = 50 + Math.sin(t * 1.5 * speed) * 32;
        at(cat, s.cat.x, s.cat.y);
        cat.style.transform = `translate(-50%, -50%) scaleX(${Math.cos(t * 1.5 * speed) > 0 ? 1 : -1})`;
        check();
      });
    },
    async solve(b, s) {
      b.down({ ...s.treat });
      while (!b.over()) { b.move({ x: s.cat.x, y: s.cat.y + 6 }); await b.wait(25); }
      b.up({ x: 50, y: 50 });
    },
  },
  {
    id: 'cz-pet', cmd: 'Pet it!', theme: 'cozy',
    setup({ stage, win, sfx, speed, pos, expose }) {
      // Rub the good dog until the love meter fills.
      css();
      stage.classList.add('cz-floor');
      const dog = place(stage, big('dog', 46), 50, 52);
      const fill = h('i');
      place(stage, div('cz-grip', 'width:60%', fill), 50, 12);
      note(stage, 'Rub back and forth');
      const need = 240 + 70 * speed;
      const s = expose({ rub: 0 });
      let last = null, nextHeart = 40, done = false;
      follow(stage, pos, (p, phase) => {
        if (done) return;
        if (phase === 'down') last = p;
        else if (phase === 'up') { last = null; dog.classList.remove('cz-happy'); }
        else if (last) {
          if (dist(p, { x: 50, y: 52 }) < 26) {
            s.rub += dist(p, last);
            dog.classList.add('cz-happy');
            if (s.rub > nextHeart) { nextHeart += 60; heart(stage, 35 + Math.random() * 30, 32); sfx('purr'); }
            fill.style.width = Math.min(100, (s.rub / need) * 100) + '%';
            if (s.rub >= need) { done = true; sfx('woof'); win(); }
          }
          last = p;
        }
      });
    },
    async solve(b) {
      b.down({ x: 40, y: 52 });
      for (let k = 0; !b.over(); k++) { b.move({ x: k % 2 ? 62 : 38, y: 52 }); await b.wait(25); }
      b.up({ x: 50, y: 52 });
    },
  },
  {
    id: 'cz-knit', cmd: 'Knit!', theme: 'cozy', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      // A ring closes in on the yarn: tap just as it lands on the dotted circle. Three stitches.
      css();
      stage.classList.add('cz-wall');
      place(stage, div('cz-yarn'), 50, 42);
      place(stage, div('cz-target'), 50, 42);
      const ring = place(stage, div('cz-ring'), 50, 42);
      const scarf = h('div', { class: 'cz-scarf' }, h('b'), h('b'), h('b'));
      place(stage, scarf, 50, 80);
      note(stage, 'Tap as the ring meets the circle');
      const period = 1.2 / Math.sqrt(speed);
      const s = expose({ scale: 2.6, n: 0 });
      let done = false;
      frame(dt => {
        if (done) return;
        s.scale -= (1.8 / period) * dt;
        ring.style.transform = `translate(-50%, -50%) scale(${Math.max(0, s.scale)})`;
        if (s.scale < 0.75) { done = true; sfx('nope'); lose(); }
      });
      tapper(stage, () => {
        if (done) return;
        if (s.scale >= 0.8 && s.scale <= 1.2) {
          scarf.children[s.n++].classList.add('on');
          sfx('type');
          if (s.n >= 3) { done = true; win(); } else s.scale = 2.2;
        } else { done = true; sfx('nope'); lose(); }
      });
    },
    async solve(b, s) {
      while (!b.over() && s.n < 3) {
        const n = s.n;
        await b.until(() => s.scale >= 0.93 && s.scale <= 1.07);
        await b.tap({ x: 50, y: 42 });
        await b.until(() => s.n > n);
      }
    },
  },
  {
    id: 'cz-chop', cmd: 'Chop it!', theme: 'cozy',
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      // The log slides along the block: swing when it's right under the axe. Twice.
      css();
      stage.classList.add('cz-floor');
      place(stage, div('cz-stump'), 50, 84);
      const log = place(stage, sprite(LOG, {}, 28, 'cz-log'), 50, 70);
      const axe = place(stage, sprite(AXE, {}, 18, 'cz-axe'), 50, 34);
      note(stage, 'Tap when the log is under the axe');
      const w = 1.6 + 0.6 * speed;
      const s = expose({ x: 20, cool: 0, n: 0 });
      let done = false;
      frame((dt, t) => {
        if (done) return;
        s.x = 50 + Math.sin(t * w - Math.PI / 2) * 30;
        s.cool -= dt;
        at(log, s.x, 70);
      });
      tapper(stage, () => {
        if (done || s.cool > 0) return;
        s.cool = 0.3;
        axe.classList.remove('chop'); void axe.offsetWidth; axe.classList.add('chop');
        if (Math.abs(s.x - 50) < 8) {
          s.n++;
          sfx('land');
          log.src = art(s.n === 1 ? LOG_SPLIT : LOG);
          if (s.n >= 2) { done = true; win(); }
        } else { done = true; sfx('nope'); lose(); }
      });
    },
    async solve(b, s) {
      while (!b.over() && s.n < 2) {
        await b.until(() => Math.abs(s.x - 50) < 2.5 && s.cool <= 0);
        await b.tap({ x: 50, y: 50 });
        await b.wait(40);
      }
    },
  },
  {
    id: 'cz-sign', cmd: 'Sign it!', theme: 'cozy',
    setup({ stage, win, sfx, pos, expose }) {
      // A delivery from Jeff's courier: scribble your name across the line.
      css();
      stage.classList.add('cz-floor');
      place(stage, div('cz-clip', '', 'DELIVERY · sign here ✕'), 50, 52);
      place(stage, div('cz-line'), 50, 64);
      note(stage, 'Jeff’s courier is tapping their foot…');
      const bins = new Set();
      const s = expose({ bins });
      let last = null, done = false;
      const ink = p => place(stage, div('cz-ink'), p.x, p.y);
      follow(stage, pos, (p, phase) => {
        if (done) return;
        if (phase === 'up') { last = null; return; }
        if (p.y < 50 || p.y > 76 || p.x < 12 || p.x > 88) { last = null; return; }
        // fill in between touch samples, so a quick scribble counts all the way along
        const pts = last ? [1, 2, 3, 4].map(k => ({ x: last.x + (p.x - last.x) * k / 4, y: last.y + (p.y - last.y) * k / 4 })) : [p];
        for (const q of pts) {
          ink(q);
          if (q.x >= 15 && q.x <= 85) bins.add(Math.min(13, Math.floor(((q.x - 15) / 70) * 14)));
        }
        last = p;
        if (bins.size >= 12) { done = true; sfx('coin'); win(); }
      });
    },
    async solve(b) { await b.drag({ x: 14, y: 62 }, { x: 86, y: 63 }, 400, 24); },
  },
  {
    id: 'cz-sweep', cmd: 'Sweep it!', theme: 'cozy',
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      // Swipe right to sweep the dust bunny into the pan; the draught keeps pushing it back.
      css();
      stage.classList.add('cz-floor');
      const pile = place(stage, div('cz-dust'), 16, 70);
      place(stage, sprite(DUSTPAN, {}, 22, 'cz-dustpan'), 88, 72);
      note(stage, 'Swipe right to sweep');
      const s = expose({ x: 16 });
      let done = false;
      swipe(stage, pos, dir => {
        if (done) return;
        if (dir === 'right') s.x += 24; else if (dir === 'left') s.x -= 24; else return;
        sfx('swap');
        if (s.x >= 80) { done = true; s.x = 88; sfx('coin'); win(); }
      });
      frame(dt => {
        if (!done) s.x = Math.max(10, s.x - 3 * speed * dt);
        at(pile, s.x, 70);
      });
    },
    async solve(b) { while (!b.over()) { await b.swipe('right', { x: 30, y: 55 }); await b.wait(60); } },
  },
  {
    id: 'cz-picture', cmd: 'Straighten it!', theme: 'cozy',
    setup({ stage, win, sfx, speed, frame, pos, expose }) {
      // Drag left or right to tilt the crooked painting level, and hold it there a moment.
      css();
      stage.classList.add('cz-wall');
      const inner = h('i');
      const pic = place(stage, div('cz-frame', '', inner), 50, 45);
      const bubble = h('b');
      place(stage, div('cz-level', '', bubble), 50, 82);
      note(stage, 'Drag sideways to tilt it level');
      const s = expose({ angle: (Math.random() < 0.5 ? -1 : 1) * (14 + rnd(10)) });
      const drift = (Math.random() < 0.5 ? -1 : 1) * (2 + 2 * speed);
      let lastX = null, straight = 0, done = false;
      follow(stage, pos, (p, phase) => {
        if (phase === 'down') lastX = p.x;
        else if (phase === 'up') lastX = null;
        else if (lastX !== null && !done) { s.angle += (p.x - lastX) * 0.9; lastX = p.x; }
      });
      frame(dt => {
        if (done) return;
        s.angle += drift * dt;
        pic.style.transform = `translate(-50%, -50%) rotate(${s.angle}deg)`;
        bubble.style.left = clamp(42 + s.angle * 1.6, 0, 84) + '%';
        straight = Math.abs(s.angle) < 2.5 ? straight + dt : 0;
        if (straight >= 0.35) { done = true; sfx('sparkle'); win(); }
      });
    },
    async solve(b, s) {
      let x = 50;
      b.down({ x, y: 50 });
      while (!b.over()) { x -= s.angle / 0.9; b.move({ x, y: 50 }); await b.wait(30); }
      b.up({ x, y: 50 });
    },
  },
  {
    id: 'cz-egg', cmd: 'Crack it!', theme: 'cozy',
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      // The egg swings over the counter: tap to drop it into the bowl.
      css();
      stage.classList.add('cz-kitchen');
      const bx = 25 + Math.random() * 50;
      place(stage, div('cz-bowl'), bx, 82);
      const egg = place(stage, sprite(EGG, {}, 10, 'cz-egg'), 50, 18);
      note(stage, 'Tap to drop');
      const s = expose({ x: 50, bx, dropped: false });
      let y = 18, done = false;
      const w = 1.4 + 0.6 * speed;
      frame((dt, t) => {
        if (done) return;
        if (!s.dropped) { s.x = 50 + Math.sin(t * w) * 36; }
        else {
          y += 170 * dt;
          if (y >= 76) {
            done = true;
            egg.remove();
            if (Math.abs(s.x - bx) < 10) { place(stage, div('cz-yolk'), bx, 78); sfx('pop'); win(); }
            else { place(stage, div('cz-splat'), s.x, 88); sfx('fizzle'); lose(); }
            return;
          }
        }
        at(egg, s.x, y);
      });
      tapper(stage, () => { if (!s.dropped) { s.dropped = true; sfx('swap'); } });
    },
    async solve(b, s) {
      await b.until(() => Math.abs(s.x - s.bx) < 2);
      await b.tap({ x: 50, y: 50 });
    },
  },
  {
    id: 'cz-marsh', cmd: 'Toast it!', theme: 'cozy', time: 6,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose }) {
      // Hold the marshmallow over the drifting campfire; let go when it's golden, not burnt.
      css();
      stage.classList.add('cz-night');
      const fire = place(stage, div('cz-fire', '', h('i')), 50, 84);
      const mm = place(stage, div('cz-mm'), 30, 58);
      const bar = div('cz-meter-fill');
      place(stage, div('cz-meter', '', div('cz-meter-zone', 'bottom:60%;height:30%'), bar), 92, 40);
      note(stage, 'Hold it over the fire · let go when golden');
      const s = expose({ toast: 0, fx: 50, mx: 30, held: false });
      let done = false;
      follow(stage, pos, (p, phase) => {
        if (done) return;
        if (phase === 'up') {
          s.held = false;
          if (s.toast >= 0.6 && s.toast <= 0.9) { done = true; sfx('sparkle'); win(); }
          return;
        }
        s.held = true;
        s.mx = clamp(p.x, 8, 80);
        at(mm, s.mx, 58);
      });
      frame((dt, t) => {
        if (done) return;
        s.fx = 50 + Math.sin(t * 0.9 * speed) * 28;
        at(fire, s.fx, 84);
        if (s.held && Math.abs(s.mx - s.fx) < 11) s.toast += dt * (0.32 + 0.1 * speed);
        mm.style.background = s.toast < 0.6 ? mix('#fff4e0', '#e8a848', s.toast / 0.6) : s.toast < 0.9 ? mix('#e8a848', '#c8792e', (s.toast - 0.6) / 0.3) : mix('#c8792e', '#1a1220', (s.toast - 0.9) / 0.1);
        bar.style.height = Math.min(100, s.toast * 100) + '%';
        if (s.toast > 1) { done = true; sfx('fizzle'); lose(); }
      });
    },
    async solve(b, s) {
      b.down({ x: s.mx, y: 58 });
      while (!b.over() && s.toast < 0.72) { b.move({ x: s.fx, y: 58 }); await b.wait(20); }
      b.up({ x: s.fx, y: 58 });
    },
  },
  {
    id: 'cz-clock', cmd: 'Wind it!', theme: 'cozy',
    setup({ stage, win, sfx, speed, pos, expose }) {
      // Circle your finger clockwise round the clock to wind the key.
      css();
      stage.classList.add('cz-wall');
      place(stage, div('cz-clock'), 50, 50);
      const key = place(stage, sprite(KEY, {}, 20, 'cz-key'), 50, 50);
      const label = place(stage, div('cz-turns', '', '0 / 2'), 50, 12);
      note(stage, 'Circle clockwise ↻');
      const need = Math.PI * 2 * (speed > 1.6 ? 2.5 : 2);
      const s = expose({ acc: 0 });
      let last = null, done = false;
      const ang = p => Math.atan2(p.y - 50, p.x - 50);
      follow(stage, pos, (p, phase) => {
        if (done) return;
        if (phase === 'up' || dist(p, { x: 50, y: 50 }) < 8) { last = null; return; }
        const a = ang(p);
        if (last !== null) {
          let d = a - last;
          if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
          const before = Math.floor(s.acc / (Math.PI * 2));
          s.acc = Math.max(0, s.acc + d);
          if (Math.floor(s.acc / (Math.PI * 2)) > before) sfx('tap');
          key.style.transform = `translate(-50%, -50%) rotate(${s.acc}rad)`;
          label.textContent = `${Math.floor(s.acc / (Math.PI * 2))} / ${need / (Math.PI * 2)}`;
          if (s.acc >= need) { done = true; sfx('ring'); win(); }
        }
        last = a;
      });
    },
    async solve(b) {
      let a = 0;
      b.down({ x: 75, y: 50 });
      while (!b.over()) { a += 0.35; b.move({ x: 50 + 25 * Math.cos(a), y: 50 + 25 * Math.sin(a) }); await b.wait(15); }
      b.up({ x: 50, y: 50 });
    },
  },
  {
    id: 'cz-umbrella', cmd: 'Shake it!', theme: 'cozy',
    setup({ stage, win, sfx, speed, pos, expose }) {
      // Back in from the rain: shake the umbrella dry, side to side.
      css();
      stage.classList.add('cz-floor');
      const umb = place(stage, sprite(UMBRELLA, {}, 40, 'cz-umb'), 50, 45);
      note(stage, 'Shake it side to side');
      const need = 5 + Math.round(speed * 1.5);
      const s = expose({ n: 0 });
      let dir = 0, lastX = null, turnX = 0, done = false;
      follow(stage, pos, (p, phase) => {
        if (done) return;
        if (phase === 'down') { lastX = p.x; turnX = p.x; dir = 0; return; }
        if (phase === 'up' || lastX === null) { lastX = null; return; }
        const d = Math.sign(p.x - lastX);
        if (d && d !== dir) {
          if (dir && Math.abs(lastX - turnX) >= 12) {
            s.n++;
            sfx('drip');
            for (let k = 0; k < 3; k++) {
              const drop = place(stage, h('i', { class: 'mc-drop' }), lastX + (Math.random() - 0.5) * 30, 35);
              drop.animate([{ opacity: 1 }, { opacity: 0, top: '10%', left: `${lastX + dir * 30}%` }], { duration: 400 }).onfinish = () => drop.remove();
            }
            if (s.n >= need) { done = true; win(); }
          }
          turnX = lastX;
          dir = d;
        }
        lastX = p.x;
        at(umb, clamp(p.x, 20, 80), 45);
        umb.style.transform = `translate(-50%, -50%) rotate(${d * 14}deg)`;
      });
    },
    async solve(b) {
      b.down({ x: 50, y: 45 });
      for (let k = 0; !b.over(); k++) {
        const to = k % 2 ? 25 : 75;
        for (let i = 1; i <= 3; i++) { b.move({ x: 50 + (to - 50) * i / 3, y: 45 }); await b.wait(15); }
      }
      b.up({ x: 50, y: 45 });
    },
  },
  {
    id: 'cz-laundry', cmd: 'Sort it!', theme: 'cozy', time: 6,
    setup({ stage, win, lose, sfx, speed, pos, expose }) {
      // Red socks swipe left, blue socks swipe right.
      css();
      stage.classList.add('cz-floor');
      place(stage, div('cz-basket', '', h('b', { style: 'background:#d0463c' })), 16, 78);
      place(stage, div('cz-basket', '', h('b', { style: 'background:#4f8fd0' })), 84, 78);
      const need = speed > 1.6 ? 5 : 4;
      const s = expose({ cur: pick(['r', 'U']), n: 0 });
      const sock = place(stage, sprite(SOCK, { x: SOCK_COLOURS[s.cur] }, 16, 'cz-sock'), 50, 40);
      note(stage, 'Red ← swipe → Blue');
      let done = false;
      swipe(stage, pos, dir => {
        if (done || (dir !== 'left' && dir !== 'right')) return;
        const want = s.cur === 'r' ? 'left' : 'right';
        const fly = place(stage, sprite(SOCK, { x: SOCK_COLOURS[s.cur] }, 16, 'cz-sock'), 50, 40);
        fly.animate([{ left: '50%', top: '40%' }, { left: dir === 'left' ? '16%' : '84%', top: '74%' }], { duration: 200, fill: 'forwards' }).onfinish = () => fly.remove();
        if (dir !== want) { done = true; sfx('nope'); lose(); return; }
        sfx('place');
        if (++s.n >= need) { done = true; sock.remove(); win(); return; }
        s.cur = pick(['r', 'U']);
        sock.src = art(SOCK, { x: SOCK_COLOURS[s.cur] });
      });
    },
    async solve(b, s) {
      while (!b.over()) {
        const n = s.n;
        await b.swipe(s.cur === 'r' ? 'left' : 'right', { x: 50, y: 45 });
        await b.until(() => s.n !== n, 1500); // look at the next sock before swiping again
        await b.wait(40);
      }
    },
  },
  {
    id: 'cz-alarm', cmd: 'Wake up!', theme: 'cozy',
    setup({ stage, win, sfx, speed, frame, expose }) {
      // The alarm clock is rattling all over the room. Smack it three times.
      css();
      stage.classList.add('cz-bed');
      const clock = h('button', { type: 'button', class: 'cz-alarm rattle' }, h('img', { src: art(ALARM), alt: '' }));
      const jump = () => at(clock, 15 + Math.random() * 70, 18 + Math.random() * 64);
      jump();
      stage.append(clock);
      const s = expose({ el: clock, n: 0 });
      let next = 0.8 / speed, done = false;
      sfx('ring');
      tapper(clock, () => {
        if (done) return;
        s.n++;
        sfx('pop');
        if (s.n >= 3) { done = true; clock.classList.remove('rattle'); win(); return; }
        jump();
        next = 0.8 / speed;
      });
      frame(dt => {
        if (done) return;
        next -= dt;
        if (next <= 0) { next = 0.8 / speed; jump(); }
      });
    },
    async solve(b, s) { while (!b.over()) { await b.tap(s.el); await b.wait(60); } },
  },
  {
    id: 'cz-harvest', cmd: 'Ripe ones!', theme: 'cozy',
    setup({ stage, win, lose, sfx, speed, expose }) {
      // Pick everything that's ready. Touch a sprout and it's ruined.
      css();
      stage.classList.add('cz-garden');
      const ripeCount = 2 + rnd(2) + (speed > 1.5 ? 1 : 0);
      const ripe = new Set(shuffle([0, 1, 2, 3, 4, 5]).slice(0, ripeCount));
      const s = expose({ ripe: [] });
      let picked = 0, done = false;
      [22, 50, 78].forEach((x, c) => [38, 70].forEach((y, r) => {
        const i = r * 3 + c, ok = ripe.has(i);
        const plot = h('button', { type: 'button', class: 'cz-plot' }, ok ? icon(pick(['pumpkin', 'wheat', 'flowers', 'cotton']), 'ico') : h('img', { src: art(SPROUT), alt: '' }));
        place(stage, plot, x, y);
        if (ok) s.ripe.push(plot);
        tapper(plot, () => {
          if (done || plot.classList.contains('picked')) return;
          if (!ok) { done = true; sfx('nope'); lose(); return; }
          plot.classList.add('picked');
          sfx('harvest');
          if (++picked === ripeCount) { done = true; win(); }
        });
      }));
      note(stage, 'Only the ripe ones!');
    },
    async solve(b, s) { for (const p of s.ripe) await b.tap(p); },
  },
  {
    id: 'cz-stack', cmd: 'Stack it!', theme: 'cozy', time: 7,
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      // Drop each log neatly on the pile. Miss by too much and it all topples.
      css();
      stage.classList.add('cz-floor');
      place(stage, sprite(LOG, {}, 28, 'cz-log'), 50, 88);
      const w = 2 + 0.7 * speed, phase = Math.random() * 6;
      const s = expose({ x: 20, top: 50, falling: false, n: 0 });
      let log = place(stage, sprite(LOG, {}, 28, 'cz-log'), 20, 22), y = 22, done = false;
      note(stage, 'Tap to drop');
      frame((dt, t) => {
        if (done) return;
        if (!s.falling) { s.x = 50 + Math.sin(t * w + phase) * 34; at(log, s.x, 22); return; }
        const target = 88 - 13 * (s.n + 1);
        y += 200 * dt;
        if (y >= target) {
          y = target;
          at(log, s.x, y);
          if (Math.abs(s.x - s.top) < 11) {
            s.n++; s.top = s.x; s.falling = false; sfx('land');
            if (s.n >= 3) { done = true; win(); return; }
            log = place(stage, sprite(LOG, {}, 28, 'cz-log'), s.x, 22);
            y = 22;
          } else {
            done = true;
            log.style.transform = `translate(-50%, -50%) rotate(${s.x > s.top ? 50 : -50}deg)`;
            sfx('fizzle');
            lose();
          }
          return;
        }
        at(log, s.x, y);
      });
      tapper(stage, () => { if (!done && !s.falling) { s.falling = true; sfx('swap'); } });
    },
    async solve(b, s) {
      while (!b.over()) {
        await b.until(() => !s.falling && Math.abs(s.x - s.top) < 5);
        if (b.over()) break;
        await b.tap({ x: 50, y: 50 });
        await b.until(() => s.falling);
        await b.until(() => !s.falling);
        await b.wait(60); // the next log starts swinging a frame after the last one lands
      }
    },
  },
  {
    id: 'cz-remote', cmd: 'Where’s the remote?', theme: 'cozy', time: 7,
    setup({ stage, win, lose, sfx, speed, frame, expose }) {
      // Watch which cushion hides the remote while they shuffle, then lift it.
      css();
      stage.classList.add('cz-wall');
      place(stage, div('cz-couch'), 50, 66);
      const slots = [22, 50, 78];
      const cushions = slots.map(x => ({ x, from: x, to: x, el: place(stage, div('cz-cushion'), x, 55) }));
      const hidden = pick(cushions);
      const remote = place(stage, sprite(REMOTE, {}, 7, 'cz-remote'), hidden.x, 60);
      remote.style.zIndex = 1;
      hidden.el.classList.add('up');
      const s = expose({ ready: false, el: hidden.el });
      const swaps = 3 + Math.round(speed * 2), dur = 0.45 / speed;
      let phase = 'show', timer = 0.9, k = 0, a = null, c = null, done = false;
      note(stage, 'Keep your eye on it…');
      frame(dt => {
        if (done || phase === 'pick') return;
        timer -= dt;
        if (phase === 'show') {
          if (timer > 0) return;
          hidden.el.classList.remove('up');
          remote.style.opacity = 0;
          phase = 'shuffle';
          timer = 0;
        }
        if (phase === 'shuffle') {
          if (timer <= 0) {
            if (a) { a.x = a.to; c.x = c.to; at(a.el, a.x, 55); at(c.el, c.x, 55); }
            if (k++ >= swaps) { phase = 'pick'; s.ready = true; stage.querySelector('.mc-note').textContent = 'Which one?'; return; }
            [a, c] = shuffle(cushions.slice()).slice(0, 2);
            a.from = a.x; c.from = c.x; a.to = c.x; c.to = a.x;
            timer = dur;
            sfx('swap');
          }
          const f = 1 - timer / dur;
          at(a.el, a.from + (a.to - a.from) * f, 55 - Math.sin(f * Math.PI) * 10);
          at(c.el, c.from + (c.to - c.from) * f, 55 + Math.sin(f * Math.PI) * 6);
        }
      });
      for (const cu of cushions) tapper(cu.el, () => {
        if (done || phase !== 'pick') return;
        done = true;
        cu.el.classList.add('up');
        at(remote, hidden.x, 60);
        if (cu === hidden) { remote.style.opacity = 1; sfx('coin'); win(); } else { sfx('nope'); lose(); }
      });
    },
    async solve(b, s) { await b.until(() => s.ready); await b.tap(s.el); },
  },
  {
    id: 'cz-breakfast', cmd: 'Cook breakfast!', theme: 'cozy', time: 24, boss: true,
    setup({ stage, win, lose, sfx, speed, frame, pos, expose, phase }) {
      // Five phases against one long fuse: crack the egg, flip it golden, butter the toast,
      // pour the juice, then catch it all on the plate. Fumbles mean "try again"; only a
      // burnt egg ends breakfast early.
      css();
      stage.classList.add('cz-kitchen');
      const TITLES = ['Crack the egg!', 'Flip it golden!', 'Butter the toast!', 'Pour the juice!', 'Plate it up!'];
      const label = place(stage, div('cz-step'), 50, 8);
      const pips = place(stage, div('cz-pips'), 50, 16);
      const pipEls = TITLES.map(() => h('b'));
      pips.append(...pipEls);
      const s = expose({
        step: -1, busy: true, x: 50, dropped: false, ey: 20,
        brown: 0, golden: [0.55, 0.8],
        rub: 0, need: 200 + 40 * speed,
        level: 0, lo: 0, hi: 0,
        px: 50, items: [], caught: 0,
      });
      let t = 0, busyUntil = 0, layer = h('div'), done = false;
      let egg, panEgg, butter, fill, plate, last = null, pouring = false, swipeFrom = null, msgUntil = 0;
      const say = text => { label.textContent = text; msgUntil = t + 0.9; };
      const scene = (n, ...kids) => {
        layer.remove();
        layer = h('div', { style: 'position:absolute;inset:0' }, ...kids);
        stage.append(layer);
        s.step = n;
        label.textContent = `${n + 1}/5 ${TITLES[n]}`;
        pipEls.forEach((p, i) => p.classList.toggle('on', i < n));
        pipEls[n].classList.add('now');
        s.busy = true;
        busyUntil = t + 0.9;
        phase(n + 1, TITLES[n]);
      };
      const finish = () => { done = true; pipEls.forEach(p => p.classList.add('on')); label.textContent = 'Breakfast is served!'; sfx('coin'); win(); };

      // 1. crack: an egg swings over the pan; tap to drop it
      const newEgg = () => {
        egg?.remove();
        egg = at(h('img', { src: art(EGG), class: 'mc-spr', alt: '', style: 'width:10%' }), 50, 26);
        layer.append(egg);
        s.dropped = false; s.ey = 26;
      };
      const step0 = () => { scene(0, at(div('cz-pan'), 50, 74)); newEgg(); };
      // 2. flip: the fried egg browns; swipe up while it's golden
      const step1 = () => {
        panEgg = at(div('cz-fried'), 50, 72);
        scene(1, at(div('cz-pan'), 50, 74), panEgg);
        s.brown = 0;
      };
      // 3. butter: scrub across the toast
      const step2 = () => { butter = h('i'); s.rub = 0; scene(2, at(div('cz-toast', '', butter), 50, 58)); };
      // 4. juice: hold to pour, let go inside the band; overflow means a fresh glass
      const newGlass = () => {
        s.lo = 52 + rnd(18); s.hi = s.lo + Math.max(10, 17 - speed * 3); s.level = 0;
        fill = div('cz-fill');
        return at(div('cz-glass', '', fill, div('cz-band', `bottom:${s.lo}%;height:${s.hi - s.lo}%`)), 50, 60);
      };
      const step3 = () => scene(3, newGlass());
      // 5. plate: slide the plate under the egg and the toast as they drop
      const step4 = () => {
        plate = at(div('cz-plate'), 50, 88);
        s.px = 50; s.items = []; s.caught = 0;
        scene(4, plate);
      };
      const dropItem = kind => {
        const el = kind === 'egg' ? div('cz-fried done') : div('cz-toast small', '', h('i', { style: 'opacity:1' }));
        const it = { kind, x: 15 + Math.random() * 70, y: -8, el, done: false };
        layer.append(at(el, it.x, it.y));
        s.items.push(it);
      };

      step0();
      follow(stage, pos, (p, ph) => {
        if (done) return;
        if (s.step === 4) { s.px = clamp(p.x, 12, 88); at(plate, s.px, 88); return; }
        if (s.busy) return;
        if (s.step === 0 && ph === 'down' && !s.dropped) { s.dropped = true; sfx('swap'); }
        if (s.step === 1) {
          if (ph === 'down') swipeFrom = p;
          if (ph === 'up' && swipeFrom) {
            const up = swipeFrom.y - p.y > 10;
            swipeFrom = null;
            if (!up) return;
            if (s.brown >= s.golden[0] && s.brown <= s.golden[1]) {
              panEgg.classList.add('flip'); sfx('pop');
              s.busy = true;
              setTimeout(() => !done && step2(), 450);
            } else { sfx('nope'); say('Too soon! Wait for golden'); panEgg.classList.add('hop'); setTimeout(() => panEgg?.classList.remove('hop'), 300); }
          }
        }
        if (s.step === 2) {
          if (ph === 'down') last = p;
          else if (ph === 'up') last = null;
          else if (last) {
            if (Math.abs(p.x - 50) < 24 && Math.abs(p.y - 58) < 22) {
              s.rub += dist(p, last);
              butter.style.opacity = Math.min(1, s.rub / s.need);
              if (s.rub >= s.need) { sfx('coin'); last = null; step3(); }
            }
            last = p;
          }
        }
        if (s.step === 3) {
          if (ph === 'down') pouring = true;
          if (ph === 'up' && pouring) {
            pouring = false;
            if (s.level >= s.lo && s.level <= s.hi) { sfx('coin'); step4(); }
            else if (s.level > s.hi) { sfx('fizzle'); say('Too much! Fresh glass'); s.level = 0; layer.replaceChildren(newGlass()); }
            else if (s.level > 0) { sfx('nope'); say('Not to the line! Top it up'); }
          }
        }
      });

      let nextDrop = 0, dropped = 0;
      frame(dt => {
        t += dt;
        if (done) return;
        if (s.busy && t >= busyUntil && s.step !== 1) s.busy = false;
        if (s.step === 1 && s.busy && t >= busyUntil && !panEgg.classList.contains('flip')) s.busy = false;
        if (msgUntil && t > msgUntil) { msgUntil = 0; label.textContent = `${s.step + 1}/5 ${TITLES[s.step]}`; }
        if (s.step === 0) {
          if (!s.dropped) s.x = 50 + Math.sin(t * (1.5 + 0.45 * speed)) * 34;
          else {
            s.ey += 170 * dt;
            if (s.ey >= 70) {
              if (Math.abs(s.x - 50) < 11) { sfx('pop'); step1(); }
              else {
                sfx('fizzle'); say('Missed! Here’s another');
                layer.append(at(div('cz-splat'), s.x, 90));
                newEgg();
              }
              return;
            }
          }
          at(egg, s.x, s.ey);
        } else if (s.step === 1) {
          if (s.busy && t < busyUntil) return;
          if (panEgg.classList.contains('flip')) return;
          s.brown += (0.2 + 0.08 * speed) * dt;
          panEgg.style.setProperty('--b', browned(s.brown));
          if (s.brown >= s.golden[0] && s.brown <= s.golden[1]) panEgg.classList.add('ready'); else panEgg.classList.remove('ready');
          if (s.brown > 1) { done = true; panEgg.classList.add('burnt'); label.textContent = 'Burnt to a crisp!'; sfx('fizzle'); lose(); }
        } else if (s.step === 3) {
          if (pouring) {
            s.level += (24 + 10 * speed) * dt;
            if (s.level > s.hi + 4) {
              pouring = false; sfx('fizzle'); say('Spilled! Fresh glass');
              fill.classList.add('spill');
              setTimeout(() => { if (!done && s.step === 3) { layer.replaceChildren(newGlass()); } }, 350);
              s.level = 0;
            }
          }
          if (fill) fill.style.height = Math.min(100, s.level) + '%';
        } else if (s.step === 4) {
          if (s.busy) return;
          if (dropped < 2 && t >= nextDrop && !s.items.some(i => !i.done)) { dropItem(dropped === 0 ? 'egg' : 'toast'); dropped++; nextDrop = t + 0.3; }
          for (const it of s.items) {
            if (it.done) continue;
            it.y += (36 + 14 * speed) * dt;
            at(it.el, it.x, it.y);
            if (it.y >= 82 && it.y < 90 && Math.abs(it.x - s.px) < 13) {
              it.done = true; it.el.remove(); s.caught++; sfx('place');
              plate.classList.add('has' + s.caught);
              if (s.caught >= 2) return finish();
            } else if (it.y > 102) {
              // missed: drop it again from somewhere else
              it.done = true; it.el.remove(); dropped--; sfx('nope'); say('Oops! Catch it this time');
            }
          }
        }
      });
    },
    async solve(b, s) {
      // 1. drop the egg when it swings over the pan
      while (s.step === 0 && !b.over()) {
        await b.until(() => (!s.busy && !s.dropped && Math.abs(s.x - 50) < 2) || s.step !== 0);
        if (s.step !== 0) break;
        await b.tap({ x: 50, y: 50 });
        await b.until(() => s.step !== 0 || !s.dropped);
      }
      // 2. flip while golden
      await b.until(() => s.step === 1 && !s.busy && s.brown >= s.golden[0] + 0.05);
      await b.drag({ x: 50, y: 70 }, { x: 50, y: 40 }, 80, 3);
      // 3. scrub the toast
      await b.until(() => s.step === 2 && !s.busy);
      b.down({ x: 40, y: 58 });
      for (let k = 0; s.step === 2 && !b.over(); k++) { b.move({ x: k % 2 ? 62 : 38, y: 58 }); await b.wait(25); }
      b.up({ x: 50, y: 58 });
      // 4. pour to the middle of the band
      while (s.step === 3 && !b.over()) {
        await b.until(() => !s.busy && s.level === 0);
        b.down({ x: 50, y: 50 });
        await b.until(() => s.level >= (s.lo + s.hi) / 2);
        b.up({ x: 50, y: 50 });
        await b.until(() => s.step !== 3 || s.level === 0, 1500);
      }
      // 5. follow the lowest falling item with the plate
      b.down({ x: 50, y: 88 });
      while (!b.over()) {
        const it = s.items.filter(i => !i.done).sort((p, q) => q.y - p.y)[0];
        if (it) b.move({ x: it.x, y: 88 });
        await b.wait(30);
      }
      b.up({ x: s.px, y: 88 });
    },
  },
];
