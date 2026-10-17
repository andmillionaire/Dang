import { $, h } from './ui.js';
import { fitCanvas, sleep } from './pixel.js';

// Visual-novel overlay: a pixel scene on top, a dialogue box below.
// drawScene(ctx, now) paints a W x H logical scene each frame.
export function openVN({ drawScene, w = 96, h: H = 72, sfx }) {
  const root = $('#vn');
  const canvas = h('canvas', { class: 'vn-scene' });
  const name = h('span', { class: 'vn-name' });
  const text = h('p', { class: 'vn-text' });
  const extra = h('div', { class: 'vn-extra' });
  const more = h('span', { class: 'vn-more' }, '▼');
  const box = h('div', { class: 'vn-box' }, name, text, extra, more);
  root.replaceChildren(h('div', { class: 'vn-stage' }, canvas), box);
  root.hidden = false;

  let ctx, alive = true;
  requestAnimationFrame(() => { ctx = fitCanvas(canvas, w, H).ctx; loop(); });
  function loop() {
    if (!alive) return;
    drawScene(ctx, performance.now());
    requestAnimationFrame(loop);
  }

  // Typewriter text; a tap finishes the line early.
  async function type(speaker, line) {
    name.textContent = speaker || '';
    name.hidden = !speaker;
    extra.replaceChildren();
    more.hidden = true;
    text.textContent = '';
    let skip = false;
    const hurry = () => (skip = true);
    box.addEventListener('pointerdown', hurry);
    for (let i = 0; i < line.length && !skip; i++) {
      text.textContent = line.slice(0, i + 1);
      if (i % 2 === 0 && line[i] !== ' ') sfx('blip');
      await sleep(line[i] === '.' || line[i] === '…' ? 120 : 18);
    }
    text.textContent = line;
    box.removeEventListener('pointerdown', hurry);
  }

  return {
    async say(speaker, line) {
      await type(speaker, line);
      more.hidden = false;
      await new Promise(res => box.addEventListener('pointerup', res, { once: true }));
      sfx('select');
    },
    async choose(speaker, line, options) {
      await type(speaker, line);
      return new Promise(res => extra.replaceChildren(...options.map((o, i) =>
        h('button', { class: 'btn vn-choice', onclick: () => { sfx('select'); res(i); } }, o))));
    },
    async ask(speaker, line, { suggestions = [], placeholder = '' } = {}) {
      await type(speaker, line);
      return new Promise(res => {
        const input = h('input', { class: 'name-input', maxlength: 12, placeholder, autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false' });
        const ok = h('button', { class: 'btn primary', onclick: () => { const v = input.value.trim(); if (v) { sfx('select'); res(v); } else input.focus(); } }, 'That’s their name');
        input.addEventListener('keydown', e => { if (e.key === 'Enter') ok.click(); });
        extra.replaceChildren(input,
          h('div', { class: 'vn-suggest' }, suggestions.map(s => h('button', { class: 'chip', onclick: () => { input.value = s; sfx('select'); } }, s))),
          ok);
      });
    },
    close() {
      alive = false;
      root.hidden = true;
      root.replaceChildren();
    },
  };
}
