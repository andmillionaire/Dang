// Offline-first service worker. Bump VERSION whenever app files change.
const VERSION = 'dang-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/main.js', 'js/state.js', 'js/data.js', 'js/ui.js', 'js/audio.js', 'js/pixel.js',
  'js/sprites.js', 'js/spritedata.js', 'js/bgrain.js', 'js/rainview.js',
  'js/match3.js', 'js/cabin.js', 'js/farm.js',
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
