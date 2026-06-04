const CACHE = 'juz-amma-v3';
const SHELL = [
  './index.html',
  './juz-amma-manifest.json',
  './juz-amma-icon-192.png',
  './juz-amma-icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u).catch(()=>{}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Audio is served from IndexedDB via blob URL — SW only handles app shell
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('.mp3')) return; // let audio go to network/IDB blob
  e.respondWith(
    caches.match(e.request).then(c =>
      c || fetch(e.request).then(r => {
        if (r.ok) caches.open(CACHE).then(cache => cache.put(e.request, r.clone()));
        return r;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
