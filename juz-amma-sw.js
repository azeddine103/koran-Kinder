// Juz Amma Kinder — Service Worker v3
const CACHE = 'juz-amma-v3';
const AUDIO = 'juz-amma-audio-v3';

const SHELL = [
  './juz-amma-kinder.html',
  './juz-amma-manifest.json',
  './juz-amma-icon-192.png',
  './juz-amma-icon-512.png',
  './juz-amma-icon-1024.png',
];

// ── Install: cache app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(SHELL.map(u => cache.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== AUDIO).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: serve from cache, fallback to network ──
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Audio: cache-first (pre-cached by main app on startup)
  if (url.includes('cdn.islamic.network') && url.includes('.mp3')) {
    event.respondWith(
      caches.open(AUDIO).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          // Not cached yet — fetch and cache for next time
          return fetch(event.request).then(res => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          }).catch(() => new Response('', { status: 503 }));
        })
      )
    );
    return;
  }

  // App shell: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() => caches.match('./juz-amma-kinder.html'));
    })
  );
});
