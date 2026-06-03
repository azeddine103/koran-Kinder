// Juz Amma Kinder – Service Worker
const CACHE = 'juz-amma-v1';
const AUDIO_CACHE = 'juz-amma-audio-v1';

const STATIC = [
  './index.html',
  'https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700;800&family=Amiri:wght@400;700&display=swap',
  'https://fonts.gstatic.com/s/baloo2/v21/wXK0E3kTposypRyd11_WAewrhR8.woff2',
  'https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHpUrtLYQ6w.woff2',
];

// Install – cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return Promise.allSettled(STATIC.map(url => c.add(url).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

// Activate – clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== AUDIO_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Audio: network-first, cache on success
  if (url.includes('cdn.islamic.network') && url.endsWith('.mp3')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(AUDIO_CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Fonts: cache-first
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached ||
        fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // HTML: network-first, fallback to cache
  if (url.endsWith('.html') || url === self.location.origin + '/') {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Default: cache-first
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});
