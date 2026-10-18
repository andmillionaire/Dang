import { S, persist } from '../state.js';
import { h, icon, showModal, toast } from '../ui.js';
import { searchBoard } from '../minigames/wordsearch.js';
import { levelData, LEVEL_COUNT, THEMES } from './wordsearch-levels.js';
import { fetchBoard, submitScore, fmtSecs } from '../leaderboard.js';

const GAME = 'wordsearch';
const HINT_COST = 5, HINT_PENALTY = 10;
const reward = n => 2 + Math.floor(n / 10);

// The Word Search cartridge: 100 timed puzzles, a new theme every 20 levels.
export function mountWordSearch(root, { sfx, changed, back }) {
  const W = S.arcade.wordsearch;
  let timer = 0;
  const stop = () => { clearInterval(timer); timer = 0; };

  function frame(...kids) { stop(); root.replaceChildren(h('div', { class: 'arcade ws-arc' }, ...kids)); }
  function header(sub, onBack) {
    return h('div', { class: 'arc-head' },
      h('button', { class: 'btn small', onclick: onBack }, '◀ Back'),
      h('div', { class: 'arc-title' }, h('b', {}, 'Word Search'), h('small', {}, sub)));
  }

  function levels() {
    const cleared = Object.keys(W.best).length;
    frame(
      header(`${cleared}/${LEVEL_COUNT} cleared`, back),
      h('div', { class: 'arc-tabs' },
        h('button', { class: 'seg-btn on' }, 'Levels'),
        h('button', { class: 'seg-btn', onclick: () => board(0) }, 'Leaderboard')),
      h('div', { class: 'arc-scroll' },
        h('p', { class: 'muted small arc-blurb' }, 'Find every word as fast as you can. Drag across a word, or tap its first letter and then its last. Words run backwards from level 26 and in every direction from level 51. Hints cost coins and add 10 seconds.'),
        THEMES.map((t, ti) => h('div', { class: 'tier' },
          h('p', { class: 'slot-label', style: `color:${t.color}` }, `${t.name} · levels ${ti * 20 + 1}–${ti * 20 + 20}`),
          h('div', { class: 'arc-grid' }, Array.from({ length: 20 }, (_, i) => {
            const n = ti * 20 + i + 1, best = W.best[n], locked = n > W.unlocked;
            return h('button', { class: 'lvl' + (best ? ' done' : '') + (n === W.unlocked ? ' on' : ''), disabled: locked, onclick: () => play(n) },
              h('span', {}, locked ? '·' : n), best && h('span', { class: 'mini-stars' }, '★'.repeat(best.stars)));
          }))))));
  }

  function play(n) {
    const L = levelData(n);
    let elapsed = 0, hints = 0, last = performance.now(), finished = false;
    const clock = h('b', { class: 'clock' }, '0:00.0');
    const hintBtn = h('button', { class: 'btn small primary', onclick: () => useHint() });
    const host = h('div', { class: 'ws-host' });
    const status = h('p', { class: 'mg-status' }, `${L.placed.length} words to find.`);
    frame(header(`Level ${n} · ${L.theme}`, () => (finished ? levels() : quit())), h('div', { class: 'arc-bar' }, clock, hintBtn), host, status);
    const sb = searchBoard(host, {
      n: L.size, grid: L.grid, placed: L.placed.map(p => ({ ...p })), sfx, theme: L.theme,
      onFound: (word, rest) => { status.textContent = rest ? `${word}! ${rest} to go.` : 'Every word found!'; if (!rest) done(); },
    });
    globalThis.__wsLevel = L; // test hook: the solution
    const refreshHint = () => { hintBtn.replaceChildren('Hint ', icon('coin'), ` ${HINT_COST}`); hintBtn.disabled = S.coins < HINT_COST; };
    refreshHint();
    timer = setInterval(() => {
      if (!host.isConnected) return stop();
      const now = performance.now();
      if (!document.hidden && !finished) elapsed += (now - last) / 1000;
      last = now;
      clock.textContent = fmtSecs(elapsed + hints * HINT_PENALTY);
    }, 100);

    function useHint() {
      if (finished || S.coins < HINT_COST) return;
      const w = sb.hint();
      if (!w) return;
      S.coins -= HINT_COST; hints++;
      persist(); changed(); refreshHint();
      sfx('coin');
      toast(`Look for ${w} at the glowing letter. (−${HINT_COST} coins, +${HINT_PENALTY}s)`);
    }

    function quit() {
      showModal({ title: 'Leave this puzzle?', body: h('p', {}, 'Your time on it will be lost.'), buttons: [{ label: 'Keep searching' }, { label: 'Leave', cls: 'primary', onClick: levels }] });
    }

    async function done() {
      finished = true;
      sb.state.done = true;
      stop();
      const time = Math.round((elapsed + hints * HINT_PENALTY) * 10) / 10;
      const stars = time <= L.par ? 3 : time <= L.ok ? 2 : 1;
      const prev = W.best[n], first = !prev;
      W.best[n] = { time: prev ? Math.min(prev.time, time) : time, stars: Math.max(prev ? prev.stars : 0, stars) };
      if (n === W.unlocked && n < LEVEL_COUNT) W.unlocked++;
      if (first) S.coins += reward(n);
      persist(); changed();
      sfx('win');
      const rank = h('p', { class: 'muted' }, 'Posting your time…');
      showModal({
        title: `Level ${n} found!`, cls: 'win',
        body: h('div', { class: 'center' },
          h('span', { class: 'stars' }, [1, 2, 3].map(i => icon(i <= stars ? 'star' : 'starOff'))),
          h('p', { class: 'reward' }, fmtSecs(time)),
          h('p', { class: 'muted small' }, `3★ under ${fmtSecs(L.par)} · 2★ under ${fmtSecs(L.ok)}${prev && time < prev.time ? ' · new best!' : ''}`),
          first && h('p', { class: 'reward small-reward' }, icon('coin'), ` +${reward(n)} for a first clear`),
          rank),
        buttons: [
          { label: 'Levels', onClick: levels },
          { label: 'Rankings', onClick: () => board(n) },
          ...(n < LEVEL_COUNT ? [{ label: 'Next', cls: 'primary', onClick: () => play(n + 1) }] : []),
        ],
      });
      const r = await submitScore(GAME, n, time);
      rank.textContent = r.online ? `You’re #${r.you.rank} of ${r.players} on this level.` : 'Leaderboard offline. Saved on this device.';
    }
  }

  async function board(level) {
    const pick = h('select', { class: 'arc-select', onchange: e => board(Number(e.target.value)) },
      h('option', { value: 0, selected: !level }, 'Overall'),
      Array.from({ length: W.unlocked }, (_, i) => h('option', { value: i + 1, selected: level === i + 1 }, `Level ${i + 1}`)));
    const list = h('div', { class: 'lb' }, h('p', { class: 'muted center' }, 'Loading…'));
    frame(header('Leaderboard', levels), h('div', { class: 'arc-tabs' }, h('button', { class: 'seg-btn', onclick: levels }, 'Levels'), h('button', { class: 'seg-btn on' }, 'Leaderboard')), pick, list);
    const data = await fetchBoard(GAME, level);
    if (!list.isConnected) return;
    const rows = data.top.map(r => h('div', { class: 'lb-row' + (r.you ? ' you' : '') },
      h('span', { class: 'lb-rank' }, `#${r.rank}`), h('span', { class: 'lb-name' }, r.name),
      h('span', { class: 'lb-score' }, level ? fmtSecs(r.time) : `${r.levels} lv · ${fmtSecs(r.total)}`)));
    list.replaceChildren(...[
      !data.online && h('p', { class: 'note' }, 'Leaderboard offline. Showing this device only.'),
      rows.length ? rows : h('p', { class: 'muted center' }, level ? 'Nobody has solved this one yet.' : 'No times yet. Be the first!'),
      data.online && h('p', { class: 'muted small center' }, `${data.players} player${data.players === 1 ? '' : 's'}${level ? '' : ' · ranked by levels cleared, then total time'}`),
    ].flat().filter(Boolean));
  }

  levels();
  return { stop };
}
