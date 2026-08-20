/* Shift Clock background push worker.
 * Firebase configuration will be inserted after the Firebase Web App is created.
 * Do not place Firebase Admin/service-account secrets in this file.
 */

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) {}

  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || 'שכחת לסגור את המשמרת?';
  const options = {
    body: notification.body || 'עברו 8 שעות ו־30 דקות מאז תחילת המשמרת.',
    tag: data.tag || 'forgotten-shift-8h30',
    renotify: true,
    requireInteraction: true,
    data: { ...data, url: data.url || './' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    })
  );
});
