/**
 * Retire the legacy cache, which held both old HTML and GET API responses.
 * Keep this update at /sw.js so previously installed workers can receive it.
 * Requests use the browser network; offline response caching is disabled.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.delete('sovereign-v1').then(() => self.clients.claim())
  );
});

// Deliberately no fetch handler: never persist or replay page/API responses.
