import { S, persist } from './state.js';
import { WARDROBE, SLOTS, SATURN_SET } from './data.js';
import { drawHero, unlockMet, unlockText, fullSaturn, kid, W, H } from './hero.js';
import { fitCanvas } from './pixel.js';
import { h, icon, showModal } from './ui.js';

const PW = 40, PH = 44;

export function openWardrobe({ sfx, changed, onMirror }) {
  const canvas = h('canvas', { class: 'portrait' });
  const list = h('div', { class: 'wardrobe' });
  const shards = h('span', { class: 'cost' });
  const saturn = h('small', { class: 'saturn' });
  let sparkAt = 0;

  function render() {
    shards.replaceChildren(icon('shard'), ` ${S.shards} star shards`);
    const worn = SATURN_SET.filter(id => Object.values(S.wardrobe.equip).includes(id)).length;
    saturn.className = 'saturn' + (fullSaturn() ? ' on' : '');
    saturn.textContent = fullSaturn() ? 'Saturn Awakening: +25% points' : `Saturn set ${worn}/4 worn`;
    list.replaceChildren(...Object.entries(SLOTS).map(([slot, label]) => {
      const items = WARDROBE.filter(w => w.slot === slot);
      return h('div', { class: 'slot' },
        h('p', { class: 'slot-label' }, label),
        items.map(item => {
          const owned = !!S.wardrobe.owned[item.id];
          const worn = S.wardrobe.equip[slot] === item.id;
          const open = unlockMet(item);
          let action;
          if (worn) {
            action = slot === 'outfit'
              ? h('span', { class: 'tag' }, 'Wearing')
              : h('button', { class: 'btn small', onclick: () => { S.wardrobe.equip[slot] = null; save(); } }, 'Take off');
          } else if (owned) {
            action = h('button', { class: 'btn small primary', onclick: () => { S.wardrobe.equip[slot] = item.id; sparkAt = performance.now(); sfx('sparkle'); save(); } }, 'Wear');
          } else if (!open) {
            action = h('span', { class: 'tag locked' }, 'Locked');
          } else {
            action = h('button', {
              class: 'btn small primary', disabled: S.shards < item.cost,
              onclick: () => {
                S.shards -= item.cost;
                S.wardrobe.owned[item.id] = true;
                S.wardrobe.equip[slot] = item.id;
                sparkAt = performance.now();
                sfx('sparkle');
                save();
              },
            }, icon('shard'), ` ${item.cost}`);
          }
          return h('div', { class: `ward-row ${item.rarity}` + (worn ? ' worn' : '') },
            h('div', { class: 'shop-info' },
              h('b', {}, item.name, ' ', h('span', { class: 'rarity' }, item.rarity)),
              h('small', {}, item.perk),
              !owned && item.unlock && h('small', { class: open ? 'unlocked' : 'req' }, open ? 'Unlocked!' : unlockText(item))),
            action);
        }));
    }));
  }

  function save() {
    persist();
    changed();
    render();
  }

  showModal({
    title: 'Wardrobe',
    cls: 'wide',
    body: h('div', {},
      h('div', { class: 'ward-top' },
        h('div', { class: 'portrait-wrap' }, canvas),
        h('div', { class: 'ward-side' },
          h('b', { class: 'hero-name' }, S.hero.name),
          h('small', { class: 'muted' }, `Rainy-day ${kid()}`),
          shards,
          h('small', { class: 'muted' }, 'Earn shards by winning levels and mini-games.'),
          saturn,
          h('button', { class: 'btn small', onclick: () => onMirror() }, 'Change my look'))),
      list),
    buttons: [{ label: 'Done' }],
  });
  render();

  let ctx;
  requestAnimationFrame(() => { ctx = fitCanvas(canvas, PW, PH).ctx; loop(); });
  function loop() {
    if (!canvas.isConnected) return;
    const now = performance.now();
    ctx.clearRect(0, 0, PW, PH);
    ctx.fillStyle = fullSaturn() ? '#2a1840' : '#2a1a14';
    ctx.fillRect(0, 0, PW, PH);
    ctx.fillStyle = '#4e2e1c'; ctx.fillRect(6, PH - 5, PW - 12, 2);
    drawHero(ctx, (PW - W) / 2, PH - H - 5 - (Math.floor(now / 600) % 2), { now });
    const t = now - sparkAt;
    if (t < 900) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + t / 200, r = 3 + t / 45;
        ctx.fillStyle = ['#ffe27a', '#f08ab0', '#a46ad0'][i % 3];
        ctx.fillRect(Math.round(PW / 2 + Math.cos(a) * r), Math.round(PH / 2 + Math.sin(a) * r), 1, 1);
      }
      ctx.fillStyle = `rgba(255,244,224,${Math.max(0, 0.6 - t / 600)})`;
      ctx.fillRect(0, 0, PW, PH);
    }
    requestAnimationFrame(loop);
  }
}
