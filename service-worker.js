const CACHE_NAME = 'shift-clock-push-v1';
const CLIENT_SCRIPT_TAG = '<script type="module" src="./push-client.js"></script>';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  ]));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(req, { cache: 'no-store' });
        const type = response.headers.get('content-type') || '';
        if (!type.includes('text/html')) return response;
        let html = await response.text();
        if (!html.includes('push-client.js')) {
          html = html.replace('</body>', `${CLIENT_SCRIPT_TAG}\n</body>`);
        }
        const headers = new Headers(response.headers);
        headers.delete('content-length');
        headers.set('cache-control', 'no-store');
        return new Response(html, { status: response.status, statusText: response.statusText, headers });
      } catch (err) {
        return fetch(req);
      }
    })());
  }
});

self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const title = event.data.title || 'שכחת לסגור את המשמרת?';
    const options = event.data.options || {};
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) {}

  const data = payload.data || {};
  const notification = payload.notification || {};
  const title = notification.title || data.title || 'שכחת לסגור את המשמרת?';
  const body = notification.body || data.body || 'עברו 8 שעות ו־30 דקות מאז תחילת המשמרת. אם כבר סיימת, אל תשכח לסגור אותה.';

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: data.tag || 'forgotten-shift-8h30',
    renotify: true,
    requireInteraction: true,
    data: { ...data, url: data.url || './' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    for (const client of clients) {
      if ('navigate' in client) {
        try { await client.navigate(target); } catch (_) {}
      }
      if ('focus' in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  }));
});
