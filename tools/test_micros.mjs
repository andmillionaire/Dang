// Plays every microgame with its own solve() in a real browser to prove each one can be won.
// Usage: node tools/test_micros.mjs [module ...] [--ids a,b] [--trials 3] [--shots dir] [--real | --touch] [--jitter ms]
// --real drives the games with real browser mouse input (true hit-testing and pointer capture)
// instead of events dispatched straight at elements; --touch does the same with a real touchscreen.
// Needs the dev server on :8080 (node server/server.js) and Playwright.
import { chromium } from 'playwright';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const mods = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const ids = opt('--ids', '') ? opt('--ids').split(',') : null;
const trials = +opt('--trials', 3);
const shots = opt('--shots', '');
const touchInput = args.includes('--touch');
// --jitter ms: each press and release lands a random 0..ms late, like a human's timing. A game that
// fails under ~120 ms of jitter asks for more precision than a person has.
const jitter = +opt('--jitter', 0);
const realInput = args.includes('--real') || touchInput;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
if (realInput) {
  // input arrives in order from the page; play it back in that order
  let chain = Promise.resolve(), touching = false;
  const cdp = touchInput ? await p.context().newCDPSession(p) : null;
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  let latestMove = null;
  await p.exposeFunction('__realInputBinding', (type, x, y) => {
    // like a real touchscreen, a burst of moves collapses to the newest one
    if (type === 'pointermove') {
      const queued = latestMove;
      latestMove = { x, y };
      if (queued) return chain;
      chain = chain.then(async () => {
        const m = latestMove; latestMove = null;
        if (!m) return;
        if (touchInput) { if (touching) await touch('touchMove', m.x, m.y); } else await p.mouse.move(m.x, m.y);
      }).catch(() => {});
      return chain;
    }
    chain = chain.then(async () => {
      if (jitter && type !== 'pointermove') await new Promise(r => setTimeout(r, Math.random() * jitter));
      if (touchInput) {
        // a finger: moves only count while it's down
        if (type === 'pointerdown') { touching = true; await touch('touchStart', x, y); }
        else if (type === 'pointermove') { if (touching) await touch('touchMove', x, y); }
        else if (type === 'pointerup') { if (touching) { touching = false; await touch('touchEnd', x, y); } }
        return;
      }
      await p.mouse.move(x, y);
      if (type === 'pointerdown') await p.mouse.down();
      else if (type === 'pointerup') await p.mouse.up();
    }).catch(() => {});
    return chain;
  });
  await p.addInitScript(() => { globalThis.__realInput = (...a) => globalThis.__realInputBinding(...a); });
}
await p.goto('http://localhost:8080/?debug');
await p.waitForTimeout(400);
const list = await p.evaluate(async ({ mods, ids }) => {
  const all = [];
  for (const m of mods.length ? mods : ['/js/micro/index.js']) {
    const mod = await import(m);
    const arr = mod.ALL || mod.default || [...(mod.MICROS || []), ...(mod.WORD_MICROS || [])];
    for (const x of arr) all.push(x);
  }
  window.__micros = ids ? all.filter(x => ids.includes(x.id)) : all;
  return window.__micros.map(x => ({ id: x.id, cmd: x.cmd, theme: x.theme, time: x.time || 5, boss: !!x.boss, solve: !!x.solve, timeoutWins: !!x.timeoutWins }));
}, { mods, ids });
const seen = new Set();
let bad = 0;
for (const [k, m] of list.entries()) {
  const problems = [];
  if (seen.has(m.id)) problems.push('duplicate id');
  seen.add(m.id);
  if (!m.solve) problems.push('no solve()');
  if (m.time > (m.boss ? 30 : 15)) problems.push(m.boss ? 'boss time > 30s' : 'time > 15s');
  if (!m.theme) problems.push('no theme');
  const results = [];
  for (const speed of [...Array(trials).fill(1), 2]) {
    const before = errs.length;
    const shot = shots && speed === 1 && results.length === 0;
    const run = p.evaluate(async ({ k, speed }) => {
      const { runMicro } = await import('/js/micro/kit.js');
      let box = document.getElementById('__mt');
      if (!box) { box = document.createElement('div'); box.id = '__mt'; box.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#1b1424;display:flex;flex-direction:column;align-items:center;padding-top:30px'; document.body.append(box); }
      const t0 = performance.now();
      const ok = await runMicro(box, window.__micros[k], { speed, autoplay: true });
      return { ok, secs: Math.round((performance.now() - t0) / 100) / 10 };
    }, { k, speed });
    if (shot) { await p.waitForTimeout(900); await p.screenshot({ path: `${shots}/${String(k).padStart(3, '0')}-${m.id}.png`, clip: { x: 0, y: 0, width: 390, height: 460 } }); }
    const r = await run;
    results.push(r.ok ? 'W' : 'L');
    if (errs.length > before) problems.push(...errs.slice(before));
  }
  const fails = results.filter(r => r === 'L').length;
  if (fails) problems.push(`lost ${fails}/${results.length} (${results.join('')})`);
  if (problems.length) bad++;
  console.log(`${problems.length ? '✗' : '✓'} ${m.id.padEnd(18)} ${m.theme?.padEnd(8)} ${String(m.time).padStart(2)}s ${m.boss ? 'BOSS ' : ''}${m.cmd}${problems.length ? '  ← ' + [...new Set(problems)].join(' | ') : ''}`);
}
console.log(`${list.length} microgames, ${bad} with problems`);
await b.close();
process.exit(bad ? 1 : 0);
