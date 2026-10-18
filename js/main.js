import { S, persist } from './state.js';
import { DECOR, CROPS, MATERIALS, LEVELS_PER_DAY, DELIVERY_CONTACT, WALLS, SPOTS_PER_WALL, UNLOCKS, levelConfig } from './data.js';
import { Board } from './match3.js';
import { Cabin } from './cabin.js';
import { Attic, cropProgress, growOvernight } from './farm.js';
import { openPantry, askBoost } from './pantry.js';
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
import { $, h, icon, hydrateIcons, showModal, toast, countTo, confetti, sparkle } from './ui.js';
import { iconURL } from './sprites.js';
import { VERSION } from './version.js';
import { rollLoot, playPlinko, prizeOf, jackpotFx, CHUTES } from './treasure.js';

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
const attic = new Attic($('#farmCanvas'), {
  sfx,
  onHatch: () => show('cabin'),
  changed: () => { updateHud(); attic.hooks.onWall(attic.wall); },
  onWall: w => {
    const spots = S.planters.slice(w * SPOTS_PER_WALL, (w + 1) * SPOTS_PER_WALL);
    const ready = spots.filter(p => p.crop && cropProgress(p) >= 1).length;
    $('#wallLabel').textContent = `${WALLS[w]} wall · ${spots.filter(p => p.level).length}/${SPOTS_PER_WALL} planters${ready ? ` · ${ready} ready` : ''}`;
  },
});
const board = new Board($('#boardCanvas'), {
  sfx,
  buzz: audio.buzz,
  toast,
  onUpdate: updateMatchHud,
  onSpecial: runSpecial,
  onCreate: explainCharged,
  onMagic: explainMagic,
  onEnd: onLevelEnd,
  onTreasure: openTreasure,
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
  countTo($('#coins'), S.coins);
  countTo($('#shards'), S.shards);
  const night = S.phase === 'night';
  $('#dayIcon').src = iconURL(night ? 'moon' : 'sun');
  $('#dayText').textContent = `Day ${S.day}`;
  const inv = [...Object.keys(CROPS), ...Object.keys(MATERIALS)].map(k => h('span', { class: 'res' }, icon(k), h('span', {}, have(k))));
  document.querySelectorAll('.inv').forEach(el => el.replaceChildren(...inv.map(n => n.cloneNode(true))));
  const ready = S.planters.some(p => p.level && p.crop && cropProgress(p) >= 1);
  $('#upBtn').classList.toggle('ping', ready);
  $('#soundBtn img').src = iconURL(S.sound ? 'sndOn' : 'sndOff');
  $('#sleepLabel').textContent = `Day ${S.day + 1}`;
  $('#arcadeBtn').hidden = !S.arcade.owned;
}

function updateMatchHud(b) {
  const c = b.cfg;
  $('#mLevel').textContent = `Level ${c.n}`;
  $('#mMoves').textContent = b.moves;
  $('#mMoves').closest('.pill').classList.toggle('low', b.moves <= 5 && !b.ended);
  $('#mBlasts').textContent = `${b.blasts}/${c.blasts}`;
  $('#mBlastPill').classList.toggle('done', b.blasts >= c.blasts);
  $('#mBar').style.width = Math.min(100, (b.score / c.target) * 100) + '%';
  countTo($('#mScoreNum'), b.score);
  $('#mScoreTarget').textContent = c.target;
  $('#mBar').parentElement.classList.toggle('full', b.score >= c.target);
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
// Every button gives a soft click.
addEventListener('click', e => { if (e.target.closest('.btn, .seg-btn, .chip, .lvl, .contact')) sfx('tap'); }, { capture: true });

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
  $('#mScoreNum').dataset.v = 0;
  $('#mScoreNum').textContent = '0';
  board.start(cfg);
  $('#mBlastPill').hidden = cfg.blasts === 0;
  setTip();
  introduce(n, cfg);
}

// First level: the basics. Levels that unlock something open with a "New!" card.
// Footer hint.
function setTip() {
  $('#mTip').replaceChildren(h('b', {}, 'Swap two charged tiles together'), ' to play a mini-game', board.cfg?.magic?.length ? '. Tap magic tiles to set them off.' : '.');
}

function introduce(n, cfg) {
  if (!S.seen.tutorial) {
    S.seen.tutorial = true;
    persist();
    return showModal({
      title: 'How to match',
      body: h('div', { class: 'howto' },
        h('p', {}, 'Swap neighbouring tiles to line up ', h('b', {}, '3 or more'), '.'),
        h('p', {}, 'Line up ', h('b', {}, '4 in a row'), ' and one tile stays behind as a ', icon('sp_ttt'), h('b', {}, ' charged tile'), '.'),
        h('p', {}, 'Make two and ', h('b', {}, 'swap them together'), ': the board morphs into a tic-tac-toe game against the storm. Win and they ', h('b', {}, 'blast'), ' everything around them.'),
        h('p', {}, 'A charged tile can slide one square in any direction, so you can bring two together.'),
        h('p', {}, cfg.blasts ? `This level needs ${cfg.target} points and ${cfg.blasts} blast.` : `This first level just needs ${cfg.target} points. Have fun!`)),
      buttons: [{ label: 'Got it', cls: 'primary' }],
    });
  }
  const u = UNLOCKS[n];
  if (!u || S.seen['unlock' + n]) return;
  S.seen['unlock' + n] = true;
  persist();
  const g = u.kind && GAMES[u.kind];
  const M = u.magic && MAGIC_INFO[u.magic];
  showModal({
    title: 'New!',
    cls: 'win new-card',
    body: g
      ? h('div', { class: 'howto center' },
        h('p', { class: 'new-icon' }, icon('sp_' + u.kind, 'ico huge')),
        h('p', {}, h('b', {}, g.shape), ' now makes a ', h('b', {}, `${g.name} tile`), '.'),
        h('p', {}, `Swap two together for Supercharged ${g.name}. Win and it ${g.blast}, twice as big.`),
        n >= 3 && h('p', {}, h('b', {}, 'Mashups:'), ' swap it into a different charged tile to play a game that fuses both.'))
      : h('div', { class: 'howto center' },
        h('p', { class: 'new-icon' }, icon('mg_' + u.magic, 'ico huge')),
        h('p', {}, h('b', {}, M.how), ' makes a ', h('b', {}, M.name), ', a magic tile.'),
        h('p', {}, `Tap it, or swap it with any tile, and it ${M.does}. No mini-game needed.`),
        h('p', {}, 'Swap two magic tiles together for a huge combo!')),
    buttons: [{ label: 'Let’s go', cls: 'primary' }],
  });
  requestAnimationFrame(() => sparkle(document.querySelector('#modal .new-icon'), { count: 16 }));
}

const MAGIC_INFO = {
  star: { name: 'Star Bomb', how: 'Two matches from one swap, or a 3-step chain reaction,', does: 'blasts the 3×3 around it' },
  beam: { name: 'Moon Beam', how: '6 in a row, or a 4-step chain reaction,', does: 'fires moonbeams down its row and column' },
  orb: { name: 'Saturn Orb', how: 'A 7-tile match, or a 5-step chain reaction,', does: 'zaps every tile of one colour' },
};

// First time each kind of charged tile appears, say what it does.
function explainCharged(kind) {
  if (S.seen['sp_' + kind]) return;
  S.seen['sp_' + kind] = true;
  persist();
  const g = GAMES[kind];
  toast(`${g.shape}: you made a ${g.name} tile! Make another and swap them together to play.`);
}

function explainMagic(kind) {
  if (S.seen['mg_' + kind]) return;
  S.seen['mg_' + kind] = true;
  persist();
  const M = MAGIC_INFO[kind];
  toast(`You made a ${M.name}! Tap it or swap it and it ${M.does}.`);
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
  const boost = await askBoost(game.key, game.name);
  const quit = $('#quitBtn');
  quit.disabled = true;
  $('#mTip').textContent = kinds.length > 1 ? `Mashup! The board is turning into ${game.name}!` : `The board is turning into ${game.name}!`;
  await b.morph(1);
  screens.match.classList.add('mg-open');
  const box = $('#morph');
  box.hidden = false;
  const playOnce = async () => {
    let r = await game.play({ root: box, difficulty: b.cfg.difficulty, sfx, boost });
    if (r === 'draw' && p.tieWins) { toast('Saturn Guardian: a tie counts as a win!'); r = 'win'; }
    return r;
  };
  let res = await playOnce();
  if (res !== 'win' && p.retry && !run.retryUsed) {
    run.retryUsed = true;
    toast('The Saturn Crystal glows. One more try!');
    res = await playOnce();
  }
  if (res !== 'win' && boost === 'jam') {
    toast('A spoonful of Rainbow Jam. Second chance!');
    res = await playOnce();
  }
  box.hidden = true;
  box.replaceChildren();
  screens.match.classList.remove('mg-open');
  await b.morph(0);
  quit.disabled = false;
  setTip();
  if (res === 'win') {
    S.stats.miniWins++;
    S.stats.blasts += kinds.length;
    S.shards += kinds.length;
    persist();
    updateHud();
  }
  return res;
}

// A treasure chest reached the bottom: loot, then the bonus Plinko ball.
async function openTreasure(b) {
  const loot = rollLoot();
  S.coins += loot.coins;
  S.mats.lumber += loot.lumber;
  S.mats.fabric += loot.fabric;
  S.mats.kit += loot.kit;
  S.seeds[loot.seed] = (S.seeds[loot.seed] || 0) + loot.seedN;
  S.stats.chests = (S.stats.chests || 0) + 1;
  persist();
  updateHud();
  const quit = $('#quitBtn');
  quit.disabled = true;
  await b.morph(1);
  screens.match.classList.add('mg-open');
  const box = $('#morph');
  box.hidden = false;
  const chute = await playPlinko(box, { sfx, loot });
  const prize = prizeOf(chute);
  S.coins += prize.coins || 0;
  S.shards += prize.shards || 0;
  S.mats.lumber += prize.lumber || 0;
  S.mats.fabric += prize.fabric || 0;
  S.mats.kit += prize.kit || 0;
  if (prize.seeds) for (const k of Object.keys(S.seeds)) S.seeds[k] += prize.seeds;
  persist();
  updateHud();
  if (CHUTES[chute].prize.mega) {
    S.stats.jackpots = (S.stats.jackpots || 0) + 1;
    persist();
    await jackpotFx(sfx);
  } else {
    toast(`Bonus: ${[prize.coins && `${prize.coins} coins`, prize.shards && `${prize.shards} star shards`, prize.lumber && `${prize.lumber} lumber`, prize.fabric && `${prize.fabric} fabric`, prize.seeds && `${prize.seeds} of every seed`].filter(Boolean).join(', ')}!`);
  }
  box.hidden = true;
  box.replaceChildren();
  screens.match.classList.remove('mg-open');
  await b.morph(0);
  quit.disabled = false;
}

// Level-cleared fanfare: confetti, a chime per star, coins counting up.
function celebrate(stars, coins) {
  confetti();
  audio.buzz([30, 40, 30]);
  document.querySelectorAll('#modal .stars .ico').forEach((star, i) => {
    if (i >= stars) return;
    setTimeout(() => { sfx('place'); sparkle(star, { count: 8 }); }, 250 + i * 180);
  });
  setTimeout(() => { const el = document.querySelector('#modal .reward .count'); if (el) countTo(el, coins); }, 300 + stars * 180);
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
        h('p', { class: 'reward' }, icon('coin', 'ico big'), ' +', h('span', { class: 'count', 'data-v': 0 }, '0'), '  ', icon('shard', 'ico big'), ` +${shards}`),
        h('p', { class: 'muted' }, dayOver ? 'That’s enough storm-fighting for one day.' : `${LEVELS_PER_DAY - S.today.played} more level${LEVELS_PER_DAY - S.today.played > 1 ? 's' : ''} before dark.`)),
      buttons: dayOver ? [home] : [{ label: 'Call it a day', onClick: nightfall }, { label: 'Next level', cls: 'primary', onClick: () => startLevel(S.maxLevel) }],
    });
    celebrate(stars, coins);
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
$('#wallPrev').addEventListener('click', () => attic.turn(-1));
$('#wallNext').addEventListener('click', () => attic.turn(1));
$('#pantryBtn').addEventListener('click', () => openPantry({ sfx, changed: () => { updateHud(); attic.hooks.onWall(attic.wall); } }));
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
