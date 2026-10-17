import { h, icon } from '../ui.js';
import { sleep } from '../pixel.js';

// Shared chrome for every mini-game: title, one-line how-to, info bar, play area, status line.
export function mount(root, { title, tip }) {
  const status = h('p', { class: 'mg-status' });
  const info = h('div', { class: 'mg-info' });
  const body = h('div', { class: 'mg-body' });
  const wrap = h('div', { class: 'mg' },
    h('div', { class: 'mg-head' }, h('h3', {}, icon('bolt'), ` ${title}`), h('p', { class: 'mg-tip' }, tip)),
    info, body, status);
  root.replaceChildren(wrap);
  return { wrap, body, info, status: t => (status.textContent = t) };
}

export async function banner(ui, res, msg) {
  const win = res === 'win';
  ui.wrap.append(h('div', { class: 'mg-banner ' + (win ? 'win' : 'lose') },
    h('b', {}, win ? 'Blast unlocked!' : 'Fizzle…'), h('span', {}, msg)));
  await sleep(1600);
}

export function hearts(n, max) {
  return Array.from({ length: max }, (_, i) => icon(i < n ? 'heart' : 'heartOff'));
}
