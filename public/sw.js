/*
 * App-shell cache, nothing more.
 *
 * Deliberately not a data cache: state lives in localStorage, so there is no API to
 * cache and nothing to reconcile. This exists so the planner opens with no network —
 * which is the situation it was designed for, standing in a supermarket queue.
 *
 * It also does not do push. Alerts that fire with the app closed need a push server
 * behind them; see ADR-001 §9.2.
 */

const VERSION = 'pp-shell-v1';

self.addEventListener('install', (event) => {
  // The hashed asset URLs are unknown here, so only the entry is pre-cached; the rest
  // populate on first visit.
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(['/', '/index.html'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first, so a deploy is picked up, falling back to the shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          void caches.open(VERSION).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r ?? Response.error())),
    );
    return;
  }

  // Hashed assets never change under the same URL, so cache first is safe and fast.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            void caches.open(VERSION).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
