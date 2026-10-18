import { S, persist, onPersist, localBackups, replaceSave, LOAD_FAILED } from './state.js';
import { h, showModal, toast } from './ui.js';

// Cloud saves: your save is copied to the server under a save code (five easy words). If the
// phone's storage is ever wiped (deleting the home-screen app, clearing Safari data, a new phone),
// enter the code to get everything back. Plus local backups and a backup file you can keep.

const WORDS = ('moon star rain cloud quilt cocoa fern kitten puppy maple honey biscuit candle lantern acorn pumpkin ' +
  'cotton wheat tulip daisy clover meadow river willow pebble ribbon tiara wand comet saturn velvet button ' +
  'muffin waffle teapot kettle cabin attic porch window blanket slipper sweater mitten scarf cozy sleepy ' +
  'thunder drizzle puddle rainbow sunny misty breeze ember spark glow twinkle shimmer sparkle bubble ' +
  'cherry berry peach plum melon mango lemon cookie toffee caramel mocha latte sugar pepper ginger').split(' ');

const DEBOUNCE = 5000;
let timer = 0, busy = false;

export function saveCode() {
  if (!S.cloud || !S.cloud.code) {
    const pick = () => WORDS[crypto.getRandomValues(new Uint32Array(1))[0] % WORDS.length];
    S.cloud = { code: `${pick()}-${pick()}-${pick()}-${pick()}-${10 + (crypto.getRandomValues(new Uint8Array(1))[0] % 90)}`, at: 0 };
  }
  return S.cloud.code;
}
const cleanCode = s => String(s || '').toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');

async function api(path, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(path, { ...opts, signal: ctl.signal, headers: { 'Content-Type': 'application/json' } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.error || res.status), { status: res.status });
    return body;
  } finally { clearTimeout(t); }
}

// Upload now. Resolves true if the server has it.
export async function backupNow() {
  if (!S.hero || busy || LOAD_FAILED) return false;
  busy = true;
  try {
    const code = saveCode();
    const r = await api('api/save', { method: 'POST', body: JSON.stringify({ code, data: S }) });
    S.cloud.at = r.at;
    try { localStorage.setItem('dang-cabin-v1', JSON.stringify(S)); } catch { /* keep going */ }
    return true;
  } catch { return false; } finally { busy = false; }
}

// Back up a few seconds after anything changes, and when the app goes to the background.
export function startAutoBackup() {
  onPersist(() => { clearTimeout(timer); timer = setTimeout(backupNow, DEBOUNCE); });
  addEventListener('visibilitychange', () => { if (document.hidden && S.hero) backupNow(); });
  if (S.hero) setTimeout(backupNow, 3000);
  if (LOAD_FAILED) setTimeout(() => toast('Your save couldn’t be read, so it was set aside safely. Open ☁ Save to restore a backup.'), 1500);
}

export async function fetchCloud(code, v = 0) {
  return api(`api/save?${new URLSearchParams({ code: cleanCode(code), ...(v ? { v } : {}) })}`);
}

function downloadFile() {
  const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `dang-save-day${S.day}.json` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function pickFile() {
  const input = h('input', { type: 'file', accept: '.json,application/json' });
  input.addEventListener('change', async () => {
    const f = input.files[0];
    if (!f) return;
    try { confirmRestore(await f.text(), `the file ${f.name}`); } catch (e) { toast(e.message); }
  });
  input.click();
}

const when = at => new Date(at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function confirmRestore(data, from) {
  const obj = typeof data === 'string' ? JSON.parse(data) : data;
  showModal({
    title: 'Restore this save?',
    body: h('div', {},
      h('p', {}, `From ${from}: ${obj.hero ? obj.hero.name : '?'}, day ${obj.day}, ${obj.coins} coins.`),
      h('p', { class: 'muted small' }, 'Your current progress is kept as a local backup first, just in case.')),
    buttons: [{ label: 'Cancel' }, { label: 'Restore', cls: 'primary', onClick: () => { try { replaceSave(obj); } catch (e) { toast(e.message); } } }],
  });
}

// Restore by save code: shows the latest cloud save and its older versions.
export function restoreFromCode(prefill = '') {
  const input = h('input', { class: 'name-input', placeholder: 'e.g. moon-quilt-cocoa-fern-42', value: prefill, autocapitalize: 'none', autocomplete: 'off', spellcheck: 'false' });
  const out = h('div', { class: 'cs-versions' });
  const look = async () => {
    out.replaceChildren(h('p', { class: 'muted' }, 'Looking…'));
    try {
      const r = await fetchCloud(input.value);
      out.replaceChildren(...r.versions.map((v, i) => h('button', {
        class: 'btn cs-ver', onclick: async () => { try { const got = i ? await fetchCloud(input.value, i) : r; confirmRestore(got.data, `your cloud save (${when(v.at)})`); } catch (e) { toast(e.message); } },
      }, h('b', {}, i ? when(v.at) : `Latest · ${when(v.at)}`), h('small', {}, `${v.name || '?'} · day ${v.day} · ${v.coins} coins`))));
    } catch (e) {
      out.replaceChildren(h('p', { class: 'note' }, e.status === 404 ? 'No save with that code.' : e.status === 400 ? 'That code doesn’t look right: five parts like moon-quilt-cocoa-fern-42.' : 'Couldn’t reach the save server.'));
    }
  };
  showModal({
    title: 'Restore from save code',
    body: h('div', { class: 'cs' }, h('p', {}, 'Type the save code shown in ☁ Save on your old phone or app.'), input, h('button', { class: 'btn primary', onclick: look }, 'Find my save'), out),
    buttons: [{ label: 'Close' }],
  });
  if (prefill) look();
}

// The ☁ Save menu.
export function openSaveMenu() {
  const code = saveCode();
  persist();
  const status = h('p', { class: 'muted small' }, S.cloud.at ? `Last cloud backup: ${when(S.cloud.at)}` : 'Not backed up to the cloud yet.');
  const codeEl = h('button', { class: 'cs-code', onclick: async () => { try { await navigator.clipboard.writeText(code); toast('Save code copied.'); } catch { toast(code); } } }, code);
  const locals = localBackups();
  showModal({
    title: '☁ Your save',
    body: h('div', { class: 'cs' },
      h('p', {}, 'Your save code. Write it down or screenshot it: it brings your game back on any phone, even if this one is wiped.'),
      codeEl,
      h('p', { class: 'muted small' }, 'Tap the code to copy it.'),
      status,
      h('div', { class: 'cs-row' },
        h('button', { class: 'btn small primary', onclick: async () => { status.textContent = 'Backing up…'; status.textContent = (await backupNow()) ? `Backed up just now (${when(S.cloud.at)}).` : 'Couldn’t reach the save server. Your save is still on this phone.'; } }, 'Back up now'),
        h('button', { class: 'btn small', onclick: () => restoreFromCode() }, 'Restore from code')),
      h('div', { class: 'cs-row' },
        h('button', { class: 'btn small', onclick: downloadFile }, 'Download backup file'),
        h('button', { class: 'btn small', onclick: pickFile }, 'Restore from file')),
      locals.length && h('p', { class: 'slot-label' }, 'Backups on this phone'),
      locals.length && h('div', { class: 'cs-versions' }, locals.map(b => h('button', { class: 'btn cs-ver', onclick: () => confirmRestore(b.raw, `a phone backup (${when(b.at)})`) },
        h('b', {}, when(b.at)), h('small', {}, `day ${b.day} · ${b.coins} coins`))))),
    buttons: [{ label: 'Done', cls: 'primary' }],
  });
}
