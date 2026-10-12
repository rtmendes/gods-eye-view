/**
 * The Deck's service worker: keeps the dashboard shell installable and
 * quick to open. Only the Deck's own files are cached, network first so an
 * update lands on the next load; the globe, its data and /api are never
 * cached here.
 */

const CACHE = 'gev-deck-v1';
const SHELL = [
  '/deck/',
  '/deck/index.html',
  '/deck/deck.css',
  '/deck/deck.js',
  '/deck/usecases.js',
  '/deck/manifest.webmanifest',
  '/deck/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin)
    return;
  if (!url.pathname.startsWith('/deck/')) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((cached) => cached || caches.match('/deck/index.html')),
      ),
  );
});
