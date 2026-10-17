import { CHOICES, defaultHero, randomHero, heroSprite, W, H } from './hero.js';
import { fitCanvas } from './pixel.js';
import { $, h } from './ui.js';

const PW = 34, PH = 36;

// Builds the creator into #scr-create. Calls onDone(hero) when confirmed.
export function mountCreator({ initial, editing = false, onDone, onCancel, sfx }) {
  const root = $('#scr-create');
  let hero = { ...(initial || defaultHero('girl')) };
  let raf = 0;

  const canvas = h('canvas', { 'aria-label': 'Character preview' });
  const name = h('input', {
    class: 'name-input', type: 'text', maxlength: 12, placeholder: 'Your name', value: hero.name || '',
    autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false',
    oninput: () => { hero.name = name.value; },
  });
  const list = h('div', { class: 'choices' });

  function cycle(c, dir) {
    const i = c.values.indexOf(hero[c.key]);
    hero[c.key] = c.values[(i + dir + c.values.length) % c.values.length];
    sfx('select');
    render();
  }

  function render() {
    list.replaceChildren(...CHOICES.map(c => {
      const i = Math.max(0, c.values.indexOf(hero[c.key]));
      if (c.key === 'gender') {
        return h('div', { class: 'choice' },
          h('span', { class: 'c-label' }, c.label),
          h('div', { class: 'seg' }, c.values.map((v, j) => h('button', {
            class: 'seg-btn' + (hero.gender === v ? ' on' : ''),
            onclick: () => {
              if (hero.gender === v) return;
              hero = { ...defaultHero(v), name: hero.name, skin: hero.skin };
              sfx('select');
              render();
            },
          }, c.names[j]))));
      }
      return h('div', { class: 'choice' },
        h('span', { class: 'c-label' }, c.label),
        h('div', { class: 'stepper' },
          h('button', { class: 'arrow', 'aria-label': `Previous ${c.label}`, onclick: () => cycle(c, -1) }, '◀'),
          h('span', { class: 'c-value' },
            c.swatch && h('i', { class: 'swatch', style: `background:${c.swatch(c.values[i])}` }),
            c.names ? c.names[i] : `${i + 1}`),
          h('button', { class: 'arrow', 'aria-label': `Next ${c.label}`, onclick: () => cycle(c, 1) }, '▶')));
    }));
  }

  const start = h('button', {
    class: 'btn primary',
    onclick: () => {
      hero.name = name.value.trim() || (hero.gender === 'boy' ? 'Sol' : 'Luna');
      cancelAnimationFrame(raf);
      onDone({ ...hero });
    },
  }, editing ? 'Looks good' : 'Start my first day');

  root.replaceChildren(
    h('div', { class: 'create-head' },
      h('h2', {}, editing ? 'Mirror, mirror' : 'Who’s stuck in the cabin?'),
      h('div', { class: 'preview' }, canvas),
      name),
    list,
    h('div', { class: 'create-foot' },
      editing
        ? h('button', { class: 'btn', onclick: () => { cancelAnimationFrame(raf); onCancel && onCancel(); } }, 'Cancel')
        : null,
      h('button', { class: 'btn', onclick: () => { hero = randomHero({ name: hero.name }); sfx('select'); render(); } }, 'Randomize'),
      start));
  render();

  let ctx;
  requestAnimationFrame(() => { ctx = fitCanvas(canvas, PW, PH).ctx; loop(); });
  function loop() {
    if (!canvas.isConnected) return;
    const now = performance.now();
    ctx.clearRect(0, 0, PW, PH);
    ctx.fillStyle = '#2a1a14'; ctx.fillRect(4, PH - 5, PW - 8, 3);
    ctx.fillStyle = '#4e2e1c'; ctx.fillRect(6, PH - 6, PW - 12, 1);
    const blink = Math.floor(now / 100) % 35 === 0;
    const bob = Math.floor(now / 500) % 2;
    ctx.drawImage(heroSprite(hero, { closed: blink }), (PW - W) / 2, PH - H - 5 - bob);
    raf = requestAnimationFrame(loop);
  }
  return { resize: () => ctx && (ctx = fitCanvas(canvas, PW, PH).ctx) };
}
