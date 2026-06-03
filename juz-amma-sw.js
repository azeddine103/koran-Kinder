const CACHE = 'juz-amma-v3';
const AUDIO = 'juz-amma-audio-v3';
const BASE_AUDIO = 'https://cdn.islamic.network/quran/audio/128/ar.shaatree/';

// App shell files
const SHELL = [
  './index.html',
  './juz-amma-manifest.json',
  './juz-amma-icon-192.png',
  './juz-amma-icon-512.png',
  './juz-amma-icon-1024.png',
];

// All 564 audio global ayah numbers (Surahs 78–114)
const AUDIO_NUMS = [];
for (let i = 5673; i <= 6236; i++) AUDIO_NUMS.push(i);

// ── Install: cache app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(SHELL.map(u => cache.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches, start audio pre-cache ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== AUDIO).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => precacheAudio())
  );
});

// Pre-cache all audio in background (non-blocking batches)
async function precacheAudio() {
  const cache = await caches.open(AUDIO);
  let done = 0;
  const BATCH = 5; // fetch 5 at a time
  for (let i = 0; i < AUDIO_NUMS.length; i += BATCH) {
    const batch = AUDIO_NUMS.slice(i, i + BATCH);
    await Promise.allSettled(batch.map(async n => {
      const url = BASE_AUDIO + n + '.mp3';
      const cached = await cache.match(url);
      if (!cached) {
        try {
          const res = await fetch(url);
          if (res.ok) { await cache.put(url, res); done++; }
        } catch (_) {}
      } else {
        done++;
      }
    }));
    // Notify clients of progress
    const clients = await self.clients.matchAll();
    clients.forEach(c => c.postMessage({ type: 'AUDIO_PROGRESS', done, total: AUDIO_NUMS.length }));
    await new Promise(r => setTimeout(r, 50)); // small pause between batches
  }
  const clients = await self.clients.matchAll();
  clients.forEach(c => c.postMessage({ type: 'AUDIO_DONE', total: AUDIO_NUMS.length }));
}

// ── Fetch ──
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Audio: cache-first, then network
  if (url.includes('cdn.islamic.network') && url.includes('.mp3')) {
    event.respondWith(
      caches.open(AUDIO).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(res => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          }).catch(() => new Response('', { status: 503 }));
        })
      )
    );
    return;
  }

  // Everything else: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res.ok) {
          caches.open(CACHE).then(c => c.put(event.request, res.clone()));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

// Handle messages from app
self.addEventListener('message', event => {
  if (event.data === 'PRECACHE_AUDIO') precacheAudio();
});
