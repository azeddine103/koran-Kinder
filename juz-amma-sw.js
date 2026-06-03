// Juz Amma Kinder — Service Worker v2
const CACHE = 'juz-amma-v2';
const AUDIO = 'juz-amma-audio-v2';

// Files to cache immediately on install (app shell)
const SHELL = [
  './index.html',
  './juz-amma-manifest.json',
  './juz-amma-icon-192.png',
  './juz-amma-icon-512.png',
  './juz-amma-icon-1024.png',
];

// ── Install: cache app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(SHELL.map(url =>
        cache.add(url).catch(e => console.warn('Shell cache miss:', url, e))
      ))
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE && k !== AUDIO).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ──
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Audio: cache-first, then network (cache on success)
  if (url.includes('cdn.islamic.network') && url.includes('.mp3')) {
    event.respondWith(
      caches.open(AUDIO).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(res => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          }).catch(() => new Response('', {status: 503}));
        })
      )
    );
    return;
  }

  // App shell & everything else: cache-first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() =>
        // Offline fallback: serve main HTML
        caches.match('./juz-amma-kinder.html')
      );
    })
  );
});
