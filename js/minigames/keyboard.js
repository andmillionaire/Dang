import { h } from '../ui.js';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM⌫'];

// On-screen letter keyboard. Keys fire on touch-down (no iOS tap delay or double-tap zoom);
// keyboard activation (Enter/Space on a focused key) still works through click.
export function keyboard(onKey) {
  const key = k => {
    const b = h('button', { type: 'button', class: 'kb-key' + (k === '⌫' ? ' wide' : ''), 'aria-label': k === '⌫' ? 'Delete' : k }, k === '⌫' ? 'DEL' : k);
    const up = () => b.classList.remove('down');
    let downAt = -1e9;
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      downAt = performance.now();
      b.classList.add('down');
      onKey(k);
    });
    b.addEventListener('pointerup', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('pointercancel', up);
    // A tap also produces a click; only count clicks with no touch-down just before (Enter/Space).
    b.addEventListener('click', () => { if (performance.now() - downAt > 800) onKey(k); });
    return b;
  };
  return h('div', { class: 'kb' }, ROWS.map(r => h('div', { class: 'kb-row' }, [...r].map(key))));
}
