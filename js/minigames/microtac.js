import { h, icon } from '../ui.js';
import { sleep } from '../pixel.js';
import { mount, banner } from './common.js';
import { aiMove, outcome, stormSkill } from './tictactoe.js';
import { MICROS, runMicro } from './micro.js';

// Micro-Tac-Toe: every square hides a 5-second microgame. Pick a square and play it:
// win and your ✕ goes there, lose and the storm steals the square. Then the storm moves.
export function play(root, { difficulty: d, sfx, boost }) {
  const ui = mount(root, { title: 'Micro-Tac-Toe', tip: 'Every square is a 5-second microgame. Win it to claim the square; lose and the storm takes it. Three in a row wins!' });
  const deck = [...MICROS].sort(() => Math.random() - 0.5).slice(0, 9);
  const board = Array(9).fill(null);
  const skill = stormSkill(d, boost);
  const host = h('div', { class: 'mc-host' });
  ui.body.append(host);
  const act = {}; // handlers are set inside the Promise below
  let busy = false, round = 0;

  function showBoard(hot = []) {
    host.replaceChildren(h('div', { class: 'ttt-grid mt-grid' }, board.map((m, i) => h('button', {
      type: 'button',
      class: 'ttt-cell mt-cell' + (hot.includes(i) ? ' hot' : ''),
      disabled: !!m || busy,
      onclick: () => act.pick(i),
    }, m ? icon(m === 'X' ? 'markX' : 'markO', 'mark') : h('span', { class: 'mt-cmd' }, deck[i].cmd)))));
  }
  showBoard();
  ui.status('Pick a square to play its microgame.');

  return new Promise(resolve => {
    async function finish(res, msg, line) {
      showBoard(line || []);
      sfx(res === 'win' ? 'tttwin' : 'tttlose');
      await sleep(700);
      await banner(ui, res, msg);
      resolve(res);
    }
    // Returns true if the game is over.
    function check() {
      const o = outcome(board);
      if (!o) return false;
      if (o.w === 'X') finish('win', 'Three in a row!', o.line);
      else if (o.w === 'O') finish('lose', 'The storm got three in a row.', o.line);
      else finish('draw', 'The board filled up.');
      return true;
    }
    act.pick = async i => {
      if (busy || board[i]) return;
      busy = true;
      sfx('select');
      const ok = await runMicro(host, deck[i], { sfx, speed: 1 + d * 0.3 + round++ * 0.08 });
      board[i] = ok ? 'X' : 'O';
      showBoard([i]);
      ui.status(ok ? 'Square claimed!' : 'The storm stole that square!');
      if (check()) return;
      await sleep(600);
      board[aiMove(board, skill)] = 'O';
      sfx('aiplace');
      if (check()) return;
      busy = false;
      showBoard();
      ui.status('Your pick.');
    };
  });
}
