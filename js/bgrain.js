// Faint rain behind the whole UI, rendered at 1/3 resolution for chunky pixels.
export function startBgRain(canvas) {
  const ctx = canvas.getContext('2d');
  let w, h, drops = [];
  function resize() {
    w = canvas.width = Math.ceil(innerWidth / 3);
    h = canvas.height = Math.ceil(innerHeight / 3);
    drops = Array.from({ length: Math.floor((w * h) / 160) }, () => ({
      x: Math.random() * w, y: Math.random() * h, v: 1.2 + Math.random() * 1.8, l: 2 + ((Math.random() * 3) | 0),
    }));
  }
  resize();
  addEventListener('resize', resize);
  (function frame() {
    ctx.fillStyle = '#120d1a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(110,140,200,0.28)';
    for (const d of drops) {
      d.y += d.v; d.x -= d.v * 0.25;
      if (d.y > h) { d.y = -d.l; d.x = Math.random() * (w + 20); }
      ctx.fillRect(d.x | 0, d.y | 0, 1, d.l);
    }
    requestAnimationFrame(frame);
  })();
}
