import { h, sparkle } from '../ui.js';
import { sleep } from '../pixel.js';
import { mount, banner } from './common.js';
import { SEARCH_SETS } from './words.js';
import { buildSearch, DIRS_EASY, DIRS_MEDIUM } from './wordsearch.js';
import { nbrs } from './sweeper.js';

// Word Sweeper (Word Search + Storm Sweeper): the words are buried under clouds. Clear a cloud and
// you either dig up a letter, or see a number: how many buried letters touch that square. Dig up
// every word before you run out of digs.
export function play(root, { difficulty: d, sfx, boost }) {
  const n = 7;
  const set = SEARCH_SETS[(Math.random() * SEARCH_SETS.length) | 0];
  let built = null;
  while (!built) {
    const pool = set.words.filter(w => w.length >= 3 && w.length <= 6).sort(() => Math.random() - 0.5).slice(0, 3);
    built = buildSearch(n, pool, d < 0.5 ? DIRS_EASY : DIRS_MEDIUM);
  }
  const { grid, placed } = built;
  const word = new Array(n * n).fill(false);
  placed.forEach(p => p.cells.forEach(i => (word[i] = true)));
  const wordCount = word.filter(Boolean).length;
  const count = i => nbrs(n, i).filter(j => word[j]).length;
  let digs = wordCount + Math.round(16 - d * 8) + (boost === 'toast' ? 4 : 0);
  let done = false;
  const open = new Array(n * n).fill(false);

  const ui = mount(root, { title: 'Word Sweeper', tip: 'The words are buried under clouds. Clear a cloud to dig up a letter, or a number counting the buried letters around it. Dig up every word before you run out of digs.' });
  const stat = h('span', { class: 'mg-stat' });
  ui.info.append(stat);
  const act = {};
  const cells = grid.map((_, i) => h('button', { type: 'button', class: 'sw-cell', onpointerdown: e => { e.preventDefault(); act.dig(i); } }));
  const list = placed.map(p => h('span', { class: 'ws-word' }, p.word.replace(/./g, '_ ').trim()));
  ui.body.append(h('p', { class: 'ws-theme' }, set.theme), h('div', { class: 'sw-wrap' }, h('div', { class: 'sw-grid', style: `grid-template-columns: repeat(${n}, 1fr)` }, cells)), h('div', { class: 'ws-list' }, list));
  root.__wsw = { word, open };

  function render() {
    cells.forEach((b, i) => {
      b.className = 'sw-cell' + (open[i] ? ' open' : '') + (open[i] && word[i] ? ' letter' : '');
      if (!open[i]) { b.textContent = ''; return; }
      if (word[i]) b.textContent = grid[i];
      else { const k = count(i); b.textContent = k || ''; b.dataset.k = k; }
    });
    placed.forEach((p, k) => {
      const shown = p.cells.map(i => (open[i] ? grid[i] : '_')).join(' ');
      list[k].textContent = shown;
      list[k].classList.toggle('got', p.cells.every(i => open[i]));
    });
    const left = word.reduce((a, w, i) => a + (w && !open[i] ? 1 : 0), 0);
    stat.textContent = `${digs} digs · ${left} letters buried`;
    return left;
  }
  render();
  ui.status('Tap any cloud to start digging.');

  return new Promise(resolve => {
    async function finish(res, msg) {
      done = true;
      if (res !== 'win') word.forEach((w, i) => w && !open[i] && cells[i].classList.add('reveal'));
      sfx(res === 'win' ? 'tttwin' : 'tttlose');
      await sleep(700);
      await banner(ui, res, msg);
      resolve(res);
    }
    act.dig = i => {
      if (done || open[i]) return;
      digs--;
      // empty squares (no letters around) open up their neighbours too, like Minesweeper
      const stack = [i];
      while (stack.length) {
        const k = stack.pop();
        if (open[k]) continue;
        open[k] = true;
        if (!word[k] && count(k) === 0) for (const j of nbrs(n, k)) if (!open[j] && !word[j]) stack.push(j);
      }
      if (word[i]) { sfx('coin'); sparkle(cells[i], { count: 6 }); } else sfx('tap');
      const left = render();
      const whole = placed.find(p => p.cells.includes(i) && p.cells.every(c => open[c]));
      if (whole) ui.status(`${whole.word}!`);
      if (!left) return finish('win', 'Every word dug up!');
      if (digs <= 0) return finish('lose', 'Out of digs.');
    };
  });
}
