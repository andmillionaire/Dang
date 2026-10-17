import { h, icon } from '../ui.js';
import { fitCanvas, toLogical, sleep } from '../pixel.js';
import { PEGS, BALL, CATS } from '../sprites.js';
import { CAT_BREEDS } from '../spritedata.js';
import { mount, banner } from './common.js';
import { aiMove, outcome } from './tictactoe.js';
import { WORDS } from './crossword.js';

const LW = 120, LH = 156;
const LAUNCH = { x: 60, y: 9 };
const BALL_R = 2;
const SPEED = 2.5, GRAV = 0.085, SUB = 4, BOUNCE = 0.78;
const BUCKET_Y = 146, BUCKET_W = 22;
const shuffle = a => a.sort(() => Math.random() - 0.5);

function scatter() {
  const pegs = [];
  const pattern = (Math.random() * 3) | 0;
  if (pattern === 0) {
    for (let r = 0; r < 6; r++) for (let x = 12 + (r % 2 ? 8 : 0); x <= 108; x += 16) pegs.push({ x, y: 40 + r * 16 });
  } else if (pattern === 1) {
    for (const [rad, n] of [[38, 20], [22, 12], [8, 5]]) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rad;
        pegs.push({ x: 60 + Math.cos(a) * rad * 1.15, y: 82 + Math.sin(a) * rad });
      }
    }
  } else {
    for (let r = 0; r < 5; r++) for (let i = 0; i < 9; i++) pegs.push({ x: 12 + i * 12, y: 40 + r * 19 + Math.sin(i * 0.8 + r * 1.3) * 6 });
  }
  return pegs.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), r: 2.5, kind: 'blue' }));
}

// Drop scattered pegs that would overlap the special ones.
const clearAround = (pegs, special, gap) => pegs.filter(p => special.every(s => Math.hypot(p.x - s.x, p.y - s.y) > gap));

// Star Pegs and its mashups. mode: 'pegs' | 'ttt' (Peg-Tac-Toe) | 'word' (Letter Pegs) | 'cats' (Cat Pegs).
export function play(root, { difficulty: d, sfx, mode = 'pegs' }) {
  const TITLES = {
    pegs: ['Star Pegs', 'Drag to aim, let go to shoot. Clear every orange peg.'],
    ttt: ['Peg-Tac-Toe', 'Light the gold pegs to claim squares. The storm claims one after each shot. Get three in a row!'],
    word: ['Letter Pegs', 'Hit the letters that spell the answer. Wrong letters cost a ball.'],
    cats: ['Cat Pegs', 'Rescue the cats in the order shown. Out-of-order cats won’t budge.'],
  };
  const ui = mount(root, { title: TITLES[mode][0], tip: TITLES[mode][1] });
  const canvas = h('canvas', { class: 'pegs-canvas' });
  ui.body.append(h('div', { class: 'mg-canvas' }, canvas));

  let balls = 6 - Math.round(d * 2);
  let pegs, board = null, word = null, order = null, need = 0;
  if (mode === 'ttt') {
    const grid = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ x: 30 + (i % 3) * 30, y: 54 + ((i / 3) | 0) * 30, r: 3, kind: 'gold', sq: i }));
    pegs = [...clearAround(scatter(), grid, 9), ...grid];
    board = Array(9).fill(null);
    balls += 2;
  } else if (mode === 'word') {
    const w = WORDS[(Math.random() * WORDS.length) | 0];
    word = { ...w, got: [] };
    const decoys = shuffle([...'BCFGHKMOPSUVWY'].filter(ch => !w.word.includes(ch))).slice(0, 3 + Math.round(d * 2));
    const letters = shuffle([...[...w.word].map((ch, i) => ({ ch, ans: i })), ...decoys.map(ch => ({ ch, ans: -1 }))]);
    const spots = shuffle([...Array(12).keys()]).slice(0, letters.length).map(i => ({ x: 18 + (i % 4) * 28, y: 46 + ((i / 4) | 0) * 32 }));
    const special = letters.map((l, i) => ({ ...spots[i], r: 3.5, kind: l.ans >= 0 ? 'letter' : 'decoy', ch: l.ch, ans: l.ans }));
    pegs = [...clearAround(scatter(), special, 10), ...special];
    balls += 1;
  } else if (mode === 'cats') {
    const n = 4 + Math.round(d);
    order = shuffle([...Array(CAT_BREEDS.length).keys()]).slice(0, n);
    const spots = shuffle([...Array(12).keys()]).slice(0, n).map(i => ({ x: 18 + (i % 4) * 28, y: 46 + ((i / 4) | 0) * 32 }));
    const special = order.map((b, i) => ({ ...spots[i], r: 4, kind: 'cat', breed: b }));
    pegs = [...clearAround(scatter(), special, 11), ...special];
    balls += 1;
  } else {
    pegs = scatter();
    const n = Math.min(6 + Math.round(d * 4), pegs.length >> 1);
    shuffle(pegs.slice()).slice(0, n).forEach(p => (p.kind = 'orange'));
  }
  pegs.forEach(p => { p.lit = false; p.gone = false; });

  let aim = Math.PI / 2, ball = null, frame = 0, hits = 0, done = false, ctx;
  let shotFrames = 0, slowFrames = 0;
  const pops = [];
  const orangeLeft = () => pegs.filter(p => p.kind === 'orange' && !p.gone && !p.lit).length;

  function updateInfo() {
    const stats = [h('span', { class: 'mg-stat' }, h('i', { class: 'dot ball' }), ` ${balls} balls`)];
    if (mode === 'pegs') stats.unshift(h('span', { class: 'mg-stat' }, h('i', { class: 'dot orange' }), ` ${orangeLeft()} orange left`));
    if (mode === 'word') stats.unshift(h('span', { class: 'mg-stat word-slots' }, [...word.word].map((ch, i) => h('b', {}, word.got.includes(i) ? ch : '_'))));
    if (mode === 'cats') stats.unshift(h('span', { class: 'mg-stat cat-order' }, order.map((b, i) => icon('cat' + b, 'ico cat' + (i < need ? ' saved' : i === need ? ' next' : '')))));
    ui.info.replaceChildren(...stats);
  }
  if (mode === 'word') ui.body.prepend(h('p', { class: 'cw-clue' }, h('b', {}, 'Clue: '), word.clue));
  updateInfo();
  ui.status('Aim with your finger.');

  return new Promise(resolve => {
    requestAnimationFrame(() => { ctx = fitCanvas(canvas, LW, LH).ctx; loop(); });

    const setAim = e => {
      const p = toLogical(canvas, LW, LH, e);
      aim = Math.max(0.12, Math.min(Math.PI - 0.12, Math.atan2(p.y - LAUNCH.y, p.x - LAUNCH.x)));
      if (p.y < LAUNCH.y) aim = p.x > LAUNCH.x ? 0.12 : Math.PI - 0.12;
    };
    let aiming = false;
    canvas.addEventListener('pointerdown', e => { if (ball || done) return; aiming = true; canvas.setPointerCapture?.(e.pointerId); setAim(e); });
    canvas.addEventListener('pointermove', e => { if (aiming) setAim(e); });
    canvas.addEventListener('pointerup', e => {
      if (!aiming) return;
      aiming = false;
      setAim(e);
      if (!ball && !done && balls > 0) fire();
    });

    function fire() {
      balls--;
      shotFrames = 0; slowFrames = 0; hits = 0;
      ball = { x: LAUNCH.x + Math.cos(aim) * 6, y: LAUNCH.y + Math.sin(aim) * 6, vx: Math.cos(aim) * SPEED, vy: Math.sin(aim) * SPEED };
      sfx('swap');
      updateInfo();
    }

    // What happens the first time a peg is touched. Returns false if the peg refuses to light.
    function touch(p) {
      if (p.kind === 'cat') {
        if (order[need] !== p.breed) return false;
        need++;
        sfx('mew');
      } else if (p.kind === 'decoy') {
        balls = Math.max(0, balls - 1);
        ui.status(`“${p.ch}” isn’t in the answer. −1 ball`);
        sfx('nope');
      } else if (p.kind === 'letter') {
        word.got.push(p.ans);
        sfx('type');
      } else if (p.kind === 'gold') {
        if (board[p.sq]) return false;
        board[p.sq] = 'X';
        sfx('place');
      }
      hits++;
      if (p.kind !== 'cat' && p.kind !== 'decoy') sfx('peg', hits);
      return true;
    }

    function stepBall(b, collide) {
      for (let s = 0; s < SUB; s++) {
        b.vy += GRAV / SUB;
        b.x += b.vx / SUB; b.y += b.vy / SUB;
        if (b.x < 2) { b.x = 2; b.vx = Math.abs(b.vx) * 0.9; }
        if (b.x > LW - 2) { b.x = LW - 2; b.vx = -Math.abs(b.vx) * 0.9; }
        if (b.y < 2) { b.y = 2; b.vy = Math.abs(b.vy); }
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
          if (!p.lit && touch(p)) { p.lit = true; updateInfo(); }
        }
      }
      return null;
    }

    function clearLit() {
      for (const p of pegs) if (p.lit && !p.gone) { p.gone = true; pops.push({ x: p.x, y: p.y, t: 0, gold: p.kind !== 'blue' }); }
    }

    function won() {
      if (mode === 'pegs') return orangeLeft() === 0;
      if (mode === 'word') return word.got.length === word.word.length;
      if (mode === 'cats') return need === order.length;
      return outcome(board)?.w === 'X';
    }

    async function endShot(caught) {
      ball = null;
      clearLit();
      if (caught) { balls++; sfx('coin'); ui.status('Caught in the bucket: free ball!'); }
      else if (mode !== 'word' || !hits) ui.status(hits ? `${hits} peg${hits > 1 ? 's' : ''} that shot.` : 'Missed everything!');
      updateInfo();
      if (won()) return finish('win', { pegs: 'Every orange peg is gone!', word: `You spelled ${word?.word}!`, cats: 'All the cats are safe!', ttt: 'Three in a row!' }[mode]);
      if (mode === 'ttt') {
        if (outcome(board)) return finish('lose', 'The board filled up without a line.');
        await sleep(300);
        const i = aiMove(board, 0.35 + 0.5 * d);
        board[i] = 'O';
        const peg = pegs.find(p => p.sq === i);
        peg.gone = true;
        pops.push({ x: peg.x, y: peg.y, t: 0, gold: false });
        sfx('aiplace');
        ui.status('The storm claimed a square.');
        const o = outcome(board);
        if (o && o.w === 'O') return finish('lose', 'The storm got three in a row.');
        if (o) return finish('lose', 'A stalemate. No line for you.');
      }
      if (balls <= 0) return finish('lose', 'Out of balls.');
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
      if (!ball) return;
      stepBall(ball, true);
      shotFrames++;
      slowFrames = Math.hypot(ball.vx, ball.vy) < 0.25 ? slowFrames + 1 : 0;
      // A ball wedged between pegs: clear what it lit so it can fall free.
      if (slowFrames > 60) { clearLit(); slowFrames = 0; }
      if (shotFrames > 60 * 15) return endShot(false);
      const bx = bucketX();
      if (ball.y >= BUCKET_Y - 1 && ball.y <= BUCKET_Y + 3 && ball.vy > 0 && Math.abs(ball.x - bx) < BUCKET_W / 2) return endShot(true);
      if (ball.y > LH + 4) endShot(false);
    }

    const bucketX = () => 60 + Math.sin(frame / 75) * 44;

    function drawMark(m, x, y) {
      ctx.fillStyle = m === 'X' ? '#ffe27a' : '#4f8fd0';
      if (m === 'X') for (let k = -3; k <= 3; k++) { ctx.fillRect(x + k, y + k, 1, 1); ctx.fillRect(x + k, y - k, 1, 1); }
      else { ctx.fillRect(x - 2, y - 3, 5, 1); ctx.fillRect(x - 2, y + 3, 5, 1); ctx.fillRect(x - 3, y - 2, 1, 5); ctx.fillRect(x + 3, y - 2, 1, 5); }
    }

    function draw() {
      ctx.fillStyle = '#141c34'; ctx.fillRect(0, 0, LW, LH);
      ctx.fillStyle = '#2a3a5c';
      for (let i = 0; i < 30; i++) ctx.fillRect((i * 37) % LW, (i * 53) % (LH - 20), 1, 1);
      ctx.fillStyle = '#3a2216'; ctx.fillRect(0, 0, 1, LH); ctx.fillRect(LW - 1, 0, 1, LH);

      if (mode === 'ttt') {
        ctx.fillStyle = 'rgba(255,226,122,0.15)';
        ctx.fillRect(44, 40, 1, 88); ctx.fillRect(74, 40, 1, 88); ctx.fillRect(16, 68, 88, 1); ctx.fillRect(16, 98, 88, 1);
        board.forEach((m, i) => m && drawMark(m, 30 + (i % 3) * 30, 54 + ((i / 3) | 0) * 30));
      }

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
        if (p.kind === 'cat') {
          if (p.lit) continue;
          ctx.drawImage(CATS[p.breed], p.x - 4, p.y - 4);
          if (order[need] === p.breed && Math.floor(frame / 15) % 2) { ctx.fillStyle = '#ffe27a'; ctx.fillRect(p.x - 5, p.y - 6, 10, 1); }
        } else if (p.kind === 'letter' || p.kind === 'decoy') {
          ctx.fillStyle = p.lit ? (p.kind === 'letter' ? '#fff0a0' : '#6e6878') : '#efdcb4';
          ctx.fillRect(p.x - 3, p.y - 3, 7, 7);
          ctx.fillStyle = '#6b3d22'; ctx.fillRect(p.x - 3, p.y + 3, 7, 1);
          ctx.fillStyle = '#1a1220'; ctx.fillText(p.ch, p.x + 0.5, p.y + 0.5);
        } else if (p.kind === 'gold') {
          ctx.drawImage(p.lit ? PEGS.orangeLit : PEGS.orange, p.x - 2, p.y - 2);
          ctx.fillStyle = '#ffe27a'; ctx.fillRect(p.x, p.y - 4, 1, 1);
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

      const bx = Math.round(bucketX());
      ctx.fillStyle = '#6b3d22'; ctx.fillRect(bx - BUCKET_W / 2, BUCKET_Y, BUCKET_W, 6);
      ctx.fillStyle = '#a0663a'; ctx.fillRect(bx - BUCKET_W / 2, BUCKET_Y, BUCKET_W, 1);
      ctx.fillStyle = '#3a2216'; ctx.fillRect(bx - BUCKET_W / 2 + 4, BUCKET_Y + 2, 1, 4); ctx.fillRect(bx + BUCKET_W / 2 - 5, BUCKET_Y + 2, 1, 4);

      if (ball) ctx.drawImage(BALL, Math.round(ball.x - 2), Math.round(ball.y - 2));
    }

    function loop() {
      if (!canvas.isConnected) return;
      if (!done) update();
      draw();
      requestAnimationFrame(loop);
    }
  });
}
