// Crisp pixel canvases: draw in "logical" pixels, scaled by an integer factor where possible.

export function fitCanvas(canvas, lw, lh) {
  const host = canvas.parentElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const aw = host.clientWidth * dpr, ah = host.clientHeight * dpr;
  let s = Math.min(aw / lw, ah / lh);
  if (s >= 2) s = Math.floor(s);
  s = Math.max(s, 0.5);
  canvas.width = Math.floor(lw * s);
  canvas.height = Math.floor(lh * s);
  canvas.style.width = canvas.width / dpr + 'px';
  canvas.style.height = canvas.height / dpr + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return { ctx, scale: s };
}

export function toLogical(canvas, lw, lh, e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * lw, y: ((e.clientY - r.top) / r.height) * lh };
}

// Deterministic 0..1 noise from a number.
export function hash(n) {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function tween(ms, fn, ease = t => t) {
  return new Promise(res => {
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / ms);
      fn(ease(t));
      if (t < 1) requestAnimationFrame(step);
      else res();
    };
    requestAnimationFrame(step);
  });
}

export const ease = {
  inOut: t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inQuad: t => t * t,
  outBack: t => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2,
};
