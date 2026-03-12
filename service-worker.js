// Clean reset package: disable offline cache and unregister old service workers quickly.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', () => {
  // no-op: always use network
});
