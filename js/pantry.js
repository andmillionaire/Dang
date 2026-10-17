import { S, persist } from './state.js';
import { CROPS, BOOSTS } from './data.js';
import { h, icon, showModal, toast } from './ui.js';

const canCraft = b => Object.entries(b.need).every(([k, n]) => S.crops[k] >= n);

// The attic pantry: sell crops for coins, or craft them into mini-game boosts.
export function openPantry({ sfx, changed, tab = 'sell' }) {
  const body = h('div', {});
  const tabs = ['sell', 'craft'].map(t => h('button', { class: 'seg-btn', onclick: () => show(t) }, t === 'sell' ? 'Sell crops' : 'Craft boosts'));

  function sellRows() {
    return Object.entries(CROPS).map(([id, c]) => {
      const n = S.crops[id];
      const sell = k => {
        const q = Math.min(k, S.crops[id]);
        if (!q) return;
        S.crops[id] -= q;
        S.coins += q * c.sell;
        persist();
        changed();
        sfx('coin');
        show('sell');
      };
      return h('div', { class: 'shop-row' },
        h('div', { class: 'shop-ico' }, icon(id, 'ico big')),
        h('div', { class: 'shop-info' }, h('b', {}, `${c.name} ×${n}`), h('small', {}, h('span', { class: 'cost' }, icon('coin'), ` ${c.sell} each`))),
        h('button', { class: 'btn small', disabled: !n, onclick: () => sell(1) }, 'Sell 1'),
        h('button', { class: 'btn small primary', disabled: !n, onclick: () => sell(n) }, `All +${n * c.sell}`));
    });
  }

  function craftRows() {
    return Object.entries(BOOSTS).map(([id, b]) => h('div', { class: 'shop-row' },
      h('div', { class: 'shop-ico boost-ico' }, icon('boost_' + id, 'ico big')),
      h('div', { class: 'shop-info' },
        h('b', {}, `${b.name}`, S.boosts[id] ? h('span', { class: 'owned-count' }, ` ×${S.boosts[id]}`) : ''),
        h('small', {}, b.effect),
        h('span', { class: 'costs' }, Object.entries(b.need).map(([k, n]) => h('span', { class: 'cost' + (S.crops[k] < n ? ' short' : '') }, icon(k), n)))),
      h('button', {
        class: 'btn small primary', disabled: !canCraft(b),
        onclick: () => {
          for (const [k, n] of Object.entries(b.need)) S.crops[k] -= n;
          S.boosts[id] = (S.boosts[id] || 0) + 1;
          persist();
          changed();
          sfx('sparkle');
          toast(`Crafted ${b.name}. Use it before a mini-game.`);
          show('craft');
        },
      }, 'Craft')));
  }

  function show(t) {
    tabs.forEach((b, k) => b.classList.toggle('on', ['sell', 'craft'][k] === t));
    body.replaceChildren(
      t === 'sell'
        ? h('p', { class: 'muted small' }, 'Sell what you grow for coins. Keep some back for decorating and boosts!')
        : h('p', { class: 'muted small' }, 'Boosts help in mini-games. When a charged tile starts a game, you can use one that fits.'),
      h('div', { class: 'shop' }, t === 'sell' ? sellRows() : craftRows()));
  }

  showModal({ title: 'Pantry', body: h('div', {}, h('div', { class: 'seg pantry-tabs' }, tabs), body), buttons: [{ label: 'Close' }] });
  show(tab);
}

// Boosts you own that help in this game ('mew', 'cw+mew', ...). Rainbow Jam fits everything.
export function boostsFor(gameKey) {
  return Object.entries(BOOSTS).filter(([id, b]) => S.boosts[id] > 0 && (b.games.includes(gameKey) || b.games.includes('*')));
}

// Ask whether to spend a boost; resolves to a boost id or null.
export function askBoost(gameKey, gameName) {
  const options = boostsFor(gameKey);
  if (!options.length) return Promise.resolve(null);
  return new Promise(resolve => {
    showModal({
      title: 'Use a boost?',
      body: h('div', {},
        h('p', {}, `Up next: ${gameName}.`),
        h('div', { class: 'shop' }, options.map(([id, b]) => h('div', { class: 'shop-row' },
          h('div', { class: 'shop-ico boost-ico' }, icon('boost_' + id, 'ico big')),
          h('div', { class: 'shop-info' }, h('b', {}, `${b.name} ×${S.boosts[id]}`), h('small', {}, b.effect)),
          h('button', {
            class: 'btn small primary',
            onclick: () => { document.querySelector('#modal').hidden = true; S.boosts[id]--; persist(); resolve(id); },
          }, 'Use'))))),
      buttons: [{ label: 'No boost', onClick: () => resolve(null) }],
    });
  });
}
