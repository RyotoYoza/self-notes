/**
 * Tombstone service worker.
 *
 * The app used to be served from this scope. Browsers that visited it still
 * have that worker installed, and a stale worker will keep serving its
 * precached copy of the old app forever — the new landing page would never
 * appear. Replacing it with this one clears those caches, unregisters, and
 * reloads any open tab onto the real page.
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) client.navigate(client.url);
    })(),
  );
});
