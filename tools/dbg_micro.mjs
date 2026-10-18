import { chromium } from 'playwright';
const [id, speed = '1', n = '3'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })).newPage();
p.on('pageerror', e => console.log('ERR', e.message));
p.on('console', m => console.log('LOG', m.text()));
await p.goto('http://localhost:8080/?debug');
for (let k = 0; k < +n; k++) {
  const r = await p.evaluate(async ({ id, speed }) => {
    const { runMicro } = await import('/js/micro/kit.js');
    const mod = await import('/js/micro/classic.js');
    const m = mod.default.find(x => x.id === id);
    let box = document.getElementById('__mt');
    if (!box) { box = document.createElement('div'); box.id = '__mt'; box.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#1b1424;display:flex;flex-direction:column;align-items:center;padding-top:30px'; document.body.append(box); }
    let st;
    const m2 = { ...m, setup(api) { const e = api.expose; api.expose = o => (st = e(o)); m.setup(api); } };
    const log = [];
    const iv = setInterval(() => st && log.push(window.__snap ? window.__snap(st) : ''), 100);
    const ok = await runMicro(box, m2, { speed: +speed, autoplay: true });
    clearInterval(iv);
    return { ok, st: JSON.stringify(st, (k, v) => (v instanceof Element ? 'el' : typeof v === 'number' ? Math.round(v * 10) / 10 : v)).slice(0, 900) };
  }, { id, speed });
  console.log(r.ok, r.st);
}
await b.close();
