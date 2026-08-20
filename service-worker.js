// Emergency recovery service worker.
// This intentionally stops intercepting the app and unregisters itself so the
// original index.html is served unchanged. Existing localStorage data is not
// deleted or modified.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    } catch (_) {}

    try {
      await self.registration.unregister();
    } catch (_) {}

    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        try { client.postMessage({ type: 'SHIFT_CLOCK_SW_REMOVED' }); } catch (_) {}
      }
    } catch (_) {}
  })());
});

// No fetch handler on purpose: all requests go directly to the network.
