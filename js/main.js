import { S, persist } from './state.js';
import { DECOR, CROPS, MATERIALS, LEVELS_PER_DAY, DELIVERY_CONTACT, levelConfig } from './data.js';
import { Board } from './match3.js';
import { Cabin } from './cabin.js';
import { Attic, cropProgress, growOvernight } from './farm.js';
import { Bedroom } from './bedroom.js';
import { mountCreator } from './creator.js';
import { openPhone } from './phone.js';
import { openWardrobe } from './wardrobe.js';
import { mountArcade } from './arcade/arcade.js';
import { petArrives, petSound } from './pet.js';
import { GAMES, gameFor } from './minigames/index.js';
import { perks, kid } from './hero.js';
import { startBgRain } from './bgrain.js';
import { sleep } from './pixel.js';
import * as audio from './audio.js';
import { $, h, icon, hydrateIcons, showModal, toast } from './ui.js';
import { iconURL } from './sprites.js';
import { VERSION } from './version.js';

const sfx = audio.sfx;
audio.setSound(S.sound);
hydrateIcons();
startBgRain($('#bgRain'));
$('#version').textContent = `v${VERSION}`;

// ---------- screens ----------
const screens = { create: $('#scr-create'), bedroom: $('#scr-bedroom'), cabin: $('#scr-cabin'), match: $('#scr-match'), farm: $('#scr-farm'), arcade: $('#scr-arcade') };
let current = null, creator = null, arcade = null;

const bedroom = new Bedroom($('#bedroomCanvas'), { sfx });
const cabin = new Cabin($('#cabinCanvas'), {
  sfx,
  onLadder: () => show('farm'),
  onPet: () => { sfx(petSound()); toast(S.pet.kind === 'dog' ? `${S.pet.name} thumps their tail sleepily.` : `${S.pet.name} purrs without opening an eye.`); },
  onHero: () => sfx('sparkle'),
  onArcade: openArcade,
});
const attic = new Attic($('#farmCanvas'), { sfx, onHatch: () => show('cabin'), changed: updateHud });
const board = new Board($('#boardCanvas'), {
  sfx,
  toast,
  onUpdate: updateMatchHud,
  onSpecial: runSpecial,
  onCreate: explainCharged,
  onEnd: onLevelEnd,
});

function show(name) {
  current = name;
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('active', k === name);
  bedroom.setActive(name === 'bedroom');
  cabin.setActive(name === 'cabin');
  attic.setActive(name === 'farm');
  if (name !== 'match') board.stop();
  if (name !== 'arcade' && arcade) { arcade.stop(); arcade = null; }
  updateHud();
}

addEventListener('resize', () => { bedroom.resize(); cabin.resize(); attic.resize(); board.resize(); creator && creator.resize(); });

// ---------- HUD ----------
const have = k => (k in S.mats ? S.mats[k] : S.crops[k]);

function updateHud() {
  $('#hud').hidden = current === 'create';
  $('#coins').textContent = S.coins;
  $('#shards').textContent = S.shards;
  const night = S.phase === 'night';
  $('#dayIcon').src = iconURL(night ? 'moon' : 'sun');
  $('#dayText').textContent = `Day ${S.day}`;
  const inv = [...Object.keys(CROPS), ...Object.keys(MATERIALS)].map(k => h('span', { class: 'res' }, icon(k), h('span', {}, have(k))));
  document.querySelectorAll('.inv').forEach(el => el.replaceChildren(...inv.map(n => n.cloneNode(true))));
  const ready = S.plots.slice(0, S.plotsOwned).some(p => p.crop && cropProgress(p) >= 1);
  $('#upBtn').classList.toggle('ping', ready);
  $('#soundBtn img').src = iconURL(S.sound ? 'sndOn' : 'sndOff');
  $('#sleepLabel').textContent = `Day ${S.day + 1}`;
  $('#arcadeBtn').hidden = !S.arcade.owned;
}

function updateMatchHud(b) {
  const c = b.cfg;
  $('#mLevel').textContent = `Level ${c.n}`;
  $('#mMoves').textContent = b.moves;
  $('#mBlasts').textContent = `${b.blasts}/${c.blasts}`;
  $('#mBlastPill').classList.toggle('done', b.blasts >= c.blasts);
  $('#mBar').style.width = Math.min(100, (b.score / c.target) * 100) + '%';
  $('#mScore').textContent = `${b.score} / ${c.target}`;
  $('#mDay').textContent = `Day ${S.day} · level ${S.today.played} of ${LEVELS_PER_DAY} today`;
}

$('#soundBtn').addEventListener('click', () => {
  S.sound = !S.sound;
  persist();
  audio.setSound(S.sound);
  updateHud();
});

// Audio may only start after a user gesture.
addEventListener('pointerdown', () => audio.initAudio(), { capture: true });

// Full-screen title card between phases. Tap to skip.
function interlude({ iconName, title, text }) {
  const el = $('#interlude');
  el.replaceChildren(icon(iconName, 'ico huge'), h('h2', {}, title), h('p', {}, text));
  el.hidden = false;
  return new Promise(res => {
    const done = () => { clearTimeout(t); el.removeEventListener('click', done); el.hidden = true; res(); };
    const t = setTimeout(done, 2600);
    el.addEventListener('click', done);
  });
}

// ---------- character ----------
function openCreator(editing) {
  show('create');
  creator = mountCreator({
    initial: S.hero,
    editing,
    sfx,
    onDone: hero => {
      const first = !S.hero;
      S.hero = hero;
      persist();
      creator = null;
      if (first) morning();
      else { show('cabin'); toast('Looking good!'); }
    },
    onCancel: () => { creator = null; show('cabin'); },
  });
}

// ---------- morning ----------
async function morning() {
  S.phase = 'morning';
  persist();
  show('bedroom');
  const rise = $('#riseBtn');
  rise.disabled = true;
  $('#morningText').textContent = `Day ${S.day}. It’s still raining.`;
  await bedroom.wake();
  rise.disabled = false;
  $('#morningText').textContent = `Day ${S.day}. Time to match! Up to ${LEVELS_PER_DAY} levels before dark.`;
  if (!S.seen.intro) {
    S.seen.intro = true;
    persist();
    showModal({
      title: `Good morning, ${S.hero.name}!`,
      body: h('div', { class: 'howto' },
        h('p', {}, 'You live in a little cabin where it never, ever stops raining.'),
        h('p', {}, h('b', {}, 'By day'), ', you transform and battle the storm in match puzzles.'),
        h('p', {}, h('b', {}, 'By night'), `, you phone ${DELIVERY_CONTACT} for supplies, grow crops in the leaky attic and make the cabin cozy.`),
        h('p', {}, 'Win star shards to unlock ', kid(), ' outfits. Legend says a set from Saturn is out there…')),
      buttons: [{ label: 'Let’s go', cls: 'primary' }],
    });
  }
}

$('#riseBtn').addEventListener('click', async () => {
  $('#riseBtn').disabled = true;
  S.phase = 'day';
  persist();
  await bedroom.transform();
  startLevel(S.maxLevel);
});

// ---------- the day: match levels ----------
let run = null;

function startLevel(n) {
  const p = perks();
  const base = levelConfig(n);
  const cfg = {
    ...base,
    moves: base.moves + p.extraMoves,
    bigBlasts: p.bigBlasts,
    scoreMult: p.scoreMult,
    wand: p.wand,
    difficulty: Math.max(0, base.difficulty - p.easier),
  };
  run = { perks: p, glaiveUsed: false, retryUsed: false };
  S.today.played++;
  persist();
  show('match');
  board.start(cfg);
  if (!S.seen.tutorial) {
    S.seen.tutorial = true;
    persist();
    showModal({
      title: 'How to match',
      body: h('div', { class: 'howto' },
        h('p', {}, 'Swap neighbouring tiles to line up 3 or more.'),
        h('p', {}, 'Bigger shapes leave behind a ', h('b', {}, 'charged tile'), ':'),
        h('ul', { class: 'shapes' }, Object.entries(GAMES).map(([k, g]) => h('li', {}, icon('sp_' + k), h('span', {}, h('b', {}, g.shape), ` → ${g.name}`)))),
        h('p', {}, h('b', {}, 'Tap'), ' a charged tile and the board morphs into its game. Win and it ', h('b', {}, 'blasts'), '. ', h('b', {}, 'Swipe two together'), ' for a mashup game.'),
        h('p', {}, 'Every level needs points ', h('i', {}, 'and'), ' blasts. Lose a level and the day is over.')),
      buttons: [{ label: 'Got it', cls: 'primary' }],
    });
  }
}

// First time each kind of charged tile appears, say what it does.
function explainCharged(kind) {
  if (S.seen['sp_' + kind]) return;
  S.seen['sp_' + kind] = true;
  persist();
  const g = GAMES[kind];
  toast(`${g.shape}: you made a ${g.name} tile! Tap it to play. Win and it ${g.blast}.`);
}

async function runSpecial(b, kinds) {
  const p = run.perks;
  if (p.glaive && !run.glaiveUsed) {
    run.glaiveUsed = true;
    sfx('glaive');
    toast('Saturn Glaive! It cuts straight through the storm.');
    await sleep(800);
    S.stats.blasts += kinds.length;
    persist();
    return 'win';
  }
  const game = gameFor(kinds);
  const quit = $('#quitBtn');
  quit.disabled = true;
  $('#mTip').textContent = kinds.length > 1 ? `Mashup! The board is turning into ${game.name}!` : `The board is turning into ${game.name}!`;
  await b.morph(1);
  const box = $('#morph');
  box.hidden = false;
  const playOnce = async () => {
    let r = await game.play({ root: box, difficulty: b.cfg.difficulty, sfx });
    if (r === 'draw' && p.tieWins) { toast('Saturn Guardian: a tie counts as a win!'); r = 'win'; }
    return r;
  };
  let res = await playOnce();
  if (res !== 'win' && p.retry && !run.retryUsed) {
    run.retryUsed = true;
    toast('The Saturn Crystal glows. One more try!');
    res = await playOnce();
  }
  box.hidden = true;
  box.replaceChildren();
  await b.morph(0);
  quit.disabled = false;
  $('#mTip').replaceChildren(h('b', {}, 'Tap'), ' a charged tile to play it, or swipe two together');
  if (res === 'win') {
    S.stats.miniWins++;
    S.stats.blasts += kinds.length;
    S.shards += kinds.length;
    persist();
    updateHud();
  }
  return res;
}

function starRow(n) {
  return h('span', { class: 'stars' }, [1, 2, 3].map(i => icon(i <= n ? 'star' : 'starOff')));
}

function onLevelEnd(b, won) {
  const c = b.cfg;
  const dayOver = !won || S.today.played >= LEVELS_PER_DAY;
  const home = { label: 'Head home', cls: dayOver ? 'primary' : '', onClick: nightfall };
  if (won) {
    const ratio = b.moves / c.moves;
    const stars = 1 + (ratio >= 0.2) + (ratio >= 0.4);
    const coins = 20 + c.n * 5 + (stars - 1) * 10 + b.moves * 2 + run.perks.bonusCoins;
    const shards = 1 + (stars === 3 ? 1 : 0);
    S.coins += coins;
    S.today.earned += coins;
    S.shards += shards;
    S.stars[c.n] = Math.max(S.stars[c.n] || 0, stars);
    if (c.n === S.maxLevel) S.maxLevel++;
    persist();
    sfx('win');
    setTimeout(() => sfx('coin'), 700);
    showModal({
      title: 'Level cleared!',
      cls: 'win',
      body: h('div', { class: 'center' },
        starRow(stars),
        h('p', { class: 'reward' }, icon('coin', 'ico big'), ` +${coins}  `, icon('shard', 'ico big'), ` +${shards}`),
        h('p', { class: 'muted' }, dayOver ? 'That’s enough storm-fighting for one day.' : `${LEVELS_PER_DAY - S.today.played} more level${LEVELS_PER_DAY - S.today.played > 1 ? 's' : ''} before dark.`)),
      buttons: dayOver ? [home] : [{ label: 'Call it a day', onClick: nightfall }, { label: 'Next level', cls: 'primary', onClick: () => startLevel(S.maxLevel) }],
    });
  } else {
    const why = [];
    if (b.score < c.target) why.push(`${c.target - b.score} points short`);
    if (b.blasts < c.blasts) why.push(`needed ${c.blasts - b.blasts} more Storm Blast${c.blasts - b.blasts > 1 ? 's' : ''}`);
    S.coins += 3;
    S.today.earned += 3;
    persist();
    sfx('lose');
    showModal({
      title: 'The storm wins today',
      body: h('div', { class: 'center' },
        h('p', {}, why.join(' and ') + '.'),
        h('p', { class: 'muted' }, 'You found 3 coins between the cushions. Try level ' + c.n + ' again tomorrow.')),
      buttons: [home],
    });
  }
  updateHud();
}

$('#quitBtn').addEventListener('click', () => {
  if (board.ended) return;
  showModal({
    title: 'Call it a day?',
    body: h('p', {}, 'This board counts as a loss and night falls.'),
    buttons: [{ label: 'Keep playing' }, { label: 'Head home', cls: 'primary', onClick: () => { board.stop(); nightfall(); } }],
  });
});

// ---------- night ----------
async function nightfall() {
  S.phase = 'night';
  persist();
  await interlude({ iconName: 'moon', title: `Night falls on day ${S.day}`, text: `You earned ${S.today.earned} coins today.` });
  show('cabin');
  if (await maybePet()) return;
  if (!S.seen.night) {
    S.seen.night = true;
    persist();
    showModal({
      title: 'Evening in the cabin',
      body: h('div', { class: 'howto' },
        h('p', {}, h('b', {}, 'Phone'), `: call ${DELIVERY_CONTACT} to buy seeds, lumber, fabric and planter kits with today’s coins.`),
        h('p', {}, h('b', {}, 'Upstairs'), ': plant seeds in the attic. The leaky roof waters them while you sleep.'),
        h('p', {}, h('b', {}, 'Decorate'), ': build furniture from lumber, fabric and your crops.'),
        h('p', {}, h('b', {}, 'Wardrobe'), ': spend star shards on outfits with special powers.'),
        h('p', {}, 'When you’re ready, go to ', h('b', {}, 'sleep'), '.')),
      buttons: [{ label: 'Cozy', cls: 'primary' }],
    });
  }
}

// From night 2 on, if you don't have a pet yet, something scratches at the door.
async function maybePet() {
  if (S.pet || S.day < 2 || !S.hero) return false;
  await sleep(700);
  await petArrives({ sfx });
  updateHud();
  return true;
}

async function goToSleep() {
  showModal({
    title: 'Go to bed?',
    body: h('p', {}, 'Crops grow overnight. Tomorrow it’s back to matching.'),
    buttons: [
      { label: 'Not yet' },
      {
        label: 'Sleep', cls: 'primary',
        onClick: async () => {
          growOvernight();
          S.day++;
          S.today = { played: 0, earned: 0 };
          persist();
          await interlude({ iconName: 'moon', title: 'Zzz…', text: 'Rain drums on the roof all night. The attic drinks it up.' });
          morning();
        },
      },
    ],
  });
}

$('#phoneBtn').addEventListener('click', () => openPhone({ sfx, changed: updateHud }));
$('#upBtn').addEventListener('click', () => show('farm'));
$('#downBtn').addEventListener('click', () => show('cabin'));
$('#decorBtn').addEventListener('click', openDecor);
$('#wardBtn').addEventListener('click', () => openWardrobe({ sfx, changed: updateHud, onMirror: () => { $('#modal').hidden = true; openCreator(true); } }));
$('#sleepBtn').addEventListener('click', goToSleep);
$('#arcadeBtn').addEventListener('click', openArcade);

function openArcade() {
  show('arcade');
  arcade = mountArcade({ sfx, changed: updateHud, onExit: () => { arcade = null; show('cabin'); } });
}

// ---------- decorating ----------
const canAfford = d => Object.entries(d.need).every(([k, n]) => have(k) >= n);

function openDecor() {
  const rows = DECOR.map(d => {
    const owned = !!S.decor[d.id];
    const costs = h('span', { class: 'costs' },
      Object.entries(d.need).map(([k, n]) => h('span', { class: 'cost' + (have(k) < n ? ' short' : '') }, icon(k), n)));
    return h('div', { class: 'shop-row' + (owned ? ' owned' : '') },
      h('div', { class: 'shop-info' }, h('b', {}, d.name), h('small', {}, d.desc), !owned && costs),
      owned
        ? h('span', { class: 'tag' }, 'Placed')
        : h('button', { class: 'btn small primary', disabled: !canAfford(d), onclick: () => buy(d) }, 'Build'));
  });
  showModal({
    title: 'Decorate',
    body: h('div', {},
      h('p', { class: 'muted small' }, `Lumber and fabric come from ${DELIVERY_CONTACT}. Crops come from the attic.`),
      h('div', { class: 'shop' }, rows)),
    buttons: [{ label: 'Close' }],
  });
}

function buy(d) {
  if (!canAfford(d)) return;
  for (const [k, n] of Object.entries(d.need)) {
    if (k in S.mats) S.mats[k] -= n; else S.crops[k] -= n;
  }
  S.decor[d.id] = true;
  persist();
  sfx('coin');
  updateHud();
  $('#modal').hidden = true;
  toast(d.id === 'catbed' && S.pet ? `${S.pet.name} claims the bed immediately.` : `${d.name} built. So cozy.`);
}

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

// ---------- boot ----------
if (!S.hero) openCreator(false);
else if (S.phase === 'night') { show('cabin'); maybePet(); }
else morning();

if (new URLSearchParams(location.search).has('debug')) {
  window.dang = { S, persist, board, show, updateHud, startLevel, nightfall, morning };
}
