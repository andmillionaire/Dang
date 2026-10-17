// Offline-first service worker. Bump VERSION whenever app files change.
const VERSION = 'dang-0.11.2'; // keep in step with js/version.js
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/arcade/arcade.js',
  'js/arcade/meowdoku-levels.js',
  'js/audio.js',
  'js/bedroom.js',
  'js/bgrain.js',
  'js/cabin.js',
  'js/creator.js',
  'js/data.js',
  'js/farm.js',
  'js/hero.js',
  'js/herodata.js',
  'js/leaderboard.js',
  'js/main.js',
  'js/match3.js',
  'js/meowdoku-engine.js',
  'js/meowdokuboard.js',
  'js/minigames/catsnap.js',
  'js/minigames/cattactoe.js',
  'js/minigames/common.js',
  'js/minigames/crossword.js',
  'js/minigames/index.js',
  'js/minigames/keyboard.js',
  'js/minigames/mewdoku.js',
  'js/minigames/micro.js',
  'js/minigames/microtac.js',
  'js/minigames/peggle.js',
  'js/minigames/tictactoe.js',
  'js/minigames/words3.js',
  'js/minigames/wordtactoe.js',
  'js/pantry.js',
  'js/pet.js',
  'js/phone.js',
  'js/pixel.js',
  'js/rainview.js',
  'js/spritedata.js',
  'js/sprites.js',
  'js/state.js',
  'js/ui.js',
  'js/version.js',
  'js/vn.js',
  'js/wardrobe.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate: instant loads from cache, refreshed in the background.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('/api/')) return; // leaderboard is always live
  const cacheable = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!cacheable) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: url.origin === location.origin });
    const fresh = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    }).catch(() => hit || (req.mode === 'navigate' ? cache.match('index.html') : undefined));
    return hit || fresh;
  }));
});
