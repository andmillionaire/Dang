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

// Animate a number in an element from what it shows now to `to`, with a little bump.
export function countTo(el, to) {
  const from = Number(el.dataset.v ?? el.textContent) || 0;
  el.dataset.v = to;
  if (from === to) { el.textContent = to; return; }
  const host = el.closest('.res, .pill') || el;
  host.classList.remove('bump'); void host.offsetWidth; host.classList.add('bump');
  const t0 = performance.now(), dur = Math.min(700, 200 + Math.abs(to - from) * 8);
  const step = now => {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = Math.round(from + (to - from) * (1 - (1 - k) ** 3));
    if (k < 1 && el.dataset.v == to) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// A burst of pixel sparkles flying out of an element (DOM, for mini-games and menus).
export function sparkle(el, { count = 10, colors = ['#ffe27a', '#f08ab0', '#9fd3f2', '#fff4e0'] } = {}) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const s = document.createElement('i');
    s.className = 'spark';
    const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 30;
    s.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;background:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
    document.body.append(s);
    setTimeout(() => s.remove(), 650);
  }
}

// Pixel confetti over the whole screen.
export function confetti(n = 70) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#ffe27a', '#f08ab0', '#9fd3f2', '#a46ad0', '#6fb04a', '#f39a3a'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    const dur = 1400 + Math.random() * 1200;
    c.style.cssText = `left:${Math.random() * 100}vw;background:${colors[i % colors.length]};animation-duration:${dur}ms;animation-delay:${Math.random() * 300}ms;--drift:${(Math.random() - 0.5) * 120}px;--spin:${(Math.random() - 0.5) * 720}deg`;
    document.body.append(c);
    setTimeout(() => c.remove(), dur + 400);
  }
}

export const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
