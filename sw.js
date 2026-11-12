// PCS Path service worker: lets the app open with no connection.
// App files: network first (so updates show up), falling back to the saved copy.
// Icons and the Supabase library from the CDN: saved copy first.
// Database calls are never cached here; store.js keeps its own offline copy.
const CACHE = 'pcspath-v12c';
const SHELL = ['./', './index.html', './app.js', './store.js', './seed.js', './config.js', './manifest.webmanifest', './icon.svg', './share.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    // no-cache: always ask GitHub Pages for the newest file, so an update
    // (like a new config.js) shows up on the next load instead of 10 minutes later.
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }

  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
