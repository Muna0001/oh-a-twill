/* Oh a Twill service worker: offline app shell.
 *
 * This file is a template. `scripts/export-web.mjs` replaces the placeholder below with the
 * build's precache list (every file of the export, with its hashed name) and a version id.
 * The app has no runtime network calls, so everything it needs is in that list.
 *
 * - install: download the whole list into a cache named after the version. No skipWaiting:
 *   a new version waits until every tab of the old one is closed and takes over on the next
 *   launch, so a running session never mixes old and new bundles.
 * - activate: delete caches of older versions; claim open pages on the very first install.
 * - fetch: navigations get the cached index.html (every route works offline); other requests
 *   are cache-first (all bundles, fonts and images have content hashes in their names).
 * - message 'version': reply with the version, so the page can show "Updated" once.
 */
const BUILD = '__OH_A_TWILL_PRECACHE__';

const PREFIX = 'oh-a-twill-';
const ready = typeof BUILD === 'object' && BUILD !== null;
const CACHE = ready ? PREFIX + BUILD.version : PREFIX + 'unbuilt';
const SHELL = ready ? BUILD.base + '/index.html' : '';

self.addEventListener('install', (event) => {
  if (!ready) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(BUILD.files.map((url) => new Request(url, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'version' && event.ports && event.ports[0]) {
    event.ports[0].postMessage(ready ? BUILD.version : null);
  }
});

async function fromCache(request) {
  const cache = await caches.open(CACHE);
  return cache.match(request);
}

async function cacheFirst(request) {
  const hit = await fromCache(request);
  if (hit) return hit;
  const response = await fetch(request);
  // Keep any same-origin file the precache list missed (e.g. an image Metro added late).
  if (response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

async function navigate(request) {
  // A request for a real file (e.g. the manifest typed into the address bar) gets that file.
  const exact = await fromCache(request);
  if (exact) return exact;
  const shell = await fromCache(SHELL);
  if (shell) return shell;
  return fetch(request);
}

self.addEventListener('fetch', (event) => {
  if (!ready) return;
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BUILD.base + '/')) return;
  event.respondWith(request.mode === 'navigate' ? navigate(request) : cacheFirst(request));
});
