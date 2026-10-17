import { S, persist } from './state.js';
import { CATALOG, KIT_COSTS, DELIVERY_CONTACT } from './data.js';
import { $, h, icon, showModal, toast } from './ui.js';
import { sleep } from './pixel.js';

const pick = a => a[(Math.random() * a.length) | 0];

const GREETINGS = [
  'Hey, it’s Jeff. Still raining up there? Figures. What do you need?',
  'You again! I love a loyal customer. What can I drone over tonight?',
  'Jeff speaking. We deliver anywhere, even into a thunderstorm. What’ll it be?',
  'Ah, the cabin kid. Same-night delivery, as always. Go ahead.',
];
const SHIPPED = [
  'On its way. The drone has a tiny umbrella.',
  'Done. Same-night delivery, no questions asked.',
  'Shipped! Leave the drone a five-star review.',
  'Packing it myself. Kidding. It’s already on the porch.',
];
const MOM = [
  'Hi sweetie, it’s Mom. Are you eating? Is it still raining? Call me back!',
  'Mom again. I saw the forecast for your area. It just says “yes”. Love you!',
  'It’s Mom. Your aunt says rain is good for the skin. Stay cozy!',
];

const kitPrice = () => KIT_COSTS[S.plotsOwned + S.mats.kit] ?? null;
const priceOf = item => (item.id === 'kit' ? kitPrice() : item.price);

export function openPhone({ sfx, changed }) {
  const screen = h('div', { class: 'phone-screen' });
  const close = showModal({
    cls: 'phone',
    body: h('div', { class: 'phone-body' },
      h('div', { class: 'phone-top' }, h('span', {}, `Day ${S.day}`), h('span', {}, 'Night'), h('span', { class: 'bars' }, '▮▮▯')),
      screen),
    buttons: [{ label: 'Hang up' }],
  });

  function contacts() {
    screen.replaceChildren(
      h('p', { class: 'phone-title' }, 'Contacts'),
      h('button', { class: 'contact', onclick: call }, h('b', {}, DELIVERY_CONTACT), h('small', {}, 'Delivery, any hour, any weather')),
      h('button', { class: 'contact', onclick: mom }, h('b', {}, 'Mom'), h('small', {}, '1 new voicemail')),
    );
  }

  async function mom() {
    screen.replaceChildren(h('p', { class: 'phone-title' }, 'Voicemail'), h('p', { class: 'speech' }, pick(MOM)),
      h('button', { class: 'btn small', onclick: contacts }, 'Back'));
  }

  async function call() {
    screen.replaceChildren(h('p', { class: 'phone-title' }, `Calling ${DELIVERY_CONTACT}…`), h('p', { class: 'ringing' }, '☎'));
    sfx('ring');
    await sleep(1300);
    if (!screen.isConnected) return;
    catalog(pick(GREETINGS));
  }

  function catalog(line) {
    const cart = {};
    const total = () => CATALOG.reduce((t, it) => t + (cart[it.id] || 0) * (priceOf(it) || 0), 0);
    const totalEl = h('b');
    const order = h('button', { class: 'btn primary', onclick: () => place(cart, total()) }, 'Place order');
    const rows = CATALOG.map(it => {
      const qty = h('span', { class: 'qty' }, '0');
      const max = it.id === 'kit' ? (kitPrice() === null ? 0 : 1) : 20;
      const step = d => {
        const next = Math.max(0, Math.min(max, (cart[it.id] || 0) + d));
        if (d > 0 && total() + (priceOf(it) || 0) > S.coins) { sfx('nope'); return; }
        cart[it.id] = next;
        qty.textContent = next;
        sfx('select');
        refresh();
      };
      const price = priceOf(it);
      return h('div', { class: 'cat-row' },
        icon(it.icon, 'ico big'),
        h('div', { class: 'shop-info' },
          h('b', {}, it.name),
          h('small', {}, price === null ? 'Sold out: the attic is full' : it.note)),
        h('span', { class: 'cost' }, icon('coin'), price === null ? '–' : price),
        h('div', { class: 'stepper small' },
          h('button', { class: 'arrow', 'aria-label': `Fewer ${it.name}`, onclick: () => step(-1) }, '−'),
          qty,
          h('button', { class: 'arrow', 'aria-label': `More ${it.name}`, disabled: !max, onclick: () => step(1) }, '+')));
    });
    function refresh() {
      totalEl.textContent = total();
      order.disabled = total() === 0 || total() > S.coins;
    }
    screen.replaceChildren(
      h('p', { class: 'speech' }, line),
      h('div', { class: 'catalog' }, rows),
      h('div', { class: 'order-bar' }, h('span', {}, 'Total ', icon('coin'), ' ', totalEl, ` of ${S.coins}`), order));
    refresh();
  }

  async function place(cart, cost) {
    if (!cost || cost > S.coins) return;
    S.coins -= cost;
    for (const [id, q] of Object.entries(cart)) {
      if (!q) continue;
      if (id.startsWith('seed:')) S.seeds[id.slice(5)] += q;
      else S.mats[id] += q;
    }
    persist();
    changed();
    sfx('coin');
    screen.replaceChildren(h('p', { class: 'speech' }, pick(SHIPPED)), h('p', { class: 'phone-title' }, 'Call ended'));
    await sleep(1400);
    if ($('#modal').contains(screen)) close();
    sfx('doorbell');
    toast('Ding-dong! A soggy box is on the porch. Supplies added.');
  }

  contacts();
}
