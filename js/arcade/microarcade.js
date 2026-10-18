import { S, persist } from '../state.js';
import { h, icon, showModal, sparkle, confetti } from '../ui.js';
import { sleep } from '../pixel.js';
import { runMicro, shuffle } from '../micro/kit.js';
import { ALL, THEMES } from '../micro/index.js';
import { fetchScores, submitHighScore } from '../leaderboard.js';

const GAME = 'micro';
// Test hook: with window.__dangAutoplay set, every microgame plays itself via its solve().
const auto = () => !!globalThis.__dangAutoplay;
const LIVES = 4;
const BOSS_EVERY = 10;
const SPEED_EVERY = 5;
const coinsFor = score => Math.floor(score / 3);
const speedAt = score => Math.min(2.2, 1 + Math.floor(score / SPEED_EVERY) * 0.15);

// Sections: a themed set of microgames that ends on that set's boss. Practice-style, not scored.
export const SECTIONS = [
  { key: 'classic', name: 'Retro Remix', themes: ['classic'], length: 10, reward: 15 },
  { key: 'gross', name: 'Gross-Out', themes: ['gross'], length: 10, reward: 15 },
  { key: 'cozy', name: 'Cabin Life', themes: ['cozy'], length: 10, reward: 15 },
  { key: 'wild', name: 'Magic, Sport & Silly', themes: ['magic', 'sport', 'silly'], length: 10, reward: 15 },
  { key: 'fun-mario', name: 'Funtendo: Mario & Blocks', themes: ['funtendo'], prefix: 'fm-', length: 12, reward: 20 },
  { key: 'fun-zelda', name: 'Funtendo: Zelda & Friends', themes: ['funtendo'], prefix: 'fz-', length: 12, reward: 20 },
  { key: 'fun-poke', name: 'Funtendo: Pokémon & Crossing', themes: ['funtendo'], prefix: 'fp-', length: 12, reward: 20 },
  { key: 'fun-mix', name: 'Funtendo: Mix-Up', themes: ['funtendo'], prefix: 'fx-', length: 12, reward: 20 },
];
const sectionList = sec => ALL.filter(m => sec.themes.includes(m.theme) && (!sec.prefix || m.id.startsWith(sec.prefix)));

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
        h('p', { class: 'muted center' }, 'Five-second games, back to back. Read the command, do it, don’t blink. Endless: four lives, faster every five, a boss every tenth, high score to the leaderboard. Sections: pick a set and beat its boss.'),
        h('div', { class: 'mm-stats' },
          h('span', {}, h('b', {}, M.best), 'best'),
          h('span', {}, h('b', {}, `${seen}/${ALL.length}`), 'seen'),
          h('span', {}, h('b', {}, M.runs), 'runs')),
        h('button', { class: 'btn big primary', onclick: run }, h('span', {}, 'Endless'), h('small', {}, 'scored · leaderboard')),
        h('button', { class: 'btn big', onclick: sections }, h('span', {}, 'Sections'), h('small', {}, 'pick a set · beat its boss')),
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
      const ok = await runMicro(host, m, { sfx, speed, autoplay: auto() });
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

  // ---------- sections ----------
  function sections() {
    M.sections ||= {};
    frame(
      header('Pick a set · not scored', title),
      h('div', { class: 'arc-scroll' },
        SECTIONS.map(sec => {
          const list = sectionList(sec);
          const boss = list.filter(m => m.boss);
          const done = M.sections[sec.key];
          return h('button', { class: 'mm-sec' + (done ? ' done' : ''), disabled: !boss.length || list.length < 3, onclick: () => runSection(sec) },
            h('b', {}, sec.name),
            h('small', {}, `${list.length - boss.length} games · ${boss.length} boss${boss.length === 1 ? '' : 'es'}${done ? ` · cleared ${done}×` : ''}`),
            h('span', { class: 'mm-sec-boss' }, boss.length ? `Boss: ${boss.map(b => b.cmd).join(' / ')}` : 'Coming soon'));
        })));
  }

  async function runSection(sec) {
    const list = sectionList(sec);
    const boss = shuffle(list.filter(m => m.boss))[0];
    const plan = [...shuffle(list.filter(m => !m.boss)).slice(0, sec.length), boss];
    let lives = LIVES, quit = false;
    const hearts = h('span', { class: 'mg-stat' });
    const prog = h('b', { class: 'clock' });
    const host = h('div', { class: 'mc-host' });
    frame(header(sec.name, () => { quit = true; sections(); }), h('div', { class: 'arc-bar' }, prog, hearts), host);
    const showLives = () => hearts.replaceChildren(...Array.from({ length: LIVES }, (_, i) => icon(i < lives ? 'heart' : 'heartOff')));
    showLives();
    for (let i = 0; i < plan.length && lives > 0; i++) {
      const m = plan[i];
      prog.textContent = m.boss ? 'BOSS' : `${i + 1} / ${plan.length - 1}`;
      // gentle ramp: a little faster through the set
      const speed = 1 + (i / Math.max(1, plan.length - 1)) * 0.5;
      host.replaceChildren(h('div', { class: 'mc-inter' + (m.boss ? ' boss' : '') },
        h('b', {}, m.boss ? 'BOSS!' : i === 0 ? 'Ready?' : 'Next!'),
        h('div', { class: 'mc-lives' }, Array.from({ length: LIVES }, (_, k) => icon(k < lives ? 'heart' : 'heartOff'))),
        h('span', {}, m.boss ? sec.name : `${i + 1} of ${plan.length - 1}`)));
      sfx(m.boss ? 'alarm' : 'blip');
      await sleep(i === 0 || m.boss ? 1100 : 700);
      if (quit || !host.isConnected) return;
      if (!M.seen[m.id]) { M.seen[m.id] = true; persist(); }
      let ok = await runMicro(host, m, { sfx, speed, autoplay: auto() });
      if (quit || !host.isConnected) return;
      if (ok) { if (!M.cleared[m.id]) { M.cleared[m.id] = true; persist(); } continue; }
      lives--;
      showLives();
      // a boss you lose to can be retried while you have lives left
      while (m.boss && !ok && lives > 0) {
        host.replaceChildren(h('div', { class: 'mc-inter boss' }, h('b', {}, 'Again!'),
          h('div', { class: 'mc-lives' }, Array.from({ length: LIVES }, (_, k) => icon(k < lives ? 'heart' : 'heartOff')))));
        await sleep(1000);
        if (quit || !host.isConnected) return;
        ok = await runMicro(host, m, { sfx, speed, autoplay: auto() });
        if (quit || !host.isConnected) return;
        if (!ok) { lives--; showLives(); }
      }
    }
    const won = lives > 0;
    if (won) {
      const first = !M.sections[sec.key];
      M.sections[sec.key] = (M.sections[sec.key] || 0) + 1;
      const coins = first ? sec.reward * 2 : sec.reward;
      S.coins += coins;
      persist();
      changed();
      sfx('win');
      confetti(80);
      showModal({
        title: `${sec.name} cleared!`, cls: 'win',
        body: h('div', { class: 'center' },
          h('p', {}, `You beat the boss with ${lives} heart${lives === 1 ? '' : 's'} to spare.`),
          h('p', { class: 'reward small-reward' }, icon('coin'), ` +${coins}${first ? ' (first clear bonus!)' : ''}`)),
        buttons: [{ label: 'Sections', onClick: sections }, { label: 'Again', cls: 'primary', onClick: () => runSection(sec) }],
      });
    } else {
      sfx('tttlose');
      showModal({
        title: 'Out of hearts',
        body: h('p', {}, `${sec.name} got the better of you this time.`),
        buttons: [{ label: 'Sections', onClick: sections }, { label: 'Try again', cls: 'primary', onClick: () => runSection(sec) }],
      });
    }
    sections();
  }

  // ---------- collection ----------
  function collection() {
    const groups = Object.entries(THEMES).map(([k, name]) => [name, ALL.filter(m => m.theme === k)]).filter(([, l]) => l.length);
    const seen = Object.keys(M.seen).length;
    frame(
      header(`${seen}/${ALL.length} played · tap any to practise`, title),
      h('div', { class: 'arc-scroll' },
        groups.map(([name, list]) => h('div', { class: 'tier' },
          h('p', { class: 'slot-label' }, `${name} · ${list.filter(m => M.seen[m.id]).length}/${list.length}`),
          h('div', { class: 'mm-grid' }, list.map(m => h('button', {
            class: 'mm-card' + (M.cleared[m.id] ? ' done' : M.seen[m.id] ? ' seen' : '') + (m.boss ? ' boss' : ''),
            onclick: () => practise(m),
          }, m.cmd)))))));
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
