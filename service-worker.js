const CACHE_NAME = 'shift-clock-push-v2';
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

function patchAppHtml(html) {
  // The old static-site reminder used midnight/22:00 and only worked while the page was alive.
  // Disable it in the served page so it cannot duplicate the new remote 8:30 push reminder.
  html = html.replace(
    /function checkForgottenShiftNotification\(\)\{[\s\S]*?\n  \}\n  setInterval\(checkForgottenShiftNotification, 60\*1000\);/,
    "function checkForgottenShiftNotification(){ /* remote push reminder handles this now */ }"
  );

  html = html.replace(
    '🔔 התראה אם משמרת נשארה פתוחה (00:00 בימי חול, 22:00 בשישי-שבת)',
    '🔔 התראה אחרי 8 שעות ו־30 דקות אם המשמרת עדיין פתוחה'
  );
  html = html.replace(
    'לא מובטח - עובד רק כשהדפדפן פתוח ברקע, לא כשהאפליקציה סגורה לגמרי.',
    'Push מרחוק — יכול להגיע גם כשהאפליקציה סגורה לגמרי.'
  );

  if (!html.includes('push-client.js')) {
    html = html.replace('</body>', `${CLIENT_SCRIPT_TAG}\n</body>`);
  }
  return html;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(req, { cache: 'no-store' });
        const type = response.headers.get('content-type') || '';
        if (!type.includes('text/html')) return response;
        const html = patchAppHtml(await response.text());
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
