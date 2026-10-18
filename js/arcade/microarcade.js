import { S, persist } from '../state.js';
import { h, icon, showModal, sparkle, confetti } from '../ui.js';
import { sleep } from '../pixel.js';
import { runMicro, shuffle } from '../micro/kit.js';
import { ALL, THEMES } from '../micro/index.js';
import { fetchScores, submitHighScore } from '../leaderboard.js';

const GAME = 'micro';
const LIVES = 4;
const BOSS_EVERY = 10;
const SPEED_EVERY = 5;
const coinsFor = score => Math.floor(score / 3);
const speedAt = score => Math.min(2.2, 1 + Math.floor(score / SPEED_EVERY) * 0.15);

// DANG! Micro Mayhem: WarioWare-style microgames back to back. Four lives, faster every five,
// a boss every ten. Your score is how many you clear.
export function mountMicro(root, { sfx, changed, back }) {
  const M = S.arcade.micro;
  const bosses = ALL.filter(m => m.boss);
  const regular = ALL.filter(m => !m.boss);

  function frame(...kids) { root.replaceChildren(h('div', { class: 'arcade micro-arc' }, ...kids)); }
  function header(sub, onBack) {
    return h('div', { class: 'arc-head' },
      h('button', { class: 'btn small', onclick: onBack }, '◀ Back'),
      h('div', { class: 'arc-title' }, h('b', {}, 'Micro Mayhem'), h('small', {}, sub)));
  }

  // ---------- title ----------
  function title() {
    const seen = Object.keys(M.seen).length;
    frame(
      header(`${ALL.length} microgames`, back),
      h('div', { class: 'mm-title' },
        h('p', { class: 'mm-logo' }, h('span', {}, 'DANG!'), h('b', {}, 'Micro Mayhem')),
        h('p', { class: 'muted center' }, 'Five-second games, back to back. Read the command, do it, don’t blink. Four lives. It speeds up every five, and every tenth is a boss.'),
        h('div', { class: 'mm-stats' },
          h('span', {}, h('b', {}, M.best), 'best'),
          h('span', {}, h('b', {}, `${seen}/${ALL.length}`), 'seen'),
          h('span', {}, h('b', {}, M.runs), 'runs')),
        h('button', { class: 'btn big primary', onclick: run }, 'Play'),
        h('div', { class: 'arc-tabs' },
          h('button', { class: 'seg-btn', onclick: collection }, 'Collection'),
          h('button', { class: 'seg-btn', onclick: board }, 'Leaderboard'))));
  }

  // ---------- a run ----------
  async function run() {
    let lives = LIVES, score = 0, speed = 1;
    const recent = [];
    const hearts = h('span', { class: 'mg-stat' });
    const scoreEl = h('b', { class: 'clock' }, '0');
    const host = h('div', { class: 'mc-host' });
    let quit = false;
    frame(header('Survive!', () => { quit = true; title(); }), h('div', { class: 'arc-bar' }, scoreEl, hearts), host);
    const showLives = () => hearts.replaceChildren(...Array.from({ length: LIVES }, (_, i) => icon(i < lives ? 'heart' : 'heartOff')));
    showLives();

    const nextMicro = () => {
      const boss = (score + 1) % BOSS_EVERY === 0 && bosses.length;
      const pool = (boss ? bosses : regular).filter(m => !recent.includes(m.id));
      const m = shuffle(pool.length ? pool : boss ? bosses : regular)[0];
      recent.push(m.id);
      if (recent.length > 30) recent.shift();
      return m;
    };

    while (lives > 0 && !quit) {
      const m = nextMicro();
      const faster = speedAt(score) > speed;
      speed = speedAt(score);
      host.replaceChildren(h('div', { class: 'mc-inter' + (m.boss ? ' boss' : '') },
        h('b', {}, m.boss ? 'BOSS!' : faster ? 'Speed up!' : score === 0 ? 'Ready?' : 'Next!'),
        h('div', { class: 'mc-lives' }, Array.from({ length: LIVES }, (_, i) => icon(i < lives ? 'heart' : 'heartOff'))),
        h('span', { class: 'mm-big' }, String(score))));
      sfx(m.boss ? 'alarm' : faster ? 'ring' : 'blip');
      await sleep(score === 0 ? 1100 : faster || m.boss ? 1000 : 700);
      if (quit || !host.isConnected) return;
      if (!M.seen[m.id]) { M.seen[m.id] = true; persist(); }
      const ok = await runMicro(host, m, { sfx, speed });
      if (quit || !host.isConnected) return;
      if (ok) {
        score++;
        if (!M.cleared[m.id]) M.cleared[m.id] = true;
        scoreEl.textContent = String(score);
      } else {
        lives--;
        showLives();
      }
    }
    gameOver(score);
  }

  async function gameOver(score) {
    const prev = M.best;
    M.best = Math.max(M.best, score);
    M.runs++;
    const coins = coinsFor(score);
    S.coins += coins;
    persist();
    changed();
    const isBest = score > prev && score > 0;
    sfx(isBest ? 'win' : 'tttlose');
    if (isBest) confetti(60);
    const rank = h('p', { class: 'muted small' }, score ? 'Posting your score…' : '');
    showModal({
      title: isBest ? 'New best!' : 'Game over',
      cls: isBest ? 'win' : '',
      body: h('div', { class: 'center' },
        h('p', { class: 'mm-big' }, String(score)),
        h('p', { class: 'muted' }, `microgame${score === 1 ? '' : 's'} cleared${isBest ? '' : ` · best ${M.best}`}`),
        coins > 0 && h('p', { class: 'reward small-reward' }, icon('coin'), ` +${coins}`),
        rank),
      buttons: [
        { label: 'Menu', onClick: title },
        { label: 'Again', cls: 'primary', onClick: run },
      ],
    });
    requestAnimationFrame(() => sparkle(document.querySelector('#modal .mm-big'), { count: 14 }));
    title();
    if (!score) return;
    const r = await submitHighScore(GAME, score);
    rank.textContent = r.online ? `You’re #${r.you.rank} of ${r.players}.` : 'Leaderboard offline. Saved on this device.';
  }

  // ---------- collection ----------
  function collection() {
    const groups = Object.entries(THEMES).map(([k, name]) => [name, ALL.filter(m => m.theme === k)]).filter(([, l]) => l.length);
    const seen = Object.keys(M.seen).length;
    frame(
      header(`${seen}/${ALL.length} found · tap one to practise`, title),
      h('div', { class: 'arc-scroll' },
        groups.map(([name, list]) => h('div', { class: 'tier' },
          h('p', { class: 'slot-label' }, `${name} · ${list.filter(m => M.seen[m.id]).length}/${list.length}`),
          h('div', { class: 'mm-grid' }, list.map(m => h('button', {
            class: 'mm-card' + (M.cleared[m.id] ? ' done' : M.seen[m.id] ? ' seen' : '') + (m.boss ? ' boss' : ''),
            disabled: !M.seen[m.id],
            onclick: () => practise(m),
          }, M.seen[m.id] ? m.cmd : '?')))))));
  }

  async function practise(m) {
    const host = h('div', { class: 'mc-host' });
    frame(header(`Practice · ${m.cmd}`, collection), host);
    const ok = await runMicro(host, m, { sfx, speed: 1 });
    if (!host.isConnected) return;
    if (ok && !M.cleared[m.id]) { M.cleared[m.id] = true; persist(); }
    host.replaceChildren(h('div', { class: 'mm-after' },
      h('button', { class: 'btn', onclick: collection }, 'Collection'),
      h('button', { class: 'btn primary', onclick: () => practise(m) }, 'Again')));
  }

  // ---------- leaderboard ----------
  async function board() {
    const list = h('div', { class: 'lb' }, h('p', { class: 'muted center' }, 'Loading…'));
    frame(header('Leaderboard', title), list);
    const data = await fetchScores(GAME);
    if (!list.isConnected) return;
    list.replaceChildren(...[
      !data.online && h('p', { class: 'note' }, 'Leaderboard offline. Showing this device only.'),
      data.top.length
        ? data.top.map(r => h('div', { class: 'lb-row' + (r.you ? ' you' : '') },
          h('span', { class: 'lb-rank' }, `#${r.rank}`), h('span', { class: 'lb-name' }, r.name), h('span', { class: 'lb-score' }, String(r.score))))
        : h('p', { class: 'muted center' }, 'No scores yet. Be the first!'),
      data.you && !data.top.some(r => r.you) && h('div', { class: 'lb-row you' },
        h('span', { class: 'lb-rank' }, `#${data.you.rank}`), h('span', { class: 'lb-name' }, 'You'), h('span', { class: 'lb-score' }, String(data.you.score))),
      data.online && h('p', { class: 'muted small center' }, `${data.players} player${data.players === 1 ? '' : 's'} · ranked by microgames cleared in one run`),
    ].flat().filter(Boolean));
  }

  title();
}
