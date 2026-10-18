import { S, persist } from '../state.js';
import { h, icon, showModal } from '../ui.js';
import { playStarPegs, POWERS } from '../pegs/engine.js';
import { levelData, LEVEL_COUNT, THEMES } from '../pegs/levels.js';
import { fetchScores, submitHighScore } from '../leaderboard.js';

const GAME = 'starpegs';
const reward = n => 3 + Math.floor(n / 20);
const TIER_NAMES = ['Drizzle', 'Shower', 'Downpour', 'Thunder', 'Gale', 'Monsoon', 'Tempest', 'Hurricane', 'Typhoon', 'Supercell'];

// The Star Pegs cartridge: 200 Peggle-style levels across 20 themed layouts.
export function mountStarPegs(root, { sfx, changed, back }) {
  const P = S.arcade.pegs;
  const total = () => Object.values(P.best).reduce((a, b) => a + b.score, 0);

  function frame(...kids) { root.replaceChildren(h('div', { class: 'arcade sp-arc' }, ...kids)); }
  function header(sub, onBack) {
    return h('div', { class: 'arc-head' },
      h('button', { class: 'btn small', onclick: onBack }, '◀ Back'),
      h('div', { class: 'arc-title' }, h('b', {}, 'Star Pegs'), h('small', {}, sub)));
  }

  function levels() {
    const cleared = Object.keys(P.best).length;
    const tiers = Array.from({ length: LEVEL_COUNT / THEMES.length }, (_, t) => [t * THEMES.length + 1, (t + 1) * THEMES.length]);
    frame(
      header(`${cleared}/${LEVEL_COUNT} cleared · ${total().toLocaleString()} pts`, back),
      h('div', { class: 'arc-tabs' },
        h('button', { class: 'seg-btn on' }, 'Levels'),
        h('button', { class: 'seg-btn', onclick: board }, 'Leaderboard'),
        h('button', { class: 'seg-btn', onclick: powers }, 'Power-ups')),
      h('div', { class: 'arc-scroll' },
        h('p', { class: 'muted small arc-blurb' }, 'Clear every orange peg (10 balls, 12 in the first 20 levels). The bucket gives free balls, big shots give free balls, the purple peg is worth 500, and the two green pegs hand out power-ups.'),
        tiers.map(([a, b], t) => h('div', { class: 'tier' },
          h('p', { class: 'slot-label' }, `${TIER_NAMES[t]} · levels ${a}–${b}`),
          h('div', { class: 'arc-grid' }, Array.from({ length: b - a + 1 }, (_, i) => {
            const n = a + i, best = P.best[n], locked = n > P.unlocked;
            return h('button', { class: 'lvl' + (best ? ' done' : '') + (n === P.unlocked ? ' on' : ''), disabled: locked, onclick: () => play(n) },
              h('span', {}, locked ? '·' : n), best && h('span', { class: 'mini-stars' }, '★'.repeat(best.stars)));
          }))))));
  }

  function powers() {
    frame(header('Power-ups', levels),
      h('div', { class: 'arc-scroll' },
        h('p', { class: 'muted small arc-blurb' }, 'Hit a green peg for a random power-up. It works for the rest of that shot and the next two.'),
        Object.values(POWERS).map(p => h('div', { class: 'sp-pw' }, h('b', { style: `color:${p.color}` }, p.name), h('span', {}, p.desc)))));
  }

  async function play(n) {
    const L = levelData(n);
    const host = h('div', { class: 'sp-host' });
    frame(header(`Level ${n} · ${L.theme}`, levels), host);
    const r = await playStarPegs(host, { level: L, sfx, title: `Level ${n} · ${L.theme}`, auto: !!globalThis.__dangAutoplay });
    if (!host.isConnected) return;
    if (!r.won) {
      showModal({ title: 'Out of balls', body: h('p', {}, `${r.score.toLocaleString()} points. So close!`), buttons: [{ label: 'Levels', onClick: levels }, { label: 'Try again', cls: 'primary', onClick: () => play(n) }] });
      return levels();
    }
    const stars = 1 + (r.score >= L.goal2) + (r.score >= L.goal3);
    const prev = P.best[n];
    const first = !prev;
    P.best[n] = { score: Math.max(prev ? prev.score : 0, r.score), stars: Math.max(prev ? prev.stars : 0, stars) };
    if (n === P.unlocked && n < LEVEL_COUNT) P.unlocked++;
    if (first) S.coins += reward(n);
    persist();
    changed();
    const rank = h('p', { class: 'muted small' }, 'Posting your total…');
    showModal({
      title: `Level ${n} cleared!`, cls: 'win',
      body: h('div', { class: 'center' },
        h('span', { class: 'stars' }, [1, 2, 3].map(i => icon(i <= stars ? 'star' : 'starOff'))),
        h('p', { class: 'reward' }, r.score.toLocaleString()),
        h('p', { class: 'muted small' }, `2★ at ${L.goal2.toLocaleString()} · 3★ at ${L.goal3.toLocaleString()}${prev && r.score > prev.score ? ' · new best!' : ''}`),
        first && h('p', { class: 'reward small-reward' }, icon('coin'), ` +${reward(n)} for a first clear`),
        rank),
      buttons: [
        { label: 'Levels', onClick: levels },
        ...(n < LEVEL_COUNT ? [{ label: 'Next', cls: 'primary', onClick: () => play(n + 1) }] : []),
      ],
    });
    levels();
    const res = await submitHighScore(GAME, total());
    rank.textContent = res.online ? `Total ${total().toLocaleString()}: you're #${res.you.rank} of ${res.players}.` : 'Leaderboard offline. Saved on this device.';
  }

  async function board() {
    const list = h('div', { class: 'lb' }, h('p', { class: 'muted center' }, 'Loading…'));
    frame(header('Leaderboard · total of your best scores', levels), list);
    const data = await fetchScores(GAME);
    if (!list.isConnected) return;
    const mine = total();
    list.replaceChildren(...[
      !data.online && h('p', { class: 'note' }, 'Leaderboard offline. Showing this device only.'),
      data.online
        ? (data.top.length ? data.top.map(r => h('div', { class: 'lb-row' + (r.you ? ' you' : '') }, h('span', { class: 'lb-rank' }, `#${r.rank}`), h('span', { class: 'lb-name' }, r.name), h('span', { class: 'lb-score' }, r.score.toLocaleString()))) : h('p', { class: 'muted center' }, 'No scores yet. Be the first!'))
        : h('div', { class: 'lb-row you' }, h('span', { class: 'lb-rank' }, '#1'), h('span', { class: 'lb-name' }, S.hero ? S.hero.name : 'You'), h('span', { class: 'lb-score' }, mine.toLocaleString())),
      data.online && data.you && !data.top.some(r => r.you) && h('div', { class: 'lb-row you' }, h('span', { class: 'lb-rank' }, `#${data.you.rank}`), h('span', { class: 'lb-name' }, 'You'), h('span', { class: 'lb-score' }, data.you.score.toLocaleString())),
      data.online && h('p', { class: 'muted small center' }, `${data.players} player${data.players === 1 ? '' : 's'}`),
    ].flat().filter(Boolean));
  }

  levels();
}
