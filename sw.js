// Service worker per accesso offline (strategia cache-first per la shell).
const CACHE = 'viaggio-v4';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // aggiunge i file uno a uno: se uno fallisce non blocca gli altri
    await Promise.all(SHELL.map((u) => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // le chiamate a GitHub (dati/backup) vanno sempre in rete, mai in cache
  if (url.hostname.includes('github')) return;
  if (url.origin !== self.location.origin) return;

  // Pagina (navigazione): PRIMA LA CACHE, aggiorna in sottofondo.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cached = await caches.match('./index.html');
      const net = fetch(req).then((r) => {
        caches.open(CACHE).then((c) => c.put('./index.html', r.clone())).catch(() => {});
        return r;
      }).catch(() => null);
      return cached || (await net) || caches.match('./index.html');
    })());
    return;
  }

  // Altri file locali: prima la cache, poi la rete.
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const r = await fetch(req);
      caches.open(CACHE).then((c) => c.put(req, r.clone())).catch(() => {});
      return r;
    } catch (err) {
      return cached;
    }
  })());
});
