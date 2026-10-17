import { iconURL } from './sprites.js';

export const $ = (s, r = document) => r.querySelector(s);

export function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) {
    if (k == null || k === false) continue;
    e.append(k.nodeType ? k : document.createTextNode(k));
  }
  return e;
}

export const icon = (name, cls = 'ico') => h('img', { src: iconURL(name), class: cls, alt: '' });

export function hydrateIcons(root = document) {
  root.querySelectorAll('img[data-icon]').forEach(i => {
    i.src = iconURL(i.dataset.icon);
    i.classList.add('ico');
    i.alt = '';
  });
}

// One modal at a time. Buttons close the modal unless keepOpen is set.
export function showModal({ title, body, buttons = [], cls = '' }) {
  const root = $('#modal');
  root.innerHTML = '';
  const close = () => { root.hidden = true; root.innerHTML = ''; };
  const panel = h('div', { class: 'panel ' + cls },
    title && h('h2', {}, title),
    h('div', { class: 'body' }, body),
    buttons.length && h('div', { class: 'btns' }, buttons.map(b =>
      h('button', {
        class: 'btn ' + (b.cls || ''),
        disabled: b.disabled,
        onclick: () => { if (!b.keepOpen) close(); b.onClick && b.onClick(close); },
      }, b.label))),
  );
  root.append(panel);
  root.hidden = false;
  return close;
}

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

export const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
