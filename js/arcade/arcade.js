import { S, persist } from '../state.js';
import { $, h, icon, showModal, toast } from '../ui.js';
import { meowdokuBoard, decode } from '../meowdokuboard.js';
import { LEVELS } from './meowdoku-levels.js';
import { fetchBoard, submitScore, fmtSecs } from '../leaderboard.js';

const GAME = 'meowdoku';
const LIVES = 3;
const HINT_PENALTY = 15; // seconds added per hint
const LEVEL_COUNT = LEVELS.length;
const sizeOf = n => LEVELS[n - 1][1].length;
const TIERS = { 5: 'Twinkle', 6: 'Moonbeam', 7: 'Stardust', 8: 'Starlight', 9: 'Nebula', 10: 'Supernova' };
const tierName = n => TIERS[sizeOf(n)];
export const hintCost = n => (sizeOf(n) >= 8 ? 10 : 5);
const reward = n => 2 + Math.floor(n / 10);

const SOON = [['Star Pegs', 'sp_pegs'], ['Word Square', 'sp_cw'], ['Tic-Tac-Toe', 'sp_ttt']];

// The arcade cabinet: Magical Mewdoku with 100 levels and a leaderboard.
export function mountArcade({ sfx, changed, onExit }) {
  const root = $('#scr-arcade');
  const A = S.arcade.meowdoku;
  let timer = 0;

  const stopTimer = () => { clearInterval(timer); timer = 0; };

  function frame(...kids) {
    stopTimer();
    root.replaceChildren(h('div', { class: 'arcade' }, ...kids));
  }

  function header(sub, back) {
    return h('div', { class: 'arc-head' },
      h('button', { class: 'btn small', onclick: back }, '◀ Back'),
      h('div', { class: 'arc-title' }, h('b', {}, 'Magical Mewdoku'), h('small', {}, sub)));
  }

  // ---------- level map ----------
  function levels() {
    // consecutive runs of the same board size
    const tiers = [];
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      if (!tiers.length || sizeOf(tiers[tiers.length - 1][0]) !== sizeOf(n)) tiers.push([n, n]);
      else tiers[tiers.length - 1][1] = n;
    }
    const cleared = Object.keys(A.best).length;
    frame(
      header(`${cleared}/${LEVEL_COUNT} cleared`, () => { stopTimer(); onExit(); }),
      h('div', { class: 'arc-tabs' },
        h('button', { class: 'seg-btn on' }, 'Levels'),
        h('button', { class: 'seg-btn', onclick: () => board(0) }, 'Leaderboard')),
      h('div', { class: 'arc-scroll' },
        h('p', { class: 'muted small arc-blurb' }, 'Place one magical girl in every row, every column and every colour. Girls can’t touch, not even diagonally. Start from the locked girl. Tap to mark ✕, double-tap to place, tap a girl to pick her up. Breaking a rule costs a heart. Hints point you at the next step and cost coins.'),
        tiers.map(([a, b]) => h('div', { class: 'tier' },
          h('p', { class: 'slot-label' }, `${tierName(a)} · ${sizeOf(a)}×${sizeOf(a)} · levels ${a}–${b}`),
          h('div', { class: 'arc-grid' }, Array.from({ length: b - a + 1 }, (_, i) => {
            const n = a + i, best = A.best[n], locked = n > A.unlocked;
            return h('button', {
              class: 'lvl' + (best ? ' done' : '') + (n === A.unlocked ? ' on' : ''),
              disabled: locked,
              onclick: () => play(n),
            }, h('span', {}, locked ? '·' : n), best && h('span', { class: 'mini-stars' }, '★'.repeat(best.stars)));
          })))),
        h('div', { class: 'soon' }, h('p', { class: 'slot-label' }, 'Coming soon to this cabinet'),
          SOON.map(([name, ic]) => h('span', { class: 'chip-soon' }, icon(ic), name)))));
  }

  // ---------- play ----------
  function play(n) {
    const L = decode(LEVELS[n - 1]);
    let elapsed = 0, last = performance.now(), hints = 0, finished = false;
    const clock = h('b', { class: 'clock' }, '0:00.0');
    const hearts = h('span', { class: 'mg-stat' });
    const hintBtn = h('button', { class: 'btn small primary', onclick: () => useHint() });
    const host = h('div', { class: 'arc-board' });

    frame(
      header(`Level ${n} · ${tierName(n)}`, () => { if (!finished) quit(); else levels(); }),
      h('div', { class: 'arc-bar' }, clock, hearts, hintBtn),
      host,
    );

    const ctl = meowdokuBoard(host, {
      puzzle: L, lives: LIVES, sfx, pieceName: 'girl',
      piece: g => icon('girl' + g, 'ico girl'),
      onChange: s => { hearts.replaceChildren(...Array.from({ length: LIVES }, (_, i) => icon(i < s.lives ? 'heart' : 'heartOff'))); },
      onDone: res => done(res),
    });
    const refreshHint = () => {
      hintBtn.replaceChildren(`Hint `, icon('coin'), ` ${hintCost(n)}`);
      hintBtn.disabled = S.coins < hintCost(n);
    };
    refreshHint();

    timer = setInterval(() => {
      if (!host.isConnected) return stopTimer();
      const now = performance.now();
      if (!document.hidden) elapsed += (now - last) / 1000;
      last = now;
      clock.textContent = fmtSecs(elapsed + hints * HINT_PENALTY);
    }, 100);

    function useHint() {
      if (finished || S.coins < hintCost(n)) return;
      S.coins -= hintCost(n);
      persist();
      changed();
      hints++;
      sfx('coin');
      const msg = ctl.hint();
      refreshHint();
      toast(`${msg} (−${hintCost(n)} coins, +${HINT_PENALTY}s)`);
    }

    function quit() {
      showModal({
        title: 'Leave this puzzle?',
        body: h('p', {}, 'Your time and progress on it will be lost.'),
        buttons: [{ label: 'Keep solving' }, { label: 'Leave', cls: 'primary', onClick: levels }],
      });
    }

    async function done(res) {
      finished = true;
      stopTimer();
      const time = Math.round((elapsed + hints * HINT_PENALTY) * 10) / 10;
      if (res !== 'win') {
        sfx('tttlose');
        showModal({
          title: 'Out of hearts',
          body: h('p', {}, 'Three wrong guesses. The girls scatter back into the rain.'),
          buttons: [{ label: 'Levels', onClick: levels }, { label: 'Try again', cls: 'primary', onClick: () => play(n) }],
        });
        return;
      }
      const m = ctl.state.mistakes;
      const stars = m === 0 && hints === 0 ? 3 : m <= 1 && hints <= 1 ? 2 : 1;
      const first = !A.best[n];
      const prev = A.best[n];
      A.best[n] = { time: prev ? Math.min(prev.time, time) : time, stars: Math.max(prev ? prev.stars : 0, stars) };
      if (n === A.unlocked && n < LEVEL_COUNT) A.unlocked++;
      if (first) S.coins += reward(n);
      persist();
      changed();
      sfx('win');
      const rank = h('p', { class: 'muted' }, 'Posting your time…');
      showModal({
        title: `Level ${n} solved!`,
        cls: 'win',
        body: h('div', { class: 'center' },
          h('span', { class: 'stars' }, [1, 2, 3].map(i => icon(i <= stars ? 'star' : 'starOff'))),
          h('p', { class: 'reward' }, fmtSecs(time)),
          h('p', { class: 'muted small' }, `${m} mistake${m === 1 ? '' : 's'} · ${hints} hint${hints === 1 ? '' : 's'}${prev && time < prev.time ? ' · new best!' : ''}`),
          first && h('p', { class: 'reward small-reward' }, icon('coin'), ` +${reward(n)} for a first clear`),
          rank),
        buttons: [
          { label: 'Levels', onClick: levels },
          { label: 'Rankings', onClick: () => board(n) },
          ...(n < LEVEL_COUNT ? [{ label: 'Next', cls: 'primary', onClick: () => play(n + 1) }] : []),
        ],
      });
      const r = await submitScore(GAME, n, time);
      rank.textContent = r.online
        ? `You’re #${r.you.rank} of ${r.players} on this level.`
        : 'Leaderboard offline. Saved on this device.';
    }
  }

  // ---------- leaderboard ----------
  async function board(level) {
    const pick = h('select', { class: 'arc-select', onchange: e => board(Number(e.target.value)) },
      h('option', { value: 0, selected: !level }, 'Overall'),
      Array.from({ length: A.unlocked }, (_, i) => h('option', { value: i + 1, selected: level === i + 1 }, `Level ${i + 1}`)));
    const list = h('div', { class: 'lb' }, h('p', { class: 'muted center' }, 'Loading…'));
    frame(
      header('Leaderboard', levels),
      h('div', { class: 'arc-tabs' },
        h('button', { class: 'seg-btn', onclick: levels }, 'Levels'),
        h('button', { class: 'seg-btn on' }, 'Leaderboard')),
      pick,
      list);
    const data = await fetchBoard(GAME, level);
    if (!list.isConnected) return;
    const rows = data.top.map(r => h('div', { class: 'lb-row' + (r.you ? ' you' : '') },
      h('span', { class: 'lb-rank' }, `#${r.rank}`),
      h('span', { class: 'lb-name' }, r.name),
      h('span', { class: 'lb-score' }, level ? fmtSecs(r.time) : `${r.levels} lv · ${fmtSecs(r.total)}`)));
    list.replaceChildren(
      !data.online && h('p', { class: 'note' }, 'Leaderboard offline. Showing this device only.'),
      rows.length ? rows : h('p', { class: 'muted center' }, level ? 'Nobody has solved this one yet.' : 'No scores yet. Be the first!'),
      data.you && !data.top.some(r => r.you) && h('div', { class: 'lb-row you' },
        h('span', { class: 'lb-rank' }, `#${data.you.rank}`), h('span', { class: 'lb-name' }, 'You'),
        h('span', { class: 'lb-score' }, level ? fmtSecs(data.you.time) : `${data.you.levels} lv · ${fmtSecs(data.you.total)}`)),
      data.online && h('p', { class: 'muted small center' }, `${data.players} player${data.players === 1 ? '' : 's'}${level ? '' : ' · ranked by levels cleared, then total time'}`));
  }

  levels();
  return { stop: stopTimer };
}
