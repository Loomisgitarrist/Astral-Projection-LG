/* Astral Projection LG - Service Worker
   No cache-buster versioning on assets per user preference.
   The SW cache itself is bumped on every deploy so the old shell
   is purged and the new HTML/CSS/JS is fetched fresh.
   Strategy:
     - Precache the app shell on install.
     - Network-first for HTML (always try fresh, fall back to cache when offline).
     - Cache-first for static assets (icons, images, css, js).
     - On activate, purge any old cache from a previous version of this SW.
*/

const CACHE_NAME = 'astral-lg-shell-v16';

const SHELL = [
  './',
  './index.html',
  './de.html',
  './styles.css',
  './app.js',
  './app-audio.js',
  './manifest.webmanifest',
  './images/icon-192.png',
  './images/icon-512.png',
  './images/icon-maskable.png',
  './images/apple-touch-icon.png',
  './images/banner.png',
  './images/og-banner.png',
  './images/whatsapp-300x200.png',
  './audio/tracks/01-binaural-4hz-15min.opus',
  './audio/tracks/induction-en.mp3',
  './audio/tracks/induction-de.mp3',
  './audio/tracks/03-drone-ambient-15min.opus',
  './video/background.mp4'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for navigations + HTML, fall back to cache.
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for everything else.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
