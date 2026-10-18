import { h, icon } from '../ui.js';
import { fitCanvas, toLogical, sleep } from '../pixel.js';
import { PEGS, BALL, CATS } from '../sprites.js';
import { mount, banner } from './common.js';
import { aiMove, outcome, stormSkill } from './tictactoe.js';
import { WORDS } from './crossword.js';
import { POOL } from '../arcade/meowdoku-levels.js';
import { decode, REGION_COLORS } from '../meowdokuboard.js';
import { transform } from '../meowdoku-engine.js';

const LW = 120;
const LAUNCH = { x: 60, y: 9 };
const BALL_R = 2;
const SPEED = 2.5, GRAV = 0.085, SUB = 4, BOUNCE = 0.78;
const BUCKET_W = 22;
const GRID_Y = 140, CELL_H = 14, CELL_W = LW / 5; // Cat Pegs board
const shuffle = a => a.sort(() => Math.random() - 0.5);

function scatter(maxY) {
  const pegs = [];
  const pattern = (Math.random() * 3) | 0;
  if (pattern === 0) {
    for (let r = 0; r < 6; r++) for (let x = 12 + (r % 2 ? 8 : 0); x <= 108; x += 16) pegs.push({ x, y: 36 + r * 16 });
  } else if (pattern === 1) {
    for (const [rad, n] of [[36, 20], [21, 12], [8, 5]]) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rad;
        pegs.push({ x: 60 + Math.cos(a) * rad * 1.15, y: 76 + Math.sin(a) * rad });
      }
    }
  } else {
    for (let r = 0; r < 5; r++) for (let i = 0; i < 9; i++) pegs.push({ x: 12 + i * 12, y: 36 + r * 19 + Math.sin(i * 0.8 + r * 1.3) * 6 });
  }
  return pegs.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), r: 2.5, kind: 'blue' })).filter(p => p.y < maxY);
}

const clearAround = (pegs, special, gap) => pegs.filter(p => special.every(s => Math.hypot(p.x - s.x, p.y - s.y) > gap));

// Star Pegs and the three pegs mashups:
//  'pegs' Star Pegs: clear every orange peg; a moving bucket gives free balls.
//  'ttt'  Peg-Tac-Toe: 9 bins along the bottom are the 9 squares; where the ball lands is where your X goes.
//  'word' Letter Pegs: hit the letters in spelling order to answer the clue.
//  'cats' Cat Pegs: a Mewdoku board under 5 bins; tap a row, then land the ball in the right column.
//  'rush' Peg Rush: every shot is a WarioWare-style order ("Hit 2 orange!") with 5 seconds to fire.
export function play(root, { difficulty: d, sfx, mode = 'pegs', boost }) {
  const TITLES = {
    pegs: ['Star Pegs', 'Drag to aim, let go to shoot. Clear every orange peg.'],
    ttt: ['Peg-Tac-Toe', 'The 9 bins are the 9 squares. Where your ball lands, your X goes. Get three in a row before the storm!'],
    word: ['Letter Pegs', 'Hit the letters in spelling order to answer the clue. Wrong letters cost a ball.'],
    cats: ['Cat Pegs', 'Tap a row of the board, then shoot: the bin your ball lands in is the column your cat goes in. Mewdoku rules!'],
    rush: ['Peg Rush', 'Every shot comes with an order. Read it, aim, and fire within 5 seconds. Miss the order and you lose a heart.'],
  };
  const ui = mount(root, { title: TITLES[mode][0], tip: TITLES[mode][1] });
  const LH = mode === 'cats' ? 214 : 156;
  const canvas = h('canvas', { class: 'pegs-canvas' });
  ui.body.append(h('div', { class: 'mg-canvas' + (mode === 'cats' ? ' tall' : '') }, canvas));

  let balls = 6 - Math.round(d * 2) + (boost === 'snack' ? 2 : 0);
  const skill = stormSkill(d, boost);
  let pegs, board = null, word = null, bins = 0, md = null;
  const BIN_Y = mode === 'cats' ? 128 : 140; // top of the bins
  if (mode === 'ttt') {
    pegs = scatter(BIN_Y - 14);
    board = Array(9).fill(null);
    bins = 9;
    balls += 3;
  } else if (mode === 'cats') {
    pegs = scatter(BIN_Y - 14);
    bins = 5;
    const pool = POOL.filter(e => e[1].length === 5);
    const p = transform(decode(pool[(Math.random() * pool.length) | 0]), (Math.random() * 8) | 0);
    const locked = (Math.random() * 5) | 0;
    md = { ...p, cats: [locked * 5 + p.solution[locked]], row: -1, rowShot: -1, hearts: 3 + (boost === 'tea' ? 1 : 0), flash: [] };
    balls += 4;
  } else if (mode === 'word') {
    const w = WORDS[(Math.random() * WORDS.length) | 0];
    word = { ...w, got: [] };
    const decoys = shuffle([...'BCFGHKMOPSUVWY'].filter(ch => !w.word.includes(ch))).slice(0, 3 + Math.round(d * 2));
    const letters = shuffle([...[...w.word].map(ch => ({ ch, real: true })), ...decoys.map(ch => ({ ch, real: false }))]);
    const spots = shuffle([...Array(12).keys()]).slice(0, letters.length).map(i => ({ x: 18 + (i % 4) * 28, y: 44 + ((i / 4) | 0) * 30 }));
    const special = letters.map((l, i) => ({ ...spots[i], r: 3.5, kind: l.real ? 'letter' : 'decoy', ch: l.ch }));
    pegs = [...clearAround(scatter(130), special, 10), ...special];
    balls += 2;
  } else if (mode === 'rush') {
    pegs = scatter(130);
    shuffle(pegs.slice()).slice(0, 12).forEach(p => (p.kind = 'orange'));
  } else {
    pegs = scatter(130);
    const n = Math.min(6 + Math.round(d * 4), pegs.length >> 1);
    shuffle(pegs.slice()).slice(0, n).forEach(p => (p.kind = 'orange'));
  }
  pegs.forEach(p => { p.lit = false; p.gone = false; });

  let aim = Math.PI / 2, ball = null, frame = 0, hits = 0, done = false, ctx;
  let shotFrames = 0, slowFrames = 0, landed = -1;
  const pops = [], rings = [], trail = [];
  let callout = null, bucketFlash = 0, binFlash = { k: -1, t: 99 };
  const STREAK = { 5: 'Nice!', 10: 'Lovely!', 15: 'Magical!', 20: 'Spellbinding!' };
  const orangeLeft = () => pegs.filter(p => p.kind === 'orange' && !p.gone && !p.lit).length;
  const nextLetter = () => word && word.word[word.got.length];

  // Peg Rush orders, checked when the shot ends.
  const many = 3 + Math.round(d * 2);
  const ORDERS = [
    { text: `Hit ${many} pegs!`, ok: s => s.hits >= many },
    { text: 'Hit orange!', ok: s => s.orange >= 1, orange: 1 },
    { text: 'Hit 2 orange!', ok: s => s.orange >= 2, orange: 2 },
    { text: 'Catch it!', ok: s => s.how === 'bucket' },
    { text: 'Blue only!', ok: s => s.hits >= 2 && s.orange === 0 },
  ];
  const rush = mode === 'rush' ? { need: 3 + Math.round(d * 2), passed: 0, max: 3 + (boost === 'tea' || boost === 'snack' ? 1 : 0), lives: 0, order: null, clock: 0 } : null;
  if (rush) rush.lives = rush.max;
  let shotOrange = 0;

  // the tic-tac-toe board, shown above the canvas for Peg-Tac-Toe
  const tttCells = mode === 'ttt' ? Array.from({ length: 9 }, (_, i) => h('span', { class: 'pt-cell' }, String(i + 1))) : null;
  if (tttCells) ui.body.prepend(h('div', { class: 'pt-board' }, tttCells));
  if (mode === 'word') ui.body.prepend(h('p', { class: 'cw-clue' }, h('b', {}, 'Clue: '), word.clue));

  function newOrder() {
    const ok = ORDERS.filter(o => o !== rush.order && (!o.orange || orangeLeft() >= o.orange + 1));
    rush.order = ok[(Math.random() * ok.length) | 0];
    rush.clock = 0;
    callout = { text: rush.order.text, t: 0 };
    ui.status(`${rush.order.text} Fire within 5 seconds!`);
    updateInfo();
  }

  function updateInfo() {
    const stats = [h('span', { class: 'mg-stat' }, h('i', { class: 'dot ball' }), ` ${balls} balls`)];
    if (mode === 'pegs') stats.unshift(h('span', { class: 'mg-stat' }, h('i', { class: 'dot orange' }), ` ${orangeLeft()} orange left`));
    if (mode === 'word') stats.unshift(h('span', { class: 'mg-stat word-slots' }, [...word.word].map((ch, i) => h('b', { class: i === word.got.length ? 'next' : '' }, i < word.got.length ? ch : '_'))));
    if (rush) stats.splice(0, 1, h('span', { class: 'mg-stat' }, Array.from({ length: rush.max }, (_, i) => icon(i < rush.lives ? 'heart' : 'heartOff'))),
      h('span', { class: 'mg-stat' }, `${rush.passed} / ${rush.need} orders`), rush.order && h('span', { class: 'mg-stat order' }, rush.order.text));
    if (mode === 'cats') stats.unshift(h('span', { class: 'mg-stat' }, Array.from({ length: 3 + (boost === 'tea' ? 1 : 0) }, (_, i) => icon(i < md.hearts ? 'heart' : 'heartOff'))));
    ui.info.replaceChildren(...stats.filter(Boolean));
    if (tttCells) board.forEach((m, i) => { tttCells[i].textContent = m === 'X' ? '✕' : m === 'O' ? '○' : String(i + 1); tttCells[i].className = 'pt-cell' + (m ? ' ' + m : ''); });
  }
  if (rush) newOrder();
  updateInfo();
  if (!rush) ui.status(mode === 'cats' ? 'Tap a row of the board to choose where your cat goes.' : 'Aim with your finger.');

  return new Promise(resolve => {
    requestAnimationFrame(() => { ctx = fitCanvas(canvas, LW, LH).ctx; loop(); });

    const setAim = p => {
      aim = Math.max(0.12, Math.min(Math.PI - 0.12, Math.atan2(p.y - LAUNCH.y, p.x - LAUNCH.x)));
      if (p.y < LAUNCH.y) aim = p.x > LAUNCH.x ? 0.12 : Math.PI - 0.12;
    };
    let aiming = false;
    canvas.addEventListener('pointerdown', e => {
      if (ball || done) return;
      const p = toLogical(canvas, LW, LH, e);
      if (md && p.y >= GRID_Y) {
        const r = Math.floor((p.y - GRID_Y) / CELL_H);
        if (r >= 0 && r < 5 && !md.cats.some(i => ((i / 5) | 0) === r)) { md.row = r; sfx('select'); ui.status(`Row ${r + 1} chosen. Now aim for the right column.`); }
        return;
      }
      aiming = true;
      canvas.setPointerCapture?.(e.pointerId);
      setAim(p);
    });
    canvas.addEventListener('pointermove', e => { if (aiming) setAim(toLogical(canvas, LW, LH, e)); });
    canvas.addEventListener('pointerup', e => {
      if (!aiming) return;
      aiming = false;
      setAim(toLogical(canvas, LW, LH, e));
      if (md && md.row < 0) { sfx('nope'); ui.status('First tap a row of the board.'); return; }
      if (!ball && !done && balls > 0) fire();
    });

    function fire() {
      if (!rush) balls--;
      shotOrange = 0;
      shotFrames = 0; slowFrames = 0; hits = 0; landed = -1;
      if (md) md.rowShot = md.row;
      ball = { x: LAUNCH.x + Math.cos(aim) * 6, y: LAUNCH.y + Math.sin(aim) * 6, vx: Math.cos(aim) * SPEED, vy: Math.sin(aim) * SPEED };
      sfx('swap');
      updateInfo();
    }

    // First touch of a peg. Returns false if it refuses to light.
    function touch(p) {
      if (p.kind === 'decoy') {
        balls = Math.max(0, balls - 1);
        ui.status(`“${p.ch}” isn’t in the answer. −1 ball`);
        sfx('nope');
      } else if (p.kind === 'letter') {
        if (p.ch !== nextLetter()) return false;
        word.got.push(p.ch);
        sfx('type');
      }
      hits++;
      if (p.kind === 'orange') shotOrange++;
      if (p.kind !== 'decoy') sfx('peg', hits);
      return true;
    }

    const binOf = x => Math.max(0, Math.min(bins - 1, Math.floor((x / LW) * bins)));
    const binClosed = k => mode === 'ttt' && !!board[k];

    function stepBall(b, collide) {
      for (let s = 0; s < SUB; s++) {
        b.vy += GRAV / SUB;
        b.x += b.vx / SUB; b.y += b.vy / SUB;
        if (b.x < 2) { b.x = 2; b.vx = Math.abs(b.vx) * 0.9; }
        if (b.x > LW - 2) { b.x = LW - 2; b.vx = -Math.abs(b.vx) * 0.9; }
        if (b.y < 2) { b.y = 2; b.vy = Math.abs(b.vy); }
        // capped bins (squares already taken) bounce the ball away
        if (collide && bins && b.vy > 0 && b.y >= BIN_Y - 2 && b.y < BIN_Y + 2 && binClosed(binOf(b.x))) {
          b.y = BIN_Y - 2; b.vy = -Math.abs(b.vy) * 0.65; b.vx += (Math.random() - 0.5) * 0.8;
          sfx('land');
        }
        for (const p of pegs) {
          if (p.gone) continue;
          const HIT = p.r + BALL_R;
          const dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy;
          if (d2 >= HIT * HIT) continue;
          if (!collide) return p;
          const dist = Math.sqrt(d2) || 0.01, nx = dx / dist, ny = dy / dist;
          b.x = p.x + nx * HIT; b.y = p.y + ny * HIT;
          const dot = b.vx * nx + b.vy * ny;
          if (dot < 0) { b.vx -= (1 + BOUNCE) * dot * nx; b.vy -= (1 + BOUNCE) * dot * ny; }
          if (!p.lit && touch(p)) {
            p.lit = true;
            rings.push({ x: p.x, y: p.y, t: 0, gold: p.kind !== 'blue' });
            if (STREAK[hits]) callout = { text: STREAK[hits], t: 0 };
            updateInfo();
          }
        }
      }
      return null;
    }

    function clearLit() {
      for (const p of pegs) if (p.lit && !p.gone) { p.gone = true; pops.push({ x: p.x, y: p.y, t: 0, gold: p.kind !== 'blue' }); }
    }

    // Cat Pegs placement by Mewdoku rules: legal cats stay, rule-breakers cost a heart.
    function placeCat(r, c) {
      const i = r * 5 + c, R = j => (j / 5) | 0, C = j => j % 5;
      const clash = md.cats.filter(j => R(j) === r || C(j) === c || md.regions[j] === md.regions[i] || (Math.abs(R(j) - r) <= 1 && Math.abs(C(j) - c) <= 1));
      if (clash.length) {
        md.hearts--;
        md.flash = [i, ...clash].map(j => ({ j, t: 0 }));
        sfx('nope');
        ui.status(`Column ${c + 1} breaks a rule there. −1 heart`);
      } else {
        md.cats.push(i);
        md.row = -1;
        sfx('mew');
        callout = { text: 'Purr-fect!', t: 0 };
        ui.status(md.cats.length < 5 ? 'Tap the next row.' : 'All five cats placed!');
      }
      updateInfo();
    }

    function won() {
      if (mode === 'pegs') return orangeLeft() === 0;
      if (mode === 'word') return word.got.length === word.word.length;
      if (mode === 'cats') return md.cats.length === 5;
      return outcome(board)?.w === 'X';
    }

    async function endShot(how) {
      ball = null;
      clearLit();
      if (rush) return rushEnd(rush.order.ok({ hits, orange: shotOrange, how }) ? '' : `Order missed: ${rush.order.text}`);
      if (how === 'bucket') {
        balls++; bucketFlash = 1; callout = { text: 'Free ball!', t: 0 }; sfx('coin'); ui.status('Caught in the bucket: free ball!');
      } else if (how === 'bin' && mode === 'ttt') {
        binFlash = { k: landed, t: 0 };
        board[landed] = 'X';
        sfx('place');
        callout = { text: `Square ${landed + 1}!`, t: 0 };
      } else if (how === 'bin' && mode === 'cats') {
        binFlash = { k: landed, t: 0 };
        placeCat(md.rowShot, landed);
      } else if (mode !== 'word' || !hits) {
        ui.status(hits ? `${hits} peg${hits > 1 ? 's' : ''} that shot.` : 'Missed everything!');
      }
      updateInfo();
      if (won()) return finish('win', { pegs: 'Every orange peg is gone!', word: `You spelled ${word?.word}!`, cats: 'Every cat has its own patch!', ttt: 'Three in a row!' }[mode]);
      if (md && md.hearts <= 0) return finish('lose', 'Out of hearts.');
      if (mode === 'ttt' && how === 'bin') {
        if (outcome(board)) return finish('draw', 'The board filled up without a line.');
        await sleep(350);
        board[aiMove(board, skill)] = 'O';
        sfx('aiplace');
        updateInfo();
        const o = outcome(board);
        if (o && o.w === 'O') return finish('lose', 'The storm got three in a row.');
        if (o) return finish('draw', 'A stalemate.');
        ui.status('The storm took a square. Your shot!');
      }
      if (balls <= 0) return finish('lose', 'Out of balls.');
    }

    // One order done (msg is empty) or failed (msg says why).
    function rushEnd(msg) {
      if (!msg) { rush.passed++; callout = { text: 'Done!', t: 0 }; sfx('coin'); bucketFlash = 0.6; }
      else { rush.lives--; callout = { text: 'Oops!', t: 0 }; sfx('nope'); ui.status(`${msg} −1 heart`); }
      updateInfo();
      if (rush.passed >= rush.need) return finish('win', 'Every order filled!');
      if (rush.lives <= 0) return finish('lose', 'Out of hearts.');
      setTimeout(() => !done && newOrder(), 700);
      rush.clock = -0.7;
    }

    async function finish(res, msg) {
      done = true;
      sfx(res === 'win' ? 'tttwin' : 'tttlose');
      await sleep(500);
      await banner(ui, res, msg);
      resolve(res);
    }

    function update() {
      frame++;
      for (const p of pops) p.t++;
      for (const r of rings) r.t++;
      if (md) for (const f of md.flash) f.t++;
      if (callout) callout.t++;
      binFlash.t++;
      bucketFlash *= 0.92;
      if (rush && !ball && !done) {
        rush.clock += 1 / 60;
        if (rush.clock >= 5) { rush.clock = -99; rushEnd('Too slow!'); }
      }
      if (!ball) { trail.length = 0; return; }
      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > 10) trail.shift();
      stepBall(ball, true);
      shotFrames++;
      slowFrames = Math.hypot(ball.vx, ball.vy) < 0.25 ? slowFrames + 1 : 0;
      if (slowFrames > 60) { clearLit(); slowFrames = 0; }
      if (shotFrames > 60 * 15) return endShot('lost');
      if (bins) {
        if (ball.y > BIN_Y + 4) { landed = binOf(ball.x); return endShot(binClosed(landed) ? 'lost' : 'bin'); }
      } else {
        const bx = bucketX();
        if (ball.y >= 145 && ball.y <= 149 && ball.vy > 0 && Math.abs(ball.x - bx) < BUCKET_W / 2) return endShot('bucket');
        if (ball.y > LH + 4) endShot('lost');
      }
    }

    const bucketX = () => 60 + Math.sin(frame / 75) * 44;

    function drawMark(m, x, y) {
      ctx.fillStyle = m === 'X' ? '#ffe27a' : '#6a9ae0';
      if (m === 'X') for (let k = -2; k <= 2; k++) { ctx.fillRect(x + k, y + k, 1, 1); ctx.fillRect(x + k, y - k, 1, 1); }
      else { ctx.fillRect(x - 1, y - 2, 3, 1); ctx.fillRect(x - 1, y + 2, 3, 1); ctx.fillRect(x - 2, y - 1, 1, 3); ctx.fillRect(x + 2, y - 1, 1, 3); }
    }

    function drawBins() {
      const w = LW / bins, hgt = md ? 10 : 16;
      for (let k = 0; k < bins; k++) {
        const x = Math.round(k * w), cw = Math.ceil(w);
        const flash = binFlash.k === k && binFlash.t < 24 ? 1 - binFlash.t / 24 : 0;
        ctx.fillStyle = flash ? `rgba(255,226,122,${0.3 + flash * 0.6})` : k % 2 ? '#24305a' : '#1e2850';
        ctx.fillRect(x, BIN_Y, cw, hgt);
        ctx.fillStyle = '#3a4a7a'; ctx.fillRect(x, BIN_Y - 3, 1, hgt + 3);
        if (mode === 'ttt') {
          if (board[k]) { ctx.fillStyle = '#6b3d22'; ctx.fillRect(x + 1, BIN_Y - 2, cw - 1, 3); drawMark(board[k], Math.round(x + w / 2), BIN_Y + 8); }
          else { ctx.fillStyle = '#9fb4d0'; ctx.font = '7px "Jersey 10", monospace'; ctx.textAlign = 'center'; ctx.fillText(String(k + 1), x + w / 2, BIN_Y + 9); }
        } else if (md && md.row >= 0) {
          ctx.fillStyle = 'rgba(255,226,122,0.25)'; ctx.fillRect(x + 3, BIN_Y + 3, cw - 6, 4);
        }
      }
    }

    function drawGrid() {
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
        const i = r * 5 + c, x = Math.round(c * CELL_W), y = GRID_Y + r * CELL_H;
        ctx.fillStyle = REGION_COLORS[md.regions[i]];
        ctx.fillRect(x, y, Math.ceil(CELL_W), CELL_H);
        ctx.fillStyle = 'rgba(26,18,32,0.75)';
        if (c < 4 && md.regions[i + 1] !== md.regions[i]) ctx.fillRect(Math.round((c + 1) * CELL_W) - 1, y, 2, CELL_H);
        if (r < 4 && md.regions[i + 5] !== md.regions[i]) ctx.fillRect(x, y + CELL_H - 1, Math.ceil(CELL_W), 2);
        const f = md.flash.find(q => q.j === i && q.t < 30);
        if (f && Math.floor(f.t / 5) % 2 === 0) { ctx.fillStyle = 'rgba(255,90,80,0.6)'; ctx.fillRect(x, y, Math.ceil(CELL_W), CELL_H); }
        if (md.cats.includes(i)) ctx.drawImage(CATS[md.regions[i] % CATS.length], Math.round(x + CELL_W / 2 - 4), y + 3);
      }
      if (md.row >= 0) {
        const y = GRID_Y + md.row * CELL_H;
        ctx.fillStyle = Math.floor(frame / 8) % 2 ? '#ffe27a' : '#fff4e0';
        ctx.fillRect(0, y, LW, 1); ctx.fillRect(0, y + CELL_H - 1, LW, 1); ctx.fillRect(0, y, 1, CELL_H); ctx.fillRect(LW - 1, y, 1, CELL_H);
      }
    }

    function draw() {
      ctx.fillStyle = '#141c34'; ctx.fillRect(0, 0, LW, LH);
      ctx.fillStyle = '#2a3a5c';
      for (let i = 0; i < 30; i++) ctx.fillRect((i * 37) % LW, (i * 53) % 120, 1, 1);
      ctx.fillStyle = '#3a2216'; ctx.fillRect(0, 0, 1, LH); ctx.fillRect(LW - 1, 0, 1, LH);

      if (!ball && !done) {
        const g = { x: LAUNCH.x + Math.cos(aim) * 6, y: LAUNCH.y + Math.sin(aim) * 6, vx: Math.cos(aim) * SPEED, vy: Math.sin(aim) * SPEED };
        ctx.fillStyle = 'rgba(255,244,224,0.55)';
        for (let i = 0; i < 40; i++) {
          if (stepBall(g, false) || g.y > LH) break;
          if (i % 2 === 0) ctx.fillRect(Math.round(g.x), Math.round(g.y), 1, 1);
        }
      }

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '7px "Jersey 10", monospace';
      for (const p of pegs) {
        if (p.gone) continue;
        if (p.kind === 'letter' || p.kind === 'decoy') {
          const isNext = p.kind === 'letter' && p.ch === nextLetter() && !p.lit;
          ctx.fillStyle = p.lit ? (p.kind === 'letter' ? '#fff0a0' : '#6e6878') : isNext && Math.floor(frame / 15) % 2 ? '#fff8d0' : '#efdcb4';
          ctx.fillRect(p.x - 3, p.y - 3, 7, 7);
          ctx.fillStyle = '#6b3d22'; ctx.fillRect(p.x - 3, p.y + 3, 7, 1);
          ctx.fillStyle = '#1a1220'; ctx.fillText(p.ch, p.x + 0.5, p.y + 0.5);
        } else {
          const orange = p.kind === 'orange';
          ctx.drawImage(orange ? (p.lit ? PEGS.orangeLit : PEGS.orange) : (p.lit ? PEGS.blueLit : PEGS.blue), p.x - 2, p.y - 2);
        }
      }
      for (const p of pops) {
        if (p.t > 14) continue;
        ctx.fillStyle = p.gold ? '#ffe27a' : '#9fd3f2';
        const r = p.t / 2;
        ctx.fillRect(Math.round(p.x - r), p.y, 1, 1); ctx.fillRect(Math.round(p.x + r), p.y, 1, 1);
        ctx.fillRect(p.x, Math.round(p.y - r), 1, 1); ctx.fillRect(p.x, Math.round(p.y + r), 1, 1);
      }

      ctx.fillStyle = '#ffe27a';
      ctx.fillRect(LAUNCH.x - 4, 2, 8, 2); ctx.fillRect(LAUNCH.x - 5, 4, 2, 4); ctx.fillRect(LAUNCH.x + 3, 4, 2, 4); ctx.fillRect(LAUNCH.x - 4, 8, 8, 2);
      ctx.fillStyle = '#fff4e0';
      ctx.fillRect(Math.round(LAUNCH.x + Math.cos(aim) * 7), Math.round(LAUNCH.y + Math.sin(aim) * 7), 1, 1);

      if (rush && !ball && rush.clock >= 0) {
        // the 5-second fuse along the top
        const left = 1 - rush.clock / 5;
        ctx.fillStyle = left < 0.3 && Math.floor(frame / 6) % 2 ? '#d0463c' : '#ffe27a';
        ctx.fillRect(0, 0, Math.round(LW * left), 2);
      }
      if (bins) drawBins();
      else {
        const bx = Math.round(bucketX());
        ctx.fillStyle = '#6b3d22'; ctx.fillRect(bx - BUCKET_W / 2, 146, BUCKET_W, 6);
        ctx.fillStyle = '#a0663a'; ctx.fillRect(bx - BUCKET_W / 2, 146, BUCKET_W, 1);
        ctx.fillStyle = '#3a2216'; ctx.fillRect(bx - BUCKET_W / 2 + 4, 148, 1, 4); ctx.fillRect(bx + BUCKET_W / 2 - 5, 148, 1, 4);
        if (bucketFlash > 0.05) { ctx.fillStyle = `rgba(255,226,122,${bucketFlash * 0.6})`; ctx.fillRect(bx - BUCKET_W / 2 - 2, 140, BUCKET_W + 4, 12); }
      }
      if (md) drawGrid();

      trail.forEach((t, k) => {
        ctx.globalAlpha = (k / trail.length) * 0.6;
        ctx.fillStyle = k > trail.length - 4 ? '#fff8e0' : '#9fd3f2';
        ctx.fillRect(Math.round(t.x - 1), Math.round(t.y - 1), 2, 2);
      });
      ctx.globalAlpha = 1;
      for (const r of rings) {
        if (r.t > 16) continue;
        ctx.globalAlpha = 1 - r.t / 16;
        ctx.strokeStyle = r.gold ? '#ffe27a' : '#bfe6ff';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(r.x, r.y, 3 + r.t * 0.7, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (ball) ctx.drawImage(BALL, Math.round(ball.x - 2), Math.round(ball.y - 2));
      if (callout && callout.t < 60) {
        const s = Math.min(1, callout.t / 8);
        ctx.globalAlpha = callout.t > 45 ? 1 - (callout.t - 45) / 15 : 1;
        ctx.font = `${Math.max(1, Math.round(14 * (0.6 + 0.4 * s)))}px "Jersey 10", monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1a1220'; ctx.fillText(callout.text, LW / 2 + 1, 31);
        ctx.fillStyle = '#ffe27a'; ctx.fillText(callout.text, LW / 2, 30);
        ctx.globalAlpha = 1;
      }
    }

    function loop() {
      if (!canvas.isConnected) return;
      if (!done) update();
      draw();
      requestAnimationFrame(loop);
    }
  });
}
