import { S, persist } from './state.js';
import { DECOR, CROPS, levelConfig } from './data.js';
import { Board, BIG_MATCH } from './match3.js';
import { Cabin } from './cabin.js';
import { Attic, cropProgress } from './farm.js';
import { playTicTacToe } from './tictactoe.js';
import { startBgRain } from './bgrain.js';
import * as audio from './audio.js';
import { $, h, icon, hydrateIcons, showModal, toast } from './ui.js';
import { iconURL } from './sprites.js';

audio.setSound(S.sound);
hydrateIcons();
startBgRain($('#bgRain'));

// ---------- screens ----------
const screens = { cabin: $('#scr-cabin'), match: $('#scr-match'), farm: $('#scr-farm') };
let current = null;

const cabin = new Cabin($('#cabinCanvas'), {
  sfx: audio.sfx,
  onLadder: goUpstairs,
  onCat: () => audio.sfx('purr'),
});
const attic = new Attic($('#farmCanvas'), {
  sfx: audio.sfx,
  onHatch: () => show('cabin'),
  changed: updateHud,
});
const board = new Board($('#boardCanvas'), {
  sfx: audio.sfx,
  toast,
  onUpdate: updateMatchHud,
  onBigMatch: b => playTicTacToe({ skill: b.cfg.aiSkill, sfx: audio.sfx }),
  onEnd: onLevelEnd,
});

function show(name) {
  current = name;
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('active', k === name);
  cabin.setActive(name === 'cabin');
  attic.setActive(name === 'farm');
  if (name !== 'match') board.stop();
  updateHud();
}

addEventListener('resize', () => { cabin.resize(); attic.resize(); board.resize(); });

// ---------- HUD ----------
function updateHud() {
  $('#coins').textContent = S.coins;
  const sup = $('#supplies');
  sup.hidden = !S.farmUnlocked;
  sup.replaceChildren(...Object.keys(CROPS).map(id => h('span', { class: 'res' }, icon(id), h('span', {}, S.supplies[id]))));
  $('#playLvl').textContent = `Level ${S.maxLevel}`;
  $('#upBtn').classList.toggle('locked', !S.farmUnlocked);
  const ready = S.plots.slice(0, S.plotsOwned).some(p => p.crop && cropProgress(p) >= 1);
  $('#upBtn').classList.toggle('ping', S.farmUnlocked && ready);
  $('#soundBtn img').src = iconURL(S.sound ? 'sndOn' : 'sndOff');
}
setInterval(() => current === 'cabin' && updateHud(), 2000);

function updateMatchHud(b) {
  const c = b.cfg;
  $('#mLevel').textContent = `Level ${c.n}`;
  $('#mMoves').textContent = b.moves;
  $('#mBlasts').textContent = `${b.blasts}/${c.blasts}`;
  $('#mBlastPill').classList.toggle('done', b.blasts >= c.blasts);
  $('#mBar').style.width = Math.min(100, (b.score / c.target) * 100) + '%';
  $('#mScore').textContent = `${b.score} / ${c.target}`;
}

$('#soundBtn').addEventListener('click', () => {
  S.sound = !S.sound;
  persist();
  audio.setSound(S.sound);
  updateHud();
});

// Audio may only start after a user gesture.
addEventListener('pointerdown', () => audio.initAudio(), { capture: true });

// ---------- levels ----------
function goalsList(cfg) {
  return h('ul', { class: 'goals' },
    h('li', {}, h('b', {}, cfg.target), ' points'),
    h('li', {}, icon('bolt'), ' ', h('b', {}, cfg.blasts), ` Storm Blast${cfg.blasts > 1 ? 's' : ''}`),
    h('li', {}, 'in ', h('b', {}, cfg.moves), ' moves'));
}

function starRow(n) {
  return h('span', { class: 'stars' }, [1, 2, 3].map(i => icon(i <= n ? 'star' : 'starOff')));
}

function openPlay() {
  const pick = n => {
    const cfg = levelConfig(n);
    showModal({
      title: `Level ${n}`,
      body: h('div', {},
        goalsList(cfg),
        h('p', { class: 'muted' }, `The storm plays tic-tac-toe at ${Math.round(cfg.aiSkill * 100)}% focus.`),
        S.maxLevel > 1 && h('div', { class: 'level-grid' },
          Array.from({ length: S.maxLevel }, (_, i) => i + 1).map(k =>
            h('button', { class: 'lvl' + (k === n ? ' on' : ''), onclick: () => pick(k) },
              h('span', {}, k), starRow(S.stars[k] || 0))))),
      buttons: [{ label: 'Back' }, { label: 'Start', cls: 'primary', onClick: () => startLevel(n) }],
    });
  };
  pick(S.maxLevel);
}

function startLevel(n) {
  show('match');
  board.start(levelConfig(n));
  if (!S.seen.tutorial) {
    S.seen.tutorial = true;
    persist();
    showModal({
      title: 'How to play',
      body: h('div', { class: 'howto' },
        h('p', {}, 'Swap neighbouring tiles to line up 3 or more.'),
        h('p', {}, 'Match ', h('b', {}, `${BIG_MATCH} or more`), ' at once (a long line, or an L or T shape) to charge a ', icon('bolt'), h('b', {}, ' Storm Blast'), '.'),
        h('p', {}, 'The charge only goes off if you beat the storm at ', h('b', {}, 'tic-tac-toe'), '. Lose and it fizzles.'),
        h('p', {}, 'Every level needs points ', h('i', {}, 'and'), ' blasts, so some days the storm just wins. That’s okay. Put the kettle on and try again.')),
      buttons: [{ label: 'Got it', cls: 'primary' }],
    });
  }
}

function onLevelEnd(b, won) {
  const c = b.cfg;
  if (won) {
    const ratio = b.moves / c.moves;
    const stars = 1 + (ratio >= 0.2) + (ratio >= 0.4);
    const coins = 20 + c.n * 5 + (stars - 1) * 10 + b.moves * 2;
    S.coins += coins;
    S.stars[c.n] = Math.max(S.stars[c.n] || 0, stars);
    const firstClear = c.n === S.maxLevel;
    if (firstClear) S.maxLevel++;
    const unlockFarm = !S.farmUnlocked && S.maxLevel > 2;
    if (unlockFarm) S.farmUnlocked = true;
    persist();
    audio.sfx('win');
    setTimeout(() => audio.sfx('coin'), 700);
    showModal({
      title: 'Level cleared!',
      cls: 'win',
      body: h('div', { class: 'center' },
        starRow(stars),
        h('p', { class: 'reward' }, icon('coin', 'ico big'), ` +${coins}`),
        b.moves > 0 && h('p', { class: 'muted' }, `Includes ${b.moves * 2} for ${b.moves} moves left over.`),
        unlockFarm && h('p', { class: 'note' }, 'You hear dripping upstairs… The attic hatch is open! Supplies only grow up there.')),
      buttons: [
        { label: 'Cabin', onClick: () => show('cabin') },
        { label: 'Next level', cls: 'primary', onClick: () => startLevel(c.n + 1) },
      ],
    });
  } else {
    const why = [];
    if (b.score < c.target) why.push(`${c.target - b.score} points short`);
    if (b.blasts < c.blasts) why.push(`needed ${c.blasts - b.blasts} more Storm Blast${c.blasts - b.blasts > 1 ? 's' : ''}`);
    S.coins += 3;
    persist();
    audio.sfx('lose');
    showModal({
      title: 'Out of moves',
      body: h('div', { class: 'center' },
        h('p', {}, why.join(' and ') + '.'),
        h('p', { class: 'muted' }, 'You found 3 coins between the cushions.')),
      buttons: [
        { label: 'Cabin', onClick: () => show('cabin') },
        { label: 'Retry', cls: 'primary', onClick: () => startLevel(c.n) },
      ],
    });
  }
  updateHud();
}

$('#playBtn').addEventListener('click', openPlay);
$('#quitBtn').addEventListener('click', () => {
  if (board.ended) return show('cabin');

if (new URLSearchParams(location.search).has('debug')) window.dang = { S, persist, board, show, updateHud };
  showModal({
    title: 'Leave this level?',
    body: h('p', {}, 'Your progress on this board will be lost.'),
    buttons: [{ label: 'Keep playing' }, { label: 'Leave', cls: 'primary', onClick: () => show('cabin') }],
  });
});

// ---------- farm ----------
function goUpstairs() {
  if (!S.farmUnlocked) return toast('The attic hatch is stuck. Clear level 2 to pry it open.');
  show('farm');
  if (!S.seen.farm) {
    S.seen.farm = true;
    persist();
    showModal({
      title: 'The attic',
      body: h('div', { class: 'howto' },
        h('p', {}, 'The roof leaks like a sieve. Perfect for growing things!'),
        h('p', {}, 'Buy seeds with coins, wait for the rain to do its work, then harvest supplies to decorate the cabin.'),
        h('p', { class: 'muted' }, 'Crops keep growing while you’re away.')),
      buttons: [{ label: 'Let’s grow', cls: 'primary' }],
    });
  }
}
$('#upBtn').addEventListener('click', goUpstairs);
$('#downBtn').addEventListener('click', () => show('cabin'));

// ---------- decorating ----------
function canAfford(d) {
  return S.coins >= d.coins && Object.entries(d.need).every(([k, n]) => S.supplies[k] >= n);
}

function openDecor() {
  const rows = DECOR.map(d => {
    const owned = !!S.decor[d.id];
    const costs = h('span', { class: 'costs' },
      h('span', { class: 'cost' + (S.coins < d.coins ? ' short' : '') }, icon('coin'), d.coins),
      Object.entries(d.need).map(([k, n]) => h('span', { class: 'cost' + (S.supplies[k] < n ? ' short' : '') }, icon(k), n)));
    return h('div', { class: 'shop-row' + (owned ? ' owned' : '') },
      h('div', { class: 'shop-info' }, h('b', {}, d.name), h('small', {}, d.desc), !owned && costs),
      owned
        ? h('span', { class: 'tag' }, 'Placed')
        : h('button', { class: 'btn small primary', disabled: !canAfford(d), onclick: () => buy(d) }, 'Place'));
  });
  showModal({
    title: 'Decorate',
    body: h('div', {},
      !S.farmUnlocked && h('p', { class: 'note' }, 'Decor needs supplies, and supplies only grow in the attic. Clear level 2 to open it.'),
      h('div', { class: 'shop' }, rows)),
    buttons: [{ label: 'Close' }],
  });
}

function buy(d) {
  if (!canAfford(d)) return;
  S.coins -= d.coins;
  for (const [k, n] of Object.entries(d.need)) S.supplies[k] -= n;
  S.decor[d.id] = true;
  persist();
  audio.sfx('coin');
  updateHud();
  $('#modal').hidden = true;
  toast(d.id === 'catbed' ? 'A damp cat wanders in and claims the bed.' : `${d.name} placed. So cozy.`);
}
$('#decorBtn').addEventListener('click', openDecor);

// ---------- install ----------
let installEvt = null;
addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvt = e;
  $('#installBtn').hidden = false;
});
$('#installBtn').addEventListener('click', async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice;
  installEvt = null;
  $('#installBtn').hidden = true;
});
addEventListener('appinstalled', () => ($('#installBtn').hidden = true));

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

show('cabin');

if (new URLSearchParams(location.search).has('debug')) window.dang = { S, persist, board, show, updateHud };
